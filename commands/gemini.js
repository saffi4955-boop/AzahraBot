// ==============================================
// 🤖 Azahrabot Gemini Command (v5.0 — Persistent Memory Edition)
// Stable • Chat-like • Auto Memory Save/Load
// ==============================================

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const small = require("../lib/small_lib");

// 🧠 Persistent memory file
const DATA_DIR = path.join(__dirname, "../data");
const MEMORY_FILE = path.join(DATA_DIR, "gemini_memory.json");

// Ensure /data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load existing memory or initialize empty
let chatMemory = {};
try {
  if (fs.existsSync(MEMORY_FILE)) {
    chatMemory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  }
} catch (err) {
  console.error("⚠️ Failed to load Gemini memory file:", err.message);
  chatMemory = {};
}

// 💾 Save memory safely
function saveMemory() {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(chatMemory, null, 2));
  } catch (err) {
    console.error("⚠️ Failed to save Gemini memory:", err.message);
  }
}

module.exports = async (sock, msg, from, text, args) => {
  const query = args.join(" ").trim();
  const apiKey = small.api.gemini;
  const modelName = "gemini-2.5-flash"; // ✅ verified working model

  if (!apiKey) {
    return await sock.sendMessage(from, { text: "❌ Gemini API key missing in small_lib.js" }, { quoted: msg });
  }

  if (!query) {
    return await sock.sendMessage(from, {
      text: "💬 *Usage:* .gemini <message>\nExample:\n.gemini write a short poem about the moon 🌙"
    }, { quoted: msg });
  }

  try {
    // 🤖 React instantly
    await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } }).catch(() => {});

    // 🧠 Prepare memory for current chat
    if (!chatMemory[from]) chatMemory[from] = [];

    // Add new user message
    chatMemory[from].push({ role: "user", parts: [{ text: query }] });

    // Trim to last 10 exchanges max
    if (chatMemory[from].length > 10) chatMemory[from] = chatMemory[from].slice(-10);

    // 🔗 Build API request
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await axios.post(endpoint, {
      contents: chatMemory[from]
    }, {
      headers: { "Content-Type": "application/json" }
    });

    // 🧩 Parse model response
    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!result) throw new Error("Empty response from Gemini");

    // Store model reply to memory
    chatMemory[from].push({ role: "model", parts: [{ text: result }] });
    saveMemory(); // 💾 persist to file

    // ✅ Send reply naturally (no prefix)
    await sock.sendMessage(from, { text: result }, { quoted: msg });

  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error("❌ Gemini error:", err.response?.data || err.message);
    await sock.sendMessage(from, { text: `⚠️ Gemini failed: ${errorMsg}` }, { quoted: msg });
  }
};
