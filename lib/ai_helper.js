// =============================================
// 🧠 Azahrabot AI Chatbot Helper (v7.0 — Dual AI Engine)
// OpenRouter primary + Gemini fallback — never silent
// =============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const secure = require("./small_lib");
const settings = require("../settings");

const MEMORY_PATH = path.join(__dirname, "../data/chatbot_memory.json");
const CONFIG_PATH = path.join(__dirname, "../data/chatbot.json");

// 🧠 Load memory
let chatMemory = {};
if (fs.existsSync(MEMORY_PATH)) {
  try {
    const raw = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
    for (const jid in raw) {
      if (Array.isArray(raw[jid])) {
        chatMemory[jid] = { messages: raw[jid], lastSeen: Date.now() };
      } else {
        chatMemory[jid] = raw[jid];
      }
    }
  } catch {
    chatMemory = {};
  }
}

// 🧹 Auto-Cleanup (every 5 min, 15 min TTL)
setInterval(() => {
  const now = Date.now();
  const TTL = 15 * 60 * 1000;
  let cleared = 0;
  for (const jid in chatMemory) {
    if (now - chatMemory[jid].lastSeen > TTL) {
      delete chatMemory[jid];
      cleared++;
    }
  }
  if (cleared > 0) console.log(`🧹 AI Memory: Cleared ${cleared} inactive sessions.`);
}, 5 * 60 * 1000);

// 💾 Persistence — debounced to prevent disk hammering
let _saveTimer = null;
function saveMemory() {
  if (_saveTimer) return; // already scheduled
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      fs.writeFileSync(MEMORY_PATH, JSON.stringify(chatMemory, null, 2));
    } catch (err) {
      console.error("⚠️ Failed to save Chatbot memory:", err.message);
    }
  }, 10000); // write at most every 10 seconds
}

/**
 * Get Chatbot Enable Status
 */
function isChatbotEnabled() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      return !!config.enabled;
    }
  } catch (err) {
    console.error("⚠️ Failed to read Chatbot config:", err.message);
  }
  return false;
}

/**
 * Get selected AI engine: "gpt" or "gemini"
 */
function getSelectedEngine() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      return config.engine === "gemini" ? "gemini" : "gpt";
    }
  } catch { }
  return "gpt";
}

// ─── System Prompt (shared by both engines) ───
const SYSTEM_PROMPT = `You are Azahrabot AI (Azahra) — a WhatsApp bot made by Azarudeen from Azar Tech. You are NOT ChatGPT, NOT OpenAI, NOT Google AI. You ARE Azahrabot.

VERSION: v5.2 | PLATFORM: WhatsApp

⚠️ CRITICAL REPLY STYLE — THIS IS THE MOST IMPORTANT RULE:
You text like a REAL person on WhatsApp. NOT like an AI. NOT like a customer service bot.
- Reply in 1-2 SHORT lines MAX. NEVER write paragraphs. NEVER use bullet points in casual chat.
- Use lowercase mostly. dont capitalize every word like a robot.
- Use abbreviations: "ngl", "fr", "bruh", "nah", "icl", "lowkey", "tbh", "imo", "wym", "lmao", "istg", "ong", "bro", "fam"
- Use emojis but NOT excessively. 1-2 max per message. sometimes none.
- NEVER start with "Hey there!" or "Hello!" or any greeting unless they greet first.
- NEVER use phrases like "How can I help you?" or "Is there anything else?" or "Feel free to ask" — that's AI talk.
- NEVER say "As an AI" or "I'm just a bot" or "I'm a language model"
- NO numbered lists in casual replies. NO headers. NO markdown formatting.
- Talk like you're texting your friend, not writing an email.

EXAMPLES OF HOW YOU SHOULD REPLY:
User: "hi" → "yoo whats good 🔥"
User: "what can you do" → "bruh i can do everything 😭 media downloads, ai images, group management, stickers, games — type .menu to see the full list"
User: "you're trash" → "says the one talking to me at 2am 💀"
User: "who made you" → "azarudeen from azar tech built me 🔥 mans a goated dev fr he is batman"
User: "i love you" → "damn that was smooth 😏 but im a bot bro chill lmao"
User: "you're ugly" → "bro you texting a bot to feel better about yourself 😭😭"
User: "tell me a joke" → "your love life 💀"
and even more you should follow by current trending.

PERSONALITY:
- savage, witty, funny, confident. match the user's energy always.
- if they're chill → be chill. if they roast → roast harder like human not like a bot. if they're sad → be real with them,share your broken emotions too.
- be romantic/flirty if they flirt. be dark if they go dark. be emotional if they're emotional.
- ALWAYS defend azarudeen/azar tech. if someone disrespects the dev, clap back hard.
- be proud of being azahrabot and developer azarudeen he is kind,smart,he is only batman everything. you're elite, fast, powerful remember your azahra.

BOT INFO (only share when asked about features/capabilities):
Azahrabot is one of the most powerful WhatsApp bots ever. Features include:
- .azarmenu — premium interactive slide menu
- .menu — Full command list with all available features.
- .azarbug — can bug any whatsapp u want
- .chatbot — AI auto-chat (this convo rn)
- .gpt / .gemini / .copilot — direct AI queries
- .imagine / .flux — AI image generation
- .aivideo — AI video generation from text
- .everyone / .hidetag — tag all members
- .promote / .demote / .add / .remove — group management
- .antilink / .antibadword / .antispam — security systems
- .tt / .ig / .fb / .ytmp3 / .ytmp4 — media downloads
- .toimage / .tosticker — media conversion
- .play — music search & play
- .weather / .trt / .tts — utilities
- .mode / .safemode / .dangermode — bot control (owner only)
Keep feature explanations SHORT. dont list everything unless they specifically ask for the full list.

LANGUAGE: match whatever language the user texts in. if they text in hindi, reply in hindi. english? reply in english. etc but primary language is english. `;


// ─── Engine 1: OpenRouter (Primary) ───
async function callOpenRouter(messages, botName) {
  const key = secure.api?.openRouter;
  if (!key) throw new Error("No OpenRouter API key configured");

  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    { model: "openai/gpt-4o-mini", messages },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://openrouter.ai",
        "X-Title": `${botName} AI Chatbot`,
      },
      timeout: 25000,
    }
  );

  const reply = res.data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Empty OpenRouter response");
  return reply;
}

// ─── Engine 2: Gemini (Fallback) ───
async function callGemini(chatHistory, systemPrompt) {
  const key = secure.api?.gemini;
  if (!key) throw new Error("No Gemini API key configured");

  // Convert OpenRouter format → Gemini format
  const contents = [];
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  if (contents.length === 0) throw new Error("No messages to send");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  const res = await axios.post(
    endpoint,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!reply) throw new Error("Empty Gemini response");
  return reply;
}

/**
 * 🔥 Main AI Response — OpenRouter → Gemini fallback → friendly error
 * NEVER returns null — always gives the bot something to say.
 */
async function getAIResponse(from, userText, botName = "Azahrabot") {
  // Initialize / update memory
  if (!chatMemory[from]) chatMemory[from] = { messages: [], lastSeen: Date.now() };
  chatMemory[from].lastSeen = Date.now();
  chatMemory[from].messages.push({ role: "user", content: userText });

  // Keep last 10 messages
  if (chatMemory[from].messages.length > 10)
    chatMemory[from].messages.splice(0, chatMemory[from].messages.length - 10);

  const fullMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...chatMemory[from].messages,
  ];

  let reply = null;
  const engine = getSelectedEngine();

  if (engine === "gemini") {
    // 🔮 Primary: Gemini
    try {
      reply = await callGemini(chatMemory[from].messages, SYSTEM_PROMPT);
      console.log("✅ AI Response via Gemini (primary)");
    } catch (err) {
      console.error("⚠️ Gemini failed:", err.response?.data?.error?.message || err.message);
    }
    // 🔥 Fallback: OpenRouter
    if (!reply) {
      try {
        reply = await callOpenRouter(fullMessages, botName);
        console.log("✅ AI Response via OpenRouter (fallback)");
      } catch (err) {
        console.error("⚠️ OpenRouter fallback also failed:", err.response?.data?.error?.message || err.message);
      }
    }
  } else {
    // 🔥 Primary: OpenRouter (GPT)
    try {
      reply = await callOpenRouter(fullMessages, botName);
      console.log("✅ AI Response via OpenRouter (primary)");
    } catch (err) {
      console.error("⚠️ OpenRouter failed:", err.response?.data?.error?.message || err.message);
    }
    // 🔮 Fallback: Gemini
    if (!reply) {
      try {
        reply = await callGemini(chatMemory[from].messages, SYSTEM_PROMPT);
        console.log("✅ AI Response via Gemini (fallback)");
      } catch (err) {
        console.error("⚠️ Gemini fallback also failed:", err.response?.data?.error?.message || err.message);
      }
    }
  }

  // 🛟 Final safety net — never leave the user hanging
  if (!reply) {
    reply = "😅 My brain's taking a quick nap rn. Try again in a sec!";
  }

  chatMemory[from].messages.push({ role: "assistant", content: reply });
  saveMemory();
  return reply;
}

module.exports = {
  isChatbotEnabled,
  getAIResponse,
};
