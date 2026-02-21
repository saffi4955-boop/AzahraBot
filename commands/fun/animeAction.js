// ==============================================
// 💖 Anime Action System (Multi Command)
// Azahrabot
// ==============================================

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const SUPPORTED = [
  "poke",
  "cry",
  "kiss",
  "pat",
  "hug",
  "wink",
  "facepalm",
  "slap",
  "cuddle",
  "bite",
  "lick",
  "nom"
];

function getTarget(msg) {
  return (
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    null
  );
}

module.exports = async (sock, msg, from, text) => {
  try {
    const command = text.split(" ")[0].replace(".", "").toLowerCase();
    if (!SUPPORTED.includes(command)) return;

    const target = getTarget(msg);
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderTag = sender.split("@")[0];

    // Emoji reactions
    const EMOJI = {
      poke: "👉",
      cry: "😭",
      kiss: "💋",
      pat: "🫳",
      hug: "🤗",
      wink: "😉",
      facepalm: "🤦",
      slap: "👋",
      cuddle: "💞",
      bite: "🧛",
      lick: "👅",
      nom: "🍪"
    };

    await sock.sendMessage(from, {
      react: { text: EMOJI[command] || "💖", key: msg.key }
    }).catch(() => {});

    // API call
    const res = await axios.get(`https://api.waifu.pics/sfw/${command}`);
    if (!res.data?.url) {
      return sock.sendMessage(from, {
        text: "❌ Couldn't fetch anime action."
      }, { quoted: msg });
    }

    const gifUrl = res.data.url;

    const gifPath = path.join(__dirname, "anime.gif");
    const webpPath = path.join(__dirname, "anime.webp");

    const buffer = (await axios.get(gifUrl, {
      responseType: "arraybuffer"
    })).data;

    fs.writeFileSync(gifPath, buffer);

    // Convert to full-fit animated sticker
    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -i ${gifPath} -vf "fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -loop 0 -an -vsync 0 -vcodec libwebp ${webpPath}`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await sock.sendMessage(
      from,
      {
        sticker: fs.readFileSync(webpPath),
        mentions: target ? [sender, target] : [sender]
      },
      { quoted: msg }
    );

    fs.unlinkSync(gifPath);
    fs.unlinkSync(webpPath);

  } catch (err) {
    console.error("Anime action error:", err.message);
  }
};
