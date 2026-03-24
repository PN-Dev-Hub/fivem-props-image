const fs = require("fs");
const path = require("path");

const IMAGES_DIR = path.join(__dirname, "images");
const OUTPUT_FILE = path.join(__dirname, "fivem_props.json");

const RAW_BASE_URL =
  "https://raw.githubusercontent.com/PN-Dev-Hub/fivem-props-image/refs/heads/main/images";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isImageFile(fileName) {
  return ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function toPosixPath(...parts) {
  return parts.join("/").replace(/\\/g, "/");
}

// transforme "beerrow_local" → "Beerrow Local"
function formatLabel(name) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// transforme "misc xs3" → "misc_xs3"
function formatCategoryName(name) {
  return name.toLowerCase().replace(/\s+/g, "_");
}

function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error("Dossier images introuvable.");
    process.exit(1);
  }

  const categories = fs
    .readdirSync(IMAGES_DIR)
    .filter((name) =>
      fs.statSync(path.join(IMAGES_DIR, name)).isDirectory()
    )
    .sort((a, b) => a.localeCompare(b));

  const output = [];

  for (const category of categories) {
    const categoryPath = path.join(IMAGES_DIR, category);

    const files = fs
      .readdirSync(categoryPath)
      .filter(isImageFile)
      .sort((a, b) => a.localeCompare(b));

    const props = files.map((fileName) => {
      const model = path.parse(fileName).name;

      return {
        label: formatLabel(model),
        model: model,
        image: `${RAW_BASE_URL}/${toPosixPath(category, fileName)}`
      };
    });

    output.push({
      label: formatLabel(category),
      name: formatCategoryName(category),
      props: props
    });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 4), "utf8");

  console.log(`✅ JSON généré : ${OUTPUT_FILE}`);
  console.log(`📦 Catégories : ${output.length}`);
}

main();