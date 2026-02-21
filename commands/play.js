// ==============================================
// 🎵 Azahrabot Play Command (v5.7 — Spotify API + elite-protech)
// Song name → Spotify track → MP3 download
// ==============================================

const axios = require("axios");
const small = require("../lib/small_lib");

// Helper: get Spotify access token
async function getSpotifyToken() {
  const clientId = small.api?.spotifyClientId;
  const clientSecret = small.api?.spotifyClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify API credentials missing in small_lib.js");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return res.data.access_token;
}

// Step 1: Search Spotify Track
async function searchSpotifyTrack(query) {

  const token = await getSpotifyToken();

  const searchRes = await axios.get(
    "https://api.spotify.com/v1/search",
    {
      params: {
        q: query,
        type: "track",
        limit: 1,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const track = searchRes.data?.tracks?.items?.[0];

  if (!track) throw new Error("No track found");

  return {
    url: track.external_urls.spotify,
    title: track.name,
    artist: track.artists.map(a => a.name).join(", "),
    duration: msToTime(track.duration_ms),
    cover: track.album.images[0]?.url,
  };
}

// Step 2: Fetch download link
async function fetchDownloadFromApi(spotifyUrl) {

  const apiUrl =
    `https://eliteprotech-apis.zone.id/spotify?url=${encodeURIComponent(spotifyUrl)}`;

  const res = await axios.get(apiUrl, {
    timeout: 60000,
  });

  if (!res.data?.success || !res.data?.data?.download) {
    throw new Error("API did not return a download link");
  }

  return {
    downloadUrl: res.data.data.download,
    metadata: res.data.data.metadata,
  };
}

// Convert ms → mm:ss
function msToTime(ms) {

  const minutes = Math.floor(ms / 60000);

  const seconds = ((ms % 60000) / 1000)
    .toFixed(0)
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

module.exports = async (sock, msg, from, text, args) => {

  const query = args.join(" ").trim();

  if (!query) {
    return sock.sendMessage(
      from,
      { text: "🎧 *Usage:* .play <song name>" },
      { quoted: msg }
    );
  }

  try {

    await sock.sendMessage(from, {
      react: { text: "🎶", key: msg.key },
    });

    await sock.sendMessage(
      from,
      { text: `🔍 *Searching for "${query}"...*` },
      { quoted: msg }
    );

    // ✅ Spotify Search (kept)
    const trackInfo = await searchSpotifyTrack(query);

    // ❌ Removed "Found Getting Download Link" message ONLY

    // ✅ Fetch Download
    const { downloadUrl, metadata } =
      await fetchDownloadFromApi(trackInfo.url);

    const title = metadata?.title || trackInfo.title;
    const artist = metadata?.artist || trackInfo.artist;
    const duration = metadata?.duration || trackInfo.duration;
    const cover = metadata?.images || trackInfo.cover;

    const caption = `
🎧 *${title}*
────────────────────
🎤 *Artist:* ${artist}
⏱ *Duration:* ${duration}
────────────────────
> 🎶 *Powered by ${small.author || "AzarTech"}* ⚡
`.trim();

    // Banner
    await sock.sendMessage(
      from,
      {
        text: caption + "\n\n⬇️ *Downloading your song...*",
        contextInfo: {
          externalAdReply: {
            title,
            body: `${artist} • ${duration}`,
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnailUrl: cover,
            sourceUrl: trackInfo.url,
          },
        },
      },
      { quoted: msg }
    );

    // Send MP3
    await sock.sendMessage(
      from,
      {
        audio: { url: downloadUrl },
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
      },
      { quoted: msg }
    );

    await sock.sendMessage(from, {
      react: { text: "✅", key: msg.key },
    });

  } catch (err) {

    console.error("❌ .play error:", err.message);

    let errorMsg = "⚠️ Failed to process song.\n";

    if (err.message.includes("credentials")) {
      errorMsg += "Please set Spotify API credentials.";
    } else if (err.message.includes("No track found")) {
      errorMsg += "No song found with that name.";
    } else if (err.message.includes("API did not return")) {
      errorMsg += "Download service unavailable.";
    } else {
      errorMsg += "Try again later.";
    }

    await sock.sendMessage(
      from,
      { text: errorMsg },
      { quoted: msg }
    );
  }
};