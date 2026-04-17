const settings = require("../../settings");

module.exports = async (sock, msg, from) => {
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        const ownerNumber = settings.ownerNumber.replace(/[^0-9]/g, "");
        const senderNumber = (sender || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
        const isOwner = msg.key.fromMe || (senderNumber && ownerNumber && senderNumber === ownerNumber);

        if (!isOwner) {
            return await sock.sendMessage(from, { text: "❌ This command is only for the owner!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: "🔄 *Restarting...*\n\n_The bot will be back online in a few seconds._" }, { quoted: msg });

        setTimeout(() => {
            process.exit(0);
        }, 2000);

    } catch (err) {
        console.error("❌ Error in restart command:", err.message);
        await sock.sendMessage(from, { text: "⚠️ Failed to initiate restart." }, { quoted: msg });
    }
};
