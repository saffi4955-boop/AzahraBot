// =============================================
// 👁️ Azahrabot VV2 — Final Fix v5.7
// DM + Group Working • Paired Owner Only • Safe Forward
// =============================================

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const P = require("pino");
const settings = require("../settings");
const secure = require("../lib/small_lib");

module.exports = async (sock, msg, from) => {
  try {
    // 🧠 Identify bot's actual paired JID
    const botId = sock?.user?.id?.split(":")[0]?.replace(/[^0-9]/g, "");
    const ownerNum = (settings.ownerNumber || "").replace(/[^0-9]/g, "");
    const ownerJid = `${ownerNum}@s.whatsapp.net`;

    // 🧩 Normalize message sender across group + DM contexts
    const sender =
      msg.key.participant ||
      msg.participant ||
      msg.key.remoteJid ||
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      msg.message?.contextInfo?.participant ||
      "";

    const senderNum = sender.replace(/[^0-9]/g, "");

    // ✅ Check if sender is the paired owner or the bot itself
    const isOwner =
      msg.key.fromMe || senderNum === ownerNum || botId === ownerNum;

    if (!isOwner) {
      await sock.sendMessage(from, { text: "❌ Only the paired bot owner can use this command." }, { quoted: msg });
      return;
    }

    // ⚙️ Must reply to a ViewOnce
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx || !ctx.quotedMessage) {
      await sock.sendMessage(from, { text: "❗ Reply to a *ViewOnce* image or video and use .vv2" }, { quoted: msg });
      return;
    }

    const quoted = ctx.quotedMessage;

    // 🧠 Detect viewOnce formats
    let mediaMessage;
    if (quoted?.viewOnceMessage?.message)
      mediaMessage = { message: quoted.viewOnceMessage.message };
    else if (quoted?.viewOnceMessageV2?.message)
      mediaMessage = { message: quoted.viewOnceMessageV2.message };
    else if (quoted?.imageMessage || quoted?.videoMessage)
      mediaMessage = { message: quoted };

    if (!mediaMessage) {
      await sock.sendMessage(from, { text: "⚠️ That message doesn’t contain a valid ViewOnce media." }, { quoted: msg });
      return;
    }

    // 🧩 Ensure /temp folder
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // 📥 Download buffer safely
    let buffer;
    try {
      buffer = await downloadMediaMessage(mediaMessage, "buffer", {}, { logger: P({ level: "silent" }) });
    } catch (err) {
      console.error("vv2 download fail:", err);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      buffer = await downloadMediaMessage(mediaMessage, "buffer", {}, { logger: P({ level: "silent" }) });
    }

    const isVideo = !!mediaMessage.message.videoMessage;

    // 🕒 Random delay (mimic human send)
    const delay = 1500 + Math.random() * 2000;
    await new Promise(res => setTimeout(res, delay));

    // 📤 Send privately to owner only
    await sock.sendMessage(ownerJid, {
      [isVideo ? "video" : "image"]: buffer,
      mimetype: isVideo ? "video/mp4" : "image/jpeg",
      caption: `👁️ *Private ViewOnce Retrieved*\n━━━━━━━━━━━\n📍 From: ${from}\n> powered by ${secure.author || "AzarTech"} ⚡`,
    });

    // 🧹 Delete original command silently (stealth)
    try {
      await sock.sendMessage(from, { delete: msg.key });
    } catch {}

    console.log(`✅ VV2 success — sent privately from ${from} → ${ownerJid}`);
  } catch (err) {
    console.error("❌ VV2 Fatal:", err);
    await sock.sendMessage(from, { text: `⚠️ Error: ${err.message}` }, { quoted: msg });
  }
};
