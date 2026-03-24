const fs = require("fs");
const path = require("path");

const IMAGES_DIR = path.join(__dirname, "images");
const DOCS_DIR = path.join(__dirname, "docs");
const CATEGORIES_DIR = path.join(DOCS_DIR, "categories");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function formatTitle(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateCategoryDoc(category, files) {
  let content = `# ${formatTitle(category)} Props\n\n`;
  content += `Liste des props de la catégorie **${category}**.\n\n---\n\n`;

  files.forEach((file) => {
    const propName = path.parse(file).name;
    const imagePath = `../../images/${category}/${file}`;

    content += `## ${propName}\n\n`;
    content += `![${propName}](${imagePath})\n\n`;
    content += `\`\`\`lua\n${propName}\n\`\`\`\n\n---\n\n`;
  });

  return content;
}

function generateIndex(categories) {
  let content = `# 📦 GTA Props Documentation\n\n`;
  content += `Liste complète des props par catégorie.\n\n---\n\n`;

  categories.forEach((cat) => {
    content += `- [${formatTitle(cat)}](./categories/${cat}.md)\n`;
  });

  return content;
}

function generateReadme(categories) {
  let content = `# 📦 GTA Props Pack\n\n`;
  content += `Collection complète de props GTA avec images.\n\n`;
  content += `## 📁 Structure\n\n`;
  content += "```bash\nimages/categorie/prop.jpg\n```\n\n";

  content += `## 📚 Catégories\n\n`;

  categories.forEach((cat) => {
    content += `- [${formatTitle(cat)}](docs/categories/${cat}.md)\n`;
  });

  return content;
}

function main() {
  ensureDir(DOCS_DIR);
  ensureDir(CATEGORIES_DIR);

  const categories = fs.readdirSync(IMAGES_DIR).filter((f) =>
    fs.statSync(path.join(IMAGES_DIR, f)).isDirectory()
  );

  categories.forEach((category) => {
    const categoryPath = path.join(IMAGES_DIR, category);

    const files = fs
      .readdirSync(categoryPath)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));

    const docContent = generateCategoryDoc(category, files);

    fs.writeFileSync(
      path.join(CATEGORIES_DIR, `${category}.md`),
      docContent,
      "utf8"
    );
  });

  // index docs
  fs.writeFileSync(
    path.join(DOCS_DIR, "index.md"),
    generateIndex(categories),
    "utf8"
  );

  // README principal
  fs.writeFileSync(
    path.join(__dirname, "README.md"),
    generateReadme(categories),
    "utf8"
  );

  console.log("✅ Documentation générée !");
}

main();