// commands/database/ttt.js
// 🎮 Azahrabot — TicTacToe (Persistent + Room Codes + Smart Logic)
// powered by AzarTech ⚡

const fs = require("fs");
const path = require("path");
const TicTacToe = require("../../lib/tictactoe");

const SAVE_PATH = path.join(process.cwd(), "data", "ttt_games.json");

// ================================
// 🔥 PERSISTENCE SYSTEM
// ================================

let games = {};

function saveGames() {
  try {
    fs.writeFileSync(SAVE_PATH, JSON.stringify(games, null, 2));
  } catch (e) {
    console.error("Failed saving TTT:", e);
  }
}

function loadGames() {
  try {
    if (fs.existsSync(SAVE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SAVE_PATH));
      // rebuild TicTacToe objects
      for (const id in raw) {
        const old = raw[id];
        const game = new TicTacToe(old.game.playerX, old.game.playerO);
        game._x = old.game._x;
        game._o = old.game._o;
        game._currentTurn = old.game._currentTurn;
        game.turns = old.game.turns;

        games[id] = {
          ...old,
          game
        };
      }
    }
  } catch (e) {
    console.error("Failed loading TTT:", e);
  }
}

loadGames();

// ================================
// HELPERS
// ================================
function mention(jid) {
  return `@${jid.split("@")[0]}`;
}

function renderBoard(game) {
  const map = {
    X: "❎", O: "⭕",
    1: "1️⃣", 2: "2️⃣", 3: "3️⃣",
    4: "4️⃣", 5: "5️⃣", 6: "6️⃣",
    7: "7️⃣", 8: "8️⃣", 9: "9️⃣"
  };
  const t = game.render().map(v => map[v]);
  return `${t[0]}${t[1]}${t[2]}\n${t[3]}${t[4]}${t[5]}\n${t[6]}${t[7]}${t[8]}`;
}

function findWaitingRoom(chatId, name = null) {
  return Object.values(games).find(
    r => r.chatId === chatId && r.state === "WAITING" && (!name || r.roomName === name)
  );
}

function findPlayerGame(chatId, jid) {
  return Object.values(games).find(
    r => r.chatId === chatId && r.state === "PLAYING" &&
      (r.game.playerX === jid || r.game.playerO === jid)
  );
}

function createRoom(chatId, playerX, roomName = null) {
  const id = "ttt-" + Date.now();
  games[id] = {
    id,
    chatId,
    x: playerX,
    o: "",
    state: "WAITING",
    roomName,
    game: new TicTacToe(playerX, null)
  };
  saveGames();
  return games[id];
}

// ================================
// MAIN COMMAND MODULE
// ================================
module.exports = async function ttt(sock, msg, from, text, args, store, moveMode = false) {
  try {
    const sender = msg.key.participant || msg.key.remoteJid;
    const chatId = from;
    const input = text.trim().toLowerCase();

    const isMove = /^[1-9]$/.test(input);
    const isSurrender = /^(surrender|give up)$/i.test(input);

    // Load game player is already in:
    let room = findPlayerGame(chatId, sender);

    // ============================================
    // ⛔ MOVE HANDLER (only if user is in a game)
    // ============================================
    if (room) {
      if (isSurrender) {
        const winner = sender === room.game.playerX ? room.game.playerO : room.game.playerX;
        await sock.sendMessage(chatId, {
          text: `🏳️ ${mention(sender)} surrendered!\n🎉 Winner: ${mention(winner)}\n\n> powered by AzarTech ⚡`,
          mentions: [sender, winner]
        });
        delete games[room.id];
        saveGames();
        return;
      }

      if (!isMove) return; // ignore non-moves

      if (sender !== room.game.currentTurn) {
        return sock.sendMessage(chatId, { text: "❌ Wait for your turn." }, { quoted: msg });
      }

      const pos = parseInt(input) - 1;
      const isO = sender === room.game.playerO;

      const res = room.game.turn(isO, pos);
      if (res === 0) return sock.sendMessage(chatId, { text: "❌ That spot is taken." }, { quoted: msg });
      if (res === -1) return sock.sendMessage(chatId, { text: "⚠️ Invalid move." }, { quoted: msg });

      const board = renderBoard(room.game);
      const winner = room.game.winner;
      const tie = room.game.turns >= 9;

      if (winner) {
        await sock.sendMessage(chatId, {
          text: `🎉 ${mention(winner)} wins!\n\n${board}\n\n> powered by AzarTech ⚡`,
          mentions: [room.game.playerX, room.game.playerO]
        });
        delete games[room.id];
        saveGames();
        return;
      }

      if (tie) {
        await sock.sendMessage(chatId, {
          text: `🤝 Draw!\n\n${board}\n\n> powered by AzarTech ⚡`,
          mentions: [room.game.playerX, room.game.playerO]
        });
        delete games[room.id];
        saveGames();
        return;
      }

      saveGames();
      return sock.sendMessage(chatId, {
        text: `🎲 Turn: ${mention(room.game.currentTurn)}\n\n${board}\n\n• Send a number (1–9)\n• Type "surrender" to quit`,
        mentions: [room.game.playerX, room.game.playerO, room.game.currentTurn]
      });
    }

    // ============================================
    // 🧨 USER IS NOT IN ANY GAME YET
    // Handle 1–9 or surrender attempts
    // ============================================
    if (isMove || isSurrender) {
      return sock.sendMessage(chatId, {
        text: "⚠️ You are not in any match here.\nType *.ttt* to start or join."
      }, { quoted: msg });
    }

    // ============================================
    // 🎮 COMMAND: .ttt [roomName]
    // ============================================
    const roomName = args[0]?.toLowerCase() || null;

    let waiting = findWaitingRoom(chatId, roomName);

    if (waiting) {
      // join room
      if (waiting.x === sender)
        return sock.sendMessage(chatId, { text: "⏳ Still waiting for opponent…" }, { quoted: msg });

      waiting.o = sender;
      waiting.state = "PLAYING";
      waiting.game.playerO = sender;

      saveGames();

      const board = renderBoard(waiting.game);
      return sock.sendMessage(chatId, {
        text:
          `🎮 *Game Started!*\nTurn: ${mention(waiting.game.currentTurn)}\n\n${board}\n\n` +
          `• Send a number (1–9)\n• Type "surrender" to quit\n\n> powered by AzarTech ⚡`,
        mentions: [waiting.game.playerX, waiting.game.playerO]
      });
    }

    // CREATE ROOM (named or normal)
    const newRoom = createRoom(chatId, sender, roomName);

    return sock.sendMessage(chatId, {
      text:
        `⏳ Waiting for opponent...\n` +
        (roomName ? `Room code: *${roomName}*\nAsk someone to type ".ttt ${roomName}"` : `Tell someone to type *.ttt* to join`) +
        `\n\n> powered by AzarTech ⚡`
    }, { quoted: msg });

  } catch (e) {
    console.error("TTT ERROR:", e);
  }
};
