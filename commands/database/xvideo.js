// commands/video.js

const axios = require("axios");
const fs = require("fs");
const path = require("path");

function ensureTempDir() {
    const dir = path.join(__dirname, "../temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function downloadFile(url, dest) {
    const res = await axios({
        url,
        method: "GET",
        responseType: "stream",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(dest);
        res.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

module.exports = async (sock, msg, from, text, args) => {
    try {
        const query = args.join(" ");
        if (!query) {
            return sock.sendMessage(from, {
                text: "Usage: .video <query>"
            }, { quoted: msg });
        }

        await sock.sendMessage(from, {
            react: { text: "🎬", key: msg.key }
        });

        // 🔥 FIX: space → +
        const q = query.trim().split(/\s+/).join("+");

        // =========================
        // 🔍 SEARCH API
        // =========================
        const searchApi = `https://api.princetechn.com/api/search/xvideossearch?apikey=prince&query=${q}`;
        const searchRes = await axios.get(searchApi);

        const results = searchRes.data?.results;
        if (!results || results.length === 0) {
            throw new Error("No results");
        }

        const first = results[0];

        const pageUrl = first.url;
        const title = first.title;
        const thumb = first.thumb;

        if (!pageUrl) throw new Error("No video page");

        // =========================
        // 📥 DOWNLOAD API
        // =========================
        const downloadApi = `https://api.princetechn.com/api/download/xvideosdl?apikey=prince&url=${encodeURIComponent(pageUrl)}`;
        const dlRes = await axios.get(downloadApi);

        const data = dlRes.data?.result;
        if (!data || !data.download_url) {
            throw new Error("Download API failed");
        }

        const videoUrl = data.download_url;

        // =========================
        // 🎬 UI MESSAGE (YOUR STYLE)
        // =========================
        await sock.sendMessage(from, {
            text: `
🎬 *${data.title || title}*
────────────────────
👁 ${data.views || "N/A"}
📦 ${data.size || "Unknown"}
────────────────────
⬇️ Downloading video...
`.trim(),
            contextInfo: {
                externalAdReply: {
                    title: data.title || title,
                    body: data.views || "",
                    thumbnailUrl: data.thumbnail || thumb,
                    sourceUrl: pageUrl,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });

        // =========================
        // 📦 DOWNLOAD FILE
        // =========================
        const tempDir = ensureTempDir();
        const filePath = path.join(tempDir, `video_${Date.now()}.mp4`);

        await downloadFile(videoUrl, filePath);

        const buffer = fs.readFileSync(filePath);

        // =========================
        // 📤 SEND VIDEO
        // =========================
        await sock.sendMessage(from, {
            video: buffer,
            mimetype: "video/mp4",
            fileName: `${(data.title || "video").slice(0, 50)}.mp4`,
            caption: `🎬 ${data.title || title}`
        }, { quoted: msg });

        fs.unlinkSync(filePath);

        await sock.sendMessage(from, {
            react: { text: "✅", key: msg.key }
        });

    } catch (err) {
        console.error("VIDEO ERROR:", err.message);

        await sock.sendMessage(from, {
            text: "❌ Failed to fetch video"
        }, { quoted: msg });

        await sock.sendMessage(from, {
            react: { text: "⚠️", key: msg.key }
        }).catch(() => { });
    }
};