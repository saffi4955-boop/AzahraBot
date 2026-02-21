// ==============================================
// 🆔 JID Command
// Azahrabot
// ==============================================

module.exports = async (sock, msg, from) => {
  try {
    const isGroup = from.endsWith("@g.us");
    const isChannel = from.endsWith("@newsletter");
    const sender = msg.key.participant || msg.key.remoteJid;

    let targetJid = null;
    let type = "";

    // If replied message
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      targetJid = msg.message.extendedTextMessage.contextInfo.participant;
      type = "👤 Replied User";
    }

    // If mentioned user
    else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
      targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      type = "👤 Mentioned User";
    }

    // If in channel
    else if (isChannel) {
      targetJid = from;
      type = "📢 Channel";
    }

    // If in group
    else if (isGroup) {
      targetJid = from;
      type = "👥 Group";
    }

    // Personal chat
    else {
      targetJid = sender;
      type = "💬 Personal Chat";
    }

    if (!targetJid) {
      return sock.sendMessage(from, {
        text: "❌ Could not detect JID."
      }, { quoted: msg });
    }

    await sock.sendMessage(
      from,
      {
        text: `🆔 *JID Information*\n\n` +
              `📌 Type: ${type}\n` +
              `🔗 JID:\n\`\`\`${targetJid}\`\`\``
      },
      { quoted: msg }
    );

  } catch (err) {
    console.error(".jid error:", err);
    await sock.sendMessage(
      from,
      { text: "❌ Failed to fetch JID." },
      { quoted: msg }
    );
  }
};
