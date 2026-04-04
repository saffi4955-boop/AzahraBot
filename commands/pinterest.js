// commands/pinterest.js
// 📌 Azahrabot Pinterest Downloader (princetechn API)
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_KEY = "prince";
const API_URL = "https://api.princetechn.com/api/download/pinterestdl";

function ensureTempDir() {
    const dir = path.join(__dirname, "../temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// Download file from URL to buffer
async function downloadFile(url, timeoutMs = 30000) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: timeoutMs,
        maxContentLength: 50 * 1024 * 1024, // 50MB limit
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });
    return Buffer.from(response.data);
}

// Extract best media from API response
function getBestMedia(mediaArray) {
    // First try to find video (MP4)
    const videos = mediaArray.filter(item => item.format === "MP4");
    if (videos.length) {
        // Prefer higher quality: look for "720p", "1080p", etc.
        const qualityOrder = ["1080p", "720p", "480p", "360p", "240p", "144p"];
        for (const quality of qualityOrder) {
            const found = videos.find(v => v.type.toLowerCase().includes(quality));
            if (found) return found;
        }
        // If no quality match, return first video
        return videos[0];
    }
    // Otherwise, get image (JPG)
    const images = mediaArray.filter(item => item.format === "JPG");
    if (images.length) return images[0];
    return null;
}

module.exports = async (sock, msg, from, text, args, store) => {
    try {
        // Get Pinterest URL from arguments
        let pinterestUrl = args[0];
        if (!pinterestUrl) {
            return sock.sendMessage(
                from,
                { text: "❌ *Usage:* `.pinterest <Pinterest URL>`\nExample: `.pinterest https://pin.it/1cR6JJNpv`" },
                { quoted: msg }
            );
        }

        // Remove any extra text after URL (if user wrote more)
        const urlMatch = pinterestUrl.match(/https?:\/\/[^\s]+/);
        if (!urlMatch) throw new Error("Invalid URL format");
        pinterestUrl = urlMatch[0];

        await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });
        await sock.sendMessage(from, { text: "📌 *Fetching Pinterest media...*" }, { quoted: msg });

        // Call the API
        const apiCallUrl = `${API_URL}?apikey=${API_KEY}&url=${encodeURIComponent(pinterestUrl)}`;
        console.log("📡 Pinterest API:", apiCallUrl);

        const response = await axios.get(apiCallUrl, {
            headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
            timeout: 15000,
        });

        const data = response.data;
        console.log("📦 API Response:", JSON.stringify(data, null, 2));

        if (!data.success || !data.result?.media?.length) {
            throw new Error(data.message || "No media found. The pin might be private or invalid.");
        }

        const mediaArray = data.result.media;
        const bestMedia = getBestMedia(mediaArray);
        if (!bestMedia) throw new Error("No downloadable media found.");

        const downloadUrl = bestMedia.download_url;
        const mediaType = bestMedia.format === "MP4" ? "video" : "image";
        const quality = bestMedia.type || (mediaType === "video" ? "Video" : "Image");

        await sock.sendMessage(from, { react: { text: "📥", key: msg.key } });
        await sock.sendMessage(from, { text: `⏳ Downloading ${mediaType} (${quality})...` }, { quoted: msg });

        // Download the file
        const fileBuffer = await downloadFile(downloadUrl);
        const fileSizeMB = fileBuffer.length / (1024 * 1024);
        const title = data.result.title || "Pinterest Media";
        const caption = `📌 *${title.substring(0, 80)}*\n📦 Size: ${fileSizeMB.toFixed(1)}MB\n> Downloaded via AzahraBot`;

        // Send according to type
        if (mediaType === "video") {
            await sock.sendMessage(from, {
                video: fileBuffer,
                mimetype: "video/mp4",
                caption: caption,
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                image: fileBuffer,
                caption: caption,
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error("❌ Pinterest command error:", err.message);
        await sock.sendMessage(from, {
            text: `❌ *Failed to download:*\n${err.message}\n\nPlease check the URL and try again.`,
        }, { quoted: msg });
        await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } });
    }
};