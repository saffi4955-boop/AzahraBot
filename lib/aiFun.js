const axios = require("axios");
const secure = require("./small_lib");

async function getAIResponse(prompt) {
    const key = secure.api.openRouter || process.env.OPENROUTER_KEY;

    if (!key) return "⚠️ Missing OpenRouter API key.";

    try {
        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content:
                            "Reply in short Gen-Z style. Max 2–3 lines. No paragraphs. No long explanations. Keep it punchy, witty, clean, and fun."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            },
            {
                headers: {
                    "Authorization": `Bearer ${key}`,
                    "HTTP-Referer": "https://openrouter.ai",
                    "X-Title": "AzahraBot-Fun",
                    "Content-Type": "application/json"
                },
                timeout: 20000
            }
        );

        let out = res.data?.choices?.[0]?.message?.content;
        if (Array.isArray(out)) out = out.join(" ");

        return out?.trim() || "⚠️ No response.";
    } catch (e) {
        console.log("AI Fun Error:", e.response?.data || e.message);
        return "⚠️ AI error, try again.";
    }
}

module.exports = getAIResponse;
