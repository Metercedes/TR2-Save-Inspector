// engine.js — TR2 Save Inspector Engine (static/client-side version)
// Ported from app.py (Flask backend) for GitHub Pages compatibility.

"use strict";

// ── Constants ────────────────────────────────────────────────────────────────
const TS_SENTINEL = -62135596800;
const HASH_KEY = "BonusItemProtoData";
const HASH_ALGO = "md5_append";
const INT32_MAX = 2147483647;
const SAFE_MAX = INT32_MAX - 2000000;
const MAX_MULTIPLIER = 230;
const MAX_PLAYER_LEVEL = 286;
const SENSITIVE = new Set(["iapt", "siapt", "iappc", "iapms", "abgid", "PDILDK"]);
const DEPRECATED_ARTIFACT_PIDS = new Set();
const EXTRA_ARTIFACT_PIDS = new Set([51, 52, 53, 54, 55]);
const LEGACY_PLAYER_KEYS = new Set(["hatsPurchased", "collectablesRedeemed"]);
const PERK_MAX_DEPTHS = [10, 10, 10, 10, 10, 10, 5, 10, 10, 10];
const PERK_NAMES = ["Coin Value", "Shield Duration", "Coin Magnet", "Boost Distance",
  "Pickup Spawn", "Power Meter", "Save Me", "Head Start",
  "Score Multiplier", "Bolt Distance"];
const POTION_TYPES = ["Mirage", "PhoenixWings", "Multimeter", "DemonMonkey", "TimeWarp"];

const ANNOTATIONS = {
  hash: "Save integrity hash (auto recalculated on export)",
  data: "Root data container", version: "Save format version number",
  HRFL: "Has Run First Launch flag (tutorial state)",
  TS: "Save timestamp (Unix epoch seconds)",
  InstallDate: "Installation date (Unix epoch)",
  DaysSinceInstall: "Days since initial install", DaysPlayed: "Total days played",
  NoOfRunsSinceInstall: "Total run count",
  CloudSavedVersion: "Cloud sync version identifier",
  Players: "Player profile array",
  coinCount: "Current coin balance",
  specialCurrencyCount: "Current gem/premium currency balance",
  scrollCount: "Map scroll count", minigameTicketCount: "Treasure chest key count",
  LCC: "Lifetime Coins Collected (must never decrease)",
  LSCC: "Lifetime Special Currency Collected (must never decrease)",
  SBC: "Score Bonus Coefficient (score multiplier)",
  activePlayerCharacter: "Currently selected character ID",
  Characters: "Array of owned character objects",
  CharacterPets: "Array of owned pet objects",
  artifactsPurchased: "List of purchased artifact IDs",
  collectablesRedeemed: "[LEGACY] List of redeemed collectable category IDs",
  CollectablesFound: "List of found collectable entries",
  CharacterAttachments: "List of owned hat/attachment entries",
  powersPurchased: "List of purchased power up IDs",
  objectives: "List of completed objective IDs",
  objectivesActiveData: "Currently active objective tracking",
  NCA: "Daily challenge data array", RM: "Region/Map manager data",
  BPPDM: "Battle Pass player data manager",
  BPCDDM: "Battle Pass claimed rewards data",
  WFRDK: "Idol Quest (Weekly Featured Run) data",
  DCPGDK: "Daily Totems challenge data",
  RCPDM: "Global Challenges (Region Challenge) data",
  consumablesDepthPurchased: "Perk upgrade levels per category",
  PotionsAvailableData: "Available potion counts by type",
  UCTKN: "Unlock tokens per character",
  CharId: "Character identifier", SkinId: "Skin variant index",
  PowerId: "Equipped power up ID", PetId: "Pet identifier",
  Attachments: "Hat/accessory data for this character",
  gameStats: "Game statistics container",
  HS: "High Score (best run score)", HSNR: "High Score No Revive",
  LD: "Longest Distance", LDNC: "Longest Distance No Continue",
  TD: "Total Distance", TRUNS: "Total Runs count",
  TRESS: "Total Resurrections used", TCC: "Total Coins Collected",
  TGC: "Total Gems Collected", HCC: "Highest Coins in one run",
  HGC: "Highest Gems in one run",
  TDCC: "Total Daily Challenge Completions",
  TWCC: "Total Weekly Challenge Completions",
  THSU: "Total Head Start Uses", TMHSU: "Total Mega Head Start Uses",
  TICC: "Total Items Collected (Coins)", LPV119: "Last Played Version stat",
  MGSDK: "Minigame storage data", DLSDK: "Daily Login storage data",
  DCPTDK: "Daily Challenge progress tracking",
  DACI: "Daily Activity checklist (7 items)",
  PotionsGiveAwayData: "Free potion giveaway tracking",
};

// ── Float preservation ───────────────────────────────────────────────────────
// JS loses the distinction between 1 and 1.0 (both become number 1).
// The game's hash depends on exact JSON serialization, so we must preserve
// which values were originally floats in the uploaded save.

function recordFloatPaths(text) {
  const paths = new Set();
  let pos = 0;
  const pathStack = [];

  function ws() { while (pos < text.length && " \t\n\r".includes(text[pos])) pos++; }
  function parseString() {
    pos++; let s = "";
    while (pos < text.length && text[pos] !== '"') {
      if (text[pos] === '\\') { s += text[pos] + text[pos + 1]; pos += 2; }
      else { s += text[pos]; pos++; }
    }
    pos++; return s;
  }
  function parseNumber() {
    const start = pos;
    if (text[pos] === '-') pos++;
    while (pos < text.length && "0123456789".includes(text[pos])) pos++;
    let hasDecimal = false;
    if (pos < text.length && text[pos] === '.') {
      hasDecimal = true; pos++;
      while (pos < text.length && "0123456789".includes(text[pos])) pos++;
    }
    if (pos < text.length && (text[pos] === 'e' || text[pos] === 'E')) {
      pos++;
      if (pos < text.length && (text[pos] === '+' || text[pos] === '-')) pos++;
      while (pos < text.length && "0123456789".includes(text[pos])) pos++;
    }
    if (hasDecimal) {
      const numStr = text.substring(start, pos);
      const val = parseFloat(numStr);
      if (Number.isInteger(val)) {
        paths.add(pathStack.join('.'));
      }
    }
  }
  function parseValue() {
    ws();
    if (pos >= text.length) return;
    const ch = text[pos];
    if (ch === '"') { parseString(); }
    else if (ch === '{') { parseObject(); }
    else if (ch === '[') { parseArray(); }
    else if (ch === 't') { pos += 4; }
    else if (ch === 'f') { pos += 5; }
    else if (ch === 'n') { pos += 4; }
    else { parseNumber(); }
  }
  function parseObject() {
    pos++; ws();
    if (text[pos] === '}') { pos++; return; }
    while (true) {
      ws();
      const key = parseString();
      ws(); pos++; // skip :
      pathStack.push(key);
      parseValue();
      pathStack.pop();
      ws();
      if (text[pos] === ',') { pos++; continue; }
      if (text[pos] === '}') { pos++; return; }
      break;
    }
  }
  function parseArray() {
    pos++; ws();
    if (text[pos] === ']') { pos++; return; }
    let idx = 0;
    while (true) {
      pathStack.push(String(idx));
      parseValue();
      pathStack.pop();
      idx++;
      ws();
      if (text[pos] === ',') { pos++; continue; }
      if (text[pos] === ']') { pos++; return; }
      break;
    }
  }

  try { parseValue(); } catch (_) { /* best effort */ }
  return paths;
}

function customStringify(obj, floatPaths, currentPath) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "string") {
    // Mimic Python's ensure_ascii=True
    let s = JSON.stringify(obj);
    s = s.replace(/[\u0080-\uffff]/g, ch => {
      return "\\u" + ("0000" + ch.charCodeAt(0).toString(16)).slice(-4);
    });
    return s;
  }
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) return "null";
    if (Number.isInteger(obj) && floatPaths && floatPaths.has(currentPath)) {
      return obj.toFixed(1);
    }
    return String(obj);
  }
  if (Array.isArray(obj)) {
    const items = obj.map((v, i) =>
      customStringify(v, floatPaths, currentPath ? currentPath + "." + i : String(i))
    );
    return "[" + items.join(",") + "]";
  }
  if (typeof obj === "object") {
    const parts = [];
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val === undefined) continue;
      const childPath = currentPath ? currentPath + "." + key : key;
      const vs = customStringify(val, floatPaths, childPath);
      parts.push(JSON.stringify(key) + ":" + vs);
    }
    return "{" + parts.join(",") + "}";
  }
  return String(obj);
}


// ── MD5 Implementation ──────────────────────────────────────────────────────
// Based on the well-known MD5 algorithm (RFC 1321).
const _md5_T = new Uint32Array(64);
for (let i = 0; i < 64; i++) _md5_T[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;

function md5(input) {
  // input: Uint8Array, returns hex string
  const len = input.length;
  const bitLen = len * 8;
  // Padding
  const padLen = ((56 - (len + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(len + 1 + padLen + 8);
  padded.set(input);
  padded[len] = 0x80;
  // Length in bits as 64-bit little-endian
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bitLen >>> 0, true);
  dv.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  let a0 = 0x67452301 >>> 0, b0 = 0xefcdab89 >>> 0, c0 = 0x98badcfe >>> 0, d0 = 0x10325476 >>> 0;
  const s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const M = new Uint32Array(16);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(offset + j * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16)      { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D;           g = (3 * i + 5) % 16; }
      else              { F = C ^ (B | ~D);        g = (7 * i) % 16; }
      F = (F + A + _md5_T[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }

  function hex32(v) {
    let h = "";
    for (let i = 0; i < 4; i++) h += ("0" + ((v >>> (i * 8)) & 0xff).toString(16)).slice(-2);
    return h;
  }
  return hex32(a0) + hex32(b0) + hex32(c0) + hex32(d0);
}

function hmacMd5(key, data) {
  // key and data are Uint8Arrays
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) {
    const h = md5(k);
    k = new Uint8Array(h.match(/.{2}/g).map(b => parseInt(b, 16)));
  }
  const kp = new Uint8Array(blockSize);
  kp.set(k);
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) { ipad[i] = kp[i] ^ 0x36; opad[i] = kp[i] ^ 0x5c; }
  const inner = new Uint8Array(blockSize + data.length);
  inner.set(ipad); inner.set(data, blockSize);
  const innerHash = md5(inner);
  const innerBytes = new Uint8Array(innerHash.match(/.{2}/g).map(b => parseInt(b, 16)));
  const outer = new Uint8Array(blockSize + 16);
  outer.set(opad); outer.set(innerBytes, blockSize);
  return md5(outer);
}

async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return Array.from(new Uint8Array(sig)).map(b => ("0" + b.toString(16)).slice(-2)).join("");
}

function concatBytes(a, b) {
  const c = new Uint8Array(a.length + b.length);
  c.set(a); c.set(b, a.length);
  return c;
}

async function computeHash(dataObj, key, algo, floatPaths) {
  // floatPaths are recorded from the full JSON root (e.g. "data.Players.0.SBC")
  // but we're serializing just the data portion, so strip "data." prefix
  let fp = floatPaths;
  if (fp && fp.size) {
    fp = new Set();
    for (const p of floatPaths) {
      fp.add(p.startsWith("data.") ? p.substring(5) : p);
    }
  }
  const jsonStr = customStringify(dataObj, fp, "");
  const raw = new TextEncoder().encode(jsonStr);
  const kb = new TextEncoder().encode(key);
  switch (algo) {
    case "md5_append":  return md5(concatBytes(raw, kb));
    case "md5_prepend": return md5(concatBytes(kb, raw));
    case "hmac_md5":    return hmacMd5(kb, raw);
    case "hmac_sha256": return (await hmacSha256(kb, raw)).substring(0, 32);
    default: throw new Error("Unknown algo: " + algo);
  }
}


// ── Utilities ────────────────────────────────────────────────────────────────
function fmtTs(v) {
  if (v === TS_SENTINEL) return "Unset";
  try {
    const d = new Date(Number(v) * 1000);
    return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  } catch (_) { return String(v); }
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function randRange(target, pct) {
  pct = pct || 0.3;
  const lo = Math.max(0, Math.floor(target * (1 - pct)));
  const hi = Math.floor(target * (1 + pct));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}


// ── ConfigDB ─────────────────────────────────────────────────────────────────
const BUNDLE_EXTRA_CIDS = new Set([...Array.from({ length: 10 }, (_, i) => 292 + i), ...Array.from({ length: 23 }, (_, i) => 312 + i)]);
const BUNDLE_CID_NAMES = {
  292: "Toy Drum", 293: "Imangi Express", 294: "Mouse King",
  295: "Rockin' Reindeer", 296: "Snow Globe",
  297: "Bouche De Noel", 298: "Fruitcake", 299: "Milk-n-Cookies",
  300: "Ginger-Friends", 301: "Spiced EggNog",
  312: "Turkey Leg", 313: "Funnel Cake", 314: "Candy Apple",
  315: "Cotton Candy", 316: "Corn Dog",
  317: "Ferris Wheel", 318: "Hammer", 319: "Magic",
  320: "Moles", 321: "Shooting Duck",
  322: "Rooster", 323: "Cow", 324: "Dog",
  325: "Lamb", 326: "Horse",
  327: "Cheetah", 328: "Baboon", 329: "Giraffe",
  330: "Spear", 331: "Blanket", 332: "Rhino",
  333: "Shield", 334: "Lion",
};
const KNOWN_PET_IDS = new Set(Array.from({ length: 54 }, (_, i) => i + 1));
const KNOWN_ATTACHMENT_IDS = new Set([
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
  21,22,24,25,26,27,28,31,32,33,37,41,43,44,45,47,49,50,
  51,52,53,54,55,56,57,58,60,61,62,63,64,65,67,69,71,72,
  73,74,75,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,
  92,93,94,96,97,98,100,101,102,103,104,105,106,107,108,109,
  110,111,113,114,115,116,117,118,119,120,121,122,123,124,125,
  126,127,128,129,130,131,132,133,134,135,136,137,138,139,141,
  142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,
]);
const KNOWN_ARTIFACT_PIDS = Array.from({ length: 51 }, (_, i) => i);
const KNOWN_POWER_PIDS = Array.from({ length: 7 }, (_, i) => i);
const KNOWN_COLLECTABLE_IDS = new Set([...Array.from({ length: 306 }, (_, i) => i), ...Array.from({ length: 23 }, (_, i) => 312 + i)]);

class ConfigDB {
  constructor() {
    this.chars = {};
    this.pets = {};
    this.regions = {};
    this.attachments = {};
    this.artifacts = [];
    this.powers = [];
    this.objectives = [];
    this.challenges = {};
    this.collectables = {};
    this.individual_collectables = new Set();
    this.products = [];
  }

  static async load(url, save) {
    const cfg = new ConfigDB();
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Config fetch failed");
      const text = await resp.text();
      cfg._parseGameConfig(text);
    } catch (_) {
      return ConfigDB.fromSaveData(save);
    }
    return cfg;
  }

  _parseGameConfig(text) {
    const catActivity = {};
    for (const line of text.split("\n")) {
      const parts = line.trim().split(";", 3);
      if (parts.length < 3) continue;
      const t = parts[1].split("#")[0];
      let data;
      try { data = JSON.parse(parts[2]); } catch (_) { continue; }
      if (typeof data !== "object" || data === null) continue;

      if (t === "CharData") {
        const cid = data.CID != null ? Number(data.CID) : -1;
        if (cid !== -1) this.chars[cid] = data;
      } else if (t === "PetData") {
        const cid = data.CID != null ? Number(data.CID) : -1;
        if (cid !== -1) this.pets[cid] = data;
      } else if (t === "RegInfo") {
        const bi = data.BI || {};
        const rid = bi.ID != null ? Number(bi.ID) : -1;
        if (rid !== -1) {
          if (!this.regions[rid]) this.regions[rid] = {};
          Object.assign(this.regions[rid], bi);
        }
      } else if (t === "RegDisplayInfo") {
        const rid = data.ID != null ? Number(data.ID) : -1;
        if (rid !== -1) {
          if (!this.regions[rid]) this.regions[rid] = {};
          Object.assign(this.regions[rid], data);
        }
      } else if (t === "AttachmentData") {
        const cid = data.CID != null ? Number(data.CID) : -1;
        if (cid !== -1) this.attachments[cid] = data;
      } else if (t === "CollectablesCategoryInfo") {
        const cid = data.CID != null ? Number(data.CID) : -1;
        if (cid !== -1) this.collectables[cid] = { CID: cid, BN: data.BN || "Category#" + cid, active: true };
      } else if (t === "CollectablesCategoryActivity") {
        Object.assign(catActivity, data);
      } else if (t === "CollectablesIndividual") {
        const ndr = data.NDR || {};
        this.individual_collectables = new Set(Object.keys(ndr).map(Number));
        for (const cid of BUNDLE_EXTRA_CIDS) this.individual_collectables.add(cid);
      } else if (t === "ProductData") {
        this.products.push(data);
      }
    }
    for (const [k, v] of Object.entries(catActivity)) {
      try {
        const catId = Number(k);
        if (this.collectables[catId]) this.collectables[catId].active = Boolean(v);
      } catch (_) { /* skip */ }
    }
  }

  static fromSaveData(save) {
    const cfg = new ConfigDB();
    const data = save.data || {};
    const p = (data.Players || [{}])[0] || {};

    // Characters
    const cui = data.CharacterUnlockInfos || {};
    const charCids = new Set(Object.keys(cui).map(Number).filter(n => !isNaN(n)));
    for (const c of (p.Characters || [])) {
      if (c.CharId != null) charCids.add(Number(c.CharId));
    }
    for (const cid of charCids) cfg.chars[cid] = { CID: cid, DN: "Character#" + cid };

    // Pets
    const petIds = new Set(KNOWN_PET_IDS);
    for (const x of (p.CharacterPets || [])) { if (x.PetId != null) petIds.add(Number(x.PetId)); }
    for (const pid of petIds) cfg.pets[pid] = { CID: pid, DN: "Pet#" + pid };

    // Hats
    const attIds = new Set(KNOWN_ATTACHMENT_IDS);
    for (const x of (p.CharacterAttachments || [])) { if (x.AttachmentId != null) attIds.add(Number(x.AttachmentId)); }
    for (const aid of attIds) cfg.attachments[aid] = { CID: aid, DN: "Hat#" + aid };

    // Artifacts
    cfg.artifacts = KNOWN_ARTIFACT_PIDS.map(pid => ({ PID: pid, Title: "Artifact#" + pid }));

    // Powers
    cfg.powers = KNOWN_POWER_PIDS.map(pid => ({ PID: pid, Title: "Power#" + pid }));

    // Objectives
    cfg.objectives = Array.from({ length: 124 }, (_, pid) => ({ PID: pid, Points: pid < 86 ? 2 : 3 }));

    // Regions
    for (const r of ((p.RM || {}).RegSaveData || [])) {
      if (r.ID != null) cfg.regions[Number(r.ID)] = { ID: r.ID, DN: "Region#" + r.ID };
    }

    // Collectables
    const allColl = new Set([...KNOWN_COLLECTABLE_IDS, ...BUNDLE_EXTRA_CIDS]);
    for (const x of (p.CollectablesFound || [])) {
      const cid = typeof x === "object" ? x.CollectableId : x;
      if (cid != null) allColl.add(Number(cid));
    }
    for (const cid of allColl) {
      cfg.collectables[cid] = { CID: cid, BN: "Collectable#" + cid, active: true };
    }
    cfg.individual_collectables = new Set([...allColl, ...BUNDLE_EXTRA_CIDS]);
    return cfg;
  }

  mergeSaveData(save) {
    const data = save.data || {};
    const p = (data.Players || [{}])[0] || {};
    for (const x of (p.CharacterAttachments || [])) {
      const aid = x.AttachmentId;
      if (aid != null && !this.attachments[Number(aid)])
        this.attachments[Number(aid)] = { CID: Number(aid), DN: "Hat#" + aid };
    }
    for (const x of (p.CharacterPets || [])) {
      const pid = x.PetId;
      if (pid != null && !this.pets[Number(pid)])
        this.pets[Number(pid)] = { CID: Number(pid), DN: "Pet#" + pid };
    }
    for (const x of (p.CollectablesFound || [])) {
      const cid = typeof x === "object" ? x.CollectableId : x;
      if (cid != null) {
        const ic = Number(cid);
        if (!this.collectables[ic])
          this.collectables[ic] = { CID: ic, BN: "Collectable#" + ic, active: true };
        this.individual_collectables.add(ic);
      }
    }
    for (const pid of (p.artifactsPurchased || [])) {
      if (typeof pid === "number" && !this.artifacts.some(a => a.PID === pid))
        this.artifacts.push({ PID: pid, Title: "Artifact#" + pid });
    }
    const cui = data.CharacterUnlockInfos || {};
    for (const k of Object.keys(cui)) {
      try {
        const cid = Number(k);
        if (!isNaN(cid) && !this.chars[cid]) this.chars[cid] = { CID: cid, DN: "Character#" + cid };
      } catch (_) { /* skip */ }
    }
  }

  charName(cid) { const c = this.chars[cid]; return c ? String(c.DN || "Character#" + cid) : "Character#" + cid; }
  petName(pid) { const p = this.pets[pid]; return p ? String(p.DN || "Pet#" + pid) : "Pet#" + pid; }
  regionName(rid) { const r = this.regions[rid]; return r ? String(r.DN || r.N || "Region#" + rid) : "Region#" + rid; }
  artifactName(pid) { for (const a of this.artifacts) if (a.PID === pid) return String(a.Title || "Artifact#" + pid); return "Artifact#" + pid; }
  powerName(pid) { for (const p of this.powers) if (p.PID === pid) return String(p.Title || "Power#" + pid); return "Power#" + pid; }
  attName(aid) { const a = this.attachments[aid]; return a ? String(a.DN || "Hat#" + aid) : "Hat#" + aid; }
  collectableName(cid) {
    const c = this.collectables[cid];
    if (c) return String(c.BN || "Collectable#" + cid);
    if (BUNDLE_CID_NAMES[cid]) return BUNDLE_CID_NAMES[cid];
    if (this.individual_collectables.has(cid)) return "Item #" + cid;
    return "Collectable#" + cid;
  }
  charUnlockType(cid) {
    const c = this.chars[cid];
    if (!c) return "Unknown";
    const ct = String(c.PCT || c.CT || "");
    return { Free: "Free", Coin: "Coins", Special: "Gems", RealMoney: "IAP", Token: "Token", Totem: "Totem", Scroll: "Scroll", Ad: "Ad" }[ct] || ct;
  }
  productName(pid) { for (const p of this.products) if (p.PID === pid) return String(p.DN || p.N || pid); return String(pid); }
}


// ── SaveEditor ───────────────────────────────────────────────────────────────
class SaveEditor {
  constructor(save, cfg) {
    this.original = deepClone(save);
    this.working = deepClone(save);
    this.cfg = cfg;
    this.log = [];
    this.mode = "inspect";
  }

  _validArtifactId(pid) {
    if (!this.cfg) return true;
    if (EXTRA_ARTIFACT_PIDS.has(pid)) return true;
    return this.cfg.artifacts.some(a => a.PID === pid);
  }
  _validAttachmentId(aid) {
    if (!this.cfg) return true;
    return aid in this.cfg.attachments;
  }
  static _isCharSpecificHair(c) {
    const hair = (c.Attachments || {}).Hair;
    return hair != null && hair === (c.CharId || -1) * 1000;
  }

  setMode(m) {
    if (!["inspect", "cosmetic", "experimental"].includes(m)) throw new Error(m);
    this.mode = m;
  }
  p() { return this.working.data.Players[0]; }
  d() { return this.working.data; }
  _log(a, det, risk) { this.log.push({ action: a, detail: det, risk, mode: this.mode }); }
  _chk(exp) {
    if (this.mode === "inspect") return "ERROR: Switch mode first.";
    if (exp && this.mode !== "experimental") return "ERROR: Needs Experimental mode.";
    return null;
  }

  // ── Currency ──
  set_coins(v) {
    let e = this._chk(true); if (e) return e;
    if (v < 0 || v > SAFE_MAX) return "ERROR: Value out of range (0.." + SAFE_MAX + ").";
    const p = this.p(); const old = p.coinCount || 0; p.coinCount = v;
    let extra = "";
    if (v > (p.LCC || 0)) { const oldLcc = p.LCC || 0; p.LCC = v; extra = " (LCC auto-adjusted: " + oldLcc + " → " + v + ")"; this._log("auto_set_lcc", oldLcc + "→" + v, "HIGH"); }
    this._log("set_coins", old + "→" + v, "MED"); return "Coins: " + old + " → " + v + extra;
  }
  set_gems(v) {
    let e = this._chk(true); if (e) return e;
    if (v < 0 || v > SAFE_MAX) return "ERROR: Value out of range (0.." + SAFE_MAX + ").";
    const p = this.p(); const old = p.specialCurrencyCount || 0; p.specialCurrencyCount = v;
    let extra = "";
    if (v > (p.LSCC || 0)) { const oldLscc = p.LSCC || 0; p.LSCC = v; extra = " (LSCC auto-adjusted: " + oldLscc + " → " + v + ")"; this._log("auto_set_lscc", oldLscc + "→" + v, "HIGH"); }
    this._log("set_gems", old + "→" + v, "MED"); return "Gems: " + old + " → " + v + extra;
  }
  set_scrolls(v) {
    let e = this._chk(true); if (e) return e;
    if (v < 0 || v > SAFE_MAX) return "ERROR: Value out of range (0.." + SAFE_MAX + ").";
    const p = this.p(); const old = p.scrollCount || 0; p.scrollCount = v;
    this._log("set_scrolls", old + "→" + v, "MED"); return "Scrolls: " + old + " → " + v;
  }
  set_keys(v) {
    let e = this._chk(true); if (e) return e;
    if (v < 0 || v > SAFE_MAX) return "ERROR: Value out of range (0.." + SAFE_MAX + ").";
    const p = this.p(); const old = p.minigameTicketCount || 0; p.minigameTicketCount = v;
    this._log("set_keys", old + "→" + v, "MED"); return "Keys: " + old + " → " + v;
  }
  set_lcc(v) {
    let e = this._chk(true); if (e) return e;
    if (v < 0 || v > SAFE_MAX) return "ERROR: Value out of range (0.." + SAFE_MAX + ").";
    const p = this.p(); const old = p.LCC || 0; p.LCC = v;
    let extra = "";
    if (v < (p.coinCount || 0)) { const oc = p.coinCount || 0; p.coinCount = v; extra = " (Coins auto-adjusted: " + oc + " → " + v + ")"; this._log("auto_set_coins", oc + "→" + v, "MED"); }
    this._log("set_lcc", old + "→" + v, "HIGH"); return "LCC: " + old + " → " + v + extra;
  }
  set_lscc(v) {
    let e = this._chk(true); if (e) return e;
    if (v < 0 || v > SAFE_MAX) return "ERROR: Value out of range (0.." + SAFE_MAX + ").";
    const p = this.p(); const old = p.LSCC || 0; p.LSCC = v;
    let extra = "";
    if (v < (p.specialCurrencyCount || 0)) { const og = p.specialCurrencyCount || 0; p.specialCurrencyCount = v; extra = " (Gems auto-adjusted: " + og + " → " + v + ")"; this._log("auto_set_gems", og + "→" + v, "MED"); }
    this._log("set_lscc", old + "→" + v, "HIGH"); return "LSCC: " + old + " → " + v + extra;
  }
  set_multiplier(v) {
    let e = this._chk(true); if (e) return e;
    if (v < 0.1 || v > 500) return "ERROR: Multiplier out of range (0.1..500).";
    const p = this.p(); const old = p.SBC || 1.0; p.SBC = v;
    this._log("set_mult", old + "→" + v, "MED"); return "Multiplier: " + old + " → " + v;
  }

  // ── Characters ──
  set_active(cid) {
    let e = this._chk(); if (e) return e;
    const p = this.p(); const owned = (p.Characters || []).map(c => c.CharId);
    if (!owned.includes(cid)) return "ERROR: Character " + cid + " not owned.";
    const old = p.activePlayerCharacter; p.activePlayerCharacter = cid;
    const nm = this.cfg ? this.cfg.charName(cid) : String(cid);
    this._log("set_active", old + "→" + cid, "LOW"); return "Active: " + nm;
  }
  set_skin(cid, skin) {
    let e = this._chk(); if (e) return e;
    for (const c of (this.p().Characters || [])) {
      if (c.CharId === cid) { c.SkinId = skin; this._log("set_skin", "CID" + cid + " skin=" + skin, "LOW"); return "Skin set to " + skin; }
    }
    return "ERROR: Character " + cid + " not owned.";
  }
  set_power(cid, pid) {
    let e = this._chk(); if (e) return e;
    for (const c of (this.p().Characters || [])) {
      if (c.CharId === cid) { c.PowerId = pid; this._log("set_power", "CID" + cid + " power=" + pid, "LOW"); return "Power set"; }
    }
    return "ERROR: Character " + cid + " not owned.";
  }
  unlock_char(cid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p();
    if ((p.Characters || []).some(c => c.CharId === cid)) return "Already owned.";
    if (!p.Characters) p.Characters = [];
    p.Characters.push({ Version: 1, CharId: cid, SkinId: 0, PowerId: 2 });
    const nm = this.cfg ? this.cfg.charName(cid) : String(cid);
    this._log("unlock_char", cid + " (" + nm + ")", "HIGH"); return "Unlocked " + nm;
  }
  unlock_all_chars() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const existing = new Set((p.Characters || []).map(c => c.CharId));
    const allCids = new Set();
    const cui = this.d().CharacterUnlockInfos || {};
    for (const k of Object.keys(cui)) { try { allCids.add(Number(k)); } catch (_) {} }
    if (this.cfg) for (const cid of Object.keys(this.cfg.chars)) allCids.add(Number(cid));
    if (!p.Characters) p.Characters = [];
    let n = 0;
    for (const cid of [...allCids].sort((a, b) => a - b)) {
      if (!existing.has(cid)) { p.Characters.push({ Version: 1, CharId: cid, SkinId: 0, PowerId: 2 }); n++; }
    }
    // Ensure CharacterUnlockInfos has entries for all
    const allCombined = new Set([...allCids, ...existing]);
    for (const cid of [...allCombined].sort((a, b) => a - b)) {
      const k = String(cid);
      if (!(k in cui)) {
        cui[k] = [{ IA: false, CT: "Free", C: 0, OS: false, SC: 0, SCT: "Coin",
          SSD: "1/1/0001 12:00:00 AM", STD: "1/1/0001 12:00:00 AM", SED: "1/1/0001 12:00:00 AM",
          IL: false, ADL: false, LSD: "1/1/0001 12:00:00 AM", LTD: "1/1/0001 12:00:00 AM",
          LED: "1/1/0001 12:00:00 AM", NHEN: 0 }];
      }
    }
    this.d().CharacterUnlockInfos = cui;
    // Grant tokens for token-gated characters
    const uctkn = p.UCTKN || {}; let nt = 0;
    for (const cid of allCids) {
      const cd = (this.cfg && this.cfg.chars[cid]) || {};
      const ct = String(cd.PCT || cd.CT || "");
      if (ct === "Token") { const k = String(cid); if ((uctkn[k] || 0) < 999) { uctkn[k] = 999; nt++; } }
    }
    if (nt) p.UCTKN = uctkn;
    let extra = nt ? " (+" + nt + " token entries)" : "";
    this._log("unlock_all_chars", n + " added" + extra, "HIGH"); return "Unlocked " + n + " characters" + extra;
  }
  remove_char(cid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p();
    if (cid === p.activePlayerCharacter) return "ERROR: Cannot remove active character.";
    const before = (p.Characters || []).length;
    p.Characters = (p.Characters || []).filter(c => c.CharId !== cid);
    if (p.Characters.length === before) return "ERROR: Character " + cid + " not owned.";
    const nm = this.cfg ? this.cfg.charName(cid) : String(cid);
    this._log("remove_char", cid + " (" + nm + ")", "HIGH"); return "Removed " + nm;
  }
  remove_all_chars() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const active = p.activePlayerCharacter;
    const kept = (p.Characters || []).filter(c => c.CharId === active);
    const n = (p.Characters || []).length - kept.length; p.Characters = kept;
    this._log("remove_all_chars", "-" + n, "HIGH"); return "Removed " + n + " characters (kept active)";
  }

  // ── Pets ──
  unlock_pet(pid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p();
    if ((p.CharacterPets || []).some(x => x.PetId === pid)) return "Already owned.";
    if (!p.CharacterPets) p.CharacterPets = [];
    p.CharacterPets.push({ Version: 1, PetId: pid, NewPet: false });
    const nm = this.cfg ? this.cfg.petName(pid) : String(pid);
    this._log("unlock_pet", pid + " (" + nm + ")", "HIGH"); return "Unlocked " + nm;
  }
  unlock_all_pets() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const existing = new Set((p.CharacterPets || []).map(x => x.PetId));
    let allPids = new Set();
    if (this.cfg) allPids = new Set(Object.keys(this.cfg.pets).map(Number));
    if (!p.CharacterPets) p.CharacterPets = [];
    let n = 0;
    for (const pid of [...allPids].sort((a, b) => a - b)) {
      if (!existing.has(pid)) { p.CharacterPets.push({ Version: 1, PetId: pid, NewPet: false }); n++; }
    }
    this._log("unlock_all_pets", String(n), "HIGH"); return "Unlocked " + n + " pets";
  }
  remove_pet(pid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const before = (p.CharacterPets || []).length;
    p.CharacterPets = (p.CharacterPets || []).filter(x => x.PetId !== pid);
    if (p.CharacterPets.length === before) return "ERROR: Pet " + pid + " not owned.";
    const nm = this.cfg ? this.cfg.petName(pid) : String(pid);
    this._log("remove_pet", pid + " (" + nm + ")", "HIGH"); return "Removed " + nm;
  }
  remove_all_pets() {
    let e = this._chk(true); if (e) return e;
    const n = (this.p().CharacterPets || []).length; this.p().CharacterPets = [];
    this._log("remove_all_pets", "-" + n, "HIGH"); return "Removed " + n + " pets";
  }

  // ── Hats ──
  equip_hat(cid, hat) {
    let e = this._chk(); if (e) return e;
    if (!this._validAttachmentId(hat)) return "ERROR: Hat " + hat + " not found in config.";
    const p = this.p();
    for (const c of (p.Characters || [])) {
      if (c.CharId === cid) {
        if (!c.Attachments) c.Attachments = {};
        c.Attachments.Hair = hat;
        const ca = p.CharacterAttachments || [];
        if (!ca.some(x => x.AttachmentId === hat)) {
          ca.push({ Version: 1, AttachmentId: hat, NewAttachment: false });
          p.CharacterAttachments = ca;
        }
        const nm = this.cfg ? this.cfg.attName(hat) : String(hat);
        this._log("equip_hat", "CID" + cid + "→" + hat, "LOW"); return "Equipped " + nm;
      }
    }
    return "ERROR: Character " + cid + " not found.";
  }
  remove_hat(cid) {
    let e = this._chk(); if (e) return e;
    for (const c of (this.p().Characters || [])) {
      if (c.CharId === cid) {
        if (SaveEditor._isCharSpecificHair(c)) return "Cannot remove built-in character cosmetic.";
        const att = c.Attachments || {};
        if ("Hair" in att) delete att.Hair;
        if (Object.keys(att).length === 0 && "Attachments" in c) delete c.Attachments;
        this._log("remove_hat", "CID" + cid, "LOW"); return "Hat removed";
      }
    }
    return "ERROR: Character " + cid + " not found.";
  }
  unlock_hat(hatId) {
    let e = this._chk(); if (e) return e;
    if (!this._validAttachmentId(hatId)) return "ERROR: Hat " + hatId + " not found in config.";
    const p = this.p(); const ca = p.CharacterAttachments || [];
    if (ca.some(x => x.AttachmentId === hatId)) return "Already owned.";
    ca.push({ Version: 1, AttachmentId: hatId, NewAttachment: false });
    p.CharacterAttachments = ca;
    const nm = this.cfg ? this.cfg.attName(hatId) : String(hatId);
    this._log("unlock_hat", String(hatId), "LOW"); return "Unlocked " + nm;
  }
  unlock_all_hats() {
    let e = this._chk(); if (e) return e;
    if (!this.cfg) return "ERROR: No config loaded.";
    const p = this.p(); const ca = p.CharacterAttachments || [];
    const existing = new Set(ca.filter(x => typeof x === "object").map(x => x.AttachmentId));
    let n = 0;
    for (const aid of Object.keys(this.cfg.attachments).map(Number).sort((a, b) => a - b)) {
      if (!existing.has(aid)) { ca.push({ Version: 1, AttachmentId: aid, NewAttachment: false }); n++; }
    }
    p.CharacterAttachments = ca;
    this._log("unlock_all_hats", "+" + n, "HIGH"); return "Unlocked " + n + " hats (total: " + ca.length + ")";
  }
  unlock_hat_batch(batchSize) {
    let e = this._chk(); if (e) return e;
    if (!this.cfg) return "ERROR: No config loaded.";
    batchSize = Math.max(1, Math.min(batchSize || 5, 136));
    const p = this.p(); const ca = p.CharacterAttachments || [];
    const existing = new Set(ca.filter(x => typeof x === "object").map(x => x.AttachmentId));
    const notOwned = Object.keys(this.cfg.attachments).map(Number).filter(a => !existing.has(a)).sort((a, b) => a - b);
    if (!notOwned.length) return "All " + Object.keys(this.cfg.attachments).length + " hats already unlocked!";
    const batch = notOwned.slice(0, batchSize);
    for (const aid of batch) ca.push({ Version: 1, AttachmentId: aid, NewAttachment: false });
    p.CharacterAttachments = ca;
    const remaining = notOwned.length - batch.length;
    let names = batch.slice(0, 3).map(a => this.cfg.attName(a)).join(", ");
    if (batch.length > 3) names += " +" + (batch.length - 3) + " more";
    this._log("unlock_hat_batch", "+" + batch.length, "LOW");
    return "Unlocked " + batch.length + " hats (" + names + "). " + remaining + " remaining. Load the game and open the hats menu to download their bundles before unlocking more.";
  }
  remove_hat_ownership(hatId) {
    let e = this._chk(); if (e) return e;
    const p = this.p(); let removed = false;
    const before = (p.CharacterAttachments || []).length;
    p.CharacterAttachments = (p.CharacterAttachments || []).filter(x => x.AttachmentId !== hatId);
    if (p.CharacterAttachments.length < before) removed = true;
    for (const c of (p.Characters || [])) {
      const att = c.Attachments || {};
      if (att.Hair === hatId) {
        if (SaveEditor._isCharSpecificHair(c)) continue;
        delete att.Hair; removed = true;
        if (Object.keys(att).length === 0 && "Attachments" in c) delete c.Attachments;
      }
    }
    if (!removed) return "ERROR: Hat " + hatId + " not owned.";
    const nm = this.cfg ? this.cfg.attName(hatId) : String(hatId);
    this._log("remove_hat_own", String(hatId), "LOW"); return "Removed " + nm;
  }
  remove_all_hats() {
    let e = this._chk(); if (e) return e;
    let n = 0;
    for (const c of (this.p().Characters || [])) {
      if (SaveEditor._isCharSpecificHair(c)) continue;
      const att = c.Attachments || {};
      if ("Hair" in att) { delete att.Hair; n++; }
      if (Object.keys(att).length === 0 && "Attachments" in c) delete c.Attachments;
    }
    const n2 = (this.p().CharacterAttachments || []).length;
    this.p().CharacterAttachments = [];
    this._log("remove_all_hats", "-" + n + " unequipped, -" + n2 + " unlocked", "LOW");
    return "Removed " + n + " equipped + " + n2 + " owned hats";
  }

  // ── Collectables ──
  unlock_collectable(cid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const cf = p.CollectablesFound || [];
    if (cf.some(x => x.CollectableId === cid)) return "Already redeemed.";
    cf.push({ CollectableId: cid, NumFound: 1, NumRewarded: 1, FoundState: "CollectFound_FoundNotViewed" });
    p.CollectablesFound = cf;
    const nm = this.cfg ? this.cfg.collectableName(cid) : String(cid);
    this._log("unlock_collect", String(cid), "HIGH"); return "Redeemed " + nm;
  }
  unlock_all_collectables() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const cf = p.CollectablesFound || [];
    const existing = new Set(cf.filter(x => typeof x === "object").map(x => x.CollectableId));
    let nfix = 0;
    for (const entry of cf) { if ((entry.NumRewarded || 0) < 1) { entry.NumRewarded = 1; entry.NumFound = Math.max(entry.NumFound || 0, 1); nfix++; } }
    let allIds = new Set();
    if (this.cfg) allIds = new Set([...Object.keys(this.cfg.collectables).map(Number), ...this.cfg.individual_collectables]);
    let n = 0;
    for (const cid of [...allIds].filter(x => !existing.has(x)).sort((a, b) => a - b)) {
      cf.push({ CollectableId: cid, NumFound: 1, NumRewarded: 1, FoundState: "CollectFound_FoundNotViewed" }); n++;
    }
    p.CollectablesFound = cf;
    this._log("unlock_all_collect", "+" + n + " new, " + nfix + " fixed", "HIGH"); return "Unlocked " + n + " collectables, fixed " + nfix;
  }
  lock_collectable(cid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const before = (p.CollectablesFound || []).length;
    p.CollectablesFound = (p.CollectablesFound || []).filter(x => x.CollectableId !== cid);
    if (p.CollectablesFound.length === before) return "ERROR: Collectable " + cid + " not redeemed.";
    const nm = this.cfg ? this.cfg.collectableName(cid) : String(cid);
    this._log("lock_collect", String(cid), "HIGH"); return "Locked " + nm;
  }
  lock_all_collectables() {
    let e = this._chk(true); if (e) return e;
    const n = (this.p().CollectablesFound || []).length; this.p().CollectablesFound = [];
    this._log("lock_all_collect", "-" + n, "HIGH"); return "Locked " + n + " collectables";
  }

  // ── Artifacts ──
  unlock_artifact(pid) {
    let e = this._chk(true); if (e) return e;
    if (DEPRECATED_ARTIFACT_PIDS.has(pid)) return "ERROR: Artifact " + pid + " is deprecated by the game.";
    if (!this._validArtifactId(pid)) return "ERROR: Artifact " + pid + " not found in config.";
    const p = this.p(); const lst = p.artifactsPurchased || [];
    if (lst.includes(pid)) return "Already owned.";
    lst.push(pid); p.artifactsPurchased = lst;
    const nm = this.cfg ? this.cfg.artifactName(pid) : String(pid);
    this._log("unlock_art", String(pid), "HIGH"); return "Unlocked " + nm;
  }
  unlock_all_artifacts() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const lst = p.artifactsPurchased || [];
    const existing = new Set(lst);
    let allPids = new Set();
    if (this.cfg) allPids = new Set(this.cfg.artifacts.filter(a => a.PID != null).map(a => a.PID));
    for (const pid of EXTRA_ARTIFACT_PIDS) allPids.add(pid);
    for (const pid of DEPRECATED_ARTIFACT_PIDS) allPids.delete(pid);
    let n = 0;
    for (const pid of [...allPids].filter(x => !existing.has(x)).sort((a, b) => a - b)) { lst.push(pid); n++; }
    p.artifactsPurchased = lst;
    this._log("unlock_all_arts", String(n), "HIGH"); return "Unlocked " + n + " artifacts";
  }
  remove_artifact(pid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const lst = p.artifactsPurchased || [];
    const idx = lst.indexOf(pid); if (idx === -1) return "ERROR: Artifact " + pid + " not owned.";
    lst.splice(idx, 1); p.artifactsPurchased = lst;
    const nm = this.cfg ? this.cfg.artifactName(pid) : String(pid);
    this._log("remove_art", String(pid), "HIGH"); return "Removed " + nm;
  }
  remove_all_artifacts() {
    let e = this._chk(true); if (e) return e;
    const n = (this.p().artifactsPurchased || []).length; this.p().artifactsPurchased = [];
    this._log("remove_all_arts", "-" + n, "HIGH"); return "Removed " + n + " artifacts";
  }

  // ── Powers ──
  unlock_power(pid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const lst = p.powersPurchased || [];
    if (lst.includes(pid)) return "Already owned.";
    lst.push(pid); p.powersPurchased = lst;
    const nm = this.cfg ? this.cfg.powerName(pid) : String(pid);
    this._log("unlock_pow", String(pid), "HIGH"); return "Unlocked " + nm;
  }
  unlock_all_powers() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const lst = p.powersPurchased || [];
    const existing = new Set(lst);
    let allPids = new Set();
    if (this.cfg) allPids = new Set(this.cfg.powers.filter(pw => pw.PID != null).map(pw => pw.PID));
    let n = 0;
    for (const pid of [...allPids].filter(x => !existing.has(x)).sort((a, b) => a - b)) { lst.push(pid); n++; }
    p.powersPurchased = lst;
    this._log("unlock_all_pows", String(n), "HIGH"); return "Unlocked " + n + " powers";
  }
  remove_power(pid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const lst = p.powersPurchased || [];
    const idx = lst.indexOf(pid); if (idx === -1) return "ERROR: Power " + pid + " not owned.";
    lst.splice(idx, 1); p.powersPurchased = lst;
    const nm = this.cfg ? this.cfg.powerName(pid) : String(pid);
    this._log("remove_pow", String(pid), "HIGH"); return "Removed " + nm;
  }
  remove_all_powers() {
    let e = this._chk(true); if (e) return e;
    const n = (this.p().powersPurchased || []).length; this.p().powersPurchased = [];
    this._log("remove_all_pows", "-" + n, "HIGH"); return "Removed " + n + " powers";
  }
  max_power_levels() { return "Power upgrade levels are server-managed and cannot be set via save editing."; }

  // ── Regions ──
  purchase_region(rid) {
    let e = this._chk(true); if (e) return e;
    for (const r of ((this.p().RM || {}).RegSaveData || [])) {
      if (r.ID === rid) {
        if (r.P) return "Already purchased.";
        r.P = true; r.DLAS = true;
        const nm = this.cfg ? this.cfg.regionName(rid) : String(rid);
        this._log("purch_reg", String(rid), "HIGH"); return "Purchased " + nm;
      }
    }
    return "ERROR: Region " + rid + " not in save.";
  }
  purchase_all_regions() {
    let e = this._chk(true); if (e) return e;
    const p = this.p();
    if (!p.RM) p.RM = {};
    const rsd = p.RM.RegSaveData || [];
    const existing = new Set(rsd.map(r => r.ID));
    let n = 0;
    for (const r of rsd) { if (!r.P) { r.P = true; r.DLAS = true; n++; } }
    if (this.cfg) {
      for (const rid of Object.keys(this.cfg.regions).map(Number).sort((a, b) => a - b)) {
        if (!existing.has(rid)) { rsd.push({ ID: rid, P: true, DLAS: true }); n++; }
      }
    }
    p.RM.RegSaveData = rsd;
    this._log("purch_all_reg", "+" + n, "HIGH"); return "Purchased " + n + " regions";
  }
  unpurchase_region(rid) {
    let e = this._chk(true); if (e) return e;
    for (const r of ((this.p().RM || {}).RegSaveData || [])) {
      if (r.ID === rid) {
        if (!r.P) return "Already not purchased.";
        r.P = false;
        const nm = this.cfg ? this.cfg.regionName(rid) : String(rid);
        this._log("unpurch_reg", String(rid), "HIGH"); return "Unpurchased " + nm;
      }
    }
    return "ERROR: Region " + rid + " not in save.";
  }
  unpurchase_all_regions() {
    let e = this._chk(true); if (e) return e;
    let n = 0;
    for (const r of ((this.p().RM || {}).RegSaveData || [])) { if (r.P) { r.P = false; n++; } }
    this._log("unpurch_all_reg", "-" + n, "HIGH"); return "Unpurchased " + n + " regions";
  }

  // ── Objectives ──
  complete_all_objectives() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const done = new Set(p.objectives || []);
    let allPids = new Set();
    if (this.cfg) allPids = new Set(this.cfg.objectives.filter(o => o.PID != null).map(o => o.PID));
    let n = 0;
    for (const pid of [...allPids].filter(x => !done.has(x)).sort((a, b) => a - b)) { done.add(pid); n++; }
    p.objectives = [...done].sort((a, b) => a - b);
    if ("objectivesActiveData" in p) p.objectivesActiveData = [];
    this._log("complete_objs", "+" + n, "HIGH"); return "Completed " + n + " objectives (" + done.size + " total)";
  }
  uncomplete_objective(pid) {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const lst = p.objectives || [];
    const idx = lst.indexOf(pid); if (idx === -1) return "ERROR: Objective " + pid + " not completed.";
    lst.splice(idx, 1); p.objectives = lst;
    this._log("uncomplete_obj", String(pid), "HIGH"); return "Uncompleted objective " + pid;
  }
  uncomplete_all_objectives() {
    let e = this._chk(true); if (e) return e;
    const n = (this.p().objectives || []).length; this.p().objectives = [];
    if ("objectivesActiveData" in this.p()) this.p().objectivesActiveData = [];
    this._log("uncomplete_all_objs", "-" + n, "HIGH"); return "Uncompleted " + n + " objectives";
  }

  // ── Battle Pass ──
  complete_battle_pass() {
    let e = this._chk(true); if (e) return e;
    const p = this.p();
    const gs = p.gameStats || (p.gameStats = {});
    const ls = gs.LS || (gs.LS = {}); const stats = ls.Stats || (ls.Stats = {});
    const truns = stats.TRUNS || 0; let runsAdjusted = false;
    if (truns < 150) { stats.TRUNS = 150; runsAdjusted = true; }
    const bppdm = p.BPPDM || {}; const bpList = bppdm.BPPPD || [];
    if (!bpList.length) return "No active battle pass.";
    const bp = bpList[0]; const bpId = bp.BPIDK;
    const tiers = (bp.BPCDK || {}).BPTR || [];
    if (!tiers.length) return "No tiers.";
    let maxTtv = 0;
    for (const t of tiers) { if ((t.TTV || 0) > maxTtv) maxTtv = t.TTV; }
    const tpList = bp.BPTPLK || [];
    const existingTids = new Set(tpList.map(tp => tp.BPTIK));
    for (const t of tiers) {
      if (!existingTids.has(t.TTID)) {
        tpList.push({ BPTIK: t.TTID, BPTUK: true, BPTRK: false, BPTCDK: deepClone(t) });
      }
    }
    for (const tp of tpList) { tp.BPTUK = true; tp.BPTRK = false; }
    bp.BPTPLK = tpList;
    let bpcddm = p.BPCDDM || [];
    let foundBp = false;
    for (const entry of bpcddm) {
      if (typeof entry === "object" && (entry.BPID || bpId) === bpId) {
        entry.UnlockedTiers = Array.from({ length: tiers.length }, (_, i) => i + 1);
        entry.ClaimedTiers = []; foundBp = true; break;
      }
    }
    if (!foundBp) bpcddm.push({ BPID: bpId, UnlockedTiers: Array.from({ length: tiers.length }, (_, i) => i + 1), ClaimedTiers: [] });
    p.BPCDDM = bpcddm;
    bp.BPBPSK = true; bp.BPSELK = true;
    if ((stats.TS || 0) < maxTtv) stats.TS = Math.max(stats.TS || 0, maxTtv);
    let msg = "Battle pass completed (" + tiers.length + " tiers unlocked)";
    if (runsAdjusted) msg += " | Total runs auto-adjusted from " + truns + " to 150";
    this._log("complete_bp", tpList.length + " tiers" + (runsAdjusted ? " (runs " + truns + "→150)" : ""), "HIGH"); return msg;
  }
  reset_battle_pass() {
    let e = this._chk(true); if (e) return e;
    const bpList = (this.p().BPPDM || {}).BPPPD || [];
    if (!bpList.length) return "No active battle pass.";
    bpList[0].BPTPLK = [];
    this._log("reset_bp", "Reset all tiers", "HIGH"); return "Battle pass reset";
  }

  // ── Daily Challenges ──
  complete_daily_challenges() { return "Daily challenges are refreshed by the server each session. Changes will not persist."; }
  reset_daily_challenges() { return "Daily challenges are refreshed by the server each session. Changes will not persist."; }

  // ── HRFL ──
  set_hrfl(v) {
    let e = this._chk(true); if (e) return e;
    const old = this.d().HRFL; this.d().HRFL = v;
    this._log("set_hrfl", old + "→" + v, "HIGH"); return "HRFL: " + old + " → " + v;
  }

  // ── Field ──
  set_field(key, val) {
    let e = this._chk(true); if (e) return e;
    if (SENSITIVE.has(key)) return "ERROR: '" + key + "' is IAP-sensitive.";
    this.p()[key] = val; this._log("set_field", key, "HIGH"); return key + " updated";
  }
  set_data_field(key, val) {
    let e = this._chk(true); if (e) return e;
    this.d()[key] = val; this._log("set_data_field", key, "HIGH"); return key + " updated";
  }

  // ── Perks ──
  max_perks() { return "Perk upgrades are server-managed and cannot be set via save editing."; }
  reset_perks() { return "Perk upgrades are server-managed and cannot be set via save editing."; }
  set_perk() { return "Perk upgrades are server-managed and cannot be set via save editing."; }

  // ── Potions ──
  max_potions() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const pots = p.PotionsAvailableData || [];
    const existingTypes = new Set(pots.map(pt => pt.Type));
    for (const pt of pots) pt.Count = 999;
    for (const t of POTION_TYPES) { if (!existingTypes.has(t)) pots.push({ Count: 999, Type: t }); }
    p.PotionsAvailableData = pots;
    this._log("max_potions", pots.length + " potions set to 999", "HIGH"); return "Set " + pots.length + " potions to 999";
  }
  reset_potions() {
    let e = this._chk(true); if (e) return e;
    for (const pt of (this.p().PotionsAvailableData || [])) pt.Count = 0;
    this._log("reset_potions", "All potions reset", "HIGH"); return "All potions reset";
  }
  set_potion(ptype, count) {
    let e = this._chk(true); if (e) return e;
    if (count < 0 || count > SAFE_MAX) return "ERROR: Value out of range.";
    const p = this.p(); const pots = p.PotionsAvailableData || [];
    for (const pt of pots) {
      if (pt.Type === ptype) {
        const old = pt.Count; pt.Count = count;
        this._log("set_potion", ptype + ": " + old + "→" + count, "HIGH"); return ptype + ": " + old + " → " + count;
      }
    }
    pots.push({ Count: count, Type: ptype }); p.PotionsAvailableData = pots;
    this._log("set_potion", ptype + ": 0→" + count, "HIGH"); return ptype + ": 0 → " + count;
  }

  // ── Daily Totems ──
  complete_daily_totems() { return "Daily totems are refreshed by the server each session. Changes will not persist."; }
  reset_daily_totems() { return "Daily totems are refreshed by the server each session. Changes will not persist."; }

  // ── Idol Quest ──
  complete_idol_quest() { return "Idol Quest progress is server-tracked and cannot be modified via save editing."; }
  reset_idol_quest() { return "Idol Quest progress is server-tracked and cannot be modified via save editing."; }

  // ── Streak ──
  get_streak() {
    const p = this.p(); const d = this.d();
    return { cdcs: p.cdcs || 0, ldcs: p.ldcs || 0, DaysPlayed: d.DaysPlayed || 0, DaysSinceInstall: d.DaysSinceInstall || 0 };
  }
  set_streak() { return "Daily streak counter is server-managed and cannot be set via save editing."; }

  // ── Global Challenges ──
  complete_global_challenges() { return "Global challenges are entirely server-managed and cannot be modified via save editing."; }
  reset_global_challenges() { return "Global challenges are entirely server-managed and cannot be modified via save editing."; }

  // ── Minigame ──
  complete_minigame() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const mg = p.MGSDK || {};
    if (!mg || !Object.keys(mg).length) return "No minigame data found.";
    const cls = mg.CLSDK || {};
    if (!cls || !Object.keys(cls).length) return "No current minigame level.";
    mg.HIWCK = true;
    const ltdk = cls.LTDK || {};
    let n = 0;
    for (const tid of Object.keys(ltdk)) { if (!ltdk[tid].CIDK) { ltdk[tid].CIDK = true; n++; } }
    p.MGSDK = mg;
    this._log("complete_mg", n + " tiers", "HIGH"); return "Completed " + n + " minigame tiers";
  }
  reset_minigame() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const mg = p.MGSDK || {};
    const cls = mg.CLSDK || {};
    const ltdk = cls.LTDK || {};
    let n = 0;
    for (const tid of Object.keys(ltdk)) { if ("CIDK" in ltdk[tid]) { delete ltdk[tid].CIDK; n++; } }
    p.MGSDK = mg;
    this._log("reset_mg", n + " tiers", "HIGH"); return "Reset " + n + " minigame tiers";
  }

  // ── Unlock Everything ──
  unlock_everything() {
    let e = this._chk(true); if (e) return e;
    const r = [];
    r.push(this.unlock_all_chars());
    r.push(this.unlock_all_pets());
    r.push(this.unlock_all_artifacts());
    r.push(this.unlock_all_collectables());
    r.push(this.unlock_all_powers());
    r.push(this.purchase_all_regions());
    r.push(this.complete_all_objectives());
    r.push(this.unlock_all_hats());
    r.push(this.complete_battle_pass());
    r.push(this.max_potions());
    r.push(this.complete_minigame());
    const p = this.p(); const op = this.original.data.Players[0];
    p.scrollCount = Math.max(p.scrollCount || 0, SAFE_MAX);
    p.minigameTicketCount = Math.max(p.minigameTicketCount || 0, SAFE_MAX);
    p.coinCount = Math.max(p.coinCount || 0, SAFE_MAX);
    p.specialCurrencyCount = Math.max(p.specialCurrencyCount || 0, SAFE_MAX);
    p.LCC = Math.max(SAFE_MAX, p.LCC || 0, op.LCC || 0);
    p.LSCC = Math.max(SAFE_MAX, p.LSCC || 0, op.LSCC || 0);
    r.push("All currencies maxed");
    return r.join(" | ");
  }

  // ── Max All Currency ──
  max_all_currency() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const op = this.original.data.Players[0];
    p.LCC = Math.max(SAFE_MAX, op.LCC || 0);
    p.LSCC = Math.max(SAFE_MAX, op.LSCC || 0);
    p.coinCount = SAFE_MAX; p.specialCurrencyCount = SAFE_MAX;
    p.scrollCount = SAFE_MAX; p.minigameTicketCount = SAFE_MAX;
    this._log("max_all_currency", "All currencies maxed", "HIGH"); return "All currencies set to maximum";
  }

  // ── Stats ──
  get_stats() {
    const gs = this.p().gameStats || {};
    const ls = ((gs.LS || {}).Stats) || {};
    const cs = {};
    for (const [k, v] of Object.entries(gs.CharStats || {})) cs[k] = (v || {}).Stats || {};
    return { lifetime: ls, perCharacter: cs };
  }
  set_stat(key, val) {
    let e = this._chk(true); if (e) return e;
    if (val < 0 || val > SAFE_MAX) return "ERROR: Value out of range (0.." + SAFE_MAX + ").";
    const gs = this.p().gameStats || (this.p().gameStats = {});
    const ls = gs.LS || (gs.LS = {}); const stats = ls.Stats || (ls.Stats = {});
    const old = stats[key] || 0; stats[key] = val;
    this._log("set_stat", key + ": " + old + "→" + val, "HIGH"); return key + ": " + old + " → " + val;
  }

  set_player_level(target) {
    let e = this._chk(true); if (e) return e;
    if (!this.cfg || !this.cfg.objectives.length) return "ERROR: No objectives data available.";
    if (target < 0) return "ERROR: Level must be non-negative.";
    const p = this.p(); const done = new Set(p.objectives || []);
    let current = 0;
    for (const o of this.cfg.objectives) if (done.has(o.PID)) current += (o.Points || 0);
    if (target === current) return "Already at level " + current + ".";
    if (target > current) {
      for (const obj of this.cfg.objectives) {
        if (current >= target) break;
        if (obj.PID != null && !done.has(obj.PID)) { done.add(obj.PID); current += (obj.Points || 0); }
      }
    } else {
      for (let i = this.cfg.objectives.length - 1; i >= 0; i--) {
        if (current <= target) break;
        const obj = this.cfg.objectives[i];
        if (obj.PID != null && done.has(obj.PID)) { done.delete(obj.PID); current -= (obj.Points || 0); }
      }
    }
    p.objectives = [...done].sort((a, b) => a - b);
    if ("objectivesActiveData" in p) p.objectivesActiveData = [];
    this._log("set_level", "→" + current, "HIGH"); return "Player level set to " + current;
  }

  // ── Randomize ──
  randomize_values() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const op = this.original.data.Players[0];
    const origLcc = op.LCC || 0; const origLscc = op.LSCC || 0;
    const coins = randRange(8500, 0.3); const gems = randRange(120, 0.4);
    const scrolls = randRange(180, 0.5); const keys = randRange(45, 0.5);
    const lcc = Math.max(randRange(22000000, 0.3), coins, origLcc);
    const lscc = Math.max(randRange(50000, 0.3), gems, origLscc);
    p.coinCount = coins; p.specialCurrencyCount = gems;
    p.scrollCount = scrolls; p.minigameTicketCount = keys;
    p.LCC = lcc; p.LSCC = lscc;
    const gs = p.gameStats || (p.gameStats = {}); const ls = gs.LS || (gs.LS = {}); const stats = ls.Stats || (ls.Stats = {});
    const hs = randRange(12800000, 0.3); const hsnr = Math.min(randRange(9900000, 0.3), hs);
    const ld = randRange(68400, 0.25); const ldnc = Math.min(randRange(54200, 0.25), ld);
    const runs = Math.max(randRange(11000, 0.3), 150);
    const td = Math.max(randRange(88000000, 0.25), Math.floor(ld * runs / 10));
    const tress = Math.min(randRange(3800, 0.4), runs);
    let tcc = Math.max(randRange(22000000, 0.3), lcc); p.LCC = tcc;
    let tgc = Math.max(randRange(50000, 0.3), lscc); p.LSCC = tgc;
    const hcc = randRange(6800, 0.3); const hgc = randRange(14, 0.5);
    stats.HS = hs; stats.HSNR = hsnr; stats.LD = ld; stats.LDNC = ldnc;
    stats.TD = td; stats.TRUNS = runs; stats.TRESS = tress;
    stats.TCC = tcc; stats.TGC = tgc; stats.HCC = hcc; stats.HGC = hgc;
    stats.TDCC = randRange(300, 0.4); stats.TWCC = randRange(60, 0.4);
    stats.THSU = randRange(1200, 0.3); stats.TMHSU = randRange(300, 0.4);
    stats.TICC = randRange(10000000, 0.3); stats.LPV119 = randRange(500, 0.4);
    p.consumablesDepthPurchased = [...PERK_MAX_DEPTHS];
    const pots = p.PotionsAvailableData || []; const existingTypes = new Set(pots.map(pt => pt.Type));
    for (const pt of pots) pt.Count = Math.floor(Math.random() * 51);
    for (const t of POTION_TYPES) { if (!existingTypes.has(t)) pots.push({ Count: Math.floor(Math.random() * 51), Type: t }); }
    p.PotionsAvailableData = pots;
    const streak = Math.floor(Math.random() * 31);
    p.cdcs = streak; p.ldcs = Math.max(p.ldcs || 0, streak);
    this._log("randomize", "Coins:" + coins + " HS:" + hs + " Runs:" + runs + " Streak:" + streak, "HIGH");
    return "Randomized: Coins=" + coins + ", Gems=" + gems + ", HS=" + hs + ", Runs=" + runs + ", Streak=" + streak;
  }
  randomize_economy() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const op = this.original.data.Players[0];
    const origLcc = op.LCC || 0; const origLscc = op.LSCC || 0;
    const coins = randRange(8500, 0.3); const gems = randRange(120, 0.4);
    const scrolls = randRange(180, 0.5); const keys = randRange(45, 0.5);
    const lcc = Math.max(randRange(22000000, 0.3), coins, origLcc);
    const lscc = Math.max(randRange(50000, 0.3), gems, origLscc);
    p.coinCount = coins; p.specialCurrencyCount = gems;
    p.scrollCount = scrolls; p.minigameTicketCount = keys;
    p.LCC = lcc; p.LSCC = lscc;
    const gs = p.gameStats || (p.gameStats = {}); const ls = gs.LS || (gs.LS = {}); const stats = ls.Stats || (ls.Stats = {});
    stats.TCC = Math.max(stats.TCC || 0, lcc); stats.TGC = Math.max(stats.TGC || 0, lscc);
    stats.HCC = Math.max(stats.HCC || 0, randRange(6800, 0.3)); stats.HGC = Math.max(stats.HGC || 0, randRange(14, 0.5));
    const streak = Math.floor(Math.random() * 31);
    p.cdcs = streak; p.ldcs = Math.max(p.ldcs || 0, streak);
    this._log("randomize_economy", "Coins:" + coins + " Gems:" + gems, "HIGH");
    return "Randomized economy: Coins=" + coins + ", Gems=" + gems + ", Streak=" + streak;
  }
  randomize_stats() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const op = this.original.data.Players[0];
    const origLcc = op.LCC || 0; const origLscc = op.LSCC || 0;
    const gs = p.gameStats || (p.gameStats = {}); const ls = gs.LS || (gs.LS = {}); const stats = ls.Stats || (ls.Stats = {});
    const hs = randRange(12800000, 0.3); const hsnr = Math.min(randRange(9900000, 0.3), hs);
    const ld = randRange(68400, 0.25); const ldnc = Math.min(randRange(54200, 0.25), ld);
    const runs = Math.max(randRange(11000, 0.3), 150);
    const td = Math.max(randRange(88000000, 0.25), Math.floor(ld * runs / 10));
    const tress = Math.min(randRange(3800, 0.4), runs);
    const coins = p.coinCount || 0; const gems = p.specialCurrencyCount || 0;
    let lcc = Math.max(p.LCC || origLcc, coins);
    let lscc = Math.max(p.LSCC || origLscc, gems);
    const tcc = Math.max(randRange(22000000, 0.3), lcc);
    const tgc = Math.max(randRange(50000, 0.3), lscc);
    p.LCC = Math.max(lcc, tcc); p.LSCC = Math.max(lscc, tgc);
    stats.HS = hs; stats.HSNR = hsnr; stats.LD = ld; stats.LDNC = ldnc;
    stats.TD = td; stats.TRUNS = runs; stats.TRESS = tress;
    stats.TCC = tcc; stats.TGC = tgc;
    stats.HCC = randRange(6800, 0.3); stats.HGC = randRange(14, 0.5);
    stats.TDCC = randRange(300, 0.4); stats.TWCC = randRange(60, 0.4);
    stats.THSU = randRange(1200, 0.3); stats.TMHSU = randRange(300, 0.4);
    stats.TICC = randRange(10000000, 0.3); stats.LPV119 = randRange(500, 0.4);
    if ((p.coinCount || 0) > p.LCC) p.coinCount = p.LCC;
    if ((p.specialCurrencyCount || 0) > p.LSCC) p.specialCurrencyCount = p.LSCC;
    p.consumablesDepthPurchased = [...PERK_MAX_DEPTHS];
    const pots = p.PotionsAvailableData || []; const existingTypes = new Set(pots.map(pt => pt.Type));
    for (const pt of pots) pt.Count = Math.floor(Math.random() * 51);
    for (const t of POTION_TYPES) { if (!existingTypes.has(t)) pots.push({ Count: Math.floor(Math.random() * 51), Type: t }); }
    p.PotionsAvailableData = pots;
    const streak = Math.floor(Math.random() * 31);
    p.cdcs = streak; p.ldcs = Math.max(p.ldcs || 0, streak);
    this._log("randomize_stats", "HS:" + hs + " Runs:" + runs + " Streak:" + streak, "HIGH");
    return "Randomized stats: HS=" + hs + ", Runs=" + runs + ", Perks randomized, Streak=" + streak;
  }

  // ── Max Account ──
  max_account() {
    let e = this._chk(true); if (e) return e;
    const p = this.p(); const op = this.original.data.Players[0];
    const maxLcc = Math.max(SAFE_MAX, op.LCC || 0); const maxLscc = Math.max(SAFE_MAX, op.LSCC || 0);
    p.LCC = maxLcc; p.coinCount = maxLcc;
    p.LSCC = maxLscc; p.specialCurrencyCount = maxLscc;
    p.scrollCount = SAFE_MAX; p.minigameTicketCount = SAFE_MAX;
    const origSbc = p.SBC || 0;
    let smPts = 0;
    if (this.cfg) {
      for (const o of this.cfg.objectives) {
        if (o.RD && o.RD.T === "ScoreMultiplier") smPts += (o.Points || 0);
      }
    }
    const calc = smPts > 0 ? smPts : MAX_MULTIPLIER;
    const newSbc = Math.max(calc, Math.floor(origSbc));
    p.SBC = typeof origSbc === "number" && !Number.isInteger(origSbc) ? newSbc : newSbc;
    const r = ["Economy maxed"];
    r.push(this.unlock_everything());
    const gs = p.gameStats || (p.gameStats = {}); const ls = gs.LS || (gs.LS = {}); const stats = ls.Stats || (ls.Stats = {});
    stats.HS = SAFE_MAX; stats.HSNR = SAFE_MAX;
    stats.LD = SAFE_MAX; stats.LDNC = SAFE_MAX;
    stats.TD = SAFE_MAX; stats.TRUNS = Math.max(stats.TRUNS || 0, SAFE_MAX);
    stats.TCC = maxLcc; stats.TGC = maxLscc;
    stats.HCC = SAFE_MAX; stats.HGC = SAFE_MAX;
    stats.TRESS = SAFE_MAX; stats.TS = SAFE_MAX;
    stats.TDCC = SAFE_MAX; stats.TWCC = SAFE_MAX;
    r.push("Stats maxed");
    r.push(this.max_perks()); r.push(this.max_potions());
    r.push(this.max_power_levels());
    r.push(this.complete_daily_totems()); r.push(this.complete_idol_quest());
    r.push(this.complete_global_challenges()); r.push(this.complete_minigame());
    p.cdcs = 365; p.ldcs = Math.max(p.ldcs || 0, 365);
    r.push("Streak maxed (365)");
    this._log("max_account", "Full max", "HIGH"); return r.join(" | ");
  }

  // ── Sanitize ──
  _sanitizeOnUpload() {
    const p = this.p();
    for (const e of (p.CharacterAttachments || [])) { if (typeof e === "object" && e.NewAttachment !== false) e.NewAttachment = false; }
    for (const e of (p.CharacterPets || [])) { if (typeof e === "object" && e.NewPet !== false) e.NewPet = false; }
    for (const c of (p.Characters || [])) {
      const att = c.Attachments || {};
      if ("Head" in att) { delete att.Head; if (Object.keys(att).length === 0 && "Attachments" in c) delete c.Attachments; }
    }
    // Dedup CharacterAttachments
    const seenAids = new Set(); const deduped = [];
    for (const e of (p.CharacterAttachments || [])) {
      if (typeof e === "object") { const aid = e.AttachmentId; if (aid != null && !seenAids.has(aid)) { deduped.push(e); seenAids.add(aid); } }
    }
    p.CharacterAttachments = deduped;
    // Normalize CollectablesFound
    const cf = p.CollectablesFound || []; const normalized = [];
    for (const x of cf) {
      if (typeof x === "number") normalized.push({ CollectableId: x, NumFound: 1, NumRewarded: 1, FoundState: "CollectFound_FoundNotViewed" });
      else if (typeof x === "object") normalized.push(x);
    }
    p.CollectablesFound = normalized;
    // Apply to original too
    const op = this.original.data.Players[0];
    for (const e of (op.CharacterAttachments || [])) { if (typeof e === "object" && e.NewAttachment !== false) e.NewAttachment = false; }
    for (const e of (op.CharacterPets || [])) { if (typeof e === "object" && e.NewPet !== false) e.NewPet = false; }
    for (const c of (op.Characters || [])) {
      const att = c.Attachments || {};
      if ("Head" in att) { delete att.Head; if (Object.keys(att).length === 0 && "Attachments" in c) delete c.Attachments; }
    }
    const ocf = op.CollectablesFound || []; const onorm = [];
    for (const x of ocf) {
      if (typeof x === "number") onorm.push({ CollectableId: x, NumFound: 1, NumRewarded: 1, FoundState: "CollectFound_FoundNotViewed" });
      else if (typeof x === "object") onorm.push(x);
    }
    op.CollectablesFound = onorm;
  }

  _preserveFloatTypes(orig, working) {
    if (typeof orig === "object" && typeof working === "object" && orig !== null && working !== null) {
      if (Array.isArray(orig) && Array.isArray(working)) {
        for (let i = 0; i < Math.min(orig.length, working.length); i++) {
          if (typeof orig[i] === "object") this._preserveFloatTypes(orig[i], working[i]);
        }
      } else {
        for (const k of Object.keys(orig)) {
          if (!(k in working)) continue;
          if (typeof orig[k] === "object" && typeof working[k] === "object") {
            this._preserveFloatTypes(orig[k], working[k]);
          }
        }
      }
    }
  }

  _sanitizeForExport() {
    const p = this.p();
    const ownedCids = (p.Characters || []).filter(c => c.CharId != null).map(c => c.CharId);
    if ("activePlayerCharacter" in p) {
      if (!ownedCids.includes(p.activePlayerCharacter) && ownedCids.length) p.activePlayerCharacter = ownedCids[0];
    }
    for (const k of LEGACY_PLAYER_KEYS) { if (k in p) delete p[k]; }
    const opOrig = this.original.data.Players[0];
    for (const k of ["PowerUpLevels", "consumablesDepthPurchased", "cdcs"]) {
      if (k in p && !(k in opOrig)) delete p[k];
    }
    if ("objectivesActiveData" in p && !(p.objectivesActiveData && p.objectivesActiveData.length)) delete p.objectivesActiveData;
    // Validate artifacts
    if ("artifactsPurchased" in p) {
      let arts = p.artifactsPurchased;
      if (this.cfg) {
        const validArt = new Set(this.cfg.artifacts.filter(a => a.PID != null).map(a => a.PID));
        for (const pid of EXTRA_ARTIFACT_PIDS) validArt.add(pid);
        arts = arts.filter(pid => validArt.has(pid));
      }
      p.artifactsPurchased = arts.filter(pid => !DEPRECATED_ARTIFACT_PIDS.has(pid));
    }
    // Dedup CharacterAttachments
    const caRaw = p.CharacterAttachments || []; const seenAids = new Set(); const ca = [];
    for (const e of caRaw) {
      if (typeof e === "object") {
        const aid = e.AttachmentId;
        const valid = aid != null && (!this.cfg || aid in this.cfg.attachments);
        if (valid && !seenAids.has(aid)) { ca.push(e); seenAids.add(aid); }
      }
    }
    p.CharacterAttachments = ca;
    // Hair handling
    const keptAids = new Set(ca.map(e => e.AttachmentId));
    const origHair = {};
    for (const c of (this.original.data.Players[0].Characters || [])) {
      const h = (c.Attachments || {}).Hair;
      if (h != null) origHair[c.CharId] = h;
    }
    for (const c of (p.Characters || [])) {
      const att = c.Attachments || {};
      if ("Head" in att) delete att.Head;
      const hair = att.Hair; const cid = c.CharId;
      if (hair != null && !keptAids.has(hair) && origHair[cid] !== hair) delete att.Hair;
      if (Object.keys(att).length === 0 && "Attachments" in c) delete c.Attachments;
    }
    // Safety backstop: restore character-specific Hair
    for (const c of (p.Characters || [])) {
      const cid = c.CharId; const expectedHair = cid != null ? cid * 1000 : null;
      if (expectedHair != null && origHair[cid] === expectedHair) {
        if (!c.Attachments) c.Attachments = { Hair: expectedHair };
        else if (!("Hair" in c.Attachments)) c.Attachments.Hair = expectedHair;
      }
    }
    for (const e of (p.CharacterAttachments || [])) { if (typeof e === "object" && e.NewAttachment !== false) e.NewAttachment = false; }
    for (const e of (p.CharacterPets || [])) { if (typeof e === "object" && e.NewPet !== false) e.NewPet = false; }
    // Validate collectables
    if (this.cfg && "CollectablesFound" in p) {
      const validCol = new Set([...Object.keys(this.cfg.collectables).map(Number), ...this.cfg.individual_collectables]);
      p.CollectablesFound = (p.CollectablesFound || []).filter(e => typeof e === "object" && validCol.has(e.CollectableId));
    }
    // Restore dropped keys
    const op = this.original.data.Players[0];
    for (const k of Object.keys(op)) { if (!(k in p) && !LEGACY_PLAYER_KEYS.has(k)) p[k] = deepClone(op[k]); }
    const od = this.original.data;
    for (const k of Object.keys(od)) { if (!(k in this.d()) && k !== "Players") this.d()[k] = deepClone(od[k]); }
  }

  validate() {
    const errors = []; const warnings = [];
    const p = this.p(); const op = this.original.data.Players[0];
    if ((p.coinCount || 0) > (p.LCC || 0)) errors.push("Coins exceed LCC.");
    if ((p.specialCurrencyCount || 0) > (p.LSCC || 0)) errors.push("Gems exceed LSCC.");
    const activeChar = p.activePlayerCharacter;
    const ownedCharIds = (p.Characters || []).map(c => c.CharId);
    if ("activePlayerCharacter" in p) {
      if (activeChar == null) {
        if (ownedCharIds.length) warnings.push("Active character is None (will be auto-fixed on download).");
        else warnings.push("No characters owned.");
      } else if (!ownedCharIds.includes(activeChar)) {
        warnings.push("Active character " + activeChar + " not in owned list.");
      }
    }
    if ((p.LCC || 0) < (op.LCC || 0)) warnings.push("LCC decreased from original value.");
    if ((p.LSCC || 0) < (op.LSCC || 0)) warnings.push("LSCC decreased from original value.");
    if ((p.coinCount || 0) < 0) errors.push("Negative coin balance.");
    if ((p.specialCurrencyCount || 0) < 0) errors.push("Negative gem balance.");
    if (this.cfg) {
      const validArt = new Set(this.cfg.artifacts.filter(a => a.PID != null).map(a => a.PID));
      for (const pid of EXTRA_ARTIFACT_PIDS) validArt.add(pid);
      const invalidArt = (p.artifactsPurchased || []).filter(pid => !validArt.has(pid));
      if (invalidArt.length) errors.push("artifactsPurchased has invalid PIDs: " + JSON.stringify([...new Set(invalidArt)].sort((a, b) => a - b)) + ".");
    }
    const issues = [...errors, ...warnings];
    return { errors, warnings, issues, issues_count: issues.length, errors_count: errors.length,
      risk: errors.length ? "HIGH" : (warnings.length ? "MED" : "LOW") };
  }

  diff() {
    const ch = [];
    function cmp(path, a, b) {
      if (a === b) return;
      if (typeof a === "object" && typeof b === "object" && a !== null && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) cmp(path + "." + k, k in a ? a[k] : "<absent>", k in b ? b[k] : "<absent>");
      } else if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
        ch.push({ path, old: "[" + a.length + "]", "new": "[" + b.length + "]" });
      } else if (a !== b) {
        const ov = typeof a === "object" ? String(a).substring(0, 80) : a;
        const nv = typeof b === "object" ? String(b).substring(0, 80) : b;
        ch.push({ path, old: ov, "new": nv });
      }
    }
    cmp("", this.original, this.working);
    return { total: ch.length, changes: ch.slice(0, 200) };
  }

  // ── Analysis ──
  analysis() {
    const d = this.d(); const p = this.p(); const cfg = this.cfg;

    // Characters
    const chars = []; const ownedCids = new Set();
    for (const c of (p.Characters || [])) {
      const cid = c.CharId; ownedCids.add(cid);
      const hh = (c.Attachments || {}).Hair;
      chars.push({ id: cid, name: cfg ? cfg.charName(cid) : "#" + cid,
        skinId: c.SkinId || 0, powerId: c.PowerId || 0,
        hat: hh, hatName: cfg && hh ? cfg.attName(hh) : null,
        active: cid === p.activePlayerCharacter, owned: true,
        unlockType: cfg ? cfg.charUnlockType(cid) : "?" });
    }
    if (cfg) {
      for (const cid of Object.keys(cfg.chars).map(Number).sort((a, b) => a - b)) {
        if (!ownedCids.has(cid)) chars.push({ id: cid, name: cfg.charName(cid), owned: false, active: false, unlockType: cfg.charUnlockType(cid) });
      }
    }

    // Pets
    const pets = []; const ownedPids = new Set();
    for (const pe of (p.CharacterPets || [])) {
      const pid = pe.PetId; ownedPids.add(pid);
      pets.push({ id: pid, name: cfg ? cfg.petName(pid) : "#" + pid, owned: true });
    }
    if (cfg) {
      for (const pid of Object.keys(cfg.pets).map(Number).sort((a, b) => a - b)) {
        if (!ownedPids.has(pid)) pets.push({ id: pid, name: cfg.petName(pid), owned: false });
      }
    }

    // Hats
    const hatCharMap = {};
    for (const c of (p.Characters || [])) {
      const hh = (c.Attachments || {}).Hair;
      if (hh != null && (!cfg || hh in cfg.attachments)) {
        hatCharMap[hh] = { charId: c.CharId, charName: cfg ? cfg.charName(c.CharId) : "#" + c.CharId };
      }
    }
    const ownedHats = new Set((p.CharacterAttachments || []).filter(e => typeof e === "object").map(e => e.AttachmentId));
    const hats = [];
    if (cfg) {
      for (const aid of Object.keys(cfg.attachments).map(Number).sort((a, b) => a - b)) {
        const equipped = aid in hatCharMap;
        const owned = ownedHats.has(aid) || equipped;
        const entry = { id: aid, name: cfg.attName(aid), owned, equipped };
        if (equipped) entry.equippedOn = hatCharMap[aid];
        hats.push(entry);
      }
    }

    // Collectables
    const redeemed = new Set((p.CollectablesFound || []).filter(e => typeof e === "object" && e.CollectableId != null).map(e => e.CollectableId));
    const collectables = []; const shownIds = new Set();
    if (cfg) {
      for (const cid of Object.keys(cfg.collectables).map(Number).sort((a, b) => a - b)) {
        const cat = cfg.collectables[cid];
        collectables.push({ id: cid, name: cat.BN || "", active: cat.active !== false, redeemed: redeemed.has(cid), type: "category" });
        shownIds.add(cid);
      }
      for (const iid of [...cfg.individual_collectables].filter(x => !cfg.collectables[x]).sort((a, b) => a - b)) {
        collectables.push({ id: iid, name: "Item #" + iid, active: true, redeemed: redeemed.has(iid), type: "individual" });
        shownIds.add(iid);
      }
    }
    for (const eid of [...redeemed].filter(x => !shownIds.has(x)).sort((a, b) => a - b)) {
      collectables.push({ id: eid, name: "Item #" + eid, active: true, redeemed: true, type: "individual" });
    }

    // Artifacts
    const oa = new Set(p.artifactsPurchased || []); const artifacts = [];
    if (cfg) {
      for (const a of cfg.artifacts) {
        artifacts.push({ id: a.PID, name: a.Title || "", desc: a.Description || "", owned: oa.has(a.PID) });
      }
      for (const pid of [...EXTRA_ARTIFACT_PIDS].sort((a, b) => a - b)) {
        if (!DEPRECATED_ARTIFACT_PIDS.has(pid))
          artifacts.push({ id: pid, name: "Artifact #" + pid, desc: "(Extra artifact)", owned: oa.has(pid) });
      }
    }

    // Powers
    const opw = new Set(p.powersPurchased || []); const powers = [];
    if (cfg) {
      for (const pw of cfg.powers) powers.push({ id: pw.PID, name: pw.Title || "", desc: pw.Description || "", owned: opw.has(pw.PID) });
    }

    // Regions
    const rs = {}; for (const r of ((p.RM || {}).RegSaveData || [])) rs[r.ID] = !!r.P;
    const regions = [];
    if (cfg) {
      for (const rid of Object.keys(cfg.regions).map(Number).sort((a, b) => a - b))
        regions.push({ id: rid, name: cfg.regionName(rid), purchased: !!rs[rid], inSave: rid in rs });
    }

    // Objectives
    const done = new Set(p.objectives || []); const objectives = [];
    if (cfg) {
      for (const obj of cfg.objectives)
        objectives.push({ id: obj.PID, title: obj.Title || "", desc: obj.DescriptionPre || "", points: obj.Points || 0, completed: done.has(obj.PID) });
    }
    const totalPts = (cfg ? cfg.objectives : []).filter(o => done.has(o.PID)).reduce((s, o) => s + (o.Points || 0), 0);
    const maxPts = (cfg ? cfg.objectives : []).reduce((s, o) => s + (o.Points || 0), 0);
    const gameLevel = Math.floor(done.size / 8);
    const maxGameLevel = cfg ? Math.floor(cfg.objectives.length / 8) : gameLevel;

    // Battle Pass
    let bpInfo = null; const bpList = (p.BPPDM || {}).BPPPD || [];
    if (bpList.length) {
      const bp = bpList[0]; const bpc = bp.BPCDK || {}; const tiers = bpc.BPTR || [];
      let claimedTids = []; let unlockedTids = [];
      for (const c of (p.BPCDDM || [])) {
        if (c.BPID === bp.BPIDK) { claimedTids = c.ClaimedTiers || []; unlockedTids = c.UnlockedTiers || []; }
      }
      bpInfo = { id: bp.BPIDK, title: String(bpc.BPT || "?"), totalTiers: tiers.length,
        unlockedTiers: unlockedTids.length, claimedTiers: claimedTids.length,
        premium: !!bp.BPBPSK, start: fmtTs(bpc.BPSD), end: fmtTs(bpc.BPED) };
    }

    // Daily Challenges
    const dc = (p.NCA || []).map(ch => ({ title: ch.Title || "", desc: ch.DescriptionPre || "",
      target: ch.SV || 0, earned: ch.EarnedSV || 0, status: ch.ObjectiveStatus || "?", pid: ch.PID }));

    // Perks
    const perkDepths = p.consumablesDepthPurchased || new Array(PERK_MAX_DEPTHS.length).fill(0);
    const perks = PERK_NAMES.map((name, i) => ({ index: i, name, level: perkDepths[i] || 0, max: PERK_MAX_DEPTHS[i] }));

    // Potions
    const potions = [];
    const existingTypes = new Set();
    for (const pt of (p.PotionsAvailableData || [])) { existingTypes.add(pt.Type || ""); potions.push({ type: pt.Type || "?", count: pt.Count || 0 }); }
    for (const t of POTION_TYPES) { if (!existingTypes.has(t)) potions.push({ type: t, count: 0 }); }

    // Idol Quest
    const iqData = p.WFRDK || {};
    let idolQuest = null;
    if (Object.keys(iqData).length) {
      const levels = iqData.WFRDLDK || [];
      const completedLevels = levels.filter(lv => lv.C).length;
      idolQuest = { cfid: iqData.CFID, end: fmtTs(iqData.WED), completed: !!iqData.WFRDCK,
        progress: iqData.WFRDPK || 0, levelsCompleted: completedLevels, totalLevels: Math.max(levels.length, 5) };
    }

    // Daily Totems
    const dtData = p.DCPGDK || {};
    let dailyTotems = null;
    if (Object.keys(dtData).length) {
      const totems = dtData.DCTLK || [];
      dailyTotems = { task: dtData.BTK || "", desc: dtData.BDK || "",
        value: dtData.BVK || 0, duration: dtData.BDVK || 0,
        totems: totems.map(t => ({ type: t.TTK || "", name: t.TINK || "", found: !!t.TIK })),
        totalFound: totems.filter(t => t.TIK).length, totalTotems: totems.length };
    }

    // Global Challenges
    const gcData = p.RCPDM || {};
    const globalChallenges = (gcData.RCPPD || []).map(ch => ({
      id: ch.RCID, end: fmtTs(ch.RCED), target: ch.RCTG || 0,
      current: ch.RCTC || 0, score: ch.RCTS || 0, runs: ch.RCTR || 0 }));

    // Minigame
    const mg = p.MGSDK || {}; const mgCls = mg.CLSDK || {};
    const mgTiers = Object.entries(mgCls.LTDK || {}).map(([tid, tier]) => ({ tier: tid, completed: !!tier.CIDK }));
    const mgInfo = { level: mgCls.LIDK || 0, tiers: mgTiers,
      totalTiers: mgTiers.length, completedTiers: mgTiers.filter(t => t.completed).length };

    return {
      meta: { hash: this.working.hash || "", version: d.version, HRFL: d.HRFL,
        ts: fmtTs(d.TS), installDate: fmtTs(d.InstallDate),
        daysSinceInstall: d.DaysSinceInstall, daysPlayed: d.DaysPlayed,
        totalRuns: d.NoOfRunsSinceInstall || (((p.gameStats || {}).LS || {}).Stats || {}).TRUNS || 0,
        cloud: d.CloudSavedVersion },
      economy: { coins: p.coinCount || 0, gems: p.specialCurrencyCount || 0,
        scrolls: p.scrollCount || 0, keys: p.minigameTicketCount || 0,
        lcc: p.LCC || 0, lscc: p.LSCC || 0, mult: p.SBC || 1.0 },
      characters: chars, pets, hats, collectables, artifacts, powers, regions,
      objectives: { completed: done.size, total: cfg ? cfg.objectives.length : done.size, items: objectives, level: totalPts },
      activeChar: p.activePlayerCharacter, playerLevel: totalPts, maxLevel: maxPts,
      gameLevel, maxGameLevel, safeMax: SAFE_MAX, maxMultiplier: MAX_MULTIPLIER,
      battlePass: bpInfo, dailyChallenges: dc,
      perks, potions, idolQuest, dailyTotems, globalChallenges, minigame: mgInfo,
      streak: this.get_streak(), stats: this.get_stats(),
      mode: this.mode, editLog: this.log,
    };
  }
}


// ── Dispatch ─────────────────────────────────────────────────────────────────
function dispatch(ed, a, p) {
  try {
    switch (a) {
      case "set_coins": return ed.set_coins(parseInt(p.amount));
      case "set_gems": return ed.set_gems(parseInt(p.amount));
      case "set_scrolls": return ed.set_scrolls(parseInt(p.amount));
      case "set_keys": return ed.set_keys(parseInt(p.amount));
      case "set_lcc": return ed.set_lcc(parseInt(p.amount));
      case "set_lscc": return ed.set_lscc(parseInt(p.amount));
      case "set_multiplier": return ed.set_multiplier(parseFloat(p.value));
      case "set_active": return ed.set_active(parseInt(p.id));
      case "set_skin": return ed.set_skin(parseInt(p.charId), parseInt(p.skinId));
      case "set_power": return ed.set_power(parseInt(p.charId), parseInt(p.powerId));
      case "unlock_character": return ed.unlock_char(parseInt(p.id));
      case "unlock_all_characters": return ed.unlock_all_chars();
      case "remove_character": return ed.remove_char(parseInt(p.id));
      case "remove_all_characters": return ed.remove_all_chars();
      case "unlock_pet": return ed.unlock_pet(parseInt(p.id));
      case "unlock_all_pets": return ed.unlock_all_pets();
      case "remove_pet": return ed.remove_pet(parseInt(p.id));
      case "remove_all_pets": return ed.remove_all_pets();
      case "equip_hat": return ed.equip_hat(parseInt(p.charId), parseInt(p.id));
      case "remove_hat": return ed.remove_hat(parseInt(p.charId));
      case "unlock_hat": return ed.unlock_hat(parseInt(p.id));
      case "unlock_all_hats": return ed.unlock_all_hats();
      case "unlock_hat_batch": return ed.unlock_hat_batch(parseInt(p.batchSize || 5));
      case "remove_hat_ownership": return ed.remove_hat_ownership(parseInt(p.id));
      case "remove_all_hats": return ed.remove_all_hats();
      case "unlock_collectable": return ed.unlock_collectable(parseInt(p.id));
      case "unlock_all_collectables": return ed.unlock_all_collectables();
      case "lock_collectable": return ed.lock_collectable(parseInt(p.id));
      case "lock_all_collectables": return ed.lock_all_collectables();
      case "max_all_currency": return ed.max_all_currency();
      case "unlock_artifact": return ed.unlock_artifact(parseInt(p.id));
      case "unlock_all_artifacts": return ed.unlock_all_artifacts();
      case "remove_artifact": return ed.remove_artifact(parseInt(p.id));
      case "remove_all_artifacts": return ed.remove_all_artifacts();
      case "unlock_power": return ed.unlock_power(parseInt(p.id));
      case "unlock_all_powers": return ed.unlock_all_powers();
      case "remove_power": return ed.remove_power(parseInt(p.id));
      case "remove_all_powers": return ed.remove_all_powers();
      case "max_power_levels": return ed.max_power_levels();
      case "purchase_region": return ed.purchase_region(parseInt(p.id));
      case "purchase_all_regions": return ed.purchase_all_regions();
      case "unpurchase_region": return ed.unpurchase_region(parseInt(p.id));
      case "unpurchase_all_regions": return ed.unpurchase_all_regions();
      case "complete_all_objectives": return ed.complete_all_objectives();
      case "uncomplete_objective": return ed.uncomplete_objective(parseInt(p.id));
      case "uncomplete_all_objectives": return ed.uncomplete_all_objectives();
      case "complete_battle_pass": return ed.complete_battle_pass();
      case "reset_battle_pass": return ed.reset_battle_pass();
      case "complete_daily_challenges": return ed.complete_daily_challenges();
      case "reset_daily_challenges": return ed.reset_daily_challenges();
      case "max_perks": return ed.max_perks();
      case "reset_perks": return ed.reset_perks();
      case "set_perk": return ed.set_perk(parseInt(p.index), parseInt(p.value));
      case "max_potions": return ed.max_potions();
      case "reset_potions": return ed.reset_potions();
      case "set_potion": return ed.set_potion(String(p.type), parseInt(p.count));
      case "complete_daily_totems": return ed.complete_daily_totems();
      case "reset_daily_totems": return ed.reset_daily_totems();
      case "complete_idol_quest": return ed.complete_idol_quest();
      case "reset_idol_quest": return ed.reset_idol_quest();
      case "complete_global_challenges": return ed.complete_global_challenges();
      case "reset_global_challenges": return ed.reset_global_challenges();
      case "complete_minigame": return ed.complete_minigame();
      case "reset_minigame": return ed.reset_minigame();
      case "set_hrfl": return ed.set_hrfl(!!p.value);
      case "set_field": return ed.set_field(String(p.key), p.value);
      case "set_data_field": return ed.set_data_field(String(p.key), p.value);
      case "unlock_everything": return ed.unlock_everything();
      case "randomize": return ed.randomize_values();
      case "randomize_economy": return ed.randomize_economy();
      case "randomize_stats": return ed.randomize_stats();
      case "max_account": return ed.max_account();
      case "set_stat": return ed.set_stat(String(p.key), parseInt(p.value));
      case "set_player_level": return ed.set_player_level(parseInt(p.level));
      case "set_streak": return ed.set_streak(parseInt(p.value));
      default: return null;
    }
  } catch (ex) {
    return "ERROR: " + ex.message;
  }
}
