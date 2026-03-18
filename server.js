const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_HISTORY = 100;
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = 70 * 1024 * 1024;
const MAX_FILES_PER_ROOM = 12;
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
      files: new Map(),
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

function getExistingRoom(roomId) {
  const normalized = sanitizeRoomId(roomId);
  if (!normalized) {
    return null;
  }

  return rooms.get(normalized) || null;
}

function sanitizeAlias(value) {
  return String(value || "").trim().slice(0, 24);
}

function sanitizeFileName(value) {
  const normalized = path
    .basename(String(value || "").trim())
    .replace(/[<>:"/\\|?*\u0000-\u001f;]/g, "_")
    .slice(0, 120);

  return normalized || "shared-file";
}

function sanitizeContentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(normalized)) {
    return "application/octet-stream";
  }

  return normalized;
}

function sendJsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let tooLarge = false;

    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (tooLarge) {
        return;
      }

      if (totalBytes > maxBytes) {
        tooLarge = true;
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (tooLarge) {
        const error = new Error("Upload is too large.");
        error.statusCode = 413;
        reject(error);
        return;
      }

      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        const error = new Error("Malformed JSON body.");
        error.statusCode = 400;
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function createDownloadUrl(roomId, fileId) {
  return `/files/${roomId}/${fileId}`;
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

function createFileMessage(alias, file) {
  return {
    id: crypto.randomUUID(),
    type: "file",
    alias,
    fileId: file.id,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.contentType,
    url: createDownloadUrl(file.roomId, file.id),
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
    const alias = sanitizeAlias(payload.alias);

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

function createContentDisposition(fileName) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"`;
}

function isAliasConnected(room, alias) {
  for (const client of room.clients) {
    if (client.alias === alias && !client.destroyed) {
      return true;
    }
  }

  return false;
}

async function handleUpload(req, res) {
  let body;

  try {
    body = await readJsonBody(req, MAX_UPLOAD_BODY_BYTES);
  } catch (error) {
    sendJsonResponse(res, error.statusCode || 400, { error: error.message });
    return;
  }

  const room = getExistingRoom(body.roomId);
  const alias = sanitizeAlias(body.alias);
  const fileName = sanitizeFileName(body.fileName);
  const contentType = sanitizeContentType(body.contentType);
  const encodedData = String(body.data || "").trim();

  if (!room) {
    sendJsonResponse(res, 404, { error: "Room not found." });
    return;
  }

  if (!alias || !isAliasConnected(room, alias)) {
    sendJsonResponse(res, 403, { error: "Join the room before uploading files." });
    return;
  }

  if (!encodedData) {
    sendJsonResponse(res, 400, { error: "No file data was provided." });
    return;
  }

  if (room.files.size >= MAX_FILES_PER_ROOM) {
    sendJsonResponse(res, 400, { error: "This room already has the maximum number of files." });
    return;
  }

  const buffer = Buffer.from(encodedData, "base64");

  if (!buffer.length) {
    sendJsonResponse(res, 400, { error: "The uploaded file was empty." });
    return;
  }

  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    sendJsonResponse(res, 413, { error: "Files must be 50 MB or smaller." });
    return;
  }

  const file = {
    id: crypto.randomUUID(),
    roomId: room.id,
    name: fileName,
    size: buffer.length,
    contentType,
    data: buffer,
    createdAt: Date.now(),
  };

  room.files.set(file.id, file);

  const message = createFileMessage(alias, file);
  addHistory(room, message);
  broadcast(room, {
    type: "message",
    message,
    occupantCount: room.clients.size,
  });

  sendJsonResponse(res, 201, {
    ok: true,
    fileUrl: message.url,
    message,
  });
}

function handleFileDownload(req, res, pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 3) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const [, roomId, fileId] = parts;
  const room = getExistingRoom(roomId);
  const file = room ? room.files.get(fileId) : null;

  if (!file) {
    res.writeHead(404);
    res.end("File not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": file.contentType,
    "Content-Length": file.size,
    "Content-Disposition": createContentDisposition(file.name),
    "Cache-Control": "no-store",
  });
  res.end(file.data);
}

function serveStatic(req, res) {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  const requestPath = pathname === "/" ? "/index.html" : pathname;
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

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  if (pathname === "/api/room" && req.method === "GET") {
    const roomId = createRoomId();
    sendJsonResponse(res, 200, { roomId });
    return;
  }

  if (pathname === "/api/upload" && req.method === "POST") {
    await handleUpload(req, res);
    return;
  }

  if (pathname.startsWith("/files/") && req.method === "GET") {
    handleFileDownload(req, res, pathname);
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
