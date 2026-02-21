// ==============================================
// ⚙️ Automation Core Controller (Owner Only)
// Azahrabot
// ==============================================

const fs = require("fs");
const path = require("path");
const settings = require("../../settings");

const DATA_FILE = path.join(__dirname, "../../data/automation.json");

const DEFAULT_CONFIG = {
  autoreact: false,
  autostatusview: false,
  autostatusreact: false,
  autotyping: false,
  autoread: false
};

function loadConfig() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(DATA_FILE)) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// OWNER CHECK (fromMe safest)
function isOwner(msg) {
  if (msg.key.fromMe) return true;

  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNum = sender.replace(/\D/g, "");
  const ownerNum = (settings.ownerNumber || "").replace(/\D/g, "");

  return senderNum === ownerNum;
}

module.exports = async function automationController(sock, msg, from, text, args) {

  if (!isOwner(msg)) {
    return sock.sendMessage(from, {
      text: "❌ Owner only command."
    }, { quoted: msg });
  }

  const command = text.split(" ")[0].replace(".", "").toLowerCase();
  const config = loadConfig();
  const state = args[0]?.toLowerCase();

  if (!["on", "off"].includes(state)) {
    return sock.sendMessage(from, {
      text:
        "Usage:\n" +
        ".autoreact on/off\n" +
        ".autotyping on/off\n" +
        ".autoread on/off\n" +
        ".autostatusview on/off\n" +
        ".autostatusreact on/off"
    }, { quoted: msg });
  }

  const value = state === "on";

  switch (command) {
    case "autoreact":
      config.autoreact = value;
      break;

    case "autotyping":
      config.autotyping = value;
      break;

    case "autoread":
      config.autoread = value;
      break;

    case "autostatusview":
      config.autostatusview = value;
      break;

    case "autostatusreact":
      config.autostatusreact = value;
      break;

    default:
      return;
  }

  saveConfig(config);

  return sock.sendMessage(from, {
    text: `✅ ${command.toUpperCase()} is now *${state.toUpperCase()}*`
  }, { quoted: msg });
};
