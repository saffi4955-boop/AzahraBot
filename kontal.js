const secure = require("./lib/small_lib"); // correct path from root

async function kontolreply(sock, msg, teks) {
  return sock.sendMessage(
    msg.key.remoteJid,
    {
      text: teks,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          title: "⏤͟͟͞͞☆ AZAHRA BOT 🐉",
          body: "⏤͟͟͞͞◉⃤⃝⃟ BOT STATUS ONLINE",
          mediaType: 1,
          renderLargerThumbnail: false,
          thumbnailUrl: secure.channel.banner,   // ✅ your banner
          sourceUrl: secure.channel.link         // ✅ your channel link
        }
      }
    },
    { quoted: msg }
  );
}

module.exports = kontolreply;
