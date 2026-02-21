// ==============================================
// ⚙️ Azahrabot Demote Command (v6.4 Stable)
// Demotes an admin back to member
// Admin-only + Interactive confirmation
// ==============================================

const settings = require("../settings");
const secure = require("../lib/small_lib");

module.exports = async (sock, msg, from) => {
  try {
    // ✅ Ensure it's used in a group
    if (!from.endsWith("@g.us")) {
      return await sock.sendMessage(from, {
        text: "❌ This command can only be used inside a group.",
      }, { quoted: msg });
    }

    // 🧠 Fetch group metadata
    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants || [];
    const sender = msg.key.participant || msg.key.remoteJid;

    // 👑 Check admin permissions
    const admins = participants.filter(p => p.admin).map(p => p.id);
    const isAdmin = admins.includes(sender) || msg.key.fromMe;
    if (!isAdmin) {
      return await sock.sendMessage(from, {
        text: "❌ Only group admins can demote other admins.",
      }, { quoted: msg });
    }

    // 👥 Identify target (replied or mentioned)
    const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = mention || quoted;

    if (!target) {
      return await sock.sendMessage(from, {
        text: "👤 Please *mention or reply* to the admin you want to demote.\n\nExample:\n.demote @user",
      }, { quoted: msg });
    }

    // 🛑 Prevent self-demotion of bot
    if (target === sock.user.id) {
      return await sock.sendMessage(from, {
        text: "⚠️ I can’t demote myself 😅",
      }, { quoted: msg });
    }

    // 🔧 Demote user
    await sock.groupParticipantsUpdate(from, [target], "demote");

    // 💬 Confirmation message
    const text = `
⚙️ *Member Demoted Successfully!*
────────────────────
👤 *User:* @${target.split("@")[0]}
⬇️ *Demoted By:* @${sender.split("@")[0]}
────────────────────
> powered by *${secure.author || "AzarTech"}* ⚡
`.trim();

    await sock.sendMessage(from, { text, mentions: [target, sender] }, { quoted: msg });

  } catch (err) {
    console.error("❌ .demote error:", err);
    await sock.sendMessage(from, {
      text: `⚠️ Failed to demote member.\nError: ${err.message}`,
    }, { quoted: msg });
  }
};
