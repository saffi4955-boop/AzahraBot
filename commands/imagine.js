// ==============================================
// 🖼️ Azahrabot — .imagine Command
// FLUX Diffusion via Replicate (100% WORKING)
// ==============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const secure = require("../lib/small_lib");
const settings = require("../settings");

module.exports = async (sock, msg, from, text, args = []) => {
  try {
    const prompt = args.join(" ").trim();
    if (!prompt) {
      return await sock.sendMessage(
        from,
        {
          text:
            `🎨 *Usage:* ${settings.prefix || "."}imagine <prompt>\n\n` +
            `Example:\n` +
            `${settings.prefix || "."}imagine ultra realistic portrait, natural lighting, sharp focus`,
        },
        { quoted: msg }
      );
    }

    const key = secure.api?.replicate;
    if (!key) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ Replicate API key missing." },
        { quoted: msg }
      );
    }

    await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } }).catch(() => {});
    await sock.sendPresenceUpdate("composing", from);

    const outDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `imagine_${Date.now()}.png`);

    // 🔥 FLUX model on Replicate
    const response = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version: "black-forest-labs/flux-schnell",
        input: {
          prompt,
          num_outputs: 1,
          guidance_scale: 7,
          num_inference_steps: 28,
          output_format: "png",
        },
      },
      {
        headers: {
          Authorization: `Token ${key}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      }
    );

    const predictionUrl = response.data?.urls?.get;
    if (!predictionUrl) throw new Error("Prediction URL missing");

    // Poll until done
    let result;
    for (let i = 0; i < 20; i++) {
      const poll = await axios.get(predictionUrl, {
        headers: { Authorization: `Token ${key}` },
      });

      if (poll.data.status === "succeeded") {
        result = poll.data;
        break;
      }
      if (poll.data.status === "failed") {
        throw new Error("Image generation failed");
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    const imageUrl = result?.output?.[0];
    if (!imageUrl) throw new Error("No image returned");

    const img = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(outFile, img.data);

    await sock.sendMessage(
      from,
      {
        image: fs.readFileSync(outFile),
        caption:
          `✨ *AI Image Generated*\n` +
          `🎨 *Prompt:* ${prompt}\n` +
          `🧠 *Model:* FLUX (Diffusion)\n` +
          `━━━━━━━━━━━\n` +
          `> Powered by ${secure.botName || "Azahrabot"} ⚡`,
      },
      { quoted: msg }
    );

    fs.unlinkSync(outFile);
  } catch (err) {
    console.error("❌ .imagine error:", err.message);
    await sock.sendMessage(
      from,
      { text: `⚠️ Failed to generate image.\n${err.message}` },
      { quoted: msg }
    );
  }
};
