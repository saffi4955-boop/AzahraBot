// ==============================================
// 👑 Azahrabot Promote Command (v6.4 Stable)
// Promotes tagged/replied member to admin
// Admin-only + Interactive confirmation
// ==============================================

const settings = require("../settings");
const secure = require("../lib/small_lib");

module.exports = async (sock, msg, from) => {
  try {
    // ✅ Ensure it's a group
    if (!from.endsWith("@g.us")) {
      return await sock.sendMessage(from, {
        text: "❌ This command can only be used inside a group.",
      }, { quoted: msg });
    }

    // 🧠 Fetch metadata
    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants || [];
    const sender = msg.key.participant || msg.key.remoteJid;

    // 👑 Check admin access
    const admins = participants.filter(p => p.admin).map(p => p.id);
    const isAdmin = admins.includes(sender) || msg.key.fromMe;
    if (!isAdmin) {
      return await sock.sendMessage(from, {
        text: "❌ Only group admins can promote members.",
      }, { quoted: msg });
    }

    // 🧍 Identify target user (replied or mentioned)
    const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = mention || quoted;

    if (!target) {
      return await sock.sendMessage(from, {
        text: "👤 Please *mention or reply* to the user you want to promote.\n\nExample:\n.promote @user",
      }, { quoted: msg });
    }

    // 🏆 Promote member
    await sock.groupParticipantsUpdate(from, [target], "promote");

    // 💬 Interactive confirmation
    const text = `
🎉 *Member Promoted Successfully!*
────────────────────
👤 *User:* @${target.split("@")[0]}
👑 *Promoted By:* @${sender.split("@")[0]}
────────────────────
> powered by *${secure.author || "AzarTech"}* ⚡
`.trim();

    await sock.sendMessage(from, { text, mentions: [target, sender] }, { quoted: msg });

  } catch (err) {
    console.error("❌ .promote error:", err);
    await sock.sendMessage(from, {
      text: `⚠️ Failed to promote member.\nError: ${err.message}`,
    }, { quoted: msg });
  }
};
