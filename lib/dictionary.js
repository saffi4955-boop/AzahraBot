const fs = require("fs");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const CACHE_FILE = path.join(__dirname, "../data/dict_cache.json");

// load cache
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
  word = word.toLowerCase();

  // cache hit
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
    // fail-safe → treat as invalid
    cache[word] = false;
    saveCache(cache);
    return false;
  }
}

module.exports = { isDictionaryWord };
