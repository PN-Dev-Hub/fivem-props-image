const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { pathToFileURL } = require("url");

const DEFAULT_OUTPUT = path.join(__dirname, "gta_props_from_folder.json");
const DEFAULT_RPF_EXTRACT_OUTPUT = path.join(
  __dirname,
  ".cache",
  "gta_rpf_extract"
);
const DEFAULT_STRINGS_FILE = path.join(
  __dirname,
  "tools",
  "gtautil-2.2.13",
  "strings.txt"
);
const DEFAULT_IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/PN-Dev-Hub/fivem-props-image/refs/heads/main/images";
const DEFAULT_OPTIONS = {
  groupBy: "category",
  mode: "props",
  indent: 2,
  rpfMode: "auto",
  rpfExtractOutput: DEFAULT_RPF_EXTRACT_OUTPUT,
  keepRpfExtract: false,
  gtautilPath: null,
  stringsFile: DEFAULT_STRINGS_FILE,
  imageBaseUrl: DEFAULT_IMAGE_BASE_URL,
  imageExtension: ".jpg",
};

const MODEL_EXTENSIONS = new Set([".ydr", ".ydd"]);
const YMAP_XML_EXTENSION = ".ymap.xml";
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);
const PROPS_PATH_STOP_WORDS = new Set([
  "gta5",
  "levels",
  "level",
  "props",
  "prop",
  "dlc_patch",
  "stream",
  "x64",
  "x64a",
  "x64b",
  "x64c",
  "x64d",
  "x64e",
  "x64f",
  "x64g",
  "x64h",
  "x64i",
  "x64j",
  "x64k",
  "x64l",
  "x64m",
  "x64n",
  "x64o",
  "x64p",
  "x64q",
  "x64r",
  "x64s",
  "x64t",
  "x64u",
  "x64v",
  "x64w",
]);
const CATEGORY_HINTS = new Map([
  ["bar", "bar"],
  ["beer", "bar"],
  ["bottle", "bar"],
  ["cocktail", "bar"],
  ["drink", "bar"],
  ["glass", "bar"],
  ["bath", "bathroom"],
  ["bathroom", "bathroom"],
  ["shower", "bathroom"],
  ["toilet", "bathroom"],
  ["bin", "bins"],
  ["dumpster", "bins"],
  ["trash", "bins"],
  ["bush", "bush"],
  ["cactus", "cacti"],
  ["cacti", "cacti"],
  ["constr", "construction"],
  ["construction", "construction"],
  ["scaffold", "construction"],
  ["crop", "crops"],
  ["plant", "garden"],
  ["door", "doors"],
  ["gate", "doors"],
  ["elec", "electrical"],
  ["fence", "fences"],
  ["garage", "garage"],
  ["garden", "garden"],
  ["hedge", "garden"],
  ["halloween", "halloween"],
  ["industrial", "industrial"],
  ["ind", "industrial"],
  ["kitchen", "kitchen"],
  ["office", "office"],
  ["palm", "palm"],
  ["fanpalm", "fanpalm"],
  ["pot", "potted"],
  ["potted", "potted"],
  ["rock", "rocks"],
  ["stone", "rocks"],
  ["roof", "rooftop"],
  ["rubbish", "rubbish"],
  ["rub", "rubbish"],
  ["bench", "seating"],
  ["chair", "seating"],
  ["couch", "seating"],
  ["seat", "seating"],
  ["sofa", "seating"],
  ["stool", "seating"],
  ["table", "seating_tables"],
  ["desk", "seating_tables"],
  ["sign", "signs"],
  ["snow", "snow"],
  ["store", "storage"],
  ["storage", "storage"],
  ["traffic", "traffic_lights"],
  ["light", "traffic_lights"],
  ["tree", "trees"],
  ["trees", "trees"],
  ["utility", "utility"],
  ["water", "utility"],
]);
const DLC_FRIENDLY_NAMES = new Map([
  ["mpchristmas2017", "The Doomsday Heist"],
  ["mpheist", "Heists"],
  ["mpheist3", "The Diamond Casino Heist"],
  ["mpheist4", "Cayo Perico Heist"],
  ["mpsecurity", "The Contract"],
  ["mpsum", "Los Santos Summer Special"],
  ["mpsum2", "The Cayo Perico Series"],
  ["mptuner", "Los Santos Tuners"],
  ["mp2023_01", "San Andreas Mercenaries"],
]);

function printUsage() {
  console.log(`
Usage:
  node extract-gta-props.js --input "D:\\GTA_OR_EXTRACT" [--output ".\\gta_props.json"] [--group-by category|source|none] [--mode props|all]
                               [--rpf-mode auto|force|never] [--strings-file ".\\tools\\gtautil-2.2.13\\strings.txt"]
                               [--image-base-url "https://.../images"] [--image-extension ".jpg"]

Notes:
  - Mode auto: si le dossier contient surtout des .rpf, le script lit directement les archives.
  - Si la lecture .rpf echoue, fallback sur strings.txt (GTAUtil) pour recuperer les modeles.
  - Le script utilise .ytyp.xml (si presents) et les modeles .ydr/.ydd pour produire le JSON.
`);
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--input" || arg === "-i") {
      options.input = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      options.output = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--group-by") {
      options.groupBy = String(argv[i + 1] || "").toLowerCase();
      i += 1;
      continue;
    }

    if (arg === "--mode") {
      options.mode = String(argv[i + 1] || "").toLowerCase();
      i += 1;
      continue;
    }

    if (arg === "--indent") {
      const value = Number.parseInt(argv[i + 1], 10);
      options.indent = Number.isFinite(value) ? value : DEFAULT_OPTIONS.indent;
      i += 1;
      continue;
    }

    if (arg === "--rpf-mode") {
      options.rpfMode = String(argv[i + 1] || "").toLowerCase();
      i += 1;
      continue;
    }

    if (arg === "--rpf-extract-output") {
      options.rpfExtractOutput = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--gtautil") {
      options.gtautilPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--keep-rpf-extract") {
      options.keepRpfExtract = true;
      continue;
    }

    if (arg === "--image-base-url") {
      options.imageBaseUrl = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--strings-file") {
      options.stringsFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--image-extension") {
      const extension = String(argv[i + 1] || "").trim();
      options.imageExtension = extension.startsWith(".")
        ? extension.toLowerCase()
        : `.${extension.toLowerCase()}`;
      i += 1;
      continue;
    }
  }

  return options;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toRelativePath(rootPath, filePath) {
  return path.relative(rootPath, filePath).replace(/\\/g, "/");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toCategoryName(value) {
  return (
    String(value || "other")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "other"
  );
}

function readNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function readVector($item, selector) {
  const element = $item.find(selector).first();

  if (!element.length) {
    return null;
  }

  const x = readNumber(element.attr("x"));
  const y = readNumber(element.attr("y"));
  const z = readNumber(element.attr("z"));

  if (x === null && y === null && z === null) {
    return null;
  }

  return { x, y, z };
}

function readNodeText($item, selector) {
  const value = normalizeText($item.find(selector).first().text());
  return value || null;
}

function readNodeValue($item, selector) {
  const element = $item.find(selector).first();

  if (!element.length) {
    return null;
  }

  return normalizeText(element.attr("value") || element.text()) || null;
}

function isYtypXml(fileName) {
  return String(fileName).toLowerCase().endsWith(".ytyp.xml");
}

function isModelFile(fileName) {
  return MODEL_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function isLikelyHumanOrVehicleModel(modelName) {
  const lower = modelName.toLowerCase();
  const blockedPrefixes = [
    "a_c_",
    "csb_",
    "g_f_",
    "g_m_",
    "hc_",
    "ig_",
    "mp_f_",
    "mp_m_",
    "player_",
    "s_f_",
    "s_m_",
    "slod",
    "u_f_",
    "u_m_",
  ];

  return blockedPrefixes.some((prefix) => lower.startsWith(prefix));
}

function isProbablyPropModel(modelName, mode) {
  if (!modelName) {
    return false;
  }

  if (mode === "all") {
    return true;
  }

  const lower = modelName.toLowerCase();

  if (isLikelyHumanOrVehicleModel(lower)) {
    return false;
  }

  const allowedPrefixes = [
    "prop_",
    "hei_prop_",
    "apa_prop_",
    "ex_prop_",
    "xm_prop_",
    "vw_prop_",
    "bkr_prop_",
    "ba_prop_",
    "ch_prop_",
    "h4_prop_",
    "tr_prop_",
    "sf_prop_",
    "sm_prop_",
    "reh_prop_",
    "xs_prop_",
    "gr_prop_",
    "lr_prop_",
    "p_",
    "v_",
    "cs_",
    "des_",
    "proc_",
    "xm_",
    "h4_",
    "ch_",
    "m23_",
    "sf_",
    "reh_",
    "sum_",
    "hei_",
  ];

  return allowedPrefixes.some((prefix) => lower.startsWith(prefix));
}

function computeJoaat(value) {
  let hash = 0;
  const input = String(value || "").toLowerCase();

  for (let i = 0; i < input.length; i += 1) {
    hash += input.charCodeAt(i);
    hash += hash << 10;
    hash ^= hash >>> 6;
  }

  hash += hash << 3;
  hash ^= hash >>> 11;
  hash += hash << 15;

  return hash >>> 0;
}

function formatHashHex(hash) {
  return `0x${hash.toString(16).padStart(8, "0")}`;
}

function toInt32Hash(hash) {
  return hash > 0x7fffffff ? hash - 0x100000000 : hash;
}

function getRpfPathFromRelativePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  const match = normalized.match(/(.+?\.rpf)(?:\/|$)/i);
  return match ? match[1] : null;
}

function getDlcNameFromPaths(relativePaths) {
  for (const relativePath of relativePaths) {
    const normalized = String(relativePath || "").replace(/\\/g, "/").toLowerCase();
    const dlcMatch = normalized.match(/\/dlcpacks\/([^/]+)/i);
    if (dlcMatch && dlcMatch[1]) {
      return dlcMatch[1];
    }
  }

  for (const relativePath of relativePaths) {
    const normalized = String(relativePath || "").replace(/\\/g, "/").toLowerCase();
    if (/^x64[a-z]\.rpf/i.test(normalized) || normalized.includes("/x64")) {
      return "gta5_base";
    }
  }

  return null;
}

function getDlcLabel(dlcName) {
  if (!dlcName) {
    return null;
  }
  return DLC_FRIENDLY_NAMES.get(String(dlcName).toLowerCase()) || formatLabel(dlcName);
}

function getBestFilePath(relativePaths, extensions) {
  const normalizedExts = new Set(
    Array.from(extensions).map((extension) => extension.toLowerCase())
  );

  for (const relativePath of relativePaths) {
    const lower = String(relativePath).toLowerCase();
    for (const extension of normalizedExts) {
      if (lower.endsWith(extension)) {
        return relativePath;
      }
    }
  }

  return null;
}

function getAllRpfPaths(relativePaths) {
  const values = [];
  for (const relativePath of relativePaths) {
    const rpf = getRpfPathFromRelativePath(relativePath);
    if (rpf) {
      values.push(rpf);
    }
  }
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function estimateSizeIndicator(bounds) {
  if (!bounds || typeof bounds !== "object") {
    return null;
  }

  const radius = readNumber(bounds.bsRadius);
  if (radius === null) {
    return null;
  }

  if (radius < 0.75) return "XS";
  if (radius < 1.5) return "S";
  if (radius < 3.0) return "M";
  if (radius < 7.0) return "L";
  return "XL";
}

function buildImageUrl(baseUrl, categoryName, modelName, imageExtension) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  const category = toCategoryName(categoryName || "other");
  const model = String(modelName || "").trim();
  const extension = String(imageExtension || ".jpg");

  if (!base || !model) {
    return null;
  }

  return `${base}/${category}/${model}${extension}`;
}

function loadKnownCategoryIndex(baseDir) {
  const index = new Map();
  const knownJsonPath = path.join(baseDir, "fivem_props.json");

  if (!fs.existsSync(knownJsonPath)) {
    return index;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(knownJsonPath, "utf8"));
    if (!Array.isArray(parsed)) {
      return index;
    }

    for (const category of parsed) {
      if (!category || typeof category !== "object") {
        continue;
      }

      const categoryName = toCategoryName(category.name || category.label || "other");
      if (!Array.isArray(category.props)) {
        continue;
      }

      for (const prop of category.props) {
        const model = normalizeText(prop && prop.model);
        if (!model) {
          continue;
        }
        if (!index.has(model)) {
          index.set(model, categoryName);
        }
      }
    }
  } catch {
    return index;
  }

  return index;
}

function getPathTokens(relativePath) {
  return String(relativePath || "")
    .split("/")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function guessCategoryFromPath(relativePaths) {
  for (const relativePath of relativePaths) {
    const tokens = getPathTokens(relativePath);

    const propsIndex = tokens.lastIndexOf("props");
    if (propsIndex >= 0) {
      for (let index = propsIndex + 1; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (PROPS_PATH_STOP_WORDS.has(token)) {
          continue;
        }

        if (token.includes(".")) {
          break;
        }

        return token;
      }
    }

    for (const token of tokens) {
      if (!PROPS_PATH_STOP_WORDS.has(token) && !token.includes(".")) {
        return token;
      }
    }
  }

  return null;
}

function stripCommonPrefixes(modelName) {
  const prefixes = [
    "hei_prop_hei_",
    "hei_prop_",
    "apa_prop_",
    "ex_prop_",
    "xm_prop_",
    "vw_prop_",
    "bkr_prop_",
    "ba_prop_",
    "ch_prop_",
    "h4_prop_",
    "tr_prop_",
    "sf_prop_",
    "sm_prop_",
    "reh_prop_",
    "xs_prop_",
    "gr_prop_",
    "lr_prop_",
    "prop_",
    "proc_",
    "des_",
    "p_",
    "v_",
    "cs_",
  ];

  const lower = String(modelName || "").toLowerCase();

  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      return lower.slice(prefix.length);
    }
  }

  return lower;
}

function guessCategoryFromModel(modelName) {
  const cleaned = stripCommonPrefixes(modelName);
  const tokens = cleaned.split("_").filter(Boolean);

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      continue;
    }

    if (CATEGORY_HINTS.has(token)) {
      return CATEGORY_HINTS.get(token);
    }
  }
  return null;
}

function guessSourceName(relativePaths) {
  for (const relativePath of relativePaths) {
    const directoryName = path.basename(path.dirname(relativePath));
    const directoryValue = toCategoryName(directoryName);

    if (directoryValue && directoryValue !== "other") {
      return directoryValue;
    }

    const fileName = path.basename(relativePath, path.extname(relativePath));
    const cleanName = toCategoryName(fileName.replace(/\.ytyp$/i, ""));

    if (cleanName && cleanName !== "other") {
      return cleanName;
    }
  }

  return "unknown";
}

function mergeValue(target, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    target[key] = value;
  }
}

function toOutputProp(record, options) {
  const hash = computeJoaat(record.model);
  const int32Hash = toInt32Hash(hash);
  const hexHash = formatHashHex(hash);
  const sourceFiles = Array.from(record.sourceFiles).sort((a, b) =>
    a.localeCompare(b)
  );
  const sourcePacks = Array.from(record.sourcePacks).sort((a, b) =>
    a.localeCompare(b)
  );
  const modelFilePath =
    getBestFilePath(sourceFiles, [".ydr", ".ydd"]) ||
    getBestFilePath(Array.from(record.modelFiles), [".ydr", ".ydd"]);
  const ytypFilePath =
    getBestFilePath(sourceFiles, [".ytyp.xml", ".ytyp"]) ||
    getBestFilePath(Array.from(record.ytypFiles), [".ytyp.xml", ".ytyp"]);
  const rpfPaths = Array.from(record.rpfPaths).sort((a, b) => a.localeCompare(b));
  const derivedRpfPaths = getAllRpfPaths(sourceFiles);
  const rpfFilePath = rpfPaths[0] || derivedRpfPaths[0] || null;
  const dlcName =
    getDlcNameFromPaths(sourceFiles) ||
    (rpfFilePath ? getDlcNameFromPaths([rpfFilePath]) : null);
  const categories = [];
  if (record.categoryName) {
    categories.push(formatLabel(record.categoryName));
  }
  if (record.assetType) {
    categories.push(formatLabel(String(record.assetType).replace(/^ASSET_TYPE_/i, "")));
  }
  const uniqueCategories = Array.from(new Set(categories.filter(Boolean)));

  const output = {
    name: record.model,
    label: formatLabel(record.model),
    model: record.model,
    hash,
    hashHex: hexHash,
    int32Hash,
    hexHash,
  };

  mergeValue(output, "assetName", record.assetName);
  mergeValue(output, "assetType", record.assetType);
  mergeValue(output, "lodDist", record.lodDist);
  mergeValue(output, "hdTextureDist", record.hdTextureDist);
  mergeValue(output, "flags", record.flags);
  mergeValue(output, "specialAttribute", record.specialAttribute);
  mergeValue(output, "textureDictionary", record.textureDictionary);
  mergeValue(output, "drawableDictionary", record.drawableDictionary);
  mergeValue(output, "physicsDictionary", record.physicsDictionary);
  mergeValue(output, "clipDictionary", record.clipDictionary);
  mergeValue(output, "defaultLodDistance", record.lodDist);
  mergeValue(output, "sizeIndicator", estimateSizeIndicator(record.bounds));
  mergeValue(output, "flags", record.flags);
  mergeValue(output, "dlcName", dlcName);
  mergeValue(output, "dlcLabel", getDlcLabel(dlcName));
  mergeValue(output, "modelFilePath", modelFilePath);
  mergeValue(output, "ytypFilePath", ytypFilePath);
  mergeValue(output, "rpfFilePath", rpfFilePath);
  if (!modelFilePath && options.preferredPatchRpfPath) {
    mergeValue(output, "patchRpfFilePath", options.preferredPatchRpfPath);
    mergeValue(
      output,
      "patchModelFilePathHint",
      `${options.preferredPatchRpfPath}/**/${record.model}.ydr`
    );
    mergeValue(
      output,
      "patchModelFilePathHintAlt",
      `${options.preferredPatchRpfPath}/**/${record.model}.ydd`
    );
  }
  mergeValue(output, "texturesDictionaryName", record.textureDictionary);
  mergeValue(output, "clipDictionaryName", record.clipDictionary);
  const knownCategoryName =
    options.knownCategoryByModel && options.knownCategoryByModel.get(record.model);
  const imageCategoryName = knownCategoryName || record.categoryName || "other";
  mergeValue(
    output,
    "image",
    buildImageUrl(
      options.imageBaseUrl,
      imageCategoryName,
      record.model,
      options.imageExtension
    )
  );

  if (record.bounds) {
    output.bounds = record.bounds;
  }
  if (sourceFiles.length > 0) {
    output.sourceFiles = sourceFiles;
  }
  if (sourcePacks.length > 0) {
    output.sourcePacks = sourcePacks;
  }
  if (uniqueCategories.length > 0) {
    output.categories = uniqueCategories;
  }
  if (rpfPaths.length > 0 || derivedRpfPaths.length > 0) {
    output.rpfPaths = Array.from(new Set([...rpfPaths, ...derivedRpfPaths]));
  }
  const relatedMlos = Array.from(record.relatedMlos || []).sort((a, b) =>
    a.localeCompare(b)
  );
  if (relatedMlos.length > 0) {
    output.relatedMlos = relatedMlos;
  }

  if (record.hasModelFile) {
    output.hasModelFile = true;
  }

  if (record.hasDefinitionFile) {
    output.hasDefinitionFile = true;
  }

  return output;
}

function parseYtypArchetypes(filePath, rootPath) {
  const xml = fs.readFileSync(filePath, "utf8");
  const $ = cheerio.load(xml, { xmlMode: true, decodeEntities: false });
  const archetypes = [];
  const relativePath = toRelativePath(rootPath, filePath);
  const sourcePack = toCategoryName(
    path.basename(filePath).replace(/\.ytyp\.xml$/i, "")
  );

  $("archetypes > Item").each((_, element) => {
    const $item = $(element);
    const name = readNodeText($item, "name");
    const assetName = readNodeText($item, "assetName");
    const model = normalizeText(name || assetName);

    if (!model) {
      return;
    }

    const bounds = {};
    const bbMin = readVector($item, "bbMin");
    const bbMax = readVector($item, "bbMax");
    const bsCentre = readVector($item, "bsCentre");
    const bsRadius = readNumber(
      $item.find("bsRadius").first().attr("value") ||
        $item.find("bsRadius").first().text()
    );

    if (bbMin) {
      bounds.bbMin = bbMin;
    }

    if (bbMax) {
      bounds.bbMax = bbMax;
    }

    if (bsCentre) {
      bounds.bsCentre = bsCentre;
    }

    if (bsRadius !== null) {
      bounds.bsRadius = bsRadius;
    }

    archetypes.push({
      model,
      assetName: assetName || null,
      assetType: readNodeText($item, "assetType"),
      lodDist: readNumber(readNodeValue($item, "lodDist")),
      hdTextureDist: readNumber(readNodeValue($item, "hdTextureDist")),
      flags: readNodeValue($item, "flags"),
      specialAttribute: readNodeValue($item, "specialAttribute"),
      textureDictionary: readNodeText($item, "textureDictionary"),
      drawableDictionary: readNodeText($item, "drawableDictionary"),
      physicsDictionary: readNodeText($item, "physicsDictionary"),
      clipDictionary: readNodeText($item, "clipDictionary"),
      bounds: Object.keys(bounds).length > 0 ? bounds : null,
      sourceFile: relativePath,
      sourcePack,
    });
  });

  return archetypes;
}

function parseYmapEntityUsage(filePath, rootPath) {
  const xml = fs.readFileSync(filePath, "utf8");
  const $ = cheerio.load(xml, { xmlMode: true, decodeEntities: false });
  const ymapName =
    normalizeText($("CMapData > name").first().text()) ||
    path.basename(filePath, path.extname(filePath));
  const relativePath = toRelativePath(rootPath, filePath);
  const entries = [];

  $("entities > Item > archetypeName").each((_, element) => {
    const model = normalizeText($(element).text());
    if (!model) {
      return;
    }

    entries.push({
      model,
      ymapName,
      sourceFile: relativePath,
    });
  });

  return entries;
}

function walkDirectory(rootPath) {
  const files = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) {
          stack.push(entryPath);
        }
        continue;
      }

      files.push(entryPath);
    }
  }

  return files;
}

function collectPatchRpfPaths(files, rootPath) {
  const patchRpfs = [];

  for (const filePath of files) {
    const normalized = String(filePath).replace(/\\/g, "/").toLowerCase();
    if (!normalized.endsWith(".rpf")) {
      continue;
    }
    if (!normalized.includes("/update/x64/dlcpacks/patch")) {
      continue;
    }

    patchRpfs.push(toRelativePath(rootPath, filePath));
  }

  return Array.from(new Set(patchRpfs)).sort((a, b) => a.localeCompare(b));
}

function createRecord(recordMap, model) {
  if (!recordMap.has(model)) {
    recordMap.set(model, {
      model,
      sourceFiles: new Set(),
      sourcePacks: new Set(),
      modelFiles: new Set(),
      ytypFiles: new Set(),
      rpfPaths: new Set(),
      relatedMlos: new Set(),
      hasModelFile: false,
      hasDefinitionFile: false,
    });
  }

  return recordMap.get(model);
}

function mergeRecordMaps(primaryMap, secondaryMap) {
  const merged = new Map(primaryMap);
  const scalarKeys = [
    "assetName",
    "assetType",
    "lodDist",
    "hdTextureDist",
    "flags",
    "specialAttribute",
    "textureDictionary",
    "drawableDictionary",
    "physicsDictionary",
    "clipDictionary",
    "bounds",
  ];

  for (const [model, incoming] of secondaryMap.entries()) {
    if (!merged.has(model)) {
      merged.set(model, incoming);
      continue;
    }

    const current = merged.get(model);
    for (const value of incoming.sourceFiles) {
      current.sourceFiles.add(value);
    }
    for (const value of incoming.sourcePacks) {
      current.sourcePacks.add(value);
    }
    for (const value of incoming.modelFiles) {
      current.modelFiles.add(value);
    }
    for (const value of incoming.ytypFiles) {
      current.ytypFiles.add(value);
    }
    for (const value of incoming.rpfPaths) {
      current.rpfPaths.add(value);
    }
    for (const value of incoming.relatedMlos) {
      current.relatedMlos.add(value);
    }

    current.hasModelFile = current.hasModelFile || incoming.hasModelFile;
    current.hasDefinitionFile =
      current.hasDefinitionFile || incoming.hasDefinitionFile;

    for (const key of scalarKeys) {
      if (current[key] === undefined || current[key] === null || current[key] === "") {
        current[key] = incoming[key];
      }
    }
  }

  return merged;
}

function normalizeArchivePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function toArchiveRelativePath(rpfPath, entryPath) {
  const rpf = normalizeArchivePath(rpfPath);
  const entry = normalizeArchivePath(entryPath);
  return entry ? `${rpf}/${entry}` : rpf;
}

async function loadRpfManagerConstructor() {
  const candidates = [
    {
      target: "gtavbrowser-mcp/dist/rpf-manager.js",
      isPath: false,
    },
    {
      target: path.join(
        __dirname,
        "node_modules",
        "gtavbrowser-mcp",
        "dist",
        "rpf-manager.js"
      ),
      isPath: true,
    },
  ];

  for (const candidate of candidates) {
    try {
      const importTarget = candidate.isPath
        ? pathToFileURL(candidate.target).href
        : candidate.target;
      const module = await import(importTarget);
      if (module && typeof module.RpfManager === "function") {
        return module.RpfManager;
      }
    } catch {
      // Essaie le candidat suivant.
    }
  }

  return null;
}

async function buildRecordMapFromRpfArchives(options) {
  const recordMap = new Map();
  const stats = {
    rpfArchivesScanned: 0,
    rpfModelEntries: 0,
    rpfYtypEntries: 0,
    rpfLoadErrors: 0,
    rpfScanAttempted: false,
    rpfScanSucceeded: false,
  };

  const RpfManager = await loadRpfManagerConstructor();
  if (!RpfManager) {
    return {
      recordMap,
      stats,
      warning:
        "Module gtavbrowser-mcp introuvable. Lance `npm install gtavbrowser-mcp --save` puis relance.",
    };
  }

  try {
    stats.rpfScanAttempted = true;
    const rpfLogLines = [];
    const originalConsoleError = console.error;
    console.error = (...args) => {
      rpfLogLines.push(
        args
          .map((value) =>
            typeof value === "string" ? value : JSON.stringify(value)
          )
          .join(" ")
      );
    };

    const manager = new RpfManager();
    try {
      await manager.init(options.input);
      const rpfList = manager.getRpfList();
      stats.rpfArchivesScanned = rpfList.length;

      const modelEntries = [
        ...manager.searchFiles("*.ydr"),
        ...manager.searchFiles("*.ydd"),
      ];
      stats.rpfModelEntries = modelEntries.length;
      stats.rpfYtypEntries = manager.searchFiles("*.ytyp").length;

      for (const entry of modelEntries) {
        const relativePath = toArchiveRelativePath(entry.rpfPath, entry.entryPath);
        const extension = path.extname(relativePath).toLowerCase();
        const modelName = path.basename(relativePath, extension);

        if (!isProbablyPropModel(modelName, options.mode)) {
          continue;
        }

        const record = createRecord(recordMap, modelName);
        record.hasModelFile = true;
        record.sourceFiles.add(relativePath);
        record.sourcePacks.add(guessSourceName([relativePath]));
        record.modelFiles.add(relativePath);

        const rpfPath = getRpfPathFromRelativePath(relativePath);
        if (rpfPath) {
          record.rpfPaths.add(rpfPath);
        }
      }
    } finally {
      console.error = originalConsoleError;
    }

    stats.rpfLoadErrors = rpfLogLines.filter((line) =>
      line.includes("Failed to load RPF")
    ).length;

    if (stats.rpfLoadErrors > 0) {
      const warning =
        `Lecture partielle des archives .rpf (${stats.rpfLoadErrors} erreurs de chargement detectees).`;
      stats.rpfScanSucceeded = true;
      return { recordMap, stats, warning };
    }

    stats.rpfScanSucceeded = true;
    return { recordMap, stats, warning: null };
  } catch (error) {
    return {
      recordMap,
      stats,
      warning: `Lecture des archives .rpf impossible: ${error.message || error}`,
    };
  }
}

function buildRecordMapFromStringsFile(options) {
  const recordMap = new Map();
  const stats = {
    stringsRead: false,
    stringsLineCount: 0,
    stringsModelCount: 0,
  };

  const stringsFile = path.resolve(options.stringsFile || DEFAULT_STRINGS_FILE);
  if (!fs.existsSync(stringsFile)) {
    return {
      recordMap,
      stats,
      warning: `Fichier strings introuvable: ${stringsFile}`,
    };
  }

  try {
    const raw = fs.readFileSync(stringsFile, "utf8");
    const lines = raw.split(/\r?\n/);
    stats.stringsRead = true;
    stats.stringsLineCount = lines.length;

    for (const line of lines) {
      const modelName = normalizeText(line).toLowerCase();

      if (!modelName) {
        continue;
      }
      if (!/^[a-z0-9_]+$/.test(modelName)) {
        continue;
      }
      if (!isProbablyPropModel(modelName, options.mode)) {
        continue;
      }

      const record = createRecord(recordMap, modelName);
      record.sourcePacks.add("gtautil_strings");
    }

    stats.stringsModelCount = recordMap.size;
    return { recordMap, stats, warning: null };
  } catch (error) {
    return {
      recordMap,
      stats,
      warning: `Lecture strings.txt impossible: ${error.message || error}`,
    };
  }
}

function buildRecordMap(files, options) {
  const recordMap = new Map();
  const stats = {
    totalFiles: files.length,
    ytypFiles: 0,
    modelFiles: 0,
    rpfFiles: 0,
    parsedArchetypes: 0,
  };

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    const relativePath = toRelativePath(options.input, filePath);

    if (extension === ".rpf") {
      stats.rpfFiles += 1;
      continue;
    }

    if (isYtypXml(filePath)) {
      stats.ytypFiles += 1;

      for (const archetype of parseYtypArchetypes(filePath, options.input)) {
        if (!isProbablyPropModel(archetype.model, options.mode)) {
          continue;
        }

        const record = createRecord(recordMap, archetype.model);
        record.hasDefinitionFile = true;
        record.sourceFiles.add(archetype.sourceFile);
        record.sourcePacks.add(archetype.sourcePack);
        record.ytypFiles.add(archetype.sourceFile);

        const archetypeRpf = getRpfPathFromRelativePath(archetype.sourceFile);
        if (archetypeRpf) {
          record.rpfPaths.add(archetypeRpf);
        }

        mergeValue(record, "assetName", archetype.assetName);
        mergeValue(record, "assetType", archetype.assetType);
        mergeValue(record, "lodDist", archetype.lodDist);
        mergeValue(record, "hdTextureDist", archetype.hdTextureDist);
        mergeValue(record, "flags", archetype.flags);
        mergeValue(record, "specialAttribute", archetype.specialAttribute);
        mergeValue(record, "textureDictionary", archetype.textureDictionary);
        mergeValue(record, "drawableDictionary", archetype.drawableDictionary);
        mergeValue(record, "physicsDictionary", archetype.physicsDictionary);
        mergeValue(record, "clipDictionary", archetype.clipDictionary);

        if (archetype.bounds && !record.bounds) {
          record.bounds = archetype.bounds;
        }

        stats.parsedArchetypes += 1;
      }

      continue;
    }

    if (isModelFile(filePath)) {
      const modelName = path.basename(filePath, extension);

      if (!isProbablyPropModel(modelName, options.mode)) {
        continue;
      }

      const record = createRecord(recordMap, modelName);
      record.hasModelFile = true;
      record.sourceFiles.add(relativePath);
      record.sourcePacks.add(guessSourceName([relativePath]));
      record.modelFiles.add(relativePath);

      const modelRpf = getRpfPathFromRelativePath(relativePath);
      if (modelRpf) {
        record.rpfPaths.add(modelRpf);
      }
      stats.modelFiles += 1;
      continue;
    }

    if (String(filePath).toLowerCase().endsWith(YMAP_XML_EXTENSION)) {
      for (const entry of parseYmapEntityUsage(filePath, options.input)) {
        if (!isProbablyPropModel(entry.model, options.mode)) {
          continue;
        }

        const record = createRecord(recordMap, entry.model);
        record.sourceFiles.add(entry.sourceFile);
        record.relatedMlos.add(entry.ymapName);

        const ymapRpf = getRpfPathFromRelativePath(entry.sourceFile);
        if (ymapRpf) {
          record.rpfPaths.add(ymapRpf);
        }
      }
    }
  }

  return { recordMap, stats };
}

function groupRecords(recordMap, groupBy, options) {
  const groups = new Map();
  const records = Array.from(recordMap.values()).sort((a, b) =>
    a.model.localeCompare(b.model)
  );

  for (const record of records) {
    const relativePaths = Array.from(record.sourceFiles);
    const knownCategoryName =
      options.knownCategoryByModel && options.knownCategoryByModel.get(record.model);
    const categoryName =
      knownCategoryName ||
      guessCategoryFromModel(record.model) ||
      guessCategoryFromPath(relativePaths) ||
      "other";
    const sourceName = guessSourceName(relativePaths);

    let groupName = categoryName;
    if (groupBy === "source") {
      groupName = sourceName;
    } else if (groupBy === "none") {
      groupName = "all";
    }

    const normalizedGroupName = toCategoryName(groupName);
    const group = groups.get(normalizedGroupName) || {
      label: formatLabel(normalizedGroupName),
      name: normalizedGroupName,
      props: [],
    };

    record.categoryName = normalizedGroupName;
    group.props.push(toOutputProp(record, options));
    groups.set(normalizedGroupName, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      props: group.props.sort((a, b) => a.model.localeCompare(b.model)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || !options.input) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  if (!["category", "source", "none"].includes(options.groupBy)) {
    console.error(`Option --group-by invalide: ${options.groupBy}`);
    process.exit(1);
  }

  if (!["props", "all"].includes(options.mode)) {
    console.error(`Option --mode invalide: ${options.mode}`);
    process.exit(1);
  }

  if (!["auto", "force", "never"].includes(options.rpfMode)) {
    console.error(`Option --rpf-mode invalide: ${options.rpfMode}`);
    process.exit(1);
  }

  options.input = path.resolve(options.input);
  options.output = path.resolve(options.output || DEFAULT_OUTPUT);
  options.knownCategoryByModel = loadKnownCategoryIndex(__dirname);

  if (!fs.existsSync(options.input)) {
    console.error(`Dossier introuvable: ${options.input}`);
    process.exit(1);
  }

  const files = walkDirectory(options.input);
  const patchRpfPaths = collectPatchRpfPaths(files, options.input);
  options.preferredPatchRpfPath =
    patchRpfPaths.length > 0 ? patchRpfPaths[patchRpfPaths.length - 1] : null;
  const { recordMap, stats } = buildRecordMap(files, options);
  let mergedRecordMap = recordMap;
  let rpfScanStats = null;
  let rpfWarning = null;
  let stringsStats = null;
  let stringsWarning = null;
  const shouldReadRpf =
    options.rpfMode === "force" ||
    (options.rpfMode === "auto" &&
      stats.rpfFiles > 0 &&
      stats.modelFiles === 0 &&
      stats.ytypFiles === 0);

  if (shouldReadRpf) {
    const rpfResult = await buildRecordMapFromRpfArchives(options);
    mergedRecordMap = mergeRecordMaps(mergedRecordMap, rpfResult.recordMap);
    rpfScanStats = rpfResult.stats;
    rpfWarning = rpfResult.warning;
  }

  const shouldUseStringsFallback =
    mergedRecordMap.size === 0 &&
    stats.rpfFiles > 0;

  if (shouldUseStringsFallback) {
    const stringsResult = buildRecordMapFromStringsFile(options);
    mergedRecordMap = mergeRecordMaps(mergedRecordMap, stringsResult.recordMap);
    stringsStats = stringsResult.stats;
    stringsWarning = stringsResult.warning;
  }

  const output = groupRecords(mergedRecordMap, options.groupBy, options);

  ensureDirectory(path.dirname(options.output));
  fs.writeFileSync(
    options.output,
    JSON.stringify(output, null, options.indent),
    "utf8"
  );

  const totalProps = output.reduce(
    (sum, category) => sum + category.props.length,
    0
  );

  console.log(`JSON genere : ${options.output}`);
  console.log(`Groupes : ${output.length}`);
  console.log(`Props : ${totalProps}`);
  console.log(`Fichiers scannes : ${stats.totalFiles}`);
  console.log(`YTYP lus : ${stats.ytypFiles}`);
  console.log(`Modeles detectes : ${stats.modelFiles}`);

  if (rpfScanStats && rpfScanStats.rpfScanSucceeded) {
    console.log(
      `Archives .rpf lues : ${rpfScanStats.rpfArchivesScanned} (entrees modeles trouvees: ${rpfScanStats.rpfModelEntries})`
    );
  } else if (stats.rpfFiles > 0) {
    if (options.rpfMode === "never") {
      console.log(
        `Archives .rpf detectees : ${stats.rpfFiles} (lecture ignoree car --rpf-mode never).`
      );
    } else {
      console.log(
        `Archives .rpf detectees : ${stats.rpfFiles} (non lues directement, extrais-les d'abord si besoin).`
      );
    }
  }

  if (rpfWarning) {
    console.log(`Info RPF : ${rpfWarning}`);
  }
  if (stringsStats && stringsStats.stringsRead) {
    console.log(
      `Fallback strings.txt : ${stringsStats.stringsModelCount} modeles props detectes (lignes lues: ${stringsStats.stringsLineCount}).`
    );
  }
  if (stringsWarning) {
    console.log(`Info strings : ${stringsWarning}`);
  }
  if (options.preferredPatchRpfPath) {
    console.log(`Patch prioritaire : ${options.preferredPatchRpfPath}`);
  }

  if (totalProps === 0) {
    console.log(
      "Aucune prop exportee. Verifie que ton dossier contient des .ytyp.xml ou des .ydr/.ydd extraits."
    );
  }
}

main().catch((error) => {
  console.error(`Erreur: ${error.message || error}`);
  process.exit(1);
});
