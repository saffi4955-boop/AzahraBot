// ==============================================
// 📸 Azahrabot Instagram Downloader (v14 — elite-protech API)
// Full error logging + robust URL builder
// ==============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");

function ensureTempDir() {
  const dir = path.join(__dirname, "../temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// -----------------------------
// Fetch media URLs from API (with debug)
// -----------------------------
async function getMediaFromAPI(igUrl) {
  const apiUrl = `https://eliteprotech-apis.zone.id/instagram?url=${encodeURIComponent(igUrl)}`;

  console.log("🔗 Calling API:", apiUrl);

  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    Accept: "application/json",
    Referer: "https://eliteprotech-apis.zone.id/",
    Origin: "https://eliteprotech-apis.zone.id",
  };

  const res = await axios.get(apiUrl, { headers, timeout: 20000 });
  const data = res.data;

  console.log("📦 API response:", JSON.stringify(data, null, 2));

  if (!data.success || !data.links || !data.links.length) {
    throw new Error(`API returned success=${data.success}, links length=${data.links?.length}`);
  }

  const downloadUrls = [];

  for (const item of data.links) {
    if (typeof item === "string") {
      if (item.startsWith("http")) downloadUrls.push(item);
    } else if (item && typeof item === "object") {
      // Format: { "https://cdn.downloadgram.app/": "token=..." }
      for (const [baseUrl, queryString] of Object.entries(item)) {
        if (typeof baseUrl === "string" && baseUrl.startsWith("http")) {
          // Build full URL: baseUrl + "?" + queryString
          const fullUrl = baseUrl + (queryString ? "?" + queryString : "");
          if (fullUrl.startsWith("http")) downloadUrls.push(fullUrl);
        }
      }
    }
  }

  console.log("✅ Extracted URLs:", downloadUrls);
  return downloadUrls;
}

// -----------------------------
// Download Media with browser-like headers
// -----------------------------
async function downloadMedia(url, dest) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Referer": "https://www.instagram.com/",
    "Origin": "https://www.instagram.com",
  };

  const res = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer",
    headers,
    timeout: 30000,
  });

  const buffer = Buffer.from(res.data);
  if (buffer.length < 2000) {
    throw new Error(`Downloaded file too small (${buffer.length} bytes) – likely broken link`);
  }
  fs.writeFileSync(dest, buffer);
}

// -----------------------------
// IG Command Handler
// -----------------------------
module.exports = async (sock, msg, from) => {
  try {
    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    const match = text.match(
      /(https?:\/\/(?:www\.)?(instagram\.com|instagr\.am)\/[^\s]+)/i
    );

    if (!match) {
      return await sock.sendMessage(
        from,
        { text: "❌ Invalid URL.\nExample: `.ig https://www.instagram.com/reel/...`" },
        { quoted: msg }
      );
    }

    const igUrl = match[0];
    await sock.sendMessage(from, { react: { text: "🔄", key: msg.key } });
    await sock.sendMessage(from, { text: "📸 *Fetching media...*" }, { quoted: msg });

    const mediaUrls = await getMediaFromAPI(igUrl);

    if (!mediaUrls.length) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ No media found – maybe private post." },
        { quoted: msg }
      );
    }

    const tempDir = ensureTempDir();
    let successCount = 0;

    for (let i = 0; i < mediaUrls.length; i++) {
      const mediaUrl = mediaUrls[i];
      const isVideo = mediaUrl.includes(".mp4") || mediaUrl.includes("video") || mediaUrl.includes("?token");
      const ext = isVideo ? "mp4" : "jpg";
      const savePath = path.join(tempDir, `ig_${Date.now()}_${i}.${ext}`);

      try {
        await downloadMedia(mediaUrl, savePath);
        const buffer = fs.readFileSync(savePath);
        const caption = "📥 *Downloaded by Azahra Bot*";

        if (isVideo) {
          await sock.sendMessage(from, { video: buffer, caption }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { image: buffer, caption }, { quoted: msg });
        }

        fs.unlinkSync(savePath);
        successCount++;
        await new Promise(r => setTimeout(r, 700));
      } catch (err) {
        console.error(`❌ Item ${i} download failed:`, err.message);
        await sock.sendMessage(
          from,
          { text: `⚠️ Media ${i+1} failed: ${err.message}` },
          { quoted: msg }
        );
      }
    }

    if (successCount === 0) {
      throw new Error("All downloads failed");
    }

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("🔥 IG Command Error:", err.message);
    await sock.sendMessage(
      from,
      { text: `❌ Failed: ${err.message}` },
      { quoted: msg }
    );
  }
};