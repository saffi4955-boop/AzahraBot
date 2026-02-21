// commands/ss.js
const axios = require("axios");
const sharp = require("sharp");

// try to require puppeteer if available; we'll install it if not
let puppeteer = null;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    puppeteer = null;
}

module.exports = async function ss(sock, msg, from, text, args, store) {
    try {
        await sock.sendMessage(from, { react: { text: "📸", key: msg.key } });

        const url = args.join(" ").trim();
        
        if (!url) {
            return sock.sendMessage(
                from,
                { 
                    text: `*📸 SCREENSHOT TOOL*\n\n*.ss <url>*\n\nTake a screenshot of any website\n\nExample:\n.ss https://google.com` 
                },
                { quoted: msg }
            );
        }

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(
                from,
                { text: '❌ Invalid URL. Use: .ss https://example.com' },
                { quoted: msg }
            );
        }

        console.log(`ss: attempting screenshot for ${url}`);

        let screenshotBuf = null;

        // 1) Preferred: local Puppeteer (most reliable). If puppeteer is not installed it will be skipped.
        if (puppeteer) {
            try {
                console.log('ss: trying local puppeteer');
                const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
                const page = await browser.newPage();
                await page.setViewport({ width: 1280, height: 720 });
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
                const buf = await page.screenshot({ type: 'png', fullPage: false });
                await browser.close();
                if (buf && Buffer.byteLength(buf) > 2000) {
                    screenshotBuf = Buffer.from(buf);
                    console.log(`✅ puppeteer captured ${Buffer.byteLength(screenshotBuf)} bytes`);
                }
            } catch (ppErr) {
                console.warn('ss: puppeteer failed -', ppErr.message);
            }
        } else {
            console.log('ss: puppeteer not installed; skipping local capture');
        }

        // 2) Fallback: Thum.io (raw URL path, not encoded)
        if (!screenshotBuf) {
            try {
                console.log('ss: trying Thum.io');
                const thumUrl = `https://image.thum.io/get/png/maxAge:3600/${url}`;
                const res = await axios.get(thumUrl, { responseType: 'arraybuffer', timeout: 20000, maxRedirects: 5 });
                if (res.data && Buffer.byteLength(res.data) > 3000) {
                    screenshotBuf = Buffer.from(res.data);
                    console.log(`✅ Thum.io: ${Buffer.byteLength(screenshotBuf)} bytes`);
                } else {
                    console.warn('ss: Thum.io returned small buffer');
                }
            } catch (err) {
                console.warn('ss: Thum.io -', err.message);
            }
        }

        // 3) Fallback: ScreenshotAPI.net (follow redirects)
        if (!screenshotBuf) {
            try {
                console.log('ss: trying ScreenshotAPI.net');
                const res = await axios.get(`https://www.screenshotapi.net/api/v1/screenshot?url=${encodeURIComponent(url)}&token=public`, { responseType: 'arraybuffer', timeout: 25000, maxRedirects: 10 });
                if (res.data && Buffer.byteLength(res.data) > 3000) {
                    screenshotBuf = Buffer.from(res.data);
                    console.log(`✅ ScreenshotAPI.net: ${Buffer.byteLength(screenshotBuf)} bytes`);
                }
            } catch (err) {
                console.warn('ss: ScreenshotAPI.net -', err.message);
            }
        }

        // 4) Last resort: URLScan.io screenshots
        if (!screenshotBuf) {
            try {
                console.log('ss: trying URLScan.io');
                const scanRes = await axios.post('https://urlscan.io/api/v1/scan/', { url, public: 'on' }, { timeout: 15000 });
                if (scanRes.data && scanRes.data.uuid) {
                    await new Promise(r => setTimeout(r, 4000));
                    const ssUrl = `https://urlscan.io/screenshots/${scanRes.data.uuid}.png`;
                    const imgRes = await axios.get(ssUrl, { responseType: 'arraybuffer', timeout: 15000, maxRedirects: 5 });
                    if (imgRes.data && Buffer.byteLength(imgRes.data) > 3000) {
                        screenshotBuf = Buffer.from(imgRes.data);
                        console.log(`✅ URLScan.io: ${Buffer.byteLength(screenshotBuf)} bytes`);
                    }
                }
            } catch (err) {
                console.warn('ss: URLScan.io -', err.message);
            }
        }

        if (!screenshotBuf) {
            console.warn('ss: All capture methods failed');
            return sock.sendMessage(from, { text: '❌ Screenshot failed. Try a different URL or install Puppeteer for reliable local captures.' }, { quoted: msg });
        }

        // Validate and normalize image with sharp (convert to PNG)
        try {
            const meta = await sharp(screenshotBuf).metadata();
            console.log('ss: image meta', meta.format, Buffer.byteLength(screenshotBuf));
            if (meta.format !== 'png') screenshotBuf = await sharp(screenshotBuf).png().toBuffer();
        } catch (sErr) {
            console.warn('ss: sharp warning -', sErr.message);
        }

        // Send image via Baileys
        await sock.sendMessage(from, { image: screenshotBuf, caption: `📸 Screenshot of ${url}` }, { quoted: msg });
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error('SS ERROR:', err && err.message ? err.message : err);
        return sock.sendMessage(from, { text: '❌ Screenshot command error. Please try again.' }, { quoted: msg });
    }
};