// ==============================================
// 💖 Anime Action System (FINAL STABLE)
// Azahrabot
// ==============================================

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

function getTarget(msg) {
  return (
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    null
  );
}

module.exports = async (sock, msg, from, text, command) => {
  try {
    // ❗ Safety check (fixes your 404 bug)
    if (!command) {
      console.log("❌ Missing command in animeAction");
      return;
    }

    console.log("Anime Command:", command);

    const target = getTarget(msg);
    const sender = msg.key.participant || msg.key.remoteJid;

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

    // ✅ FIXED reaction (correct message always)
    await sock.sendMessage(from, {
      react: {
        text: EMOJI[command] || "💖",
        key: {
          remoteJid: msg.key.remoteJid,
          fromMe: msg.key.fromMe,
          id: msg.key.id
        }
      }
    }).catch(() => { });

    // 🔥 API call
    let gifUrl = "";
    try {
      if (command === "facepalm" || command === "nom") {
        const res = await axios.get(`https://nekos.best/api/v2/${command === "nom" ? "bored" : command}`);
        gifUrl = res.data?.results?.[0]?.url;
      } else {
        const res = await axios.get(`https://api.waifu.pics/sfw/${command}`);
        gifUrl = res.data?.url;
      }
    } catch (e) {
      console.log("Anime API error:", e.message);
    }

    if (!gifUrl) {
      return sock.sendMessage(from, {
        text: "❌ Couldn't fetch anime action."
      }, { quoted: msg });
    }

    // ✅ unique file fix (no overwrite bug)
    const id = Date.now();
    const gifPath = path.join(__dirname, `anime_${id}.gif`);
    const webpPath = path.join(__dirname, `anime_${id}.webp`);

    const buffer = (await axios.get(gifUrl, {
      responseType: "arraybuffer"
    })).data;

    fs.writeFileSync(gifPath, buffer);

    // 🎬 convert to sticker
    await new Promise((resolve, reject) => {
      exec(
        `"${ffmpegPath}" -i "${gifPath}" -vf "fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -loop 0 -an -vsync 0 -vcodec libwebp "${webpPath}"`,
        (err) => (err ? reject(err) : resolve())
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
    console.error("Anime FULL ERROR:", err);

    await sock.sendMessage(from, {
      text: "❌ Anime sticker failed: " + err.message
    }, { quoted: msg });
  }
};