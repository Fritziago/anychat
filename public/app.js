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
  saturation: 92,
  glow: 54,
  shadowDepth: 42,
  blur: 18,
  surface: 72,
  ambientScale: 100,
  radius: 28,
  textScale: 100,
  density: "cozy",
  background: "aurora",
  pattern: "grain",
  panelStyle: "glass",
  bubbleStyle: "glass",
  messageWidth: "balanced",
  fontMood: "signal",
  showTimestamps: true,
  motion: true,
  ambientShapes: true,
};

const presetSettings = {
  shadow: { ...defaultSettings },
  frost: {
    preset: "frost",
    accentHue: 196,
    saturation: 80,
    glow: 48,
    shadowDepth: 34,
    blur: 24,
    surface: 62,
    ambientScale: 88,
    radius: 22,
    textScale: 98,
    density: "compact",
    background: "grid",
    pattern: "beam",
    panelStyle: "glass",
    bubbleStyle: "outline",
    messageWidth: "balanced",
    fontMood: "tech",
    showTimestamps: true,
    motion: true,
    ambientShapes: true,
  },
  ember: {
    preset: "ember",
    accentHue: 22,
    saturation: 86,
    glow: 66,
    shadowDepth: 58,
    blur: 15,
    surface: 78,
    ambientScale: 112,
    radius: 32,
    textScale: 102,
    density: "airy",
    background: "sundown",
    pattern: "rings",
    panelStyle: "tinted",
    bubbleStyle: "solid",
    messageWidth: "full",
    fontMood: "cinema",
    showTimestamps: true,
    motion: true,
    ambientShapes: true,
  },
  studio: {
    preset: "studio",
    accentHue: 168,
    saturation: 38,
    glow: 34,
    shadowDepth: 24,
    blur: 12,
    surface: 84,
    ambientScale: 72,
    radius: 20,
    textScale: 99,
    density: "cozy",
    background: "studio",
    pattern: "none",
    panelStyle: "ink",
    bubbleStyle: "soft",
    messageWidth: "balanced",
    fontMood: "editorial",
    showTimestamps: false,
    motion: false,
    ambientShapes: false,
  },
  lagoon: {
    preset: "lagoon",
    accentHue: 174,
    saturation: 96,
    glow: 60,
    shadowDepth: 46,
    blur: 20,
    surface: 74,
    ambientScale: 120,
    radius: 30,
    textScale: 101,
    density: "airy",
    background: "lagoon",
    pattern: "beam",
    panelStyle: "tinted",
    bubbleStyle: "glass",
    messageWidth: "full",
    fontMood: "signal",
    showTimestamps: true,
    motion: true,
    ambientShapes: true,
  },
  noir: {
    preset: "noir",
    accentHue: 200,
    saturation: 28,
    glow: 28,
    shadowDepth: 68,
    blur: 10,
    surface: 88,
    ambientScale: 60,
    radius: 18,
    textScale: 98,
    density: "compact",
    background: "studio",
    pattern: "rings",
    panelStyle: "ink",
    bubbleStyle: "outline",
    messageWidth: "narrow",
    fontMood: "tech",
    showTimestamps: false,
    motion: false,
    ambientShapes: false,
  },
};

const presetLabels = {
  shadow: "Shadow Bloom",
  frost: "Frost Signal",
  ember: "Ember Lounge",
  studio: "Studio Slate",
  lagoon: "Lagoon Pulse",
  noir: "Mono Noir",
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
const saturationInput = document.querySelector("#accent-saturation");
const glowInput = document.querySelector("#glow-strength");
const shadowDepthInput = document.querySelector("#shadow-depth");
const blurInput = document.querySelector("#glass-blur");
const surfaceInput = document.querySelector("#panel-tint");
const ambientScaleInput = document.querySelector("#ambient-scale");
const radiusInput = document.querySelector("#corner-radius");
const textScaleInput = document.querySelector("#text-scale");
const backgroundSelect = document.querySelector("#background-style");
const patternSelect = document.querySelector("#pattern-style");
const panelStyleSelect = document.querySelector("#panel-style");
const bubbleStyleSelect = document.querySelector("#bubble-style");
const messageWidthSelect = document.querySelector("#message-width");
const fontMoodSelect = document.querySelector("#font-mood");
const densitySelect = document.querySelector("#density");
const showTimestampsInput = document.querySelector("#show-timestamps");
const motionInput = document.querySelector("#motion-enabled");
const ambientEnabledInput = document.querySelector("#ambient-enabled");

const accentHueValue = document.querySelector("#accent-hue-value");
const saturationValue = document.querySelector("#saturation-value");
const glowValue = document.querySelector("#glow-value");
const shadowValue = document.querySelector("#shadow-value");
const blurValue = document.querySelector("#blur-value");
const surfaceValue = document.querySelector("#surface-value");
const ambientScaleValue = document.querySelector("#ambient-scale-value");
const radiusValue = document.querySelector("#radius-value");
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
    saturation: clampNumber(raw.saturation, 24, 100, defaultSettings.saturation),
    glow: clampNumber(raw.glow, 20, 95, defaultSettings.glow),
    shadowDepth: clampNumber(raw.shadowDepth, 16, 90, defaultSettings.shadowDepth),
    blur: clampNumber(raw.blur, 8, 28, defaultSettings.blur),
    surface: clampNumber(raw.surface, 48, 90, defaultSettings.surface),
    ambientScale: clampNumber(raw.ambientScale, 60, 140, defaultSettings.ambientScale),
    radius: clampNumber(raw.radius, 16, 40, defaultSettings.radius),
    textScale: clampNumber(raw.textScale, 92, 116, defaultSettings.textScale),
    density: ["compact", "cozy", "airy"].includes(raw.density) ? raw.density : defaultSettings.density,
    background: ["aurora", "grid", "eclipse", "studio", "lagoon", "sundown"].includes(raw.background)
      ? raw.background
      : defaultSettings.background,
    pattern: ["none", "grain", "rings", "beam"].includes(raw.pattern)
      ? raw.pattern
      : defaultSettings.pattern,
    panelStyle: ["glass", "tinted", "ink"].includes(raw.panelStyle)
      ? raw.panelStyle
      : defaultSettings.panelStyle,
    bubbleStyle: ["glass", "outline", "solid", "soft"].includes(raw.bubbleStyle)
      ? raw.bubbleStyle
      : defaultSettings.bubbleStyle,
    messageWidth: ["narrow", "balanced", "full"].includes(raw.messageWidth)
      ? raw.messageWidth
      : defaultSettings.messageWidth,
    fontMood: ["signal", "editorial", "tech", "cinema"].includes(raw.fontMood)
      ? raw.fontMood
      : defaultSettings.fontMood,
    showTimestamps:
      typeof raw.showTimestamps === "boolean"
        ? raw.showTimestamps
        : defaultSettings.showTimestamps,
    motion: typeof raw.motion === "boolean" ? raw.motion : defaultSettings.motion,
    ambientShapes:
      typeof raw.ambientShapes === "boolean"
        ? raw.ambientShapes
        : defaultSettings.ambientShapes,
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
  const saturation = settings.saturation;
  const strongHue = (hue + 24) % 360;
  const orbHue = (hue + 70) % 360;
  const panelAlpha = settings.surface / 100;

  rootStyle.setProperty("--accent", hsl(hue, saturation, 76));
  rootStyle.setProperty("--accent-strong", hsl(strongHue, Math.max(26, saturation - 18), 52));
  rootStyle.setProperty("--accent-faint", hsl(hue, saturation, 76, 0.12 + settings.glow / 340));
  rootStyle.setProperty("--accent-soft", hsl(hue, saturation, 76, 0.05 + settings.surface / 1000));
  rootStyle.setProperty("--panel-border", hsl(hue, saturation, 76, 0.08 + settings.glow / 500));
  rootStyle.setProperty("--orb-one", hsl(hue, Math.min(100, saturation + 4), 64, 0.12 + settings.glow / 320));
  rootStyle.setProperty("--orb-two", hsl(orbHue, Math.min(100, saturation + 8), 58, 0.12 + settings.glow / 380));
  rootStyle.setProperty("--panel-surface", `rgba(7, 23, 31, ${panelAlpha})`);
  rootStyle.setProperty(
    "--panel-tinted",
    `linear-gradient(180deg, ${hsl(hue, saturation, 76, 0.08 + settings.glow / 900)}, rgba(255, 255, 255, 0)), rgba(7, 23, 31, ${panelAlpha})`
  );
  rootStyle.setProperty("--panel-ink", `rgba(4, 10, 14, ${Math.min(0.97, panelAlpha + 0.12)})`);
  rootStyle.setProperty(
    "--shadow",
    `0 24px ${54 + settings.shadowDepth}px rgba(0, 0, 0, 0.34), 0 0 ${18 + settings.glow}px ${hsl(
      hue,
      saturation,
      76,
      0.06 + settings.glow / 700
    )}`
  );
  rootStyle.setProperty(
    "--message-shadow",
    `0 12px ${8 + settings.shadowDepth}px rgba(0, 0, 0, ${0.04 + settings.shadowDepth / 300})`
  );
  rootStyle.setProperty("--radius-xl", `${settings.radius + 2}px`);
  rootStyle.setProperty("--radius-lg", `${Math.max(16, settings.radius - 6)}px`);
  rootStyle.setProperty("--radius-md", `${Math.max(14, settings.radius - 10)}px`);
  rootStyle.setProperty("--panel-blur", `${settings.blur}px`);
  rootStyle.setProperty("--base-scale", `${settings.textScale}%`);
  rootStyle.setProperty("--ambient-scale", `${settings.ambientScale / 100}`);

  document.body.dataset.density = settings.density;
  document.body.dataset.background = settings.background;
  document.body.dataset.pattern = settings.pattern;
  document.body.dataset.panelStyle = settings.panelStyle;
  document.body.dataset.bubble = settings.bubbleStyle;
  document.body.dataset.messageWidth = settings.messageWidth;
  document.body.dataset.font = settings.fontMood;
  document.body.dataset.motion = settings.motion ? "on" : "off";
  document.body.dataset.timestamps = settings.showTimestamps ? "on" : "off";
  document.body.dataset.ambient = settings.ambientShapes ? "on" : "off";
}

function syncSettingsUI() {
  accentHueInput.value = currentSettings.accentHue;
  saturationInput.value = currentSettings.saturation;
  glowInput.value = currentSettings.glow;
  shadowDepthInput.value = currentSettings.shadowDepth;
  blurInput.value = currentSettings.blur;
  surfaceInput.value = currentSettings.surface;
  ambientScaleInput.value = currentSettings.ambientScale;
  radiusInput.value = currentSettings.radius;
  textScaleInput.value = currentSettings.textScale;
  backgroundSelect.value = currentSettings.background;
  patternSelect.value = currentSettings.pattern;
  panelStyleSelect.value = currentSettings.panelStyle;
  bubbleStyleSelect.value = currentSettings.bubbleStyle;
  messageWidthSelect.value = currentSettings.messageWidth;
  fontMoodSelect.value = currentSettings.fontMood;
  densitySelect.value = currentSettings.density;
  showTimestampsInput.checked = currentSettings.showTimestamps;
  motionInput.checked = currentSettings.motion;
  ambientEnabledInput.checked = currentSettings.ambientShapes;

  accentHueValue.value = `${currentSettings.accentHue} deg`;
  saturationValue.value = `${currentSettings.saturation}%`;
  glowValue.value = `${currentSettings.glow}%`;
  shadowValue.value = `${currentSettings.shadowDepth}%`;
  blurValue.value = `${currentSettings.blur} px`;
  surfaceValue.value = `${currentSettings.surface}%`;
  ambientScaleValue.value = `${currentSettings.ambientScale}%`;
  radiusValue.value = `${currentSettings.radius} px`;
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

saturationInput.addEventListener("input", () => {
  updateCustomSetting({ saturation: Number(saturationInput.value) });
});

glowInput.addEventListener("input", () => {
  updateCustomSetting({ glow: Number(glowInput.value) });
});

shadowDepthInput.addEventListener("input", () => {
  updateCustomSetting({ shadowDepth: Number(shadowDepthInput.value) });
});

blurInput.addEventListener("input", () => {
  updateCustomSetting({ blur: Number(blurInput.value) });
});

surfaceInput.addEventListener("input", () => {
  updateCustomSetting({ surface: Number(surfaceInput.value) });
});

ambientScaleInput.addEventListener("input", () => {
  updateCustomSetting({ ambientScale: Number(ambientScaleInput.value) });
});

radiusInput.addEventListener("input", () => {
  updateCustomSetting({ radius: Number(radiusInput.value) });
});

textScaleInput.addEventListener("input", () => {
  updateCustomSetting({ textScale: Number(textScaleInput.value) });
});

backgroundSelect.addEventListener("change", () => {
  updateCustomSetting({ background: backgroundSelect.value });
});

patternSelect.addEventListener("change", () => {
  updateCustomSetting({ pattern: patternSelect.value });
});

panelStyleSelect.addEventListener("change", () => {
  updateCustomSetting({ panelStyle: panelStyleSelect.value });
});

bubbleStyleSelect.addEventListener("change", () => {
  updateCustomSetting({ bubbleStyle: bubbleStyleSelect.value });
});

messageWidthSelect.addEventListener("change", () => {
  updateCustomSetting({ messageWidth: messageWidthSelect.value });
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

ambientEnabledInput.addEventListener("change", () => {
  updateCustomSetting({ ambientShapes: ambientEnabledInput.checked });
});

setChatEnabled(false);
updateInviteLinkState();
setSettingsOpen(false);
