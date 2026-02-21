// =============================================
// 📣 Azahrabot .everyone — Final Stable Edition
// One clean message • Admin-only • No reply
// =============================================

const settings = require("../settings");

module.exports = async (sock, msg, from) => {
  try {
    // ✅ must be a group
    if (!from.endsWith("@g.us")) {
      return await sock.sendMessage(from, { text: "⚠️ This command only works in groups." });
    }

    // 🧠 get group info
    const metadata = await sock.groupMetadata(from);
    const participants = metadata?.participants || [];
    const allIds = participants.map(p => p.id);

    // 👑 check admin
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const ownerNumber = (settings.ownerNumber || "").replace(/[^0-9]/g, "");
    const isOwner = msg.key.fromMe || sender.includes(ownerNumber);
    const admins = participants.filter(p => p.admin).map(p => p.id);
    const isAdmin = admins.includes(sender);

    if (!isAdmin && !isOwner) {
      return await sock.sendMessage(from, {
        text: "❌ Yoo only group admins can use .everyone ya!."
      });
    }

    // 💬 send one single "everyone" message tagging all members
    await sock.sendMessage(from, {
      text: "everyone",
      mentions: allIds
    });

  } catch (err) {
    console.error("❌ .everyone error:", err);
    await sock.sendMessage(from, {
      text: `⚠️ Failed to tag everyone.\n${err.message || err}`
    });
  }
};
