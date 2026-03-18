const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_HISTORY = 100;
const rooms = new Map();
const sockets = new Set();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function getRoom(roomId) {
  const normalized = sanitizeRoomId(roomId);
  if (!normalized) {
    return null;
  }

  if (!rooms.has(normalized)) {
    rooms.set(normalized, {
      id: normalized,
      createdAt: Date.now(),
      history: [],
      clients: new Set(),
    });
  }

  return rooms.get(normalized);
}

function sanitizeRoomId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
}

function createRoomId() {
  return crypto.randomBytes(3).toString("hex");
}

function sendJson(ws, payload) {
  if (!ws || ws.destroyed) {
    return;
  }

  ws.write(encodeFrame(JSON.stringify(payload)));
}

function broadcast(room, payload) {
  const frame = encodeFrame(JSON.stringify(payload));

  for (const client of room.clients) {
    if (!client.destroyed) {
      client.write(frame);
    }
  }
}

function encodeFrame(payload) {
  const body = Buffer.from(payload);
  const length = body.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), body]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, body]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeUInt32BE(0, 2);
  header.writeUInt32BE(length, 6);
  return Buffer.concat([header, body]);
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (!masked) {
      break;
    }

    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) {
        break;
      }
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) {
        break;
      }
      const highBits = buffer.readUInt32BE(offset + 2);
      const lowBits = buffer.readUInt32BE(offset + 6);
      if (highBits !== 0) {
        throw new Error("Frames larger than 4GB are not supported.");
      }
      payloadLength = lowBits;
      headerLength = 10;
    }

    const maskStart = offset + headerLength;
    const payloadStart = maskStart + 4;
    const frameEnd = payloadStart + payloadLength;

    if (frameEnd > buffer.length) {
      break;
    }

    const mask = buffer.subarray(maskStart, payloadStart);
    const payload = buffer.subarray(payloadStart, frameEnd);
    const decoded = Buffer.alloc(payload.length);

    for (let i = 0; i < payload.length; i += 1) {
      decoded[i] = payload[i] ^ mask[i % 4];
    }

    if (opcode === 0x8) {
      messages.push({ type: "close" });
    } else if (opcode === 0x1) {
      messages.push({ type: "text", payload: decoded.toString("utf8") });
    }

    offset = frameEnd;
  }

  return {
    messages,
    remaining: buffer.subarray(offset),
  };
}

function createSystemMessage(text) {
  return {
    id: crypto.randomUUID(),
    type: "system",
    text,
    createdAt: Date.now(),
  };
}

function createChatMessage(alias, text) {
  return {
    id: crypto.randomUUID(),
    type: "chat",
    alias,
    text,
    createdAt: Date.now(),
  };
}

function trimHistory(room) {
  if (room.history.length > MAX_HISTORY) {
    room.history.splice(0, room.history.length - MAX_HISTORY);
  }
}

function addHistory(room, message) {
  room.history.push(message);
  trimHistory(room);
}

function removeClient(ws) {
  sockets.delete(ws);

  const room = ws.room;
  if (!room) {
    return;
  }

  const alias = ws.alias;
  ws.room = null;
  ws.alias = "";
  room.clients.delete(ws);

  if (alias) {
    const message = createSystemMessage(`${alias} slipped back into the shadows.`);
    addHistory(room, message);
    broadcast(room, { type: "message", message });
  }

  if (room.clients.size === 0) {
    setTimeout(() => {
      const latest = rooms.get(room.id);
      if (latest && latest.clients.size === 0) {
        rooms.delete(room.id);
      }
    }, 5 * 60 * 1000);
  }
}

function handleClientMessage(ws, rawPayload) {
  let payload;

  try {
    payload = JSON.parse(rawPayload);
  } catch {
    sendJson(ws, { type: "error", message: "Malformed payload." });
    return;
  }

  if (payload.type === "join") {
    const roomId = sanitizeRoomId(payload.roomId);
    const alias = String(payload.alias || "").trim().slice(0, 24);

    if (!roomId || !alias) {
      sendJson(ws, { type: "error", message: "Room and alias are required." });
      return;
    }

    const room = getRoom(roomId);
    ws.room = room;
    ws.alias = alias;
    room.clients.add(ws);

    sendJson(ws, {
      type: "joined",
      roomId: room.id,
      alias,
      history: room.history,
      occupantCount: room.clients.size,
    });

    const notice = createSystemMessage(`${alias} entered the room.`);
    addHistory(room, notice);
    broadcast(room, {
      type: "presence",
      occupantCount: room.clients.size,
      message: notice,
    });
    return;
  }

  if (!ws.room || !ws.alias) {
    sendJson(ws, { type: "error", message: "Join a room first." });
    return;
  }

  if (payload.type === "message") {
    const text = String(payload.text || "").trim().slice(0, 500);

    if (!text) {
      return;
    }

    const message = createChatMessage(ws.alias, text);
    addHistory(ws.room, message);
    broadcast(ws.room, {
      type: "message",
      message,
      occupantCount: ws.room.clients.size,
    });
  }
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const resolvedPath = path.normalize(path.join(PUBLIC_DIR, requestPath));

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolvedPath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(resolvedPath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/api/room")) {
    const roomId = createRoomId();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ roomId }));
    return;
  }

  serveStatic(req, res);
});

server.on("upgrade", (req, socket) => {
  const upgradeHeader = req.headers.upgrade;
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "\r\n",
    ].join("\r\n")
  );

  sockets.add(socket);
  socket.buffer = Buffer.alloc(0);
  socket.room = null;
  socket.alias = "";

  socket.on("data", (chunk) => {
    try {
      socket.buffer = Buffer.concat([socket.buffer, chunk]);
      const { messages, remaining } = decodeFrames(socket.buffer);
      socket.buffer = remaining;

      for (const message of messages) {
        if (message.type === "close") {
          socket.end();
          return;
        }

        handleClientMessage(socket, message.payload);
      }
    } catch {
      socket.end();
    }
  });

  socket.on("close", () => removeClient(socket));
  socket.on("end", () => removeClient(socket));
  socket.on("error", () => removeClient(socket));
});

function startServer(port = PORT, host = HOST) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

if (require.main === module) {
  startServer()
    .then(() => {
      console.log(`Incognito chatroom running on ${HOST}:${PORT}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  server,
  startServer,
};
