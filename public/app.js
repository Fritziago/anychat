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

const SETTINGS_STORAGE_KEY = "shadow-room-settings-v1";
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

const defaultSettings = {
  preset: "shadow",
  accentHue: 142,
  glow: 54,
  radius: 28,
  blur: 18,
  textScale: 100,
  density: "cozy",
  background: "aurora",
  bubbleStyle: "glass",
  fontMood: "signal",
  showTimestamps: true,
  motion: true,
};

const presetSettings = {
  shadow: {
    preset: "shadow",
    accentHue: 142,
    glow: 54,
    radius: 28,
    blur: 18,
    textScale: 100,
    density: "cozy",
    background: "aurora",
    bubbleStyle: "glass",
    fontMood: "signal",
    showTimestamps: true,
    motion: true,
  },
  frost: {
    preset: "frost",
    accentHue: 196,
    glow: 48,
    radius: 22,
    blur: 24,
    textScale: 98,
    density: "compact",
    background: "grid",
    bubbleStyle: "outline",
    fontMood: "tech",
    showTimestamps: true,
    motion: true,
  },
  ember: {
    preset: "ember",
    accentHue: 22,
    glow: 66,
    radius: 32,
    blur: 15,
    textScale: 102,
    density: "airy",
    background: "eclipse",
    bubbleStyle: "solid",
    fontMood: "editorial",
    showTimestamps: true,
    motion: true,
  },
  studio: {
    preset: "studio",
    accentHue: 168,
    glow: 34,
    radius: 20,
    blur: 12,
    textScale: 99,
    density: "cozy",
    background: "studio",
    bubbleStyle: "glass",
    fontMood: "editorial",
    showTimestamps: false,
    motion: false,
  },
};

const presetLabels = {
  shadow: "Shadow Bloom",
  frost: "Frost Signal",
  ember: "Ember Lounge",
  studio: "Studio Slate",
  custom: "Custom Mix",
};

const rootStyle = document.documentElement.style;
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
const fileButton = document.querySelector("#file-button");
const fileInput = document.querySelector("#file-input");
const createRoomButton = document.querySelector("#create-room");
const copyLinkButton = document.querySelector("#copy-link");
const messageTemplate = document.querySelector("#message-template");
const openSettingsButton = document.querySelector("#open-settings");
const closeSettingsButton = document.querySelector("#close-settings");
const resetSettingsButton = document.querySelector("#reset-settings");
const settingsDrawer = document.querySelector("#settings-drawer");
const settingsScrim = document.querySelector("#settings-scrim");
const customIndicator = document.querySelector("#custom-indicator");
const presetButtons = Array.from(document.querySelectorAll("[data-preset]"));

const accentHueInput = document.querySelector("#accent-hue");
const glowInput = document.querySelector("#glow-strength");
const radiusInput = document.querySelector("#corner-radius");
const blurInput = document.querySelector("#glass-blur");
const textScaleInput = document.querySelector("#text-scale");
const backgroundSelect = document.querySelector("#background-style");
const bubbleStyleSelect = document.querySelector("#bubble-style");
const fontMoodSelect = document.querySelector("#font-mood");
const densitySelect = document.querySelector("#density");
const showTimestampsInput = document.querySelector("#show-timestamps");
const motionInput = document.querySelector("#motion-enabled");

const accentHueValue = document.querySelector("#accent-hue-value");
const glowValue = document.querySelector("#glow-value");
const radiusValue = document.querySelector("#radius-value");
const blurValue = document.querySelector("#blur-value");
const textScaleValue = document.querySelector("#text-scale-value");

let socket;
let joinedRoom = "";
let joinedAlias = "";
let currentSettings = loadSettings();

applySettings(currentSettings);
syncSettingsUI();
aliasInput.value = randomAlias();

const params = new URLSearchParams(window.location.search);
const presetRoom = sanitizeRoomId(params.get("room") || "");
if (presetRoom) {
  roomInput.value = presetRoom;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function normalizeSettings(raw = {}) {
  return {
    preset: typeof raw.preset === "string" ? raw.preset : defaultSettings.preset,
    accentHue: clampNumber(raw.accentHue, 0, 360, defaultSettings.accentHue),
    glow: clampNumber(raw.glow, 20, 95, defaultSettings.glow),
    radius: clampNumber(raw.radius, 16, 40, defaultSettings.radius),
    blur: clampNumber(raw.blur, 8, 28, defaultSettings.blur),
    textScale: clampNumber(raw.textScale, 92, 116, defaultSettings.textScale),
    density: ["compact", "cozy", "airy"].includes(raw.density) ? raw.density : defaultSettings.density,
    background: ["aurora", "grid", "eclipse", "studio"].includes(raw.background)
      ? raw.background
      : defaultSettings.background,
    bubbleStyle: ["glass", "outline", "solid"].includes(raw.bubbleStyle)
      ? raw.bubbleStyle
      : defaultSettings.bubbleStyle,
    fontMood: ["signal", "editorial", "tech"].includes(raw.fontMood)
      ? raw.fontMood
      : defaultSettings.fontMood,
    showTimestamps:
      typeof raw.showTimestamps === "boolean"
        ? raw.showTimestamps
        : defaultSettings.showTimestamps,
    motion: typeof raw.motion === "boolean" ? raw.motion : defaultSettings.motion,
  };
}

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "null");
    return normalizeSettings(raw || defaultSettings);
  } catch {
    return { ...defaultSettings };
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
}

function hsl(hue, saturation, lightness, alpha) {
  if (typeof alpha === "number") {
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
  }

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function applySettings(settings) {
  const hue = settings.accentHue;
  const strongHue = (hue + 24) % 360;
  const orbHue = (hue + 70) % 360;

  rootStyle.setProperty("--accent", hsl(hue, 96, 76));
  rootStyle.setProperty("--accent-strong", hsl(strongHue, 74, 52));
  rootStyle.setProperty("--accent-faint", hsl(hue, 96, 76, 0.14 + settings.glow / 340));
  rootStyle.setProperty("--accent-soft", hsl(hue, 96, 76, 0.06 + settings.glow / 520));
  rootStyle.setProperty("--panel-border", hsl(hue, 96, 76, 0.12 + settings.glow / 520));
  rootStyle.setProperty("--orb-one", hsl(hue, 90, 64, 0.16 + settings.glow / 360));
  rootStyle.setProperty("--orb-two", hsl(orbHue, 88, 58, 0.14 + settings.glow / 420));
  rootStyle.setProperty(
    "--shadow",
    `0 24px 80px rgba(0, 0, 0, 0.35), 0 0 ${18 + settings.glow}px ${hsl(
      hue,
      96,
      76,
      0.06 + settings.glow / 700
    )}`
  );
  rootStyle.setProperty("--radius-xl", `${settings.radius + 2}px`);
  rootStyle.setProperty("--radius-lg", `${Math.max(16, settings.radius - 6)}px`);
  rootStyle.setProperty("--radius-md", `${Math.max(14, settings.radius - 10)}px`);
  rootStyle.setProperty("--panel-blur", `${settings.blur}px`);
  rootStyle.setProperty("--base-scale", `${settings.textScale}%`);

  document.body.dataset.density = settings.density;
  document.body.dataset.background = settings.background;
  document.body.dataset.bubble = settings.bubbleStyle;
  document.body.dataset.font = settings.fontMood;
  document.body.dataset.motion = settings.motion ? "on" : "off";
  document.body.dataset.timestamps = settings.showTimestamps ? "on" : "off";
}

function syncSettingsUI() {
  accentHueInput.value = currentSettings.accentHue;
  glowInput.value = currentSettings.glow;
  radiusInput.value = currentSettings.radius;
  blurInput.value = currentSettings.blur;
  textScaleInput.value = currentSettings.textScale;
  backgroundSelect.value = currentSettings.background;
  bubbleStyleSelect.value = currentSettings.bubbleStyle;
  fontMoodSelect.value = currentSettings.fontMood;
  densitySelect.value = currentSettings.density;
  showTimestampsInput.checked = currentSettings.showTimestamps;
  motionInput.checked = currentSettings.motion;

  accentHueValue.value = `${currentSettings.accentHue}°`;
  glowValue.value = `${currentSettings.glow}%`;
  radiusValue.value = `${currentSettings.radius} px`;
  blurValue.value = `${currentSettings.blur} px`;
  textScaleValue.value = `${currentSettings.textScale}%`;
  customIndicator.textContent = `Preset: ${presetLabels[currentSettings.preset] || presetLabels.custom}`;

  for (const button of presetButtons) {
    button.dataset.active = String(button.dataset.preset === currentSettings.preset);
  }
}

function applyAndStore(nextSettings) {
  currentSettings = normalizeSettings(nextSettings);
  applySettings(currentSettings);
  syncSettingsUI();
  persistSettings();
}

function usePreset(presetName) {
  const preset = presetSettings[presetName];
  if (!preset) {
    return;
  }

  applyAndStore({ ...preset });
}

function updateCustomSetting(patch) {
  applyAndStore({
    ...currentSettings,
    ...patch,
    preset: "custom",
  });
}

function setSettingsOpen(open) {
  settingsDrawer.dataset.open = String(open);
  settingsDrawer.setAttribute("aria-hidden", String(!open));
  settingsScrim.hidden = !open;
  document.body.classList.toggle("settings-open", open);
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
  fileButton.disabled = !enabled;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createMessageContent(message) {
  if (message.type === "file") {
    const link = document.createElement("a");
    link.className = "attachment";
    link.href = message.url;
    link.target = "_blank";
    link.rel = "noopener";

    const name = document.createElement("span");
    name.className = "attachment-name";
    name.textContent = message.fileName;

    const meta = document.createElement("span");
    meta.className = "attachment-size";
    meta.textContent = `${formatFileSize(message.fileSize)} download`;

    link.append(name, meta);
    return link;
  }

  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = message.text;
  return text;
}

function appendMessage(message) {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  node.classList.toggle("system", message.type === "system");
  node.querySelector(".message-author").textContent =
    message.type === "system" ? "System" : message.alias;
  node.querySelector(".message-time").textContent = formatTime(message.createdAt);
  node.querySelector(".message-content").append(createMessageContent(message));
  messages.append(node);
  messages.scrollTop = messages.scrollHeight;
}

function resetMessages() {
  messages.innerHTML = "";
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      const [, encoded = ""] = result.split(",");
      resolve(encoded);
    });

    reader.addEventListener("error", () => {
      reject(new Error("Could not read that file."));
    });

    reader.readAsDataURL(file);
  });
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

fileButton.addEventListener("click", () => {
  if (!joinedRoom || !joinedAlias) {
    setStatus("Join a room before uploading files.", true);
    return;
  }

  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files || [];

  if (!file) {
    return;
  }

  if (!joinedRoom || !joinedAlias) {
    setStatus("Join a room before uploading files.", true);
    fileInput.value = "";
    return;
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    setStatus("Files must be 50 MB or smaller.", true);
    fileInput.value = "";
    return;
  }

  setStatus(`Uploading ${file.name}...`);

  try {
    const data = await readFileAsBase64(file);
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId: joinedRoom,
        alias: joinedAlias,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        data,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }

    setStatus(`${file.name} shared in #${joinedRoom}.`);
  } catch (error) {
    setStatus(error.message || "Could not upload that file.", true);
  } finally {
    fileInput.value = "";
  }
});

copyLinkButton.addEventListener("click", async () => {
  if (!joinedRoom) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("room", joinedRoom);

  try {
    await navigator.clipboard.writeText(url.toString());
    setStatus("Invite link copied.");
  } catch {
    setStatus("Could not copy the invite link.", true);
  }
});

openSettingsButton.addEventListener("click", () => {
  setSettingsOpen(true);
});

closeSettingsButton.addEventListener("click", () => {
  setSettingsOpen(false);
});

resetSettingsButton.addEventListener("click", () => {
  usePreset(defaultSettings.preset);
});

settingsScrim.addEventListener("click", () => {
  setSettingsOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSettingsOpen(false);
  }
});

for (const button of presetButtons) {
  button.addEventListener("click", () => {
    usePreset(button.dataset.preset);
  });
}

accentHueInput.addEventListener("input", () => {
  updateCustomSetting({ accentHue: Number(accentHueInput.value) });
});

glowInput.addEventListener("input", () => {
  updateCustomSetting({ glow: Number(glowInput.value) });
});

radiusInput.addEventListener("input", () => {
  updateCustomSetting({ radius: Number(radiusInput.value) });
});

blurInput.addEventListener("input", () => {
  updateCustomSetting({ blur: Number(blurInput.value) });
});

textScaleInput.addEventListener("input", () => {
  updateCustomSetting({ textScale: Number(textScaleInput.value) });
});

backgroundSelect.addEventListener("change", () => {
  updateCustomSetting({ background: backgroundSelect.value });
});

bubbleStyleSelect.addEventListener("change", () => {
  updateCustomSetting({ bubbleStyle: bubbleStyleSelect.value });
});

fontMoodSelect.addEventListener("change", () => {
  updateCustomSetting({ fontMood: fontMoodSelect.value });
});

densitySelect.addEventListener("change", () => {
  updateCustomSetting({ density: densitySelect.value });
});

showTimestampsInput.addEventListener("change", () => {
  updateCustomSetting({ showTimestamps: showTimestampsInput.checked });
});

motionInput.addEventListener("change", () => {
  updateCustomSetting({ motion: motionInput.checked });
});

setChatEnabled(false);
updateInviteLinkState();
setSettingsOpen(false);
