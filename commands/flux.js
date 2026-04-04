const axios = require("axios");
const settings = require("../settings");

const HF_TOKEN = "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";

module.exports = async (sock, msg, from, body, args) => {

    const prompt = args.join(" ").trim();

    if (!prompt) {
        return sock.sendMessage(from, {
            text: `🖼 Example:\n${settings.prefix}flux cyberpunk city`
        }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } }).catch(() => { });

    await sock.sendMessage(from, {
        text: "⌛ Generating image (AI)…"
    }, { quoted: msg });

    try {

        const res = await axios({
            method: "POST",
            url: "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "image/png",
                "X-Wait-For-Model": "true"
            },
            data: {
                inputs: prompt
            },
            responseType: "arraybuffer",
            timeout: 60000
        });

        const buffer = Buffer.from(res.data);

        await sock.sendMessage(from, {
            image: buffer,
            caption: `🎨 Prompt: ${prompt}\n> ${settings.author}`
        }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => { });

    } catch (e) {

        console.log(e.response?.data?.toString() || e.message);

        await sock.sendMessage(from, {
            text: "❌ AI failed. Try again later."
        }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => { });

    }

};