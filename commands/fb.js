// ==============================================
// 📘 Azahrabot Facebook Downloader (v12 — elite-protech /facebook)
// ✅ Uses: https://eliteprotech-apis.zone.id/facebook (single video URL)
// ==============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");

function ensureTempDir() {
  const dir = path.join(__dirname, "../temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Expand Facebook shortlinks
async function expandFacebookUrl(url) {
  try {
    const res = await axios.get(url, { maxRedirects: 0, validateStatus: null });
    const loc = res.headers.location;
    if (loc && loc.startsWith("http")) {
      console.log("🔗 Expanded Facebook shortlink");
      return loc;
    }
  } catch {}
  return url;
}

// Extract Facebook URL from text
function extractFacebookUrl(text = "") {
  const fbRegex =
    /(https?:\/\/(?:www\.|m\.|fb\.|web\.|l\.)?(facebook\.com|fb\.watch)[^\s]*)/i;
  const match = text.match(fbRegex);
  return match ? match[0].split("?")[0] : null;
}

// Robust download with proper headers for fbcdn
async function downloadMedia(url, destPath) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "video/webm,video/mp4,video/*;q=0.9,image/jpeg,image/*;q=0.8,*/*;q=0.5",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.facebook.com/",
    "Origin": "https://www.facebook.com",
    "Connection": "keep-alive",
  };

  const res = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer",
    headers,
    timeout: 30000,
    maxRedirects: 5,
  });

  const buffer = Buffer.from(res.data);
  if (buffer.length < 5000) {
    throw new Error("Downloaded file too small – likely invalid");
  }

  fs.writeFileSync(destPath, buffer);
}

module.exports = async (sock, msg, from) => {
  try {
    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const fbUrl = extractFacebookUrl(text);

    if (!fbUrl) {
      return await sock.sendMessage(
        from,
        {
          text: "❌ Invalid Facebook URL.\nExample:\n`.fb https://www.facebook.com/share/v/...`\n`.fb https://fb.watch/.../`",
        },
        { quoted: msg }
      );
    }

    const finalUrl = await expandFacebookUrl(fbUrl);
    await sock.sendMessage(from, { react: { text: "📘", key: msg.key } });
    await sock.sendMessage(from, { text: "📘 *Fetching Facebook video...*" }, { quoted: msg });

    // --- NEW ENDPOINT (single video URL) ---
    const apiUrl = `https://eliteprotech-apis.zone.id/facebook?url=${encodeURIComponent(finalUrl)}`;
    const res = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
        Accept: "application/json",
      },
      timeout: 25000,
    });

    const data = res.data;

    if (!data.success || !data.video) {
      throw new Error("No video URL returned from API");
    }

    const videoUrl = data.video;

    // --- Download and send ---
    const tempDir = ensureTempDir();
    const filePath = path.join(tempDir, `fb_${Date.now()}.mp4`);

    await downloadMedia(videoUrl, filePath);

    const buffer = fs.readFileSync(filePath);
    await sock.sendMessage(
      from,
      {
        video: buffer,
        caption: `📥 *Downloaded by Azahra Bot (Facebook)*\nSource: ${data.source || "Facebook"}`,
      },
      { quoted: msg }
    );

    fs.unlinkSync(filePath);
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    console.error("❌ Facebook download error:", err.message);
    await sock.sendMessage(
      from,
      { text: `❌ Failed: ${err.message}` },
      { quoted: msg }
    );
  }
};