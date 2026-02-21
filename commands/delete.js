// ==============================================
// 🧹 Azahrabot — .delete Command (v5.5 Silent Build)
// Admin-Only • Deletes messages silently • Clean & Fast
// ==============================================

const { canRunAdminCommand } = require("../lib/guards");
const store = require("../lib/lightweight_store");

module.exports = async (sock, msg, from, text, args) => {
  try {
    // 🧠 Only for groups
    if (!from.endsWith("@g.us")) return;

    // 🧾 Check if sender is admin
    const canRun = await canRunAdminCommand(sock, msg, from);
    if (!canRun) {
      await sock.sendMessage(from, { text: "❌ Only *group admins* can use this command." }, { quoted: msg });
      return;
    }

    // 📦 Parse message text and reply info
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const parts = body.trim().split(/\s+/);
    let countArg = null;

    // 🧮 Extract number
    if (parts.length > 1) {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > 0) countArg = Math.min(num, 50);
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    const repliedParticipant = ctx.participant || null;
    const mentioned = Array.isArray(ctx.mentionedJid) && ctx.mentionedJid.length > 0 ? ctx.mentionedJid[0] : null;

    // Default deletion logic
    if (!countArg && repliedParticipant) countArg = 1;
    if (!countArg && mentioned) countArg = 1;
    if (!countArg) countArg = 1; // fallback to 1 if nothing else

    // 🎯 Target selection
    let targetUser = null;
    let repliedMsgId = null;
    let deleteAll = false;

    if (repliedParticipant && ctx.stanzaId) {
      targetUser = repliedParticipant;
      repliedMsgId = ctx.stanzaId;
    } else if (mentioned) {
      targetUser = mentioned;
    } else {
      deleteAll = true;
    }

    // 🧱 Load chat messages
    const chatMessages = store.messages[from] ? Array.from(store.messages[from].values()) : [];
    const toDelete = [];
    const seen = new Set();

    if (deleteAll) {
      // delete last N messages (group-wide)
      for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg; i--) {
        const m = chatMessages[i];
        if (!seen.has(m.key.id) && !m.message?.protocolMessage && !m.key.fromMe && m.key.id !== msg.key.id) {
          toDelete.push(m);
          seen.add(m.key.id);
        }
      }
    } else {
      // delete from specific user
      if (repliedMsgId) {
        const repliedMsg = chatMessages.find(
          (m) => m.key.id === repliedMsgId && (m.key.participant || m.key.remoteJid) === targetUser
        );
        if (repliedMsg) {
          toDelete.push(repliedMsg);
          seen.add(repliedMsg.key.id);
        } else {
          try {
            await sock.sendMessage(from, {
              delete: {
                remoteJid: from,
                fromMe: false,
                id: repliedMsgId,
                participant: repliedParticipant,
              },
            });
            countArg = Math.max(0, countArg - 1);
          } catch {}
        }
      }

      for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg; i--) {
        const m = chatMessages[i];
        const user = m.key.participant || m.key.remoteJid;
        if (user === targetUser && !seen.has(m.key.id) && !m.message?.protocolMessage) {
          toDelete.push(m);
          seen.add(m.key.id);
        }
      }
    }

    // 🧨 Execute silent deletion (no reply message)
    for (const m of toDelete) {
      try {
        const msgParticipant = deleteAll
          ? m.key.participant || m.key.remoteJid
          : targetUser;
        await sock.sendMessage(from, {
          delete: {
            remoteJid: from,
            fromMe: false,
            id: m.key.id,
            participant: msgParticipant,
          },
        });
        await new Promise((r) => setTimeout(r, 120)); // quick delay
      } catch {}
    }

  } catch (err) {
    console.error("❌ Delete command error:", err);
  }
};
