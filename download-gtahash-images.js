const fs = require("fs");
const path = require("path");
const axios = require("axios");

const INPUT_FILE = path.join(__dirname, "gtahash_props.json");
const OUTPUT_DIR = path.join(__dirname, "downloaded_images");
const CONCURRENCY = 10;

function sanitizeFileName(name) {
  return String(name || "unknown")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    return ext || ".jpg";
  } catch {
    return ".jpg";
  }
}

function getFolderFromImageUrl(imageUrl) {
  try {
    const url = new URL(imageUrl);

    // On reprend l'arborescence du site
    // Ex: /uploads/props/a/b/image.jpg => downloaded_images/uploads/props/a/b/
    const dir = path.dirname(url.pathname).replace(/^\/+/, "");

    if (!dir || dir === ".") {
      return OUTPUT_DIR;
    }

    return path.join(OUTPUT_DIR, dir);
  } catch {
    return OUTPUT_DIR;
  }
}

async function downloadImage(item, index, total) {
  const prop = item.prop;
  const imageUrl = item.image;

  if (!prop || !imageUrl) {
    console.log(`[${index}/${total}] Entrée ignorée: prop ou image manquant`);
    return;
  }

  const folderPath = getFolderFromImageUrl(imageUrl);
  ensureDir(folderPath);

  const ext = getExtensionFromUrl(imageUrl);
  const fileName = `${sanitizeFileName(prop)}${ext}`;
  const filePath = path.join(folderPath, fileName);

  if (fs.existsSync(filePath)) {
    console.log(`[${index}/${total}] Déjà présent: ${fileName}`);
    return;
  }

  try {
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://gtahash.ru/",
      },
      maxRedirects: 5,
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log(`[${index}/${total}] OK -> ${filePath}`);
  } catch (error) {
    console.error(
      `[${index}/${total}] Erreur téléchargement ${prop}: ${error.message}`
    );
  }
}

async function runPool(items, concurrency, workerFn) {
  let currentIndex = 0;

  async function worker() {
    while (true) {
      const index = currentIndex++;
      if (index >= items.length) break;
      await workerFn(items[index], index + 1, items.length);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Fichier introuvable: ${INPUT_FILE}`);
    process.exit(1);
  }

  ensureDir(OUTPUT_DIR);

  const raw = fs.readFileSync(INPUT_FILE, "utf8");
  const items = JSON.parse(raw);

  if (!Array.isArray(items)) {
    console.error("Le JSON doit contenir un tableau.");
    process.exit(1);
  }

  console.log(`Images à télécharger: ${items.length}`);
  console.log(`Dossier de sortie: ${OUTPUT_DIR}`);

  await runPool(items, CONCURRENCY, downloadImage);

  console.log("Téléchargement terminé.");
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});