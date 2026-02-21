// ==============================================
// 🔓 Azahrabot Unban Command (v3.0 Stable)
// Only Admins / Owner • Works via mention or reply
// ==============================================

const { removeBan, isBanned } = require("../lib/banManager");
const settings = require("../settings");

module.exports = async (sock, msg, from) => {
  try {
    if (!from.endsWith("@g.us")) {
      return await sock.sendMessage(from, {
        text: "❌ This command can only be used in groups.",
      });
    }

    const sender = msg.key.participant || msg.key.remoteJid;
    const owner = settings.ownerNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    // 🧩 Fetch group admins
    const metadata = await sock.groupMetadata(from);
    const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
    const isAdmin = admins.includes(sender) || msg.key.fromMe;

    if (!isAdmin && sender !== owner) {
      return await sock.sendMessage(from, {
        text: "❌ Only admins or the bot owner can use this command.",
      }, { quoted: msg });
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const target = mentioned[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (!target) {
      return await sock.sendMessage(from, {
        text: "⚠️ Tag or reply to the user you want to unban.",
      }, { quoted: msg });
    }

    if (!isBanned(target)) {
      return await sock.sendMessage(from, {
        text: `✅ @${target.split("@")[0]} is not banned.`,
        mentions: [target],
      }, { quoted: msg });
    }

    removeBan(target);

    await sock.sendMessage(from, {
      text: `🔓 User @${target.split("@")[0]} has been *unbanned successfully!* 🎉`,
      mentions: [target],
    }, { quoted: msg });

  } catch (err) {
    console.error("❌ Unban Command Error:", err);
    await sock.sendMessage(from, { text: `⚠️ Failed to unban user: ${err.message}` }, { quoted: msg });
  }
};
