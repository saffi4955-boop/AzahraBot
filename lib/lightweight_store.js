// ==============================================
// lib/lightweight_store.js
// 💾 Azahrabot Persistent Lightweight Store (v2.1)
// Tracks messages, contacts & chats safely in /session
// Compatible with Baileys v6+ & all commands (listonline, warn, etc.)
// ==============================================

const fs = require("fs");
const path = require("path");

// ✅ Define session folder
const SESSION_DIR = path.join(__dirname, "../session");
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  console.log("📁 Created /session folder for data store");
}

const STORE_FILE = path.join(SESSION_DIR, "baileys_store.json");
const BACKUP_FILE = path.join(SESSION_DIR, "baileys_store.bak.json");

// 🧩 Max messages to keep per chat
let MAX_MESSAGES = 300; // default
try {
  const settings = require("../settings");
  if (settings.maxStoreMessages) MAX_MESSAGES = settings.maxStoreMessages;
} catch {
  // ignore if settings missing
}

// 🧠 Store Object
const store = {
  messages: {}, // chatJid => Map(msg.key.id => msg)
  contacts: {}, // jid => contact info
  chats: {},    // jid => chat meta
  _lastWrite: 0,

  // ✅ Load from file
  readFromFile(file = STORE_FILE) {
    try {
      if (!fs.existsSync(file)) return;

      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      this.messages = {};
      for (const [jid, msgs] of Object.entries(raw.messages || {})) {
        const map = new Map();
        for (const msg of msgs) {
          const id = (msg && msg.key && msg.key.id) || `${Date.now()}-${Math.random()}`;
          map.set(id, msg);
        }
        this.messages[jid] = map;
      }
      this.contacts = raw.contacts || {};
      this.chats = raw.chats || {};
    } catch (err) {
      console.error("⚠️ Failed to read store:", err.message);
      try {
        fs.renameSync(file, BACKUP_FILE);
        console.log("📦 Corrupted store backed up to:", BACKUP_FILE);
      } catch {}
      this.messages = {};
      this.contacts = {};
      this.chats = {};
    }
  },

  // ✅ Save to file (throttled every 5s)
  writeToFile(file = STORE_FILE) {
    const now = Date.now();
    if (now - this._lastWrite < 5000) return;
    this._lastWrite = now;

    try {
      const msgObj = {};
      for (const [jid, map] of Object.entries(this.messages)) {
        msgObj[jid] = Array.from(map.values());
      }
      const data = {
        messages: msgObj,
        contacts: this.contacts,
        chats: this.chats,
      };
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("⚠️ Failed to write store:", err.message);
    }
  },

  // ✅ Bind Baileys events
  bind(ev) {
    ev.on("messages.upsert", ({ messages }) => {
      for (const msg of messages || []) {
        const jid = msg?.key?.remoteJid;
        const id = msg?.key?.id;
        if (!jid || !id) continue;

        if (!this.messages[jid]) this.messages[jid] = new Map();
        const map = this.messages[jid];

        map.set(id, msg);

        // limit per chat
        if (map.size > MAX_MESSAGES) {
          const keys = Array.from(map.keys());
          const removeCount = map.size - MAX_MESSAGES;
          for (const oldKey of keys.slice(0, removeCount)) {
            map.delete(oldKey);
          }
        }
      }
    });

    ev.on("contacts.update", (contacts) => {
      for (const c of contacts || []) {
        if (!c.id) continue;
        this.contacts[c.id] = {
          id: c.id,
          name: c.notify || c.name || this.contacts[c.id]?.name || "",
        };
      }
    });

    ev.on("chats.set", ({ chats }) => {
      this.chats = {};
      for (const chat of chats || []) {
        if (!chat.id) continue;
        this.chats[chat.id] = chat;
      }
    });

    // some Baileys versions also emit chats.update
    ev.on("chats.update", (chats) => {
      for (const chat of chats || []) {
        if (!chat.id) continue;
        this.chats[chat.id] = {
          ...(this.chats[chat.id] || {}),
          ...chat,
        };
      }
    });
  },
};

module.exports = store;
