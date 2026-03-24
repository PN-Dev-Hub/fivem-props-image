const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://gtahash.ru/";
const OUTPUT_FILE = path.join(__dirname, "gtahash_props.json");

const TOTAL_PAGES = 177;
const CONCURRENCY = 12; // augmente à 20 si ta co est bonne

function cleanText(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return new URL(url, BASE_URL).href;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return new URL(url, BASE_URL).href;
}

function looksLikePropName(text) {
  if (!text) return false;
  return /^[a-z0-9_]+$/i.test(text) && text.length >= 3;
}

function extractPropNameFromTextBlock(text) {
  if (!text) return null;

  const lines = text
    .split("\n")
    .map((x) => cleanText(x))
    .filter(Boolean);

  for (const line of lines) {
    if (
      line.startsWith("prop_") ||
      line.startsWith("hei_prop_") ||
      line.startsWith("csx_") ||
      line.startsWith("apa_") ||
      line.startsWith("ex_") ||
      line.startsWith("xm_") ||
      line.startsWith("vw_") ||
      line.startsWith("p_") ||
      line.startsWith("v_")
    ) {
      return line;
    }
  }

  for (const line of lines) {
    const match = line.match(/Object Name:\s*([a-z0-9_]+)/i);
    if (match) return match[1];
  }

  for (const line of lines) {
    if (looksLikePropName(line)) return line;
  }

  return null;
}

function extractItemsFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const found = [];

  const containers = $("article, .post, .item, .card, .entry, .object, li, .grid > div, .row > div");

  containers.each((_, el) => {
    const block = $(el);

    const img =
      block.find("img").first().attr("src") ||
      block.find("img").first().attr("data-src") ||
      block.find("img").first().attr("data-lazy-src") ||
      block.find("img").first().attr("data-original");

    const text = cleanText(block.text());
    const prop = extractPropNameFromTextBlock(text);

    if (prop && img) {
      found.push({
        prop,
        image: normalizeUrl(img),
      });
    }
  });

  if (found.length === 0) {
    $("img").each((_, imgEl) => {
      const img =
        $(imgEl).attr("src") ||
        $(imgEl).attr("data-src") ||
        $(imgEl).attr("data-lazy-src") ||
        $(imgEl).attr("data-original");

      if (!img) return;

      const parentText =
        cleanText($(imgEl).parent().text()) ||
        cleanText($(imgEl).closest("div, article, li").text());

      const prop = extractPropNameFromTextBlock(parentText);

      if (prop) {
        found.push({
          prop,
          image: normalizeUrl(img),
        });
      }
    });
  }

  const unique = new Map();
  for (const item of found) {
    if (!item.prop || !item.image) continue;
    if (!unique.has(item.prop)) {
      unique.set(item.prop, item);
    }
  }

  return Array.from(unique.values());
}

async function fetchPage(pageNumber) {
  const url = pageNumber === 1 ? BASE_URL : `${BASE_URL}?page=${pageNumber}`;

  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Referer": BASE_URL,
      },
    });

    const items = extractItemsFromHtml(response.data, url);
    console.log(`[PAGE ${pageNumber}] ${items.length} item(s)`);
    return items;
  } catch (error) {
    console.error(`[PAGE ${pageNumber}] Erreur: ${error.message}`);
    return [];
  }
}

async function runPool(taskFns, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < taskFns.length) {
      const currentIndex = index++;
      results[currentIndex] = await taskFns[currentIndex]();
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const tasks = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    tasks.push(() => fetchPage(page));
  }

  const pagesResults = await runPool(tasks, CONCURRENCY);

  const finalMap = new Map();

  for (const items of pagesResults) {
    for (const item of items) {
      if (!finalMap.has(item.prop)) {
        finalMap.set(item.prop, item);
      }
    }
  }

  const output = Array.from(finalMap.values()).sort((a, b) =>
    a.prop.localeCompare(b.prop)
  );

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log(`\nTerminé : ${output.length} props sauvegardés dans ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});