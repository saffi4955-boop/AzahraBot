// =====================================================================
// ✨ Azahrabot — Remove BG Command (v5.0 Clean Edition)
// Uses new uploadImage (no FileType), stable API, full fallback logic
// =====================================================================

const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { uploadImage } = require("../../lib/uploadImage");

// Convert stream → buffer
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks);
}

// Extract image data from reply or self-image; returns { imageUrl, buffer }
async function getImageData(sock, msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    // 1️⃣ Replied image
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
        const buf = await streamToBuffer(stream);
        return { imageUrl: null, buffer: buf };
    }

    // 2️⃣ Direct image
    if (msg.message?.imageMessage) {
        const stream = await downloadContentFromMessage(msg.message.imageMessage, "image");
        const buf = await streamToBuffer(stream);
        return { imageUrl: null, buffer: buf };
    }

    return { imageUrl: null, buffer: null };
}

// Validate URL
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

module.exports = async (sock, msg, from, text, args) => {
    try {
        let imageUrl = null;

        // 1️⃣ User sent a URL
        let buf = null;
        if (args[0] && isValidUrl(args[0])) {
            imageUrl = args[0];
        } else {
            // 2️⃣ Try reply/direct image (get buffer)
            const img = await getImageData(sock, msg);
            imageUrl = img.imageUrl;
            buf = img.buffer;

            // 3️⃣ Fallback -> profile picture
            if (!imageUrl && !buf) {
                const target =
                    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                    msg.message?.extendedTextMessage?.contextInfo?.participant ||
                    msg.key.participant ||
                    msg.key.remoteJid;

                try {
                    const dp = await sock.profilePictureUrl(target, "image");
                    const res = await axios.get(dp, { responseType: "arraybuffer" });
                    buf = Buffer.from(res.data);
                } catch (e) {
                    console.error('REMOVEBG: failed to fetch profile picture', e && e.message ? e.message : e);
                    return sock.sendMessage(
                        from,
                        { text: "❌ No valid image found. Send or reply to an image." },
                        { quoted: msg }
                    );
                }
            }
        }

        if (!imageUrl && !buf) {
            return sock.sendMessage(
                from,
                { text: "📸 Reply to an image or send `.removebg <image-url>`" },
                { quoted: msg }
            );
        }

        // Inform user we're uploading/processing
        await sock.sendMessage(from, { text: "⏳ Uploading image and processing background removal..." }, { quoted: msg });

        // If we have the buffer, POST it directly to the removebg API (avoid external hosts)
        let res;
        if (buf) {
            try {
                // If user provided REMOVE_BG_API_KEY, prefer remove.bg (more reliable, requires API key)
                const smallLib = require('../../lib/small_lib');
                const removeBgKey = process.env.REMOVE_BG_API_KEY || process.env.REMOVE_BG_KEY || (smallLib && smallLib.api && smallLib.api.removebg);
                if (removeBgKey) {
                    console.log('REMOVEBG: using remove.bg API (env key present)');
                    const FormData = require('form-data');
                    const form = new FormData();
                    form.append('image_file', buf, { filename: 'image.jpg' });

                    res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
                        headers: { ...form.getHeaders(), 'X-Api-Key': removeBgKey },
                        responseType: 'arraybuffer',
                        timeout: 60000,
                    });
                } else {
                    console.log('REMOVEBG: sending direct POST with image buffer to siputzx');
                    const FormData = require('form-data');
                    const form = new FormData();
                    form.append('image', buf, { filename: 'image.jpg' });

                    res = await axios.post('https://api.siputzx.my.id/api/iloveimg/removebg', form, {
                        headers: { ...form.getHeaders() },
                        responseType: 'arraybuffer',
                        timeout: 60000,
                    });
                }
            } catch (e) {
                console.error('REMOVEBG: direct POST failed:', e && e.message ? e.message : e);
                // Try local background removal using @imgly/background-removal if available
                try {
                    const br = require('@imgly/background-removal');
                    if (br && typeof br.removeBackground === 'function') {
                        try {
                            if (typeof br.preload === 'function') {
                                await br.preload();
                            }
                        } catch (preErr) {
                            console.warn('REMOVEBG: preload failed (continuing):', preErr && preErr.message ? preErr.message : preErr);
                        }

                        console.log('REMOVEBG: attempting local removeBackground()');
                        const out = await br.removeBackground({ image: buf });

                        let outBuf = null;
                        if (Buffer.isBuffer(out)) outBuf = out;
                        else if (out && Buffer.isBuffer(out.result)) outBuf = out.result;
                        else if (out && Buffer.isBuffer(out.image)) outBuf = out.image;

                        if (outBuf) {
                            await sock.sendMessage(from, { image: outBuf, caption: '✨ Background removed (local)!' }, { quoted: msg });
                            return;
                        } else {
                            console.error('REMOVEBG: local removeBackground returned unexpected:', Object.keys(out || {}));
                        }
                    }
                } catch (localErr) {
                    console.error('REMOVEBG: local background removal failed:', localErr && localErr.message ? localErr.message : localErr);
                }

                // fallback: if we can upload buffer to a host, try that
                try {
                    const uploaded = await uploadImage(buf);
                    imageUrl = uploaded;
                } catch (errUpload) {
                    console.error('REMOVEBG: fallback upload failed:', errUpload && errUpload.message ? errUpload.message : errUpload);
                    throw new Error('Image upload failed');
                }
            }
        }

        // If we didn't get a response from direct POST but have imageUrl, use URL-based API
        if (!res && imageUrl) {
            const apiUrl = `https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodeURIComponent(imageUrl)}`;
            console.log('REMOVEBG: calling API with URL:', apiUrl);
            res = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 45000 });
        }

        // Validate response
        const contentType = res.headers && (res.headers['content-type'] || res.headers['Content-Type']);
        if (!contentType || !contentType.startsWith('image')) {
            console.error('REMOVEBG: API did not return an image, content-type=', contentType);
            console.error('REMOVEBG: API response length=', res.data ? res.data.length : 'no-data');
            throw new Error('API did not return an image');
        }

        await sock.sendMessage(from, { image: res.data, caption: '✨ Background removed successfully!' }, { quoted: msg });
    } catch (err) {
        console.error("REMOVE BG ERROR:", err && err.message ? err.message : err);

        // Provide a helpful error message to the user with optional debug hint
        const userMessage = (err && err.message && err.message.includes('Image upload failed'))
            ? '❌ Failed to upload image. Try sending a different image or URL.'
            : '❌ Failed to remove background. Try again later.';

        await sock.sendMessage(
            from,
            { text: `${userMessage}\n
Debug: ${err && err.message ? err.message : 'unknown error'}` },
            { quoted: msg }
        );
    }
};
