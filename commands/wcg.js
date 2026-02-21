// ==============================================
// 🎮 WCG — Word Chain Game
// Azahrabot
// ==============================================

const { isDictionaryWord } = require("../lib/dictionary");
const wcgStore = require("../lib/wcgStore");

// -----------------------------
// In-memory game state (per group)
// -----------------------------
if (!global.__WCG__) global.__WCG__ = {};
const GAMES = global.__WCG__;

// -----------------------------
// Helpers
// -----------------------------
const now = () => Date.now();
const numFromJid = (jid) => jid.replace(/\D/g, "");
const isValidFormat = (w) => /^[a-z]+$/.test(w) && w.length >= 3;

// -----------------------------
// Main Command
// -----------------------------
module.exports = async function (sock, msg, from, text, args) {
  if (!from.endsWith("@g.us")) {
    return sock.sendMessage(from, { text: "❌ WCG works only in groups." });
  }

  const sender = msg.key.participant;
  const number = numFromJid(sender);

  // -----------------------------
  // Init game object if missing
  // -----------------------------
  if (!GAMES[from]) {
    GAMES[from] = {
      active: false,
      players: {},          // number -> { score }
      usedWords: new Set(),
      currentWord: null,
      level: 1,
      timeLimit: 60,
      lastMoveAt: 0,
      joinTimeout: null,
    };
  }

  const game = GAMES[from];
  const cmd = args[0]?.toLowerCase();

  // =================================================
  // START GAME
  // =================================================
  if (cmd === "start") {
    if (game.active) {
      return sock.sendMessage(from, { text: "⚠️ WCG is already running." });
    }

    game.active = true;
    game.players = {};
    game.usedWords = new Set();
    game.currentWord = null;
    game.level = 1;
    game.timeLimit = 60;
    game.lastMoveAt = now();

    // cancel if nobody joins
    game.joinTimeout = setTimeout(() => {
      if (Object.keys(game.players).length === 0) {
        game.active = false;
        sock.sendMessage(from, {
          text: "❌ WCG cancelled. No one joined.",
        });
      }
    }, 150_000);

    return sock.sendMessage(from, {
      text:
        "🎮 *Word Chain Game Started!*\n\n" +
        "• `.wcg join` to participate\n" +
        "• Type `.wcg <word>` to play\n" +
        "• Real dictionary words only\n\n" +
        "⏳ Game cancels if no one joins in 150 seconds",
    });
  }

  // =================================================
  // JOIN
  // =================================================
  if (cmd === "join") {
    if (!game.active) {
      return sock.sendMessage(from, { text: "❌ No active WCG game." });
    }

    if (!game.players[number]) {
      game.players[number] = { score: 0 };
    }

    const timeLeft = Math.max(
      0,
      Math.floor(
        (game.lastMoveAt + game.timeLimit * 1000 - now()) / 1000
      )
    );

    return sock.sendMessage(from, {
      text:
        `✅ *@${number}* joined WCG!\n` +
        `🎯 Level: ${game.level}\n` +
        `⏳ Time left: ${timeLeft}s`,
      mentions: [sender],
    });
  }

  // =================================================
  // LEAVE
  // =================================================
  if (cmd === "leave") {
    if (game.players[number]) {
      delete game.players[number];
      return sock.sendMessage(from, {
        text: `👋 *@${number}* left the WCG game.`,
        mentions: [sender],
      });
    }
    return;
  }

  // =================================================
  // STATUS
  // =================================================
  if (cmd === "status") {
    return sock.sendMessage(from, {
      text: game.active
        ? `🎮 *WCG ACTIVE*\n\nPlayers: ${Object.keys(game.players).length}\nLevel: ${game.level}\n⏳ Time limit: ${game.timeLimit}s`
        : "❌ No active WCG game.",
    });
  }

  // =================================================
  // LEADERBOARD (GLOBAL)
  // =================================================
  if (cmd === "leaderboard") {
    const top = wcgStore.getTop(10);

    if (!top.length) {
      return sock.sendMessage(from, { text: "📉 No WCG scores yet." });
    }

    const textLb = top
      .map((p, i) => `${i + 1}. @${p.number} — ${p.score} pts`)
      .join("\n");

    return sock.sendMessage(from, {
      text: `🏆 *WCG Leaderboard*\n\n${textLb}`,
      mentions: top.map((p) => `${p.number}@s.whatsapp.net`),
    });
  }

  // =================================================
  // PLAY WORD (.wcg sun)
  // =================================================
  if (!cmd || !game.active) return;
  if (!game.players[number]) return;

  const word = cmd.toLowerCase();

  // format check
  if (!isValidFormat(word)) {
    return sock.sendMessage(from, {
      text: `❌ *@${number}* invalid format.\nUse letters only (min 3).`,
      mentions: [sender],
    });
  }

  // dictionary check (REAL WORD)
  const isDict = await isDictionaryWord(word);
  if (!isDict) {
    return sock.sendMessage(from, {
      text: `❌ *@${number}* "${word}" is not a valid dictionary word.\nTry again.`,
      mentions: [sender],
    });
  }

  // repeated word
  if (game.usedWords.has(word)) {
    return sock.sendMessage(from, {
      text: `❌ *@${number}* "${word}" already used.`,
      mentions: [sender],
    });
  }

  // chain rule
  if (game.currentWord) {
    const mustStart = game.currentWord.slice(-1);
    if (word[0] !== mustStart) {
      return sock.sendMessage(from, {
        text: `❌ *@${number}* word must start with '${mustStart}'.`,
        mentions: [sender],
      });
    }
  }

  // timeout check
  if (now() - game.lastMoveAt > game.timeLimit * 1000) {
    game.active = false;
    return sock.sendMessage(from, {
      text: "⏰ Time over! WCG ended.",
    });
  }

  // =================================================
  // ACCEPT MOVE
  // =================================================
  game.usedWords.add(word);
  game.currentWord = word;
  game.lastMoveAt = now();

  const points = word.length + game.level;
  game.players[number].score += points;
  wcgStore.addScore(number, points);

  // level scaling (fair)
  const playerCount = Object.keys(game.players).length;
  if (game.usedWords.size % Math.max(3, playerCount) === 0) {
    game.level++;
    game.timeLimit = Math.max(15, 60 - game.level * 5);
  }

  return sock.sendMessage(from, {
    text:
      `✅ *@${number}* played *${word}*\n` +
      `🎯 +${points} points\n` +
      `📈 Level: ${game.level}\n` +
      `⏳ Next limit: ${game.timeLimit}s`,
    mentions: [sender],
  });
};
