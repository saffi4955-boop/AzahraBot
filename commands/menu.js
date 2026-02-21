// ==============================================
// ⚙️ Azahrabot Menu Command (v5.4 — Attached Native View Button)
// One Message • Clean Banner • Native WhatsApp “View Channel” Button
// ==============================================

const fs = require("fs");
const path = require("path");
const { banner, menuText } = require("../utils/menuData");
const secure = require("../lib/small_lib");

module.exports = async (sock, msg, from) => {
  try {
    // 📜 React to show bot received the command
    await sock.sendMessage(from, { react: { text: "📜", key: msg.key } }).catch(() => {});
  } catch (e) {
    console.log("Reaction failed:", e?.message || e);
  }

  // 🧠 Ensure /data folder exists
  const dataDir = path.join(__dirname, "../data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // ⚙️ Get bot mode safely
  const modeFile = path.join(dataDir, "botMode.json");
  let currentMode = "public";

  try {
    if (fs.existsSync(modeFile)) {
      const modeData = JSON.parse(fs.readFileSync(modeFile, "utf8"));
      if (modeData?.mode && typeof modeData.mode === "string") {
        currentMode = modeData.mode.toLowerCase();
      }
    } else {
      fs.writeFileSync(modeFile, JSON.stringify({ mode: "public" }, null, 2));
    }
  } catch (err) {
    console.warn("⚠️ Mode file error:", err.message);
  }

  // 🕒 Date & time
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();

  // 📜 Build dynamic menu
  const text = menuText(dateStr, timeStr, currentMode).trim();

  // 📰 Channel JID (for native view button)
  const newsletterJid = secure.channel?.jid;

  try {
    await sock.sendMessage(
      from,
      {
        image: { url: banner },
        caption: text,
        headerType: 4,
        contextInfo: {
          // ✅ The magic combo that attaches native “View Channel” button
          forwardedNewsletterMessageInfo: {
            newsletterJid, // Your channel ID e.g. 120363404914980672@newsletter
            serverMessageId: 1,
            // newsletterName: secure.channel?.name, // optional, can hide if you want only button
          },
          isForwarded: true,
          forwardingScore: 1,
        },
      },
      { quoted: msg }
    );
  } catch (err) {
    console.error("❌ Menu send failed:", err?.message || err);
    await sock.sendMessage(from, { text: "⚠️ Could not send menu." }, { quoted: msg });
  }
};
