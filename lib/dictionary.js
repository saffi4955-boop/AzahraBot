// lib/dictionary.js
const fs = require("fs");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const CACHE_FILE = path.join(__dirname, "../data/dict_cache.json");

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE));
  } catch {
    return {};
  }
}

function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

const cache = loadCache();

/**
 * Check if a word is a valid dictionary word
 */
async function isDictionaryWord(word) {
  word = word.toLowerCase().trim();

  // Basic validation
  if (word.length < 2) return false;
  if (!/^[a-z]+$/.test(word)) return false;

  // Cache hit
  if (cache[word] !== undefined) {
    return cache[word];
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      { timeout: 5000 }
    );

    const ok = res.status === 200;
    cache[word] = ok;
    saveCache(cache);
    return ok;
  } catch {
    // Fail-safe → treat as invalid but don't cache failures permanently
    return false;
  }
}

module.exports = { isDictionaryWord };
