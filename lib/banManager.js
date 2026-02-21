// ==============================================
// 🚫 Azahrabot Ban Manager (v3.0 Stable)
// Admins & Owner Only — Auto Message Delete
// ==============================================

const fs = require("fs");
const path = require("path");

const BAN_FILE = path.join(__dirname, "../data/bannedUsers.json");

// 🗂️ Ensure data directory
if (!fs.existsSync(path.dirname(BAN_FILE))) {
  fs.mkdirSync(path.dirname(BAN_FILE), { recursive: true });
}
if (!fs.existsSync(BAN_FILE)) {
  fs.writeFileSync(BAN_FILE, JSON.stringify([]));
}

// 🔧 File handlers
function loadBans() {
  try {
    return JSON.parse(fs.readFileSync(BAN_FILE));
  } catch {
    return [];
  }
}
function saveBans(list) {
  fs.writeFileSync(BAN_FILE, JSON.stringify(list, null, 2));
}

// 🚫 Core functions
function addBan(jid) {
  const bans = loadBans();
  if (!bans.includes(jid)) {
    bans.push(jid);
    saveBans(bans);
  }
}
function isBanned(jid) {
  return loadBans().includes(jid);
}
function removeBan(jid) {
  const bans = loadBans().filter(u => u !== jid);
  saveBans(bans);
}

async function handleBanMessages(sock, msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  if (isBanned(sender)) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
    } catch (err) {
      // ignore failures silently
    }
  }
}
module.exports = { addBan, removeBan, isBanned, handleBanMessages };
