// Boards, tag sets, and the search plan for `pnpm seed`.
// A post tagged as a minor is dropped on every board and rating.
// "lolita" is clothing and stays searchable.

const UA = "kura-convex-seed/0.1";
const EXCLUDES = ["-loli", "-shota", "-lolicon", "-shotacon", "-child", "-underage", "-toddler"];
const BLOCKED = new Set([
  "loli",
  "lolicon",
  "shota",
  "shotacon",
  "shotaboy",
  "child",
  "children",
  "underage",
  "toddler",
  "toddlercon",
  "infant",
  "baby",
  "preteen",
  "preschooler",
  "kindergarten",
  "minor",
  "jailbait",
  "young_child",
  "child_abuse",
]);

const RATING_ALIASES = {
  safe: ["safe"],
  general: ["safe"],
  g: ["safe"],
  questionable: ["questionable"],
  sensitive: ["questionable"],
  q: ["questionable"],
  explicit: ["explicit"],
  e: ["explicit"],
  nsfw: ["questionable", "explicit"],
};

const BOARD_ALIASES = {
  "yande.re": "yandere",
  yande: "yandere",
  "konachan.com": "konachan",
  "safebooru.org": "safebooru",
  "danbooru.donmai.us": "danbooru",
  "gelbooru.com": "gelbooru",
};

export const TAG_SETS = {
  yuri: ["yuri", "2girls", "holding_hands", "kiss", "multiple_girls"],
  cute: ["cute", "smile", "blush", "heart", "cat_ears"],
  cyberpunk: ["cyberpunk", "neon_lights", "science_fiction", "mecha", "cityscape"],
  scenery: ["landscape", "scenery", "nature", "ocean", "forest", "mountain", "sky", "night", "sunset", "rain", "snow", "flower", "city"],
  portrait: ["1girl", "1boy", "solo", "portrait", "upper_body", "looking_at_viewer", "face"],
  fashion: ["dress", "kimono", "hoodie", "school_uniform", "gothic_lolita", "armor", "thighhighs", "hat"],
  fantasy: ["fantasy", "witch", "magic", "dragon", "sword", "elf", "angel", "demon_girl"],
  daily: ["cafe", "library", "train", "food", "book", "headphones", "bed", "window"],
  nsfw: ["nude", "lingerie", "bikini", "breasts", "ass", "sex", "kiss", "yuri", "hetero", "thighhighs", "underwear", "nipples", "fellatio", "cunnilingus", "bondage"],
};

const SAFE_SET_NAMES = ["yuri", "cute", "cyberpunk", "scenery", "portrait", "fashion", "fantasy", "daily"];
const WIDE = [...new Set(SAFE_SET_NAMES.flatMap((name) => TAG_SETS[name]))];

function preset(name, description, boards, ratings, tags) {
  return { name, description, boards, ratings, tags };
}

function safePreset(name, description) {
  return preset(name, description, ["safebooru", "danbooru"], ["safe"], TAG_SETS[name]);
}

export const PRESETS = {
  classic: preset(
    "classic",
    "The original Safebooru mix: yuri, cute, cyberpunk, and 1girl.",
    ["safebooru"],
    ["safe"],
    ["yuri 1girl", "cyberpunk 1girl", "cute 1girl", "yuri cute", "cyberpunk"],
  ),
  wide: preset(
    "wide",
    "Broad general-rated Safebooru catalog across portraits, places, clothes, and fantasy.",
    ["safebooru"],
    ["safe"],
    WIDE,
  ),
  yuri: safePreset("yuri", "Yuri, pairs, and kisses. General rated."),
  cute: safePreset("cute", "Soft expressions and cat ears. General rated."),
  cyberpunk: safePreset("cyberpunk", "Neon, cities, and mecha. General rated."),
  scenery: safePreset("scenery", "Landscapes, weather, and cities. General rated."),
  portrait: safePreset("portrait", "Character portraits. General rated."),
  fashion: safePreset("fashion", "Clothes and outfits. General rated."),
  fantasy: safePreset("fantasy", "Witches, magic, and armor. General rated."),
  daily: safePreset("daily", "Cafes, trains, food, and rooms. General rated."),
  nsfw: preset(
    "nsfw",
    "Questionable and explicit posts from Danbooru, Yande.re, Konachan, and Gelbooru.",
    ["danbooru", "yandere", "konachan", "gelbooru"],
    ["questionable", "explicit"],
    ["1girl", "2girls", "solo", ...TAG_SETS.nsfw],
  ),
  danbooru: preset(
    "danbooru",
    "Danbooru at every rating, using the wide tags and the nsfw tags.",
    ["danbooru"],
    ["safe", "questionable", "explicit"],
    [...WIDE, ...TAG_SETS.nsfw],
  ),
};

export class BoardError extends Error {
  constructor(message, unavailable = false) {
    super(message);
    this.unavailable = unavailable;
  }
}

export function usage(message) {
  const error = new Error(message);
  error.usage = true;
  return error;
}

export function tagBlocked(tag) {
  const name = tag.toLowerCase();
  if (name.includes("lolita")) return false;
  if (BLOCKED.has(name)) return true;
  return /(^|_)(loli|lolicon|shota|shotacon|toddler|preteen|underage|preschooler|jailbait)(_|$)/.test(name);
}

export function helpText() {
  const presets = Object.values(PRESETS)
    .map((item) => `  ${item.name.padEnd(12)} ${item.description}`)
    .join("\n");
  const sets = Object.entries(TAG_SETS)
    .map(([name, tags]) => `  ${name.padEnd(12)} ${tags.join(", ")}`)
    .join("\n");
  const boards = Object.values(BOARDS)
    .map((board) => `  ${board.id.padEnd(12)} ${board.note}`)
    .join("\n");
  return `Usage
  pnpm seed
  pnpm seed -- --list
  pnpm seed -- --preset <name>
  pnpm seed -- --board <name>[,name] --tags <tag>[,tag] --rating <safe|questionable|explicit|nsfw>
  pnpm seed -- --set <name>[,name]
  pnpm seed -- --limit <n> --pages <n> --dry-run

Presets
${presets}

Tag sets
${sets}

Boards
${boards}

A comma separates searches. A space inside one search is an AND, for example --tags "yuri 1girl,landscape".
--tags replaces the preset tags. --set adds a named group. --board and --rating replace those parts of the preset.
Posts tagged as minors are skipped on every board.
Gelbooru needs GELBOORU_API_KEY and GELBOORU_USER_ID in .env.local.
Danbooru allows two search tags at a time unless DANBOORU_LOGIN and DANBOORU_API_KEY are set.
The default is --preset wide --limit 1200.
`;
}

export function resolvePlan(args) {
  const flags = parseArgs(args);
  if (flags.help || flags.list) return { help: true, dryRun: false };
  const preset = flags.preset ? PRESETS[flags.preset] : null;
  if (flags.preset && !preset) throw usage(`Unknown preset ${flags.preset}. Run pnpm seed -- --list.`);
  const implicit = !preset && !flags.tags && !flags.sets && !flags.boards && !flags.ratings;
  const base = preset ?? (implicit ? PRESETS.wide : null);
  const setTags = [];
  for (const name of flags.sets ?? []) {
    const set = TAG_SETS[name];
    if (!set) throw usage(`Unknown tag set ${name}. Run pnpm seed -- --list.`);
    setTags.push(...set);
  }
  const tags = [...new Set([...(flags.tags ?? base?.tags ?? []), ...setTags].map((tag) => tag.trim()).filter(Boolean))];
  const boards = (flags.boards ?? base?.boards ?? ["safebooru"]).map(canonicalBoard);
  const ratings = flags.ratings ?? base?.ratings ?? ["safe"];
  for (const board of boards) {
    if (!BOARDS[board]) throw usage(`Unknown board ${board}. Run pnpm seed -- --list.`);
  }
  for (const tag of tags) {
    for (const part of tag.split(/\s+/)) {
      const name = part.replace(/^-/, "").toLowerCase();
      if (name && tagBlocked(name)) throw usage(`Won't search for ${name}.`);
    }
  }
  if (tags.length === 0) throw usage("Pick tags with --tags, --set, or --preset.");
  const limit = flags.limit ?? 1200;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw usage("--limit must be an integer from 1 to 10000.");
  if (flags.pages != null && (!Number.isInteger(flags.pages) || flags.pages < 1 || flags.pages > 20)) {
    throw usage("--pages must be an integer from 1 to 20.");
  }
  return {
    help: false,
    dryRun: flags.dryRun,
    preset: preset?.name ?? (implicit ? "wide" : ""),
    tags,
    boards: [...new Set(boards)],
    ratings,
    limit,
    pages: flags.pages,
  };
}

export function boardFor(id, env = {}) {
  const source = BOARDS[canonicalBoard(id)];
  if (!source) throw usage(`Unknown board ${id}.`);
  const board = { ...source };
  if (board.id === "danbooru" && env.DANBOORU_LOGIN && env.DANBOORU_API_KEY) {
    board.contentTagLimit = 6;
    board.excludeRoom = 4;
    board.auth = `Basic ${Buffer.from(`${env.DANBOORU_LOGIN}:${env.DANBOORU_API_KEY}`).toString("base64")}`;
  }
  if (board.id === "gelbooru") {
    board.apiKey = env.GELBOORU_API_KEY ?? "";
    board.userId = env.GELBOORU_USER_ID ?? "";
  }
  return board;
}

export function skipReason(board) {
  if (board.id === "gelbooru" && (!board.apiKey || !board.userId)) {
    return "needs GELBOORU_API_KEY and GELBOORU_USER_ID in .env.local";
  }
  return "";
}

export function searchQueries(board, tag, ratings) {
  const metas = metasFor(board, ratings);
  if (!metas) return [];
  const content = tag.split(/\s+/).filter(Boolean);
  const size = Math.max(1, board.contentTagLimit);
  const groups = [];
  for (let i = 0; i < content.length; i += size) groups.push(content.slice(i, i + size));
  const excludes = EXCLUDES.slice(0, board.excludeRoom ?? 0);
  const queries = [];
  for (const group of groups) {
    for (const meta of metas) {
      const parts = [...group];
      if (meta) parts.push(meta);
      if (board.sortTag && (!board.sortCounts || group.length < board.contentTagLimit)) parts.push(board.sortTag);
      parts.push(...excludes);
      queries.push({ query: parts.join(" "), label: [...group, meta].filter(Boolean).join(" ") });
    }
  }
  return queries;
}

export async function collect(board, tags, ratings, limit, pages) {
  const skipped = ratings.filter((rating) => !board.supports.includes(rating));
  if (skipped.length > 0 && skipped.length < ratings.length) console.log(`${board.label} has no ${skipped.join(", ")} posts.`);
  const queries = [];
  for (const tag of tags) queries.push(...searchQueries(board, tag, ratings));
  const unique = [];
  const seenQuery = new Set();
  for (const item of queries) {
    if (seenQuery.has(item.query)) continue;
    seenQuery.add(item.query);
    unique.push(item);
  }
  if (unique.length === 0) {
    console.log(`${board.label} does not serve ${ratings.join(", ")}.`);
    return [];
  }
  const perQuery = Math.max(24, Math.ceil((limit * 1.4) / unique.length));
  const maxPages = pages ?? Math.min(3, Math.max(1, Math.ceil(perQuery / board.pageSize)));
  console.log(`${board.label}: ${unique.length} searches, about ${perQuery} posts each.`);
  const groups = [];
  for (let index = 0; index < unique.length; index += 1) {
    const item = unique[index];
    if (index > 0) await delay(board.delayMs);
    const found = new Map();
    let query = item.query;
    let droppedSort = false;
    for (let page = 0; page < maxPages; page += 1) {
      let raws = [];
      try {
        raws = await board.page({ query, page });
      } catch (error) {
        if (error?.unavailable) throw error;
        const timedOut = /HTTP 50[0234]/.test(error instanceof Error ? error.message : "");
        if (!droppedSort && page === 0 && board.sortTag && query.includes(board.sortTag) && timedOut) {
          droppedSort = true;
          query = query
            .split(/\s+/)
            .filter((part) => part !== board.sortTag)
            .join(" ");
          console.error(`${board.label} ${item.label} timed out. Fetching newest instead.`);
          page = -1;
          continue;
        }
        console.error(`${board.label} "${item.label}": ${error instanceof Error ? error.message : error}`);
        break;
      }
      if (!Array.isArray(raws) || raws.length === 0) break;
      for (const raw of raws) {
        const post = board.normalize(raw);
        if (!post || !ratings.includes(post.rating) || found.has(post.id)) continue;
        found.set(post.id, post);
      }
      if (raws.length < board.pageSize || page + 1 >= maxPages) break;
      await delay(board.delayMs);
    }
    const kept = [...found.values()]
      .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
      .slice(0, perQuery);
    console.log(`${board.label} ${item.label} -> ${kept.length}`);
    groups.push(kept);
  }
  return diversify(groups, limit + 40);
}

export const BOARD_ORDER = ["konachan", "gelbooru", "yandere", "safebooru", "danbooru"];

function parseArgs(args) {
  const flags = { preset: "", boards: null, tags: null, sets: null, ratings: null, limit: null, pages: null, list: false, help: false, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--list") flags.list = true;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--preset" || arg.startsWith("--preset=")) {
      const got = takeValue(args, i);
      i = got.index;
      flags.preset = got.value.trim();
    } else if (arg === "--board" || arg === "--boards" || arg.startsWith("--board=") || arg.startsWith("--boards=")) {
      const got = takeValue(args, i);
      i = got.index;
      flags.boards = splitList(got.value);
    } else if (arg === "--tag" || arg === "--tags" || arg.startsWith("--tag=") || arg.startsWith("--tags=")) {
      const got = takeValue(args, i);
      i = got.index;
      flags.tags = splitList(got.value);
    } else if (arg === "--set" || arg === "--sets" || arg.startsWith("--set=") || arg.startsWith("--sets=")) {
      const got = takeValue(args, i);
      i = got.index;
      flags.sets = splitList(got.value);
    } else if (arg === "--rating" || arg === "--ratings" || arg.startsWith("--rating=") || arg.startsWith("--ratings=")) {
      const got = takeValue(args, i);
      i = got.index;
      flags.ratings = parseRatings(got.value);
    } else if (arg === "--limit" || arg.startsWith("--limit=")) {
      const got = takeValue(args, i);
      i = got.index;
      flags.limit = Number(got.value);
    } else if (arg === "--pages" || arg.startsWith("--pages=")) {
      const got = takeValue(args, i);
      i = got.index;
      flags.pages = Number(got.value);
    } else throw usage(`Unknown argument ${arg}. Run pnpm seed -- --list.`);
  }
  return flags;
}

function parseRatings(value) {
  const out = [];
  for (const part of splitList(value)) {
    const mapped = RATING_ALIASES[part.toLowerCase()];
    if (!mapped) throw usage(`Unknown rating ${part}. Use safe, questionable, explicit, or nsfw.`);
    for (const rating of mapped) if (!out.includes(rating)) out.push(rating);
  }
  if (out.length === 0) throw usage("--rating needs a value.");
  return out;
}

function takeValue(args, index) {
  const arg = args[index];
  const eq = arg.indexOf("=");
  if (eq !== -1) return { value: arg.slice(eq + 1), index };
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw usage(`${arg} needs a value.`);
  return { value, index: index + 1 };
}

function splitList(value) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function canonicalBoard(value) {
  const name = value.trim().toLowerCase();
  return BOARD_ALIASES[name] ?? name;
}

function metasFor(board, ratings) {
  const supported = ratings.filter((item) => board.supports.includes(item));
  if (supported.length === 0) return null;
  if (board.kind === "safebooru") return [""];
  if (board.kind === "danbooru") {
    const metas = [];
    if (supported.includes("safe")) metas.push("rating:g");
    if (supported.includes("questionable") && supported.includes("explicit")) metas.push("-rating:g");
    else if (supported.includes("questionable")) metas.push("rating:s", "rating:q");
    else if (supported.includes("explicit")) metas.push("rating:e");
    return metas;
  }
  if (board.kind === "moebooru") {
    const map = { safe: "rating:s", questionable: "rating:q", explicit: "rating:e" };
    return supported.map((item) => map[item]);
  }
  if (board.kind === "gelbooru") {
    const metas = [];
    if (supported.includes("safe")) metas.push("rating:general");
    if (supported.includes("questionable")) metas.push("rating:questionable", "rating:sensitive");
    if (supported.includes("explicit")) metas.push("rating:explicit");
    return metas;
  }
  return null;
}

function diversify(groups, limit) {
  const lists = groups.map((group) => group.slice());
  const seen = new Set();
  const out = [];
  while (out.length < limit) {
    let moved = false;
    for (const list of lists) {
      while (list.length > 0) {
        const post = list.shift();
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        out.push(post);
        moved = true;
        break;
      }
      if (out.length >= limit) break;
    }
    if (!moved) break;
  }
  return out;
}

async function getJson(url, board) {
  const headers = { "user-agent": UA, accept: "application/json" };
  if (board.auth) headers.authorization = board.auth;
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "request failed");
  }
  if (response.status === 429) {
    await delay(4000);
    response = await fetch(url, { headers });
  }
  if (response.status === 401 || response.status === 403) {
    throw new BoardError(`HTTP ${response.status}.`, true);
  }
  if (response.status === 422) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `${board.label} rejected the search`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = (await response.text()).trim();
  if (!text.startsWith("{") && !text.startsWith("[")) {
    throw new BoardError("did not return JSON.", true);
  }
  return JSON.parse(text);
}

function asList(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  const posts = body.post ?? body.posts;
  if (Array.isArray(posts)) return posts;
  if (posts && typeof posts === "object") return [posts];
  return [];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numericId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return 0;
  return id;
}

function cleanUrl(value) {
  return String(value ?? "")
    .replaceAll("\\/", "/")
    .trim();
}

function absolute(value, origin) {
  const url = cleanUrl(value);
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return "";
}

function imageExt(url, fileExt) {
  const hinted = String(fileExt ?? "")
    .toLowerCase()
    .replace("jpeg", "jpg");
  if (["zip", "mp4", "webm", "swf", "avif", "gifv", "mov"].includes(hinted)) return "";
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".png")) return "png";
  if (path.endsWith(".webp")) return "webp";
  if (path.endsWith(".gif")) return "gif";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "jpg";
  if (["jpg", "png", "gif", "webp"].includes(hinted)) return hinted;
  return hinted ? "" : "jpg";
}

function createdAtOf(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return Date.now();
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function artistFrom(value) {
  return String(value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((tag) => tag.replaceAll("_", " "))
    .join(", ")
    .slice(0, 80);
}

function captionFrom(tags) {
  return tags
    .filter((tag) => tag.includes("_") || tag.includes("("))
    .slice(0, 2)
    .map((tag) => tag.replaceAll("_", " "))
    .join(", ")
    .slice(0, 500);
}

function buildPost(board, fields) {
  const id = numericId(fields.id);
  const url = absolute(fields.url, board.origin);
  const ext = imageExt(url, fields.fileExt);
  const tags = String(fields.tags ?? "")
    .split(/\s+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  if (!id || !url || !ext || !fields.rating) return null;
  if (tags.some((tag) => tagBlocked(tag))) return null;
  return {
    board: board.id,
    id,
    ext,
    tags: tags.slice(0, 32),
    score: Number(fields.score) || 0,
    createdAt: createdAtOf(fields.createdAt),
    width: Number(fields.width) || 0,
    height: Number(fields.height) || 0,
    url,
    page: `${board.postUrl}${id}`,
    caption: captionFrom(tags),
    name: `${id}.${ext}`,
    artist: artistFrom(fields.artist),
    rating: fields.rating,
  };
}

function safebooruNormalize(post) {
  if (!post || post.rating !== "general") return null;
  return buildPost(this, {
    id: post.id,
    url: post.sample_url || post.file_url,
    tags: post.tags,
    score: post.score,
    createdAt: Number(post.change) || 0,
    width: post.sample_width || post.width,
    height: post.sample_height || post.height,
    artist: "",
    rating: "safe",
  });
}

function danbooruNormalize(post) {
  if (!post || post.is_deleted || post.is_banned) return null;
  const rating = { g: "safe", s: "questionable", q: "questionable", e: "explicit" }[post.rating];
  return buildPost(this, {
    id: post.id,
    url: post.large_file_url || post.file_url,
    fileExt: post.file_ext,
    tags: post.tag_string,
    score: post.score,
    createdAt: post.created_at,
    width: post.image_width,
    height: post.image_height,
    artist: post.tag_string_artist,
    rating,
  });
}

function moebooruNormalize(post) {
  if (!post || (post.status && post.status !== "active")) return null;
  const rating = { s: "safe", q: "questionable", e: "explicit" }[post.rating];
  return buildPost(this, {
    id: post.id,
    url: post.sample_url || post.jpeg_url || post.file_url,
    fileExt: post.file_ext,
    tags: post.tags,
    score: post.score,
    createdAt: post.created_at,
    width: post.sample_width || post.width,
    height: post.sample_height || post.height,
    artist: post.author,
    rating,
  });
}

function gelbooruNormalize(post) {
  if (!post) return null;
  const rating = {
    general: "safe",
    g: "safe",
    safe: "safe",
    sensitive: "questionable",
    s: "questionable",
    questionable: "questionable",
    q: "questionable",
    explicit: "explicit",
    e: "explicit",
  }[post.rating];
  return buildPost(this, {
    id: post.id,
    url: post.sample_url || post.file_url,
    tags: post.tags,
    score: post.score,
    createdAt: Number(post.change) || 0,
    width: post.sample_width || post.width,
    height: post.sample_height || post.height,
    artist: "",
    rating,
  });
}

const BOARDS = {
  safebooru: {
    id: "safebooru",
    label: "Safebooru",
    note: "General only. No API key.",
    origin: "https://safebooru.org",
    postUrl: "https://safebooru.org/index.php?page=post&s=view&id=",
    kind: "safebooru",
    sortTag: "sort:score",
    delayMs: 200,
    pageSize: 100,
    contentTagLimit: 2,
    excludeRoom: 6,
    supports: ["safe"],
    async page({ query, page }) {
      const url = `${this.origin}/index.php?page=dapi&s=post&q=index&json=1&limit=${this.pageSize}&pid=${page}&tags=${encodeURIComponent(query)}`;
      return asList(await getJson(url, this));
    },
    normalize: safebooruNormalize,
  },
  danbooru: {
    id: "danbooru",
    label: "Danbooru",
    note: "General, sensitive, questionable, and explicit. Two tags per search without a login.",
    origin: "https://danbooru.donmai.us",
    postUrl: "https://danbooru.donmai.us/posts/",
    kind: "danbooru",
    sortTag: "order:score",
    sortCounts: true,
    delayMs: 550,
    pageSize: 100,
    contentTagLimit: 2,
    excludeRoom: 0,
    supports: ["safe", "questionable", "explicit"],
    async page({ query, page }) {
      const url = new URL("/posts.json", this.origin);
      url.searchParams.set("tags", query);
      url.searchParams.set("limit", String(this.pageSize));
      url.searchParams.set("page", String(page + 1));
      const body = await getJson(url, this);
      if (body && body.success === false) throw new Error(body.message || "Danbooru rejected the search");
      return Array.isArray(body) ? body : [];
    },
    normalize: danbooruNormalize,
  },
  yandere: {
    id: "yandere",
    label: "Yande.re",
    note: "General, questionable, and explicit. No API key.",
    origin: "https://yande.re",
    postUrl: "https://yande.re/post/show/",
    kind: "moebooru",
    sortTag: "order:score",
    delayMs: 400,
    pageSize: 100,
    contentTagLimit: 4,
    excludeRoom: 6,
    supports: ["safe", "questionable", "explicit"],
    async page({ query, page }) {
      const url = new URL("/post.json", this.origin);
      url.searchParams.set("tags", query);
      url.searchParams.set("limit", String(this.pageSize));
      url.searchParams.set("page", String(page + 1));
      const body = await getJson(url, this);
      return Array.isArray(body) ? body : [];
    },
    normalize: moebooruNormalize,
  },
  konachan: {
    id: "konachan",
    label: "Konachan",
    note: "General, questionable, and explicit. Skipped when Cloudflare refuses the API.",
    origin: "https://konachan.com",
    postUrl: "https://konachan.com/post/show/",
    kind: "moebooru",
    sortTag: "order:score",
    delayMs: 400,
    pageSize: 100,
    contentTagLimit: 4,
    excludeRoom: 6,
    supports: ["safe", "questionable", "explicit"],
    async page({ query, page }) {
      const url = new URL("/post.json", this.origin);
      url.searchParams.set("tags", query);
      url.searchParams.set("limit", String(this.pageSize));
      url.searchParams.set("page", String(page + 1));
      const body = await getJson(url, this);
      return Array.isArray(body) ? body : [];
    },
    normalize: moebooruNormalize,
  },
  gelbooru: {
    id: "gelbooru",
    label: "Gelbooru",
    note: "All ratings. Needs GELBOORU_API_KEY and GELBOORU_USER_ID.",
    origin: "https://gelbooru.com",
    postUrl: "https://gelbooru.com/index.php?page=post&s=view&id=",
    kind: "gelbooru",
    sortTag: "sort:score",
    delayMs: 300,
    pageSize: 100,
    contentTagLimit: 2,
    excludeRoom: 6,
    supports: ["safe", "questionable", "explicit"],
    apiKey: "",
    userId: "",
    async page({ query, page }) {
      const url = new URL("/index.php", this.origin);
      url.searchParams.set("page", "dapi");
      url.searchParams.set("s", "post");
      url.searchParams.set("q", "index");
      url.searchParams.set("json", "1");
      url.searchParams.set("limit", String(this.pageSize));
      url.searchParams.set("pid", String(page));
      url.searchParams.set("tags", query);
      url.searchParams.set("api_key", this.apiKey);
      url.searchParams.set("user_id", this.userId);
      return asList(await getJson(url, this));
    },
    normalize: gelbooruNormalize,
  },
};
