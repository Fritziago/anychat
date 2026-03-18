const aliasAdjectives = [
  "Silent",
  "Velvet",
  "Ghost",
  "Midnight",
  "Hidden",
  "Neon",
  "Drift",
];

const aliasNouns = [
  "Fox",
  "Cipher",
  "Raven",
  "Echo",
  "Lantern",
  "Orbit",
  "Nomad",
];

const roomInput = document.querySelector("#room-input");
const aliasInput = document.querySelector("#alias-input");
const roomLabel = document.querySelector("#room-label");
const presenceCount = document.querySelector("#presence-count");
const status = document.querySelector("#status");
const messages = document.querySelector("#messages");
const joinForm = document.querySelector("#join-form");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const createRoomButton = document.querySelector("#create-room");
const copyLinkButton = document.querySelector("#copy-link");
const messageTemplate = document.querySelector("#message-template");

let socket;
let joinedRoom = "";
let joinedAlias = "";

aliasInput.value = randomAlias();

const params = new URLSearchParams(window.location.search);
const presetRoom = sanitizeRoomId(params.get("room") || "");
if (presetRoom) {
  roomInput.value = presetRoom;
}

function randomAlias() {
  const adjective = aliasAdjectives[Math.floor(Math.random() * aliasAdjectives.length)];
  const noun = aliasNouns[Math.floor(Math.random() * aliasNouns.length)];
  return `${adjective} ${noun}`;
}

function sanitizeRoomId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
}

function setStatus(text, isError = false) {
  status.textContent = text;
  status.style.color = isError ? "#ff9d8a" : "";
}

function updatePresence(count = 0) {
  presenceCount.textContent = `${count} online`;
}

function updateInviteLinkState() {
  copyLinkButton.disabled = !joinedRoom;
}

function setChatEnabled(enabled) {
  messageInput.disabled = !enabled;
  sendButton.disabled = !enabled;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function appendMessage(message) {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  node.classList.toggle("system", message.type === "system");
  node.querySelector(".message-author").textContent =
    message.type === "system" ? "System" : message.alias;
  node.querySelector(".message-time").textContent = formatTime(message.createdAt);
  node.querySelector(".message-text").textContent = message.text;
  messages.append(node);
  messages.scrollTop = messages.scrollHeight;
}

function resetMessages() {
  messages.innerHTML = "";
}

function connect(roomId, alias) {
  if (socket) {
    socket.close();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const currentSocket = new WebSocket(`${protocol}//${window.location.host}`);
  socket = currentSocket;

  currentSocket.addEventListener("open", () => {
    currentSocket.send(
      JSON.stringify({
        type: "join",
        roomId,
        alias,
      })
    );
  });

  currentSocket.addEventListener("message", (event) => {
    if (socket !== currentSocket) {
      return;
    }

    const payload = JSON.parse(event.data);

    if (payload.type === "error") {
      setStatus(payload.message, true);
      return;
    }

    if (payload.type === "joined") {
      joinedRoom = payload.roomId;
      joinedAlias = payload.alias;
      roomLabel.textContent = `#${payload.roomId}`;
      updatePresence(payload.occupantCount);
      resetMessages();
      payload.history.forEach(appendMessage);
      setChatEnabled(true);
      updateInviteLinkState();
      setStatus(`You are in #${payload.roomId} as ${payload.alias}.`);

      const url = new URL(window.location.href);
      url.searchParams.set("room", payload.roomId);
      window.history.replaceState({}, "", url);
      return;
    }

    if (payload.type === "presence") {
      if (payload.message) {
        appendMessage(payload.message);
      }
      updatePresence(payload.occupantCount);
      return;
    }

    if (payload.type === "message") {
      appendMessage(payload.message);
      updatePresence(payload.occupantCount);
    }
  });

  currentSocket.addEventListener("close", () => {
    if (socket !== currentSocket) {
      return;
    }

    setChatEnabled(false);
    updatePresence(0);
    updateInviteLinkState();
    if (joinedRoom) {
      setStatus("Connection closed. Rejoin to continue chatting.", true);
    }
  });

  currentSocket.addEventListener("error", () => {
    if (socket !== currentSocket) {
      return;
    }

    setStatus("Could not reach the room server.", true);
  });
}

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const roomId = sanitizeRoomId(roomInput.value);
  const alias = aliasInput.value.trim().slice(0, 24);

  if (!roomId) {
    setStatus("Choose a room code first.", true);
    roomInput.focus();
    return;
  }

  if (!alias) {
    setStatus("Choose an alias before joining.", true);
    aliasInput.focus();
    return;
  }

  setStatus("Opening your incognito room...");
  connect(roomId, alias);
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();

  if (!socket || socket.readyState !== WebSocket.OPEN || !text) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "message",
      text,
    })
  );

  messageInput.value = "";
});

createRoomButton.addEventListener("click", async () => {
  setStatus("Minting a fresh room...");

  try {
    const response = await fetch("/api/room", { cache: "no-store" });
    const data = await response.json();
    roomInput.value = data.roomId;
    setStatus(`Room #${data.roomId} is ready. Pick an alias and enter.`);
  } catch {
    setStatus("Could not create a room right now.", true);
  }
});

copyLinkButton.addEventListener("click", async () => {
  if (!joinedRoom) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("room", joinedRoom);
  await navigator.clipboard.writeText(url.toString());
  setStatus("Invite link copied.");
});

setChatEnabled(false);
updateInviteLinkState();
