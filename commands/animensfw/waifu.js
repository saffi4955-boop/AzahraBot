// commands/database/waifu.js
const axios = require("axios");

const API_KEY = "prince";
const ENDPOINT = "https://api.princetechn.com/api/anime/waifu";

module.exports = async (sock, msg, from, text, args, store) => {
    try {
        await sock.sendMessage(from, { react: { text: "🖼️", key: msg.key } });

        const response = await axios.get(ENDPOINT, {
            params: { apikey: API_KEY },
            timeout: 10000,
        });

        const data = response.data;
        if (!data.success || !data.result) throw new Error("No image URL");

        const imageUrl = data.result;
        const imgResponse = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        const imageBuffer = Buffer.from(imgResponse.data);

        await sock.sendMessage(from, {
            image: imageBuffer,
            caption: `🌸 *Waifu* — Random anime wife\n> Powered by AzahraBot`,
        }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
    } catch (err) {
        console.error("Waifu command error:", err.message);
        await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } });
    }
};