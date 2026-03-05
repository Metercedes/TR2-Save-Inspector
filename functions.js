let editor = null, floatPaths = null, hashKey = 'BonusItemProtoData', hashAlgo = 'md5_append';
let A = null, currentSection = 'overview';

/* ─── SVG Icons ─── */
const IC = {
  chart: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 14h12M4 14V8M7 14V5M10 14V9M13 14V3"/></svg>',
  file: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h5l3 3v9H4V2z"/><path d="M9 2v3h3"/></svg>',
  coin: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4v8M6 6h4M6 10h4" stroke-linecap="round"/></svg>',
  stats: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="9" width="2" height="5" rx=".5"/><rect x="7" y="5" width="2" height="9" rx=".5"/><rect x="11" y="7" width="2" height="7" rx=".5"/></svg>',
  user: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>',
  paw: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><ellipse cx="5" cy="4.5" rx="1.3" ry="1.8"/><ellipse cx="11" cy="4.5" rx="1.3" ry="1.8"/><ellipse cx="3" cy="8.5" rx="1.2" ry="1.4"/><ellipse cx="13" cy="8.5" rx="1.2" ry="1.4"/><path d="M5 10.5c0 2 1.3 3 3 3s3-1 3-3-1.5-2.5-3-2.5-3 .5-3 2.5z"/></svg>',
  hat: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L3 7h2v3h6V7h2L8 2z"/><rect x="2" y="11" width="12" height="2" rx="1"/></svg>',
  diamond: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 2L2 8l6 6 6-6z"/></svg>',
  bolt: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L4 9h4l-1 6 5-8H8z"/></svg>',
  globe: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c-2 2-2 10 0 12M8 2c2 2 2 10 0 12"/></svg>',
  target: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r=".5" fill="currentColor"/></svg>',
  trophy: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h6v5c0 2-1.5 3-3 3S5 9 5 7V2z"/><path d="M5 4H3c0 2 1 3 2 3M11 4h2c0 2-1 3-2 3M6 12h4M8 10v2"/></svg>',
  calendar: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>',
  lock: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>',
  code: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4L1 8l4 4M11 4l4 4-4 4"/></svg>',
  list: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 4h8M5 8h8M5 12h8M2 4h.01M2 8h.01M2 12h.01"/></svg>',
  sun: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M12.7 3.3l-1.4 1.4M4.7 11.3L3.3 12.7"/></svg>',
  moon: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 9A5 5 0 117 3a4 4 0 006 6z"/></svg>',
  gear: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.3 3.3l1 1M11.7 11.7l1 1M12.7 3.3l-1 1M4.3 11.7l-1 1"/></svg>',
  upload: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 26V10M14 16l6-6 6 6M6 28v4h28v-4"/></svg>',
  dice: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r=".8" fill="currentColor"/><circle cx="10.5" cy="5.5" r=".8" fill="currentColor"/><circle cx="8" cy="8" r=".8" fill="currentColor"/><circle cx="5.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="10.5" cy="10.5" r=".8" fill="currentColor"/></svg>',
  check: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4 4 6-7"/></svg>',
  warn: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1zm-.5 5h1v4h-1V6zm0 5h1v1h-1v-1z"/></svg>',
  menu: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>',
  zap: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L4 9h4l-1 6 5-8H8z"/></svg>',
  gem: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 5h10l-5 9zM3 5l2-3h6l2 3"/></svg>',
  apple: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M11.2 4.1c-.7.8-1.8.7-1.8.7s-.2-1 .6-1.8c.7-.7 1.8-.7 1.8-.7s.1 1-.6 1.8zm-.9 1c-.6 0-1.2.4-1.6.4s-.9-.4-1.5-.4C6 5.1 4.8 6 4.8 8.2c0 1.4.5 2.9 1.2 3.8.5.7 1 1.3 1.5 1.3s.8-.4 1.5-.4 .9.4 1.5.4 1-.6 1.5-1.3c.3-.4.5-.9.6-1-.1-.1-1.5-.7-1.5-2.6 0-1.6 1.3-2.4 1.4-2.5-.8-1-1.9-1.2-2.2-1.2z"/></svg>',
  android: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 6h9v5a1 1 0 01-1 1h-1v2.5a.75.75 0 01-1.5 0V12h-2v2.5a.75.75 0 01-1.5 0V12h-1a1 1 0 01-1-1V6zm-1.25.5a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5a.75.75 0 00-.75-.75zm11.5 0a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5a.75.75 0 00-.75-.75zM5.3 2.5l-.7-1.1a.25.25 0 01.4-.3l.7 1.1C6.3 1.7 7.1 1.5 8 1.5s1.7.2 2.3.7l.7-1.1a.25.25 0 01.4.3l-.7 1.1a3 3 0 011.3 2.5H4a3 3 0 011.3-2.5zM6.5 4a.5.5 0 100-1 .5.5 0 000 1zm3 0a.5.5 0 100-1 .5.5 0 000 1z"/></svg>',
  arrowLeft: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>',
  level: '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14l4-4 3 3 5-7"/></svg>',
};

const SIDEBAR_ICONS = {
  overview: IC.chart, meta: IC.file, economy: IC.coin, potions: IC.bolt, stats: IC.stats,
  characters: IC.user, pets: IC.paw, hats: IC.hat, collectables: IC.gem, artifacts: IC.diamond,
  powers: IC.bolt, perks: IC.level, regions: IC.globe, objectives: IC.target, battlepass: IC.trophy,
  daily: IC.calendar, idolquest: IC.diamond, dailytotems: IC.target, globalchallenges: IC.globe,
  minigame: IC.dice,
  quickactions: IC.zap, hashconfig: IC.lock, raweditor: IC.code, editlog: IC.list,
  settings: IC.gear,
};

function initIcons() {
  for (const [key, svg] of Object.entries(SIDEBAR_ICONS)) {
    const el = document.getElementById('si_' + key);
    if (el) el.innerHTML = svg;
  }
  const dzi = document.getElementById('dropzoneIcon');
  if (dzi) dzi.innerHTML = IC.upload;
  const mi = document.getElementById('menuIcon');
  if (mi) mi.innerHTML = IC.menu;
  const hli = document.getElementById('hashLockIcon');
  if (hli) hli.innerHTML = IC.lock;
  const rli = document.getElementById('rawLockIcon');
  if (rli) rli.innerHTML = IC.lock;
  const imi = document.getElementById('inspectModalIcon');
  if (imi) imi.innerHTML = IC.warn;
  const eci = document.getElementById('expConfirmIcon');
  if (eci) eci.innerHTML = IC.warn;
  document.querySelectorAll('.lp-icon').forEach(el => { el.innerHTML = IC.globe; });
  renderSaveGuide();
}

function updateModeIndicators() {
  if (!A) return;
  const m = A.mode || 'inspect';
  const cls = 'tag section-mode-tag tag-mode-' + m;
  const label = m.toUpperCase();
  document.querySelectorAll('.section-mode-tag').forEach(el => {
    el.className = cls; el.textContent = label;
  });
  const mt = document.getElementById('modeTag');
  if (mt) { mt.className = 'tag section-mode-tag tag-mode-' + m; mt.textContent = label; }
}

/* ─── Language Data ─── */
const LANGS = [
  { group: "Americas", items: [
    { code: "en", name: "English", native: "English", rtl: false },
    { code: "en-US", name: "English (US)", native: "English (US)", rtl: false },
    { code: "es", name: "Spanish", native: "Español", rtl: false },
    { code: "es-419", name: "Spanish (Latin America)", native: "Español (Latinoamérica)", rtl: false },
    { code: "pt", name: "Portuguese", native: "Português", rtl: false },
    { code: "pt-BR", name: "Portuguese (Brazil)", native: "Português (Brasil)", rtl: false },
    { code: "fr-CA", name: "French (Canada)", native: "Français (Canada)", rtl: false },
  ]},
  { group: "Europe", items: [
    { code: "en-GB", name: "English (UK)", native: "English (UK)", rtl: false },
    { code: "fr", name: "French", native: "Français", rtl: false },
    { code: "de", name: "German", native: "Deutsch", rtl: false },
    { code: "it", name: "Italian", native: "Italiano", rtl: false },
    { code: "nl", name: "Dutch", native: "Nederlands", rtl: false },
    { code: "pl", name: "Polish", native: "Polski", rtl: false },
    { code: "ru", name: "Russian", native: "Русский", rtl: false },
    { code: "uk", name: "Ukrainian", native: "Українська", rtl: false },
    { code: "cs", name: "Czech", native: "Čeština", rtl: false },
    { code: "sk", name: "Slovak", native: "Slovenčina", rtl: false },
    { code: "hu", name: "Hungarian", native: "Magyar", rtl: false },
    { code: "ro", name: "Romanian", native: "Română", rtl: false },
    { code: "bg", name: "Bulgarian", native: "Български", rtl: false },
    { code: "hr", name: "Croatian", native: "Hrvatski", rtl: false },
    { code: "sr", name: "Serbian", native: "Српски", rtl: false },
    { code: "sl", name: "Slovenian", native: "Slovenščina", rtl: false },
    { code: "el", name: "Greek", native: "Ελληνικά", rtl: false },
    { code: "da", name: "Danish", native: "Dansk", rtl: false },
    { code: "no", name: "Norwegian", native: "Norsk", rtl: false },
    { code: "sv", name: "Swedish", native: "Svenska", rtl: false },
    { code: "fi", name: "Finnish", native: "Suomi", rtl: false },
    { code: "et", name: "Estonian", native: "Eesti", rtl: false },
    { code: "lv", name: "Latvian", native: "Latviešu", rtl: false },
    { code: "lt", name: "Lithuanian", native: "Lietuvių", rtl: false },
    { code: "ga", name: "Irish", native: "Gaeilge", rtl: false },
    { code: "cy", name: "Welsh", native: "Cymraeg", rtl: false },
    { code: "eu", name: "Basque", native: "Euskara", rtl: false },
    { code: "ca", name: "Catalan", native: "Català", rtl: false },
    { code: "gl", name: "Galician", native: "Galego", rtl: false },
    { code: "is", name: "Icelandic", native: "Íslenska", rtl: false },
    { code: "mt", name: "Maltese", native: "Malti", rtl: false },
    { code: "sq", name: "Albanian", native: "Shqip", rtl: false },
    { code: "mk", name: "Macedonian", native: "Македонски", rtl: false },
    { code: "bs", name: "Bosnian", native: "Bosanski", rtl: false },
    { code: "be", name: "Belarusian", native: "Беларуская", rtl: false },
    { code: "tr", name: "Turkish", native: "Türkçe", rtl: false },
    { code: "az", name: "Azerbaijani", native: "Azərbaycan", rtl: false },
    { code: "ka", name: "Georgian", native: "ქართული", rtl: false },
    { code: "hy", name: "Armenian", native: "Հայերեն", rtl: false },
  ]},
  { group: "Middle East & Africa", items: [
    { code: "ar", name: "Arabic", native: "العربية", rtl: true },
    { code: "he", name: "Hebrew", native: "עברית", rtl: true },
    { code: "fa", name: "Persian", native: "فارسی", rtl: true },
    { code: "ur", name: "Urdu", native: "اردو", rtl: true },
    { code: "ku", name: "Kurdish", native: "کوردی", rtl: true },
    { code: "ps", name: "Pashto", native: "پښتو", rtl: true },
    { code: "sw", name: "Swahili", native: "Kiswahili", rtl: false },
    { code: "am", name: "Amharic", native: "አማርኛ", rtl: false },
    { code: "ha", name: "Hausa", native: "Hausa", rtl: false },
    { code: "yo", name: "Yoruba", native: "Yorùbá", rtl: false },
    { code: "ig", name: "Igbo", native: "Igbo", rtl: false },
    { code: "zu", name: "Zulu", native: "isiZulu", rtl: false },
    { code: "af", name: "Afrikaans", native: "Afrikaans", rtl: false },
  ]},
  { group: "Asia", items: [
    { code: "zh", name: "Chinese (Simplified)", native: "简体中文", rtl: false },
    { code: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文", rtl: false },
    { code: "ja", name: "Japanese", native: "日本語", rtl: false },
    { code: "ko", name: "Korean", native: "한국어", rtl: false },
    { code: "hi", name: "Hindi", native: "हिन्दी", rtl: false },
    { code: "bn", name: "Bengali", native: "বাংলা", rtl: false },
    { code: "ta", name: "Tamil", native: "தமிழ்", rtl: false },
    { code: "te", name: "Telugu", native: "తెలుగు", rtl: false },
    { code: "mr", name: "Marathi", native: "मराठी", rtl: false },
    { code: "gu", name: "Gujarati", native: "ગુજરાતી", rtl: false },
    { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", rtl: false },
    { code: "ml", name: "Malayalam", native: "മലയാളം", rtl: false },
    { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", rtl: false },
    { code: "si", name: "Sinhala", native: "සිංහල", rtl: false },
    { code: "ne", name: "Nepali", native: "नेपाली", rtl: false },
    { code: "th", name: "Thai", native: "ไทย", rtl: false },
    { code: "vi", name: "Vietnamese", native: "Tiếng Việt", rtl: false },
    { code: "id", name: "Indonesian", native: "Bahasa Indonesia", rtl: false },
    { code: "ms", name: "Malay", native: "Bahasa Melayu", rtl: false },
    { code: "tl", name: "Filipino", native: "Filipino", rtl: false },
    { code: "my", name: "Burmese", native: "မြန်မာ", rtl: false },
    { code: "km", name: "Khmer", native: "ភាសាខ្មែរ", rtl: false },
    { code: "lo", name: "Lao", native: "ລາວ", rtl: false },
    { code: "mn", name: "Mongolian", native: "Монгол", rtl: false },
    { code: "uz", name: "Uzbek", native: "Oʻzbek", rtl: false },
    { code: "kk", name: "Kazakh", native: "Қазақ", rtl: false },
    { code: "ky", name: "Kyrgyz", native: "Кыргызча", rtl: false },
    { code: "tg", name: "Tajik", native: "Тоҷикӣ", rtl: false },
    { code: "sd", name: "Sindhi", native: "سنڌي", rtl: true },
    { code: "ug", name: "Uyghur", native: "ئۇيغۇرچە", rtl: true },
    { code: "dv", name: "Dhivehi", native: "ދިވެހި", rtl: true },
  ]},
  { group: "Oceania", items: [
    { code: "en-AU", name: "English (AU)", native: "English (AU)", rtl: false },
    { code: "en-NZ", name: "English (NZ)", native: "English (NZ)", rtl: false },
    { code: "mi", name: "Maori", native: "Te Reo Māori", rtl: false },
    { code: "sm", name: "Samoan", native: "Gagana Samoa", rtl: false },
    { code: "to", name: "Tongan", native: "Lea fakatonga", rtl: false },
    { code: "fj", name: "Fijian", native: "Na Vosa Vakaviti", rtl: false },
  ]},
];

/* ─── Translations ─── */
const T = {
  en: {
    agreeTitle:"Disclaimer",agreeDesc:"This tool is provided for educational and personal use only. By proceeding, you acknowledge:",
    agree1:"This tool inspects and modifies local save data files.",agree2:"Modifying save data may result in unexpected game behavior.",
    agree3:"You accept full responsibility for any modifications made.",agree4:"This tool is not affiliated with or endorsed by any game developer.",
    agree5:"No warranty of any kind is provided. This software is offered as is without guarantees.",
    agree6:"The developers accept no liability for any damages or consequences resulting from use.",
    agree7:"Do not use this tool to gain unfair advantages in competitive or online environments.",
    agree8:"You are solely responsible for ensuring your use complies with applicable laws and terms of service.",
    agreeLegal:"By clicking the button below, you confirm that you have read, understood, and agreed to all the terms above. You acknowledge that you use this tool entirely at your own risk.",
    agreeBtn:"I Understand, Accept All Risks & Proceed",
    uploadTitle:"Temple Run 2 Decrypter",uploadDesc:"Upload your save data file to inspect, analyze, and optionally edit its contents.",
    dropBold:"Click to upload",dropOr:"or drag and drop",dropHint:"gamedata.txt",logo:"Temple Run 2 Decrypter",
    sgOverview:"Overview",sgEconomy:"Economy",sgCollection:"Collection",sgUpgrades:"Upgrades",sgProgress:"Progress",sgTools:"Tools",
    navOverview:"Overview",navMeta:"Meta Info",navEconomy:"Currency",navStats:"Statistics",navChars:"Characters",navPets:"Pets",
    navHats:"Hats",navCollectables:"Collectables",navArtifacts:"Artifacts",navPowers:"Powers",navRegions:"Regions",navObjectives:"Objectives",navBP:"Battle Pass",
    navDaily:"Daily Challenges",navQuick:"Quick Actions",navHash:"Hash Config",navRaw:"Raw Editor",navLog:"Edit Log",
    navPerks:"Perks",navPotions:"Potions",navIdolQuest:"Idol Quest",navDailyTotems:"Daily Totems",navGlobalChallenges:"Global Challenges",navMinigame:"Minigame",
    modeInspect:"Inspect",modeCosmetic:"Cosmetic",modeExperimental:"Experimental",diffBtn:"Changes",downloadBtn:"Download",
    overviewTitle:"Overview",overviewDesc:"Quick summary of your save file.",
    metaTitle:"Meta Information",metaDesc:"Save file metadata and system info.",
    econTitle:"Currency",econDesc:"View and edit in game currency values.",
    statsTitle:"Statistics",statsDesc:"Game statistics and lifetime records.",
    charsTitle:"Characters",charsDesc:"Manage your character collection.",
    petsTitle:"Pets",petsDesc:"Manage your pet collection.",
    hatsTitle:"Hats",hatsDesc:"Equip accessories on your characters. Each hat requires a downloaded asset bundle. Use batch unlock to add hats gradually — load the game between batches so it can download the bundles.",unlockHatBatch:"Unlock Next Batch",unlockAllHats:"Unlock All",
    collectTitle:"Collectables",collectDesc:"Map collectibles — unlock prizes by completing sets.",
    navCollectables:"Collectables",unlockAllCollect:"Unlock All",lockAllCollect:"Lock All",
    redeemed:"Redeemed",notRedeemed:"Not Redeemed",
    artsTitle:"Artifacts",artsDesc:"Permanent upgrade artifacts.",
    powsTitle:"Powers",powsDesc:"Power up abilities.",
    regsTitle:"Regions",regsDesc:"World map regions.",
    objsTitle:"Objectives",objsDesc:"Mission objectives and progress.",
    bpTitle:"Battle Pass",bpDesc:"Current battle pass status.",
    bpRunsWarn:"Minimum 60 total runs required for battle pass access. If your run count is below 60, it will be automatically increased to 60 when completing the battle pass.",
    dcTitle:"Daily Challenges",dcDesc:"Today's challenge progress.",
    qaTitle:"Quick Actions",qaDesc:"Powerful batch operations. Use with caution.",
    qaMaxTitle:"Max Account",qaMaxDesc:"Unlock everything, max all currencies and statistics to high values.",
    qaMaxWarn:"I understand this makes changes obvious",qaMaxBtn:"Max Everything",
    qaRandTitle:"Randomize Values",qaRandDesc:"Randomises all currencies, lifetime totals, scores, distances, and run statistics to realistic values that look like natural gameplay.",
    qaRandWarn:"I understand values will be overwritten",qaRandBtn:"Randomize",
    qaUnlockTitle:"Unlock Everything",qaUnlockDesc:"Unlock all characters, pets, hats, artifacts, powers, regions, objectives, potions, battle pass, and minigame. Server-managed features (perks, daily challenges, totems, streaks, idol quest, global challenges) are skipped.",qaUnlockBtn:"Unlock All",
    hashTitle:"Hash Configuration",hashDesc:"Configure the hash key and algorithm for save integrity.",
    hashKeyLabel:"Hash Key",hashAlgoLabel:"Algorithm",hashSaveBtn:"Save",
    rawTitle:"Raw JSON Editor",rawDesc:"Direct JSON editing. Requires Experimental mode.",rawLoadBtn:"Load JSON",rawSaveBtn:"Apply Changes",
    logTitle:"Edit Log",logDesc:"History of all modifications made in this session.",logEmpty:"No edits yet.",
    diffTitle:"Changes",diffEmpty:"No changes detected.",diffCloseBtn:"Close",
    settingsTitle:"Settings",settingsDesc:"Appearance and language preferences.",settingsTheme:"Theme",settingsLang:"Language",
    navSettings:"Settings",
    inspectWarnTitle:"Inspect Mode Active",inspectWarnDesc:"Editing is disabled in Inspect mode. Switch to Cosmetic or Experimental mode to make changes to your save file.",
    inspectSwitchCos:"Switch to Cosmetic",inspectDismiss:"Dismiss",
    hashLockMsg:"This section modifies critical save integrity data.",hashAcceptLabel:"I accept the risks",
    howToObtain:"How to obtain your save file?",guideAndroid:"Android",guideIOS:"iOS",guideBack:"Back",
    rawLockMsg:"This section allows direct modification of raw save data.",rawAcceptLabel:"I accept the risks",
    expConfirmTitle:"Switch to Experimental Mode?",expConfirmDesc:"Experimental mode allows modifying all values including raw JSON. Incorrect changes may corrupt your save file beyond repair.",
    expConfirmYes:"Yes, Switch",expConfirmNo:"Cancel",
    readonlyNotice:"Read-only in Inspect mode. Click to switch.",
    playerLevel:"Player Level",showAll:"Show All",scrollTo:"Navigate",
    unlockAllChars:"Unlock All",unlockAllPets:"Unlock All",unlockAllArts:"Unlock All",unlockAllPows:"Unlock All",
    purchAllRegs:"Unlock All",completeObjs:"Complete All",completeBP:"Complete Battle Pass",completeDC:"Complete All",
    removeAllChars:"Remove All",removeAllPets:"Remove All",removeAllHats:"Remove All",removeAllArts:"Remove All",removeAllPows:"Remove All",
    unpurchAllRegs:"Lock All",uncompleteObjs:"Reset All",resetBP:"Reset Battle Pass",resetDC:"Reset All",
    coins:"Coins",gems:"Gems",scrolls:"Scrolls",keys:"Keys",lcc:"Lifetime Coins",lscc:"Lifetime Gems",mult:"Multiplier",max:"MAX",
    name:"Name",status:"Status",owned:"Owned",notOwned:"Not Owned",active:"Active",level:"Lv",
    unlock:"Unlock",purchase:"Purchase",completed:"Completed",id:"ID",title:"Title",desc:"Description",type:"Type",
    points:"Points",target:"Target",earned:"Earned",tiers:"Tiers",claimed:"Claimed",premium:"Premium",start:"Start",end:"End",
    equip:"Equip",unequip:"Unequip",equipOn:"Equip on",remove:"Remove",lock:"Lock",reset:"Reset",set:"Set",save:"Save",apply:"Apply",select:"Select",equipped:"Equipped",
    maxAllCurrency:"Max All",randCurrency:"Randomise Currency",randStats:"Randomise Stats",
    highScore:"High Score",highScoreNR:"High Score (No Revive)",longestDist:"Longest Distance",longestDistNC:"Longest Dist. (No Continue)",
    totalDist:"Total Distance",totalRuns:"Total Runs",totalRes:"Total Resurrections",
    totalCoins:"Total Coins Collected",totalGems:"Total Gems Collected",highCoins:"Highest Coins (Run)",highGems:"Highest Gems (Run)",
    totalScore:"Total Score",totalDailyCC:"Daily Challenge Completions",totalWeeklyCC:"Weekly Challenge Completions",
    totalHeadStarts:"Head Start Uses",totalMegaHS:"Mega Head Start Uses",totalItemsCC:"Items Collected (Coins)",lpv119:"LPV119 Stat",
    hash:"Hash",version:"Version",hrfl:"Tutorial Flag",installDate:"Install Date",
    daysSinceInstall:"Days Since Install",daysPlayed:"Days Played",totalRunsMeta:"Total Runs",cloudVersion:"Cloud Version",timestamp:"Timestamp",
    streakTitle:"Daily Streak",currentStreak:"Current Streak",longestStreak:"Longest Streak",
    perk:"Perk",potionType:"Type",potionCount:"Count",tier:"Tier",
    configId:"Config ID",ends:"Ends",levels:"Levels",progress:"Progress",score:"Score",inProgress:"In Progress",
    task:"Task",bonusValue:"Bonus Value",duration:"Duration",found:"Found",notFound:"Not Found",done:"Done",incomplete:"Incomplete",
    noGlobalChallenges:"No global challenges.",noMinigameTiers:"No minigame tiers found.",noIdolQuest:"No idol quest data.",noDailyTotems:"No daily totem data.",noBattlePass:"No active battle pass.",
    yes:"Yes",no:"No",unlocked:"unlocked",auto:"Auto",light:"Light",dark:"Dark",
    path:"Path",before:"Before",after:"After",changes:"changes",change:"change",
    noIssues:"No issues detected",jsonLoaded:"JSON loaded.",hashSaved:"Hash config saved.",downloaded:"Downloaded!",networkError:"Network error.",uploadOk:"OK",maxWarnToast:"Warning: Setting maximum values may be detectable.",unsavedWarn:"You have unsaved changes. Are you sure you want to return to the upload screen? All changes will be lost."
  },
  es: {
    agreeTitle:"Aviso Legal",agreeBtn:"Entiendo y Acepto",uploadTitle:"Temple Run 2 Decrypter",
    uploadDesc:"Sube tu archivo de guardado para inspeccionar, analizar y opcionalmente editar su contenido.",
    dropBold:"Haz clic para subir",dropOr:"o arrastra y suelta",logo:"Temple Run 2 Decrypter",
    navOverview:"Resumen",navMeta:"Meta Info",navEconomy:"Moneda",navStats:"Estadísticas",navChars:"Personajes",
    navPets:"Mascotas",navHats:"Sombreros",navCollectables:"Coleccionables",navArtifacts:"Artefactos",navPowers:"Poderes",navRegions:"Regiones",
    navObjectives:"Objetivos",navBP:"Pase de Batalla",navDaily:"Desafíos Diarios",navQuick:"Acciones Rápidas",
    navHash:"Config Hash",navRaw:"Editor Raw",navLog:"Registro",
    modeInspect:"Inspeccionar",modeCosmetic:"Cosmético",modeExperimental:"Experimental",
    diffBtn:"Cambios",downloadBtn:"Descargar",coins:"Monedas",gems:"Gemas",scrolls:"Pergaminos",keys:"Llaves",
    max:"MÁX",owned:"Poseído",notOwned:"No Poseído",unlock:"Desbloquear",completed:"Completado",
    highScore:"Puntuación Máxima",totalRuns:"Carreras Totales"
  },
  fr: {
    agreeTitle:"Avertissement",agreeBtn:"Je Comprends et Accepte",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"Cliquez pour télécharger",dropOr:"ou glisser déposer",logo:"Temple Run 2 Decrypter",
    navOverview:"Aperçu",navEconomy:"Monnaie",navStats:"Statistiques",navChars:"Personnages",
    diffBtn:"Modifications",downloadBtn:"Télécharger",coins:"Pièces",gems:"Gemmes",max:"MAX",owned:"Possédé",unlock:"Débloquer",completed:"Terminé"
  },
  de: {
    agreeTitle:"Haftungsausschluss",agreeBtn:"Ich Verstehe und Akzeptiere",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"Klicken zum Hochladen",dropOr:"oder ziehen und ablegen",logo:"Temple Run 2 Decrypter",
    navOverview:"Übersicht",navEconomy:"Währung",navChars:"Charaktere",diffBtn:"Änderungen",downloadBtn:"Herunterladen",
    coins:"Münzen",gems:"Edelsteine",max:"MAX",owned:"Besitzt",unlock:"Freischalten",completed:"Abgeschlossen"
  },
  ja: {
    agreeTitle:"免責事項",agreeBtn:"理解し同意する",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"クリックしてアップロード",dropOr:"またはドラッグ＆ドロップ",logo:"Temple Run 2 Decrypter",
    navOverview:"概要",navEconomy:"通貨",navChars:"キャラクター",diffBtn:"変更点",downloadBtn:"ダウンロード",
    coins:"コイン",gems:"ジェム",max:"最大",owned:"所持",unlock:"解放",completed:"完了"
  },
  ko: {
    agreeTitle:"면책 조항",agreeBtn:"이해하고 동의합니다",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"클릭하여 업로드",dropOr:"또는 드래그 앤 드롭",logo:"Temple Run 2 Decrypter",
    navOverview:"개요",navEconomy:"재화",navChars:"캐릭터",diffBtn:"변경사항",downloadBtn:"다운로드",
    coins:"코인",gems:"보석",max:"최대",owned:"보유",unlock:"잠금해제",completed:"완료"
  },
  zh: {
    agreeTitle:"免责声明",agreeBtn:"我理解并接受",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"点击上传",dropOr:"或拖放文件",logo:"Temple Run 2 Decrypter",
    navOverview:"概览",navEconomy:"货币",navChars:"角色",diffBtn:"更改",downloadBtn:"下载",
    coins:"金币",gems:"宝石",max:"最大",owned:"已拥有",unlock:"解锁",completed:"已完成"
  },
  ru: {
    agreeTitle:"Отказ от ответственности",agreeBtn:"Я понимаю и принимаю",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"Нажмите для загрузки",dropOr:"или перетащите файл",logo:"Temple Run 2 Decrypter",
    navOverview:"Обзор",navEconomy:"Валюта",navChars:"Персонажи",diffBtn:"Изменения",downloadBtn:"Скачать",
    coins:"Монеты",gems:"Кристаллы",max:"МАКС",owned:"Есть",unlock:"Разблокировать",completed:"Завершено"
  },
  tr: {
    agreeTitle:"Sorumluluk Reddi",agreeBtn:"Anlıyorum ve Kabul Ediyorum",uploadTitle:"Temple Run 2 Decrypter",
    uploadDesc:"Kayıt dosyanızı incelemek, analiz etmek ve isteğe bağlı olarak düzenlemek için yükleyin.",
    dropBold:"Yüklemek için tıklayın",dropOr:"veya sürükleyip bırakın",logo:"Temple Run 2 Decrypter",
    navOverview:"Genel Bakış",navMeta:"Meta Bilgi",navEconomy:"Para Birimi",navStats:"İstatistikler",
    navChars:"Karakterler",navPets:"Evcil Hayvanlar",navHats:"Şapkalar",navCollectables:"Koleksiyonlar",navArtifacts:"Eserler",
    navPowers:"Güçler",navRegions:"Bölgeler",navObjectives:"Hedefler",navBP:"Savaş Bileti",
    navDaily:"Günlük Görevler",navQuick:"Hızlı İşlemler",navHash:"Hash Ayarları",navRaw:"Ham Düzenleyici",navLog:"Düzenleme Günlüğü",
    modeInspect:"İncele",modeCosmetic:"Kozmetik",modeExperimental:"Deneysel",diffBtn:"Değişiklikler",downloadBtn:"İndir",
    coins:"Altın",gems:"Elmas",scrolls:"Parşömen",keys:"Anahtar",max:"MAKS",owned:"Sahip",notOwned:"Sahip Değil",
    unlock:"Kilidi Aç",completed:"Tamamlandı",highScore:"En Yüksek Skor",totalRuns:"Toplam Koşu",
    bpRunsWarn:"Savaş bileti erişimi için en az 15 toplam koşu gereklidir. Koşu sayınız 15'in altındaysa, savaş bileti tamamlanırken otomatik olarak 15'e yükseltilir."
  },
  ar: {
    agreeTitle:"إخلاء المسؤولية",agreeBtn:"أفهم وأوافق",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"انقر للتحميل",dropOr:"أو اسحب وأفلت",logo:"Temple Run 2 Decrypter",
    navOverview:"نظرة عامة",navEconomy:"العملة",navChars:"الشخصيات",diffBtn:"التغييرات",downloadBtn:"تحميل",
    coins:"عملات",gems:"جواهر",max:"أقصى",owned:"مملوك",unlock:"فتح",completed:"مكتمل"
  },
  hi: {
    agreeTitle:"अस्वीकरण",agreeBtn:"मैं समझता/समझती हूँ और स्वीकार करता/करती हूँ",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"अपलोड करने के लिए क्लिक करें",dropOr:"या खींचें और छोड़ें",logo:"Temple Run 2 Decrypter",
    navOverview:"अवलोकन",navEconomy:"मुद्रा",navChars:"पात्र",diffBtn:"बदलाव",downloadBtn:"डाउनलोड",
    coins:"सिक्के",gems:"रत्न",max:"अधिकतम",unlock:"अनलॉक",completed:"पूर्ण"
  },
  pt: {
    agreeTitle:"Aviso Legal",agreeBtn:"Eu Entendo e Aceito",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"Clique para enviar",dropOr:"ou arraste e solte",logo:"Temple Run 2 Decrypter",
    navOverview:"Visão Geral",navEconomy:"Moeda",navChars:"Personagens",diffBtn:"Alterações",downloadBtn:"Baixar",
    coins:"Moedas",gems:"Gemas",max:"MÁX",unlock:"Desbloquear",completed:"Concluído"
  },
  it: {
    agreeTitle:"Dichiarazione di non responsabilità",agreeBtn:"Capisco e Accetto",uploadTitle:"Temple Run 2 Decrypter",
    dropBold:"Clicca per caricare",dropOr:"o trascina e rilascia",logo:"Temple Run 2 Decrypter",
    navOverview:"Panoramica",navEconomy:"Valuta",navChars:"Personaggi",diffBtn:"Modifiche",downloadBtn:"Scarica",
    coins:"Monete",gems:"Gemme",max:"MAX",unlock:"Sblocca",completed:"Completato"
  },
  "en-GB": {
    agreeTitle:"Disclaimer & Legal Notice",
    agreeDesc:"This tool is provided strictly for educational and personal use. By proceeding, you acknowledge and agree to the following:",
    agree1:"This tool inspects and modifies local save data files stored on your device.",
    agree2:"Modifying save data may cause unexpected game behaviour, data corruption, progress loss, or account restrictions.",
    agree3:"You accept full and sole responsibility for any modifications made to your save files.",
    agree4:"This tool is not affiliated with, endorsed by, or connected to Imangi Studios or any game developer or publisher.",
    agree5:"No warranty of any kind is provided. This software is offered as is without guarantees of functionality, accuracy, or fitness for any purpose.",
    agree6:"The developers of this tool accept no liability for any damages, losses, or consequences resulting from its use.",
    agree7:"Do not use this tool to gain unfair advantages in competitive or online environments. Misuse may violate terms of service.",
    agree8:"You are solely responsible for ensuring your use complies with applicable laws and terms of service.",
    agreeLegal:"By clicking the button below, you confirm that you have read, understood, and agreed to all the terms above. You acknowledge that you use this tool entirely at your own risk.",
    agreeBtn:"I Understand, Accept All Risks & Proceed",
    uploadTitle:"Temple Run 2 Decrypter",uploadDesc:"Upload your save data file to inspect, analyse, and optionally edit its contents.",
    dropBold:"Click to upload",dropOr:"or drag and drop",logo:"Temple Run 2 Decrypter",
    sgOverview:"Overview",sgEconomy:"Economy",sgCollection:"Collection",sgUpgrades:"Upgrades",sgProgress:"Progress",sgTools:"Tools",
    navOverview:"Overview",navMeta:"Meta Info",navEconomy:"Currency",navStats:"Statistics",navChars:"Characters",navPets:"Pets",
    navHats:"Hats",navCollectables:"Collectables",navArtifacts:"Artifacts",navPowers:"Powers",navRegions:"Regions",navObjectives:"Objectives",navBP:"Battle Pass",
    navDaily:"Daily Challenges",navQuick:"Quick Actions",navHash:"Hash Config",navRaw:"Raw Editor",navLog:"Edit Log",
    navPerks:"Perks",navPotions:"Potions",navIdolQuest:"Idol Quest",navDailyTotems:"Daily Totems",navGlobalChallenges:"Global Challenges",navMinigame:"Minigame",
    modeInspect:"Inspect",modeCosmetic:"Cosmetic",modeExperimental:"Experimental",diffBtn:"Changes",downloadBtn:"Download",
    overviewTitle:"Overview",overviewDesc:"Quick summary of your save file.",
    metaTitle:"Meta Information",metaDesc:"Save file metadata and system info.",
    econTitle:"Currency",econDesc:"View and edit in-game currency values.",
    statsTitle:"Statistics",statsDesc:"Game statistics and lifetime records.",
    charsTitle:"Characters",charsDesc:"Manage your character collection.",
    petsTitle:"Pets",petsDesc:"Manage your pet collection.",
    hatsTitle:"Hats",hatsDesc:"Equip accessories on your characters. Each hat requires a downloaded asset bundle. Use batch unlock to add hats gradually — load the game between batches so it can download the bundles.",unlockHatBatch:"Unlock Next Batch",unlockAllHats:"Unlock All",
    collectTitle:"Collectables",collectDesc:"Map collectibles — unlock prizes by completing sets.",
    navCollectables:"Collectables",unlockAllCollect:"Unlock All",lockAllCollect:"Lock All",
    redeemed:"Redeemed",notRedeemed:"Not Redeemed",
    artsTitle:"Artifacts",artsDesc:"Permanent upgrade artifacts.",
    powsTitle:"Powers",powsDesc:"Power-up abilities.",
    regsTitle:"Regions",regsDesc:"World map regions.",
    objsTitle:"Objectives",objsDesc:"Mission objectives and progress.",
    bpTitle:"Battle Pass",bpDesc:"Current battle pass status.",
    bpRunsWarn:"Minimum 60 total runs required for battle pass access. If your run count is below 60, it will be automatically increased to 60 when completing the battle pass.",
    dcTitle:"Daily Challenges",dcDesc:"Today's challenge progress.",
    qaTitle:"Quick Actions",qaDesc:"Powerful batch operations. Use with caution.",
    qaMaxTitle:"Max Account",qaMaxDesc:"Unlock everything, max all currencies and statistics to high values.",
    qaMaxWarn:"I understand this makes changes obvious",qaMaxBtn:"Max Everything",
    qaRandTitle:"Randomise Values",qaRandDesc:"Randomises all currencies, lifetime totals, scores, distances, and run statistics to realistic values that look like natural gameplay.",
    qaRandWarn:"I understand values will be overwritten",qaRandBtn:"Randomise",
    qaUnlockTitle:"Unlock Everything",qaUnlockDesc:"Unlock all characters, pets, hats, artifacts, powers, regions, objectives, potions, battle pass, and minigame. Server-managed features (perks, daily challenges, totems, streaks, idol quest, global challenges) are skipped.",qaUnlockBtn:"Unlock All",
    hashTitle:"Hash Configuration",hashDesc:"Configure the hash key and algorithm for save integrity.",
    hashKeyLabel:"Hash Key",hashAlgoLabel:"Algorithm",hashSaveBtn:"Save",
    rawTitle:"Raw JSON Editor",rawDesc:"Direct JSON editing. Requires Experimental mode.",rawLoadBtn:"Load JSON",rawSaveBtn:"Apply Changes",
    logTitle:"Edit Log",logDesc:"History of all modifications made in this session.",logEmpty:"No edits yet.",
    diffTitle:"Changes",diffEmpty:"No changes detected.",diffCloseBtn:"Close",
    settingsTitle:"Settings",settingsDesc:"Appearance and language preferences.",settingsTheme:"Theme",settingsLang:"Language",
    navSettings:"Settings",
    inspectWarnTitle:"Inspect Mode Active",inspectWarnDesc:"Editing is disabled in Inspect mode. Switch to Cosmetic or Experimental mode to make changes to your save file.",
    inspectSwitchCos:"Switch to Cosmetic",inspectDismiss:"Dismiss",
    hashLockMsg:"This section modifies critical save integrity data.",hashAcceptLabel:"I accept the risks",
    howToObtain:"How to obtain your save file?",guideAndroid:"Android",guideIOS:"iOS",guideBack:"Back",
    rawLockMsg:"This section allows direct modification of raw save data.",rawAcceptLabel:"I accept the risks",
    expConfirmTitle:"Switch to Experimental Mode?",expConfirmDesc:"Experimental mode allows modifying all values including raw JSON. Incorrect changes may corrupt your save file beyond repair.",
    expConfirmYes:"Yes, Switch",expConfirmNo:"Cancel",
    readonlyNotice:"Read-only in Inspect mode. Click to switch.",
    playerLevel:"Player Level",showAll:"Show All",scrollTo:"Navigate",
    unlockAllChars:"Unlock All",unlockAllPets:"Unlock All",unlockAllArts:"Unlock All",unlockAllPows:"Unlock All",
    purchAllRegs:"Unlock All",completeObjs:"Complete All",completeBP:"Complete Battle Pass",completeDC:"Complete All",
    removeAllChars:"Remove All",removeAllPets:"Remove All",removeAllHats:"Remove All",removeAllArts:"Remove All",removeAllPows:"Remove All",
    unpurchAllRegs:"Lock All",uncompleteObjs:"Reset All",resetBP:"Reset Battle Pass",resetDC:"Reset All",
    coins:"Coins",gems:"Gems",scrolls:"Scrolls",keys:"Keys",lcc:"Lifetime Coins",lscc:"Lifetime Gems",mult:"Multiplier",max:"MAX",
    maxAllCurrency:"Max All",randCurrency:"Randomise Currency",randStats:"Randomise Stats",
    name:"Name",status:"Status",owned:"Owned",notOwned:"Not Owned",active:"Active",level:"Lv",
    unlock:"Unlock",purchase:"Purchase",completed:"Completed",id:"ID",title:"Title",desc:"Description",type:"Type",
    points:"Points",target:"Target",earned:"Earned",tiers:"Tiers",claimed:"Claimed",premium:"Premium",start:"Start",end:"End",
    equip:"Equip",unequip:"Unequip",equipOn:"Equip on",remove:"Remove",lock:"Lock",reset:"Reset",set:"Set",save:"Save",apply:"Apply",select:"Select",equipped:"Equipped",
    highScore:"High Score",highScoreNR:"High Score (No Revive)",longestDist:"Longest Distance",longestDistNC:"Longest Dist. (No Continue)",
    totalDist:"Total Distance",totalRuns:"Total Runs",totalRes:"Total Resurrections",
    totalCoins:"Total Coins Collected",totalGems:"Total Gems Collected",highCoins:"Highest Coins (Run)",highGems:"Highest Gems (Run)",
    totalScore:"Total Score",totalDailyCC:"Daily Challenge Completions",totalWeeklyCC:"Weekly Challenge Completions",
    totalHeadStarts:"Head Start Uses",totalMegaHS:"Mega Head Start Uses",totalItemsCC:"Items Collected (Coins)",lpv119:"LPV119 Stat",
    hash:"Hash",version:"Version",hrfl:"Tutorial Flag",installDate:"Install Date",
    daysSinceInstall:"Days Since Install",daysPlayed:"Days Played",totalRunsMeta:"Total Runs",cloudVersion:"Cloud Version",timestamp:"Timestamp",
    streakTitle:"Daily Streak",currentStreak:"Current Streak",longestStreak:"Longest Streak",
    perk:"Perk",potionType:"Type",potionCount:"Count",tier:"Tier",
    configId:"Config ID",ends:"Ends",levels:"Levels",progress:"Progress",score:"Score",inProgress:"In Progress",
    task:"Task",bonusValue:"Bonus Value",duration:"Duration",found:"Found",notFound:"Not Found",done:"Done",incomplete:"Incomplete",
    noGlobalChallenges:"No global challenges.",noMinigameTiers:"No minigame tiers found.",noIdolQuest:"No idol quest data.",noDailyTotems:"No daily totem data.",noBattlePass:"No active battle pass.",
    yes:"Yes",no:"No",unlocked:"unlocked",auto:"Auto",light:"Light",dark:"Dark",
    path:"Path",before:"Before",after:"After",changes:"changes",change:"change",
    noIssues:"No issues detected",jsonLoaded:"JSON loaded.",hashSaved:"Hash config saved.",downloaded:"Downloaded!",networkError:"Network error.",uploadOk:"OK",maxWarnToast:"Warning: Setting maximum values may be detectable.",unsavedWarn:"You have unsaved changes. Are you sure you want to return to the upload screen? All changes will be lost."
  },
};

let curLang = 'en';

function t(key) {
  return (T[curLang] || T[curLang.split('-')[0]] || T.en || {})[key] || (T.en || {})[key] || key;
}

function applyTranslations() {
  const map = T.en;
  for (const key of Object.keys(map)) {
    const el = document.getElementById('t_' + key);
    if (el) el.textContent = t(key);
  }
  document.documentElement.lang = curLang;
  const rtlLang = LANGS.flatMap(g => g.items).find(l => l.code === curLang || l.code === curLang.split('-')[0]);
  document.documentElement.dir = (rtlLang && rtlLang.rtl) ? 'rtl' : 'ltr';
}

function setLang(code) {
  curLang = code;
  localStorage.setItem('si_lang', code);
  applyTranslations();
  document.querySelectorAll('.lang-dropdown').forEach(d => d.classList.remove('show'));
  const langInfo = LANGS.flatMap(g => g.items).find(l => l.code === code);
  const label = langInfo ? langInfo.native : code;
  const btn1 = document.getElementById('langPickerBtn');
  if (btn1) btn1.innerHTML = IC.globe + ' ' + label;
  if (A) renderAll();
  else renderSettings();
}

function populateLangList(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  let html = '';
  for (const group of LANGS) {
    html += '<div class="lang-group-title">' + group.group + '</div>';
    for (const l of group.items) {
      html += '<div class="lang-option' + (l.code === curLang ? ' active' : '') + '" onclick="setLang(\'' + l.code + '\')" data-search="' + (l.name + ' ' + l.native + ' ' + l.code).toLowerCase() + '">';
      html += '<span>' + l.name + '</span><span class="native">' + l.native + '</span></div>';
    }
  }
  c.innerHTML = html;
}

function filterLangs(q, listNum) {
  const containerId = listNum === 3 ? 'langList3' : 'langList';
  const container = document.getElementById(containerId);
  if (!container) return;
  const els = container.querySelectorAll('.lang-option, .lang-group-title');
  const low = q.toLowerCase();
  let groupHasVisible = false;
  let lastGroup = null;
  for (const el of els) {
    if (el.classList.contains('lang-group-title')) {
      if (lastGroup) lastGroup.style.display = groupHasVisible ? '' : 'none';
      lastGroup = el;
      groupHasVisible = false;
    } else {
      const match = !q || el.dataset.search.includes(low);
      el.style.display = match ? '' : 'none';
      if (match) groupHasVisible = true;
    }
  }
  if (lastGroup) lastGroup.style.display = groupHasVisible ? '' : 'none';
}

function toggleLangDropdown(e) {
  e.stopPropagation();
  const dd = e.currentTarget.nextElementSibling || e.currentTarget.parentElement.querySelector('.lang-dropdown');
  const isShow = dd.classList.contains('show');
  document.querySelectorAll('.lang-dropdown').forEach(d => d.classList.remove('show'));
  if (!isShow) { dd.classList.add('show'); dd.querySelector('.lang-search')?.focus(); }
}

/* ─── Theme ─── */
let themeIdx = 0;
const themes = ['auto', 'light', 'dark'];

function getThemeIcon(idx) {
  return [IC.gear, IC.sun, IC.moon][idx] || IC.gear;
}

function setTheme(th) {
  themeIdx = themes.indexOf(th);
  if (themeIdx < 0) themeIdx = 0;
  if (th === 'auto') document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  else document.documentElement.dataset.theme = th;
  localStorage.setItem('si_theme', th);
  renderSettings();
}

function cycleTheme() {
  themeIdx = (themeIdx + 1) % 3;
  setTheme(themes[themeIdx]);
}

function initTheme() {
  const saved = localStorage.getItem('si_theme') || 'auto';
  themeIdx = themes.indexOf(saved);
  if (themeIdx < 0) themeIdx = 0;
  const th = themes[themeIdx];
  if (th === 'auto') document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  else document.documentElement.dataset.theme = th;
}

/* ─── Settings Render ─── */
function renderSettings() {
  const el = document.getElementById('settingsContent');
  if (!el) return;
  const th = themes[themeIdx];
  let html = '<div class="glass-card settings-card"><div class="settings-label">' + t('settingsTheme') + '</div><div class="theme-options">';
  html += '<div class="theme-option' + (th === 'auto' ? ' active' : '') + '" onclick="setTheme(\'auto\')">' + IC.gear + ' ' + t('auto') + '</div>';
  html += '<div class="theme-option' + (th === 'light' ? ' active' : '') + '" onclick="setTheme(\'light\')">' + IC.sun + ' ' + t('light') + '</div>';
  html += '<div class="theme-option' + (th === 'dark' ? ' active' : '') + '" onclick="setTheme(\'dark\')">' + IC.moon + ' ' + t('dark') + '</div>';
  html += '</div></div>';
  html += '<div class="glass-card settings-card"><div class="settings-label">' + t('settingsLang') + '</div>';
  html += '<div class="lang-picker" style="width:100%">';
  const langInfo = LANGS.flatMap(g => g.items).find(l => l.code === curLang);
  const label = langInfo ? langInfo.native : curLang;
  html += '<button class="btn btn-secondary btn-sm lang-picker-btn" style="width:100%;justify-content:start" onclick="toggleLangDropdown(event)" id="langPickerBtn3">' + IC.globe + ' ' + label + '</button>';
  html += '<div class="lang-dropdown glass" id="langDropdown3" style="width:100%">';
  html += '<input type="text" class="lang-search" name="langSearch3" placeholder="Search languages..." oninput="filterLangs(this.value,3)">';
  html += '<div class="lang-list" id="langList3"></div>';
  html += '</div></div></div>';
  el.innerHTML = html;
  populateLangList('langList3');
}

/* ─── Save File Guide ─── */
function detectOS() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function renderSaveGuide() {
  const el = document.getElementById('saveGuide');
  if (!el) return;
  el.innerHTML = '<div class="save-guide-flow" id="guideFlow"><span class="save-guide-link" onclick="showGuideOptions()">' + t('howToObtain') + '</span></div>';
}

function showGuideOptions() {
  const el = document.getElementById('guideFlow');
  const os = detectOS();
  el.innerHTML =
    '<div class="save-guide-options">' +
    '<div class="save-guide-option' + (os === 'android' ? ' recommended' : '') + '" onclick="showGuideDetail(\'android\')">' +
    (os === 'android' ? '<span class="guide-badge" style="position:static;margin-bottom:4px">Detected</span>' : '') +
    '<div class="guide-os-icon">' + IC.android + '</div>' +
    '<span class="guide-os-label">' + t('guideAndroid') + '</span></div>' +
    '<div class="save-guide-option' + (os === 'ios' ? ' recommended' : '') + '" onclick="showGuideDetail(\'ios\')">' +
    (os === 'ios' ? '<span class="guide-badge" style="position:static;margin-bottom:4px">Detected</span>' : '') +
    '<div class="guide-os-icon">' + IC.apple + '</div>' +
    '<span class="guide-os-label">' + t('guideIOS') + '</span></div></div>';
}

function showGuideDetail(platform) {
  const el = document.getElementById('guideFlow');
  let content = '';
  if (platform === 'android') {
    content = '<h4>' + IC.android + ' ' + t('guideAndroid') + '</h4>' +
      '<ol><li>Install a file manager (e.g. MT Manager, Root Explorer)</li>' +
      '<li>Navigate to <strong>/data/data/com.imangi.templerun2/files/</strong></li>' +
      '<li>Copy <strong>gamedata.txt</strong> to an accessible location</li>' +
      '<li>Upload it here</li></ol>' +
      '<p style="font-size:11px;color:var(--text-secondary);margin-top:8px">Root access is typically required.</p>';
  } else {
    content = '<h4>' + IC.apple + ' ' + t('guideIOS') + '</h4>' +
      '<ol><li>Connect your device to a computer</li>' +
      '<li>Use iMazing, 3uTools, or an iTunes backup extractor</li>' +
      '<li>Browse the Temple Run 2 app container &rsaquo; Documents</li>' +
      '<li>Export <strong>gamedata.txt</strong> and upload it here</li></ol>' +
      '<p style="font-size:11px;color:var(--text-secondary);margin-top:8px">No jailbreak required with iMazing.</p>';
  }
  el.innerHTML = '<div class="save-guide-detail">' + content + '</div>' +
    '<span class="save-guide-back" onclick="showGuideOptions()">' + IC.arrowLeft + ' ' + t('guideBack') + '</span>';
}

/* ─── Home / Reset ─── */
function goHome() {
  if (A && A.editLog && A.editLog.length > 0) {
    if (!confirm(t('unsavedWarn'))) return;
  }
  editor = null; floatPaths = null; A = null;
  hashKey = 'BonusItemProtoData'; hashAlgo = 'md5_append';
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'flex';
  document.getElementById('fileInput').value = '';
  document.getElementById('modeSelect').value = 'inspect';
  currentSection = 'overview';
}

/* ─── Agreement & Upload ─── */
function acceptAgreement() {
  localStorage.setItem('si_agreed', '1');
  document.getElementById('agreementScreen').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'flex';
}

function initUpload() {
  const dz = document.getElementById('dropzone');
  const fi = document.getElementById('fileInput');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]); });
  fi.addEventListener('change', () => { if (fi.files.length) uploadFile(fi.files[0]); });
}

async function uploadFile(file) {
  const errEl = document.getElementById('uploadError');
  errEl.style.display = 'none';
  try {
    const text = await file.text();
    let save;
    try { save = JSON.parse(text); } catch (e) { errEl.textContent = 'Invalid JSON file.'; errEl.style.display = 'block'; return; }
    if (!save.data) { errEl.textContent = 'Invalid save file: missing data field.'; errEl.style.display = 'block'; return; }
    floatPaths = recordFloatPaths(text);
    const db = await ConfigDB.load('Config/gameConfig.txt', save);
    db.mergeSaveData(save);
    editor = new SaveEditor(save, db);
    editor._sanitizeOnUpload();
    A = editor.analysis();
    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    renderAll();
    toast(t('uploadTitle') + ': ' + t('uploadOk'), 'success');
  } catch (e) { errEl.textContent = e.message || 'Upload failed.'; errEl.style.display = 'block'; }
}

/* ─── Navigation ─── */
function navTo(section, el) {
  currentSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + section);
  if (sec) sec.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

/* ─── API Helpers (Local) ─── */
async function setMode(m) {
  if (m === 'experimental') {
    document.getElementById('expConfirmModal').classList.add('show');
    return;
  }
  if (!editor) return;
  editor.setMode(m);
  A = editor.analysis();
  updateModeIndicators();
  renderAll();
}

async function confirmExperimental(yes) {
  document.getElementById('expConfirmModal').classList.remove('show');
  if (!yes) { document.getElementById('modeSelect').value = A ? A.mode : 'inspect'; return; }
  if (!editor) return;
  editor.setMode('experimental');
  A = editor.analysis();
  updateModeIndicators();
  renderAll();
}

function toggleRawLock(checked) {
  const w = document.getElementById('rawLockWrapper');
  const o = document.getElementById('rawUnlockOverlay');
  if (checked) { w.classList.remove('hash-locked'); o.style.display = 'none'; }
  else { w.classList.add('hash-locked'); o.style.display = 'flex'; }
}

let _pendingAction = null;

async function editAction(action, params) {
  if (A && A.mode === 'inspect') {
    _pendingAction = { action, params: params || {} };
    showInspectWarning();
    return;
  }
  if (!editor) return;
  try {
    const result = dispatch(editor, action, params || {});
    if (typeof result === 'string' && result.startsWith('ERROR:')) { toast(result, 'error'); return; }
    A = editor.analysis();
    try { renderAll(); } catch (e) { toast('Render error: ' + e.message, 'error'); console.error(e); return; }
    toast(result, 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

/* ─── Render All ─── */
function renderAll() {
  renderOverview(); renderMeta(); renderEconomy(); renderPotions(); renderStats();
  renderCharacters(); renderPets(); renderHats(); renderCollectables();
  renderArtifacts(); renderPowers(); renderPerks(); renderRegions();
  renderObjectives(); renderBattlePass(); renderDailyChallenges();
  renderIdolQuest(); renderDailyTotems(); renderGlobalChallenges(); renderMinigame();
  renderLog(); renderSettings();
  updateModeIndicators();
  updateFieldLocking();
  updateBadgesAndCounters();
}

function updateBadgesAndCounters() {
  function setBadge(id, cur, total, counterId) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = cur + '/' + total;
    el.classList.toggle('complete', total > 0 && cur >= total);
    if (counterId) {
      const ce = document.getElementById(counterId);
      if (ce) { ce.textContent = cur + ' / ' + total; ce.classList.toggle('complete', total > 0 && cur >= total); }
    }
  }

  // Characters
  const oc = A.characters ? A.characters.filter(c => c.owned).length : 0;
  const tc = A.characters ? A.characters.length : 0;
  setBadge('charBadge', oc, tc, 'charsCounter');

  // Pets
  const op = A.pets ? A.pets.filter(p => p.owned).length : 0;
  const tp = A.pets ? A.pets.length : 0;
  setBadge('petBadge', op, tp, 'petsCounter');

  // Hats
  const oh = A.hats ? A.hats.filter(h => h.owned || h.equipped).length : 0;
  const th = A.hats ? A.hats.length : 0;
  setBadge('hatBadge', oh, th, 'hatsCounter');

  // Collectables
  const rc = A.collectables ? A.collectables.filter(c => c.redeemed).length : 0;
  const tcc = A.collectables ? A.collectables.length : 0;
  setBadge('collectBadge', rc, tcc, 'collectCounter');

  // Artifacts
  const oa = A.artifacts ? A.artifacts.filter(a => a.owned).length : 0;
  const ta = A.artifacts ? A.artifacts.length : 0;
  setBadge('artBadge', oa, ta, 'artsCounter');

  // Powers
  const opw = A.powers ? A.powers.filter(p => p.owned).length : 0;
  const tpw = A.powers ? A.powers.length : 0;
  setBadge('powBadge', opw, tpw, 'powsCounter');

  // Perks
  const mp = A.perks ? A.perks.filter(p => p.level >= p.max).length : 0;
  const tprk = A.perks ? A.perks.length : 0;
  setBadge('perkBadge', mp, tprk, 'perksCounter');

  // Regions
  const pr = A.regions ? A.regions.filter(r => r.purchased).length : 0;
  const trg = A.regions ? A.regions.length : 0;
  setBadge('regBadge', pr, trg, 'regsCounter');

  // Objectives
  const co = A.objectives ? (A.objectives.completed || 0) : 0;
  const tob = A.objectives ? (A.objectives.total || 0) : 0;
  setBadge('objBadge', co, tob, 'objsCounter');

  // Battle Pass
  const bp = A.battlePass;
  const bpEl = document.getElementById('bpBadge');
  if (bpEl) {
    bpEl.textContent = bp ? ((bp.unlockedTiers||0) + '/' + bp.totalTiers) : '\u2014';
    bpEl.classList.toggle('complete', bp && (bp.unlockedTiers||0) >= bp.totalTiers);
  }

  // Daily Challenges
  const dcArr = A.dailyChallenges || [];
  const dcc = dcArr.filter(c => c.status === 'Completed').length;
  setBadge('dcBadge', dcc, dcArr.length);

  // Idol Quest
  const iq = A.idolQuest;
  const iqEl = document.getElementById('iqBadge');
  if (iqEl) {
    iqEl.textContent = iq ? ((iq.levelsCompleted||0) + '/' + (iq.totalLevels||5)) : '\u2014';
    iqEl.classList.toggle('complete', iq && iq.completed);
  }

  // Daily Totems
  const dt = A.dailyTotems;
  const dtEl = document.getElementById('dtBadge');
  if (dtEl) {
    dtEl.textContent = dt ? (dt.totalFound + '/' + dt.totalTotems) : '\u2014';
    dtEl.classList.toggle('complete', dt && dt.totalFound >= dt.totalTotems);
  }

  // Global Challenges
  const gcArr = A.globalChallenges || [];
  const gcc = gcArr.filter(c => c.target > 0 && c.current >= c.target).length;
  const gcEl = document.getElementById('gcBadge');
  if (gcEl) {
    gcEl.textContent = gcArr.length ? (gcc + '/' + gcArr.length) : '\u2014';
    gcEl.classList.toggle('complete', gcArr.length > 0 && gcc >= gcArr.length);
  }

  // Minigame
  const mgTiers = (A.minigame && A.minigame.tiers) ? A.minigame.tiers : [];
  const mgc = mgTiers.filter(t => t.completed).length;
  const mgEl = document.getElementById('mgBadge');
  if (mgEl) {
    mgEl.textContent = mgTiers.length ? (mgc + '/' + mgTiers.length) : '\u2014';
    mgEl.classList.toggle('complete', mgTiers.length > 0 && mgc >= mgTiers.length);
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ─── Overview ─── */
function renderOverview() {
  const m = A.meta, e = A.economy;
  const lvl = A.gameLevel != null ? A.gameLevel : (A.playerLevel != null ? A.playerLevel : (A.objectives?.level || 0));
  const maxLvl = A.maxGameLevel || A.maxLevel || '?';
  const lvlPts = A.playerLevel != null ? A.playerLevel : '';
  const maxPts = A.maxLevel || '';
  const items = [
    { l: t('coins'), v: num(e.coins) }, { l: t('gems'), v: num(e.gems) },
    { l: t('highScore'), v: num(A.stats?.lifetime?.HS || 0) }, { l: t('totalRuns'), v: num(m.totalRuns || 0) },
    { l: t('daysPlayed'), v: m.daysPlayed || '0' }, { l: t('mult'), v: e.mult + 'x' },
    { l: t('playerLevel'), v: lvl + ' / ' + maxLvl + (lvlPts ? ' (' + lvlPts + ' / ' + maxPts + ' pts)' : '') },
  ];
  document.getElementById('overviewGrid').innerHTML = items.map(i =>
    '<div class="info-item"><div class="label">' + i.l + '</div><div class="value">' + i.v + '</div></div>'
  ).join('');
  const v = editor ? editor.validate() : { issues: [], errors: [], warnings: [] };
  const box = document.getElementById('validationBox');
  if (!v.issues || v.issues.length === 0) {
    box.innerHTML = '<div class="tag tag-success" style="padding:8px 16px;font-size:13px">' + IC.check + ' ' + t('noIssues') + '</div>';
    return;
  }
  let html = '';
  if (v.errors && v.errors.length)
    html += v.errors.map(e => '<div class="tag tag-danger" style="padding:6px 14px;font-size:12px;margin:3px 0">' + IC.warn + ' ' + esc(e) + '</div>').join('');
  if (v.warnings && v.warnings.length)
    html += v.warnings.map(w => '<div class="tag tag-warning" style="padding:6px 14px;font-size:12px;margin:3px 0">' + IC.warn + ' ' + esc(w) + '</div>').join('');
  box.innerHTML = html;
}

/* ─── Meta ─── */
function renderMeta() {
  const m = A.meta;
  const items = [
    { l: t('hash'), v: m.hash ? m.hash.substring(0, 16) + '...' : '?' }, { l: t('version'), v: m.version },
    { l: t('hrfl'), v: String(m.HRFL) }, { l: t('timestamp'), v: m.ts },
    { l: t('installDate'), v: m.installDate }, { l: t('daysSinceInstall'), v: m.daysSinceInstall },
    { l: t('daysPlayed'), v: m.daysPlayed }, { l: t('totalRunsMeta'), v: m.totalRuns },
    { l: t('cloudVersion'), v: m.cloud || 'N/A' },
  ];
  document.getElementById('metaGrid').innerHTML = items.map(i =>
    '<div class="info-item"><div class="label">' + i.l + '</div><div class="value" style="font-size:14px;word-break:break-all">' + (i.v ?? 'N/A') + '</div></div>'
  ).join('');
}

/* ─── Economy ─── */
function renderEconomy() {
  const e = A.economy;
  const sm = A.safeMax || SAFE_MAX;
  const mm = A.maxMultiplier || 100;
  const fields = [
    { key: 'coins', label: t('coins'), val: e.coins, action: 'set_coins', param: 'amount', max: sm, maxBtn: sm, tt: 'Current coin balance' },
    { key: 'gems', label: t('gems'), val: e.gems, action: 'set_gems', param: 'amount', max: sm, maxBtn: sm, tt: 'Current gem balance' },
    { key: 'scrolls', label: t('scrolls'), val: e.scrolls, action: 'set_scrolls', param: 'amount', max: sm, maxBtn: sm, tt: 'Map scroll count' },
    { key: 'keys', label: t('keys'), val: e.keys, action: 'set_keys', param: 'amount', max: sm, maxBtn: sm, tt: 'Treasure chest keys' },
    { key: 'mult', label: t('mult'), val: e.mult, action: 'set_multiplier', param: 'value', max: mm, maxBtn: mm, step: '0.1', tt: 'Score bonus coefficient' },
  ];
  const lvl = A.playerLevel != null ? A.playerLevel : (A.objectives?.level || 0);
  const maxLvl = A.maxLevel || 0;
  const gameLvl = A.gameLevel != null ? A.gameLevel : '?';
  const maxGameLvl = A.maxGameLevel || '?';
  let html = fields.map(f => {
    const inp = f.step ? 'step="' + f.step + '"' : 'step="1"';
    return '<div class="glass-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="form-label" style="margin:0">' + f.label + '</span>' +
      '<div class="tooltip-wrap"><span class="tooltip-icon">?</span><span class="tooltip-text">' + f.tt + '</span></div></div>' +
      '<div class="input-with-max"><input class="form-input" type="number" id="econ_' + f.key + '" name="econ_' + f.key + '" value="' + f.val + '" min="0" max="' + f.max + '" ' + inp + '>' +
      '<button class="btn btn-secondary btn-sm" onclick="setEcon(\'' + f.action + '\',\'' + f.param + '\',\'econ_' + f.key + '\')">' + t('set') + '</button>' +
      '<button class="btn btn-danger btn-sm" onclick="setEconMax(\'' + f.action + '\',\'' + f.param + '\',' + f.maxBtn + ')" title="' + t('max') + '">' + t('max') + '</button></div></div>';
  }).join('');
  html += '<div class="glass-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="form-label" style="margin:0">' + IC.level + ' ' + t('playerLevel') + ' <small style="opacity:0.7">(Game Level: ' + gameLvl + ' / ' + maxGameLvl + ')</small></span>' +
    '<div class="tooltip-wrap"><span class="tooltip-icon">?</span><span class="tooltip-text">Objective points total. Game Level = completed objectives ÷ 8.</span></div></div>' +
    '<div class="input-with-max"><input class="form-input" type="number" id="econ_level" name="econ_level" value="' + lvl + '" min="0" max="' + maxLvl + '" step="1">' +
    '<button class="btn btn-secondary btn-sm" onclick="setPlayerLevel()">' + t('set') + '</button>' +
    '<button class="btn btn-danger btn-sm" onclick="setPlayerLevelMax(' + maxLvl + ')" title="' + t('max') + '">' + t('max') + '</button></div></div>';
  document.getElementById('econCards').innerHTML = html;
}

function setEcon(action, param, inputId) {
  if (A && A.mode === 'inspect') { showInspectWarning(); return; }
  const v = document.getElementById(inputId).value;
  const p = {};
  p[param] = param === 'value' ? parseFloat(v) : parseInt(v);
  editAction(action, p);
}

let maxBtnWarned = false;
function setEconMax(action, param, maxVal) {
  if (A && A.mode === 'inspect') { showInspectWarning(); return; }
  if (!maxBtnWarned) { maxBtnWarned = true; toast(t('maxWarnToast'), 'warning'); }
  const p = {};
  p[param] = maxVal;
  editAction(action, p);
}

function setPlayerLevel() {
  if (A && A.mode === 'inspect') { showInspectWarning(); return; }
  const v = parseInt(document.getElementById('econ_level').value);
  editAction('set_player_level', { level: v });
}

function setPlayerLevelMax(maxVal) {
  if (A && A.mode === 'inspect') { showInspectWarning(); return; }
  if (!maxBtnWarned) { maxBtnWarned = true; toast(t('maxWarnToast'), 'warning'); }
  editAction('set_player_level', { level: maxVal });
}

/* ─── Statistics ─── */
function renderStats() {
  const ls = A.stats?.lifetime || {};
  const e = A.economy;
  const lifetimeFields = [
    { key: 'lcc', label: t('lcc'), val: e.lcc, action: 'set_lcc', param: 'amount' },
    { key: 'lscc', label: t('lscc'), val: e.lscc, action: 'set_lscc', param: 'amount' },
  ];
  const statDefs = [
    { key: 'HS', label: t('highScore') }, { key: 'HSNR', label: t('highScoreNR') },
    { key: 'LD', label: t('longestDist') }, { key: 'LDNC', label: t('longestDistNC') },
    { key: 'TD', label: t('totalDist') }, { key: 'TRUNS', label: t('totalRuns') },
    { key: 'TRESS', label: t('totalRes') }, { key: 'TCC', label: t('totalCoins') },
    { key: 'TGC', label: t('totalGems') }, { key: 'HCC', label: t('highCoins') },
    { key: 'HGC', label: t('highGems') }, { key: 'TS', label: t('totalScore') },
    { key: 'TDCC', label: t('totalDailyCC') }, { key: 'TWCC', label: t('totalWeeklyCC') },
    { key: 'THSU', label: t('totalHeadStarts') }, { key: 'TMHSU', label: t('totalMegaHS') },
    { key: 'TICC', label: t('totalItemsCC') }, { key: 'LPV119', label: t('lpv119') },
  ];
  let html = '';
  const sm = A.safeMax || SAFE_MAX;
  html += lifetimeFields.map(f =>
    '<div class="stat-edit-row"><span class="stat-label">' + f.label + '</span>' +
    '<div class="stat-value input-with-max"><input class="form-input" type="number" id="stat_lt_' + f.key + '" name="stat_lt_' + f.key + '" value="' + f.val + '" min="0" max="' + sm + '" step="1">' +
    '<button class="btn btn-secondary btn-sm" onclick="setLifetimeStat(\'' + f.action + '\',\'' + f.param + '\',\'stat_lt_' + f.key + '\')">' + t('set') + '</button>' +
    '<button class="btn btn-danger btn-sm" onclick="setEconMax(\'' + f.action + '\',\'' + f.param + '\',' + sm + ')" title="' + t('max') + '">' + t('max') + '</button></div></div>'
  ).join('');
  html += statDefs.map(s =>
    '<div class="stat-edit-row"><span class="stat-label">' + s.label + '</span>' +
    '<div class="stat-value input-with-max"><input class="form-input" type="number" id="stat_' + s.key + '" name="stat_' + s.key + '" value="' + (ls[s.key] || 0) + '" min="0" max="' + sm + '" step="1">' +
    '<button class="btn btn-secondary btn-sm" onclick="setStat(\'' + s.key + '\')">' + t('set') + '</button></div></div>'
  ).join('');
  document.getElementById('statsCard').innerHTML = html;
  renderStreak();
}

function renderStreak() {
  const sk = A.streak || {};
  document.getElementById('streakCard').innerHTML =
    '<div class="stat-edit-row"><span class="stat-label">' + t('currentStreak') + '</span>' +
    '<div class="stat-value"><span>' + (sk.cdcs || 0) + '</span> <span style="font-size:11px;color:var(--text-tertiary)">(server-managed)</span></div></div>' +
    '<div class="stat-edit-row"><span class="stat-label">' + t('longestStreak') + '</span>' +
    '<div class="stat-value"><span>' + (sk.ldcs || 0) + '</span></div></div>' +
    '<div class="stat-edit-row"><span class="stat-label">' + t('daysPlayed') + '</span>' +
    '<div class="stat-value"><span>' + (sk.DaysPlayed || 0) + '</span></div></div>' +
    '<div class="stat-edit-row"><span class="stat-label">' + t('daysSinceInstall') + '</span>' +
    '<div class="stat-value"><span>' + (sk.DaysSinceInstall || 0) + '</span></div></div>';
}

function setStreak() {
  // Streak editing disabled — server-managed
}

function setLifetimeStat(action, param, inputId) {
  if (A && A.mode === 'inspect') { showInspectWarning(); return; }
  const v = document.getElementById(inputId).value;
  const p = {}; p[param] = parseInt(v);
  editAction(action, p);
}

async function setStat(key) {
  if (A && A.mode === 'inspect') { showInspectWarning(); return; }
  const v = parseInt(document.getElementById('stat_' + key).value);
  editAction('set_stat', { key, value: v });
}

/* ─── Characters ─── */
function renderCharacters() {
  const chars = A.characters || [];
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('name') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const c of chars) {
    const st = c.owned
      ? (c.active ? '<span class="tag tag-info">' + t('active') + '</span>' : '<span class="tag tag-success">' + t('owned') + '</span>')
      : '<span class="tag tag-warning">' + t('notOwned') + '</span>';
    let acts = '';
    if (!c.owned) acts = '<button class="btn btn-primary btn-sm" onclick="editAction(\'unlock_character\',{id:' + c.id + '})">' + t('unlock') + '</button>';
    else if (!c.active) acts = '<button class="btn btn-secondary btn-sm" onclick="editAction(\'set_active\',{id:' + c.id + '})" title="Select this character to use in game">' + t('select') + '</button> <button class="btn btn-danger btn-sm" onclick="editAction(\'remove_character\',{id:' + c.id + '})">' + t('remove') + '</button>';
    html += '<tr><td>' + c.id + '</td><td>' + esc(c.name) + '</td><td>' + st + '</td><td>' + acts + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('charsTable').innerHTML = html;
}

/* ─── Pets ─── */
function renderPets() {
  const pets = A.pets || [];
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('name') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const p of pets) {
    const st = p.owned ? '<span class="tag tag-success">' + t('owned') + '</span>' : '<span class="tag tag-warning">' + t('notOwned') + '</span>';
    const acts = p.owned ? '<button class="btn btn-danger btn-sm" onclick="editAction(\'remove_pet\',{id:' + p.id + '})">' + t('remove') + '</button>' : '<button class="btn btn-primary btn-sm" onclick="editAction(\'unlock_pet\',{id:' + p.id + '})">' + t('unlock') + '</button>';
    html += '<tr><td>' + p.id + '</td><td>' + esc(p.name) + '</td><td>' + st + '</td><td>' + acts + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('petsTable').innerHTML = html;
}

/* ─── Hats ─── */
function renderHats() {
  const hats = A.hats || [];
  const chars = (A.characters || []).filter(c => c.owned);
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('name') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const h of hats) {
    let st, acts;
    if (h.equipped && h.equippedOn) {
      st = '<span class="tag tag-success">' + t('equipped') + ' — ' + esc(h.equippedOn.charName) + '</span>';
      acts = '<button class="btn btn-secondary btn-sm" onclick="editAction(\'remove_hat\',{charId:' + h.equippedOn.charId + '})">' + t('unequip') + '</button> ';
      acts += '<button class="btn btn-danger btn-sm" onclick="editAction(\'remove_hat_ownership\',{id:' + h.id + '})">' + t('remove') + '</button>';
    } else if (h.owned) {
      st = '<span class="tag tag-info">' + t('owned') + '</span>';
      acts = '';
      if (chars.length > 0) {
        acts += '<select class="form-input form-select" id="hat_equip_' + h.id + '" name="hat_equip_' + h.id + '" style="width:auto;font-size:12px;padding:4px 28px 4px 8px;display:inline-block;vertical-align:middle" onchange="if(this.value)editAction(\'equip_hat\',{id:' + h.id + ',charId:parseInt(this.value)})">' +
          '<option value="">' + t('equip') + '...</option>';
        // Put active character first
        const activeId = A.activeChar || 0;
        const activeChar = chars.find(c => c.id === activeId);
        if (activeChar) {
          acts += '<option value="' + activeChar.id + '">' + esc(activeChar.name) + ' ★</option>';
        }
        for (const c of chars) {
          if (c.id !== activeId) acts += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
        }
        acts += '</select> ';
      }
      acts += '<button class="btn btn-danger btn-sm" onclick="editAction(\'remove_hat_ownership\',{id:' + h.id + '})">' + t('remove') + '</button>';
    } else {
      st = '<span class="tag tag-warning">' + t('notOwned') + '</span>';
      acts = '<button class="btn btn-primary btn-sm" onclick="editAction(\'unlock_hat\',{id:' + h.id + '})">' + t('unlock') + '</button>';
    }
    html += '<tr><td>' + h.id + '</td><td>' + esc(h.name) + '</td><td>' + st + '</td><td>' + acts + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('hatsTable').innerHTML = html;
}

/* ─── Collectables ─── */
function renderCollectables() {
  const cols = A.collectables || [];
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('type') + '</th><th>' + t('name') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const c of cols) {
    const tp = c.type === 'individual' ? '<span class="tag tag-info">Item</span>' : '<span class="tag">Category</span>';
    const st = c.redeemed ? '<span class="tag tag-success">' + t('redeemed') + '</span>' : '<span class="tag tag-warning">' + t('notRedeemed') + '</span>';
    const acts = c.redeemed ? '<button class="btn btn-danger btn-sm" onclick="editAction(\'lock_collectable\',{id:' + c.id + '})">' + t('lock') + '</button>' : '<button class="btn btn-primary btn-sm" onclick="editAction(\'unlock_collectable\',{id:' + c.id + '})">' + t('unlock') + '</button>';
    html += '<tr><td>' + c.id + '</td><td>' + tp + '</td><td>' + esc(c.name) + '</td><td>' + st + '</td><td>' + acts + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('collectTable').innerHTML = html;
}

/* ─── Artifacts ─── */
function renderArtifacts() {
  const arts = A.artifacts || [];
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('name') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const a of arts) {
    const st = a.owned ? '<span class="tag tag-success">' + t('owned') + '</span>' : '<span class="tag tag-warning">' + t('notOwned') + '</span>';
    const acts = a.owned ? '<button class="btn btn-danger btn-sm" onclick="editAction(\'remove_artifact\',{id:' + a.id + '})">' + t('remove') + '</button>' : '<button class="btn btn-primary btn-sm" onclick="editAction(\'unlock_artifact\',{id:' + a.id + '})">' + t('unlock') + '</button>';
    html += '<tr><td>' + a.id + '</td><td>' + esc(a.name) + '</td><td>' + st + '</td><td>' + acts + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('artsTable').innerHTML = html;
}

/* ─── Powers ─── */
function renderPowers() {
  const pows = A.powers || [];
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('name') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const p of pows) {
    const st = p.owned ? '<span class="tag tag-success">' + t('owned') + '</span>' : '<span class="tag tag-warning">' + t('notOwned') + '</span>';
    const acts = p.owned ? '<button class="btn btn-danger btn-sm" onclick="editAction(\'remove_power\',{id:' + p.id + '})">' + t('remove') + '</button>' : '<button class="btn btn-primary btn-sm" onclick="editAction(\'unlock_power\',{id:' + p.id + '})">' + t('unlock') + '</button>';
    html += '<tr><td>' + p.id + '</td><td>' + esc(p.name) + '</td><td>' + st + '</td><td>' + acts + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('powsTable').innerHTML = html;
}

/* ─── Regions ─── */
function renderRegions() {
  const regs = A.regions || [];
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('name') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const r of regs) {
    const st = r.purchased ? '<span class="tag tag-success">' + t('owned') + '</span>' : '<span class="tag tag-warning">' + t('notOwned') + '</span>';
    const acts = r.purchased ? '<button class="btn btn-danger btn-sm" onclick="editAction(\'unpurchase_region\',{id:' + r.id + '})">' + t('lock') + '</button>' : '<button class="btn btn-primary btn-sm" onclick="editAction(\'purchase_region\',{id:' + r.id + '})">' + t('unlock') + '</button>';
    html += '<tr><td>' + r.id + '</td><td>' + esc(r.name) + '</td><td>' + st + '</td><td>' + acts + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('regsTable').innerHTML = html;
}

/* ─── Objectives ─── */
function renderObjectives() {
  const obj = A.objectives || {};
  document.getElementById('objsSummary').innerHTML =
    '<div class="info-grid"><div class="info-item"><div class="label">' + t('completed') + '</div><div class="value">' + (obj.completed || 0) + ' / ' + (obj.total || 0) +
    '</div></div><div class="info-item"><div class="label">' + t('points') + '</div><div class="value">' + num(obj.level || 0) + '</div></div></div>';
  const items = obj.items || [];
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('title') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>';
  for (const o of items) {
    const st = o.completed ? '<span class="tag tag-success">' + t('completed') + '</span>' : '<span class="tag tag-warning">' + t('incomplete') + '</span>';
    const oActs = o.completed ? '<button class="btn btn-danger btn-sm" onclick="editAction(\'uncomplete_objective\',{id:' + o.id + '})">' + t('reset') + '</button>' : '';
    html += '<tr><td>' + o.id + '</td><td>' + esc(o.title) + '</td><td>' + st + '</td><td>' + oActs + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('objsTable').innerHTML = html;
}

/* ─── Battle Pass ─── */
function renderBattlePass() {
  const bp = A.battlePass;
  if (!bp) { document.getElementById('bpCard').innerHTML = '<p style="color:var(--text-secondary)">' + t('noBattlePass') + '</p>'; return; }
  document.getElementById('bpCard').innerHTML =
    '<div class="info-grid">' +
    '<div class="info-item"><div class="label">' + t('title') + '</div><div class="value" style="font-size:14px">' + esc(bp.title) + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('tiers') + '</div><div class="value">' + (bp.unlockedTiers||0) + ' ' + t('unlocked') + ' / ' + bp.totalTiers + ' (' + bp.claimedTiers + ' ' + t('claimed') + ')</div></div>' +
    '<div class="info-item"><div class="label">' + t('premium') + '</div><div class="value">' + (bp.premium ? t('yes') : t('no')) + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('start') + '</div><div class="value" style="font-size:13px">' + bp.start + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('end') + '</div><div class="value" style="font-size:13px">' + bp.end + '</div></div>' +
    '</div>';
}

/* ─── Daily Challenges ─── */
function renderDailyChallenges() {
  const dc = A.dailyChallenges || [];
  let html = '<thead><tr><th>' + t('title') + '</th><th>' + t('target') + '</th><th>' + t('earned') + '</th><th>' + t('status') + '</th></tr></thead><tbody>';
  for (const c of dc) {
    const st = c.status === 'Completed' ? '<span class="tag tag-success">' + t('completed') + '</span>' : '<span class="tag tag-warning">' + esc(c.status) + '</span>';
    html += '<tr><td>' + esc(c.title) + '</td><td>' + c.target + '</td><td>' + c.earned + '</td><td>' + st + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('dcTable').innerHTML = html;
}

/* ─── Perks ─── */
function renderPerks() {
  const perks = A.perks || [];
  let html = '<thead><tr><th>' + t('perk') + '</th><th>' + t('level') + '</th><th>' + t('max') + '</th></tr></thead><tbody>';
  for (const p of perks) {
    const pct = p.max > 0 ? Math.round(p.level/p.max*100) : 0;
    const bar = '<div class="progress-bar"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div> ' + p.level + '/' + p.max + '</div>';
    const full = p.level >= p.max;
    const st = full ? '<span class="tag tag-success">MAX</span>' : bar;
    html += '<tr><td>' + esc(p.name) + '</td><td>' + st + '</td><td>' + p.max + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('perksTable').innerHTML = html;
}

/* ─── Potions ─── */
function renderPotions() {
  const potions = A.potions || [];
  let html = '<thead><tr><th>' + t('potionType') + '</th><th>' + t('potionCount') + '</th><th></th></tr></thead><tbody>';
  for (let i = 0; i < potions.length; i++) {
    const p = potions[i];
    html += '<tr><td>' + esc(p.type) + '</td><td>' + p.count + '</td><td>' +
      '<input type="number" class="form-input" id="potion_' + i + '" name="potion_' + i + '" style="width:80px;display:inline;padding:4px 6px;font-size:12px" min="0" max="999" value="' + p.count + '" onchange="editAction(\'set_potion\',{type:\'' + esc(p.type) + '\',count:parseInt(this.value)})">' +
      '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('potionsTable').innerHTML = html;
}

/* ─── Idol Quest ─── */
function renderIdolQuest() {
  const iq = A.idolQuest;
  if (!iq) { document.getElementById('iqCard').innerHTML = '<p style="color:var(--text-secondary)">' + t('noIdolQuest') + '</p>'; return; }
  const st = iq.completed ? '<span class="tag tag-success">' + t('completed') + '</span>' : '<span class="tag tag-warning">' + t('inProgress') + '</span>';
  document.getElementById('iqCard').innerHTML =
    '<div class="info-grid">' +
    '<div class="info-item"><div class="label">' + t('configId') + '</div><div class="value">' + (iq.cfid || '?') + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('ends') + '</div><div class="value" style="font-size:13px">' + (iq.end || '?') + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('status') + '</div><div class="value">' + st + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('levels') + '</div><div class="value">' + (iq.levelsCompleted||0) + ' / ' + (iq.totalLevels||5) + '</div></div>' +
    '</div>';
}

/* ─── Daily Totems ─── */
function renderDailyTotems() {
  const dt = A.dailyTotems;
  if (!dt) { document.getElementById('dtCard').innerHTML = '<p style="color:var(--text-secondary)">' + t('noDailyTotems') + '</p>'; return; }
  let html = '<div class="info-grid" style="margin-bottom:16px">' +
    '<div class="info-item"><div class="label">' + t('task') + '</div><div class="value" style="font-size:13px">' + esc(dt.desc || dt.task || '?') + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('bonusValue') + '</div><div class="value">' + dt.value + '</div></div>' +
    '<div class="info-item"><div class="label">' + t('duration') + '</div><div class="value">' + dt.duration + ' min</div></div>' +
    '<div class="info-item"><div class="label">' + t('found') + '</div><div class="value">' + dt.totalFound + ' / ' + dt.totalTotems + '</div></div>' +
    '</div>';
  if (dt.totems && dt.totems.length) {
    html += '<table class="data-table"><thead><tr><th>' + t('type') + '</th><th>' + t('name') + '</th><th>' + t('found') + '</th></tr></thead><tbody>';
    for (const totem of dt.totems) {
      const st = totem.found ? '<span class="tag tag-success">' + t('found') + '</span>' : '<span class="tag tag-warning">' + t('notFound') + '</span>';
      html += '<tr><td>' + esc(totem.type) + '</td><td>' + esc(totem.name) + '</td><td>' + st + '</td></tr>';
    }
    html += '</tbody></table>';
  }
  document.getElementById('dtCard').innerHTML = html;
}

/* ─── Global Challenges ─── */
function renderGlobalChallenges() {
  const gc = A.globalChallenges || [];
  if (!gc.length) { document.getElementById('gcTable').innerHTML = '<tbody><tr><td style="color:var(--text-secondary)">' + t('noGlobalChallenges') + '</td></tr></tbody>'; return; }
  let html = '<thead><tr><th>' + t('id') + '</th><th>' + t('progress') + '</th><th>' + t('score') + '</th><th>' + t('ends') + '</th></tr></thead><tbody>';
  for (const c of gc) {
    const pct = c.target > 0 ? Math.round(c.current / c.target * 100) : 0;
    const done = c.target > 0 ? c.current >= c.target : false;
    const bar = '<div class="progress-bar"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div> ' + num(c.current) + '/' + num(c.target) + '</div>';
    const st = done ? '<span class="tag tag-success">' + t('done') + '</span>' : bar;
    html += '<tr><td>' + c.id + '</td><td>' + st + '</td><td>' + num(c.score || 0) + '</td><td style="font-size:12px">' + (c.end || '?') + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('gcTable').innerHTML = html;
}

/* ─── Minigame ─── */
function renderMinigame() {
  const mg = A.minigame || {};
  const tierList = mg.tiers || [];
  if (!tierList.length) { document.getElementById('mgTable').innerHTML = '<tbody><tr><td style="color:var(--text-secondary)">' + t('noMinigameTiers') + '</td></tr></tbody>'; return; }
  let html = '<thead><tr><th>' + t('tier') + '</th><th>' + t('status') + '</th></tr></thead><tbody>';
  for (const tr of tierList) {
    const st = tr.completed ? '<span class="tag tag-success">' + t('completed') + '</span>' : '<span class="tag tag-warning">' + t('incomplete') + '</span>';
    html += '<tr><td>' + esc(String(tr.tier)) + '</td><td>' + st + '</td></tr>';
  }
  html += '</tbody>';
  document.getElementById('mgTable').innerHTML = html;
}

/* ─── Edit Log ─── */
function renderLog() {
  const log = A.editLog || [];
  const el = document.getElementById('logEntries');
  if (!log.length) { el.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">' + t('logEmpty') + '</p>'; return; }
  const modeColors = { inspect: 'var(--success)', cosmetic: 'var(--warning)', experimental: 'var(--danger)' };
  const riskColors = { LOW: 'var(--success)', MED: 'var(--warning)', HIGH: 'var(--danger)' };
  el.innerHTML = log.map(e => {
    const mc = modeColors[e.mode] || 'var(--text-secondary)';
    const rc = riskColors[e.risk] || 'var(--text-secondary)';
    return '<div class="log-entry"><div class="log-risk log-risk-' + e.risk + '"></div><div><strong>' + esc(e.action) + '</strong> <span style="color:var(--text-secondary)">' + esc(e.detail) + '</span>' +
      '<div style="font-size:11px;margin-top:2px"><span style="color:' + mc + ';font-weight:600">' + e.mode + '</span> <span style="color:var(--text-secondary)">|</span> <span style="color:' + rc + ';font-weight:600">' + e.risk + '</span></div></div></div>';
  }).join('');
}

/* ─── Quick Actions ─── */
document.getElementById('maxConfirm')?.addEventListener('change', function() {
  document.getElementById('t_qaMaxBtn').disabled = !this.checked;
});
document.getElementById('randConfirm')?.addEventListener('change', function() {
  document.getElementById('t_qaRandBtn').disabled = !this.checked;
});

function doMaxAccount() {
  if (!document.getElementById('maxConfirm').checked) return;
  editAction('max_account');
}

function doRandomize() {
  if (!document.getElementById('randConfirm').checked) return;
  editAction('randomize');
}

/* ─── Hash Config ─── */
function toggleHashLock(checked) {
  const wrapper = document.getElementById('hashLockWrapper');
  const overlay = document.getElementById('hashUnlockOverlay');
  if (checked) {
    wrapper.classList.remove('hash-locked');
    overlay.style.display = 'none';
  } else {
    wrapper.classList.add('hash-locked');
    overlay.style.display = 'flex';
  }
}

async function saveHashConfig() {
  hashKey = document.getElementById('hashKeyInput').value;
  hashAlgo = document.getElementById('hashAlgoInput').value;
  toast(t('hashSaved'), 'success');
}

/* ─── Raw Editor ─── */
const RAW_SECTION_ICONS = {
  hash:IC.lock, data:IC.file, version:IC.file, HRFL:IC.check, TS:IC.calendar, InstallDate:IC.calendar,
  DaysSinceInstall:IC.calendar, DaysPlayed:IC.calendar, NoOfRunsSinceInstall:IC.stats, CloudSavedVersion:IC.globe,
  Players:IC.user, coinCount:IC.coin, specialCurrencyCount:IC.gem, scrollCount:IC.file, minigameTicketCount:IC.file,
  LCC:IC.coin, LSCC:IC.gem, SBC:IC.bolt, activePlayerCharacter:IC.user, Characters:IC.user,
  CharacterPets:IC.paw, artifactsPurchased:IC.diamond, collectablesRedeemed:IC.gem, powersPurchased:IC.bolt,
  objectives:IC.target, objectivesActiveData:IC.target, NCA:IC.calendar, RM:IC.globe,
  BPPDM:IC.trophy, BPCDDM:IC.trophy, CharId:IC.user, SkinId:IC.hat, PowerId:IC.bolt,
  PetId:IC.paw, Attachments:IC.hat, gameStats:IC.stats,
  HS:IC.trophy, HSNR:IC.trophy, LD:IC.stats, LDNC:IC.stats, TD:IC.stats,
  TRUNS:IC.stats, TRESS:IC.stats, TCC:IC.coin, TGC:IC.gem, HCC:IC.coin, HGC:IC.gem,
};
let rawAnnotations = null;

async function loadRaw() {
  if (!editor) return;
  const rawData = editor.exportRaw();
  const ta = document.getElementById('rawTextarea');
  ta.value = rawData;
  rawAnnotations = ANNOTATIONS || {};
  buildRawNav();
  document.getElementById('rawAssistPanel').style.display = 'grid';
  toast(t('jsonLoaded'), 'info');
}

function buildRawNav() {
  const panel = document.getElementById('rawNavPanel');
  if (!rawAnnotations || !Object.keys(rawAnnotations).length) { panel.innerHTML = ''; return; }
  let html = '<div class="raw-nav-header"><span>' + t('scrollTo') + '</span>' +
    '<button class="btn btn-secondary btn-sm" onclick="toggleShowAll()">' + t('showAll') + '</button></div>';
  for (const [key, desc] of Object.entries(rawAnnotations)) {
    const icon = RAW_SECTION_ICONS[key] || IC.code;
    html += '<div class="raw-nav-item" onclick="scrollRawTo(\'' + esc(key) + '\')" title="' + esc(desc) + '">' +
      '<span class="raw-nav-icon">' + icon + '</span><div><span>' + esc(key) + '</span>' +
      '<div class="raw-nav-desc">' + esc(desc) + '</div></div></div>';
  }
  panel.innerHTML = html;
}

function scrollRawTo(key) {
  const ta = document.getElementById('rawTextarea');
  const text = ta.value;
  const searchStr = '"' + key + '"';
  const idx = text.indexOf(searchStr);
  if (idx === -1) { toast('Key not found: ' + key, 'warning'); return; }
  ta.focus();
  // Reliable scroll: compute position as fraction of total text → scrollHeight
  const linesBefore = text.substring(0, idx).split('\n').length;
  const totalLines = text.split('\n').length;
  const targetScroll = (linesBefore / totalLines) * ta.scrollHeight - ta.clientHeight / 3;
  ta.scrollTop = Math.max(0, targetScroll);
  // Select the key to highlight it
  ta.setSelectionRange(idx, idx + searchStr.length);
  // Update nav active state
  document.querySelectorAll('.raw-nav-item').forEach(el => el.classList.remove('active'));
  const items = document.querySelectorAll('.raw-nav-item');
  for (const item of items) { if (item.textContent.includes(key)) { item.classList.add('active'); break; } }
}

function toggleShowAll() {
  document.getElementById('rawNavPanel').classList.toggle('show-all');
}

async function saveRaw() {
  const raw = document.getElementById('rawTextarea').value;
  if (!editor) return;
  try {
    editor.importRaw(raw);
    A = editor.analysis();
    renderAll();
    toast(t('rawSaved'), 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

/* ─── Inspect Warning Modal ─── */
function showInspectWarning() {
  document.getElementById('inspectModal').classList.add('show');
}

function closeInspectModal() {
  document.getElementById('inspectModal').classList.remove('show');
  _pendingAction = null;
}

async function switchAndRetry() {
  const pa = _pendingAction;
  closeInspectModal();
  if (!editor) return;
  editor.setMode('cosmetic');
  A = editor.analysis();
  document.getElementById('modeSelect').value = 'cosmetic';
  updateModeIndicators();
  renderAll();
  if (pa) {
    await editAction(pa.action, pa.params);
  }
}

/* ─── Field Locking ─── */
function updateFieldLocking() {
  if (!A) return;
  const locked = A.mode === 'inspect';
  const lockable = ['economy','potions','stats','characters','pets','hats','collectables','artifacts','powers','perks','regions','objectives','battlepass','daily','idolquest','dailytotems','globalchallenges','minigame','quickactions','hashconfig','raweditor'];
  for (const s of lockable) {
    const el = document.getElementById('sec-' + s);
    if (!el) continue;
    el.classList.toggle('edit-locked', locked);
    let notice = el.querySelector('.section-readonly-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'section-readonly-notice';
      notice.innerHTML = IC.lock + ' <span>' + t('readonlyNotice') + '</span>';
      notice.onclick = function() { document.getElementById('modeSelect').value = 'cosmetic'; setMode('cosmetic'); };
      const header = el.querySelector('.section-header');
      if (header) header.after(notice);
      else el.prepend(notice);
    }
  }
}

/* ─── Diff Modal ─── */
async function showDiff() {
  if (!editor) return;
  const changes = editor.getChanges() || [];
  const c = document.getElementById('diffContainer');
  if (!changes || changes.length === 0) {
    c.innerHTML = '<p style="color:var(--text-secondary)">' + t('diffEmpty') + '</p>';
    document.getElementById('diffCount').textContent = '0 ' + t('changes');
  } else {
    c.innerHTML = '<div class="diff-row" style="font-weight:700;border-bottom:2px solid var(--input-border)"><span>' + t('path') + '</span><span>' + t('before') + '</span><span>' + t('after') + '</span></div>' +
      changes.map(ch =>
        '<div class="diff-row"><span class="diff-path">' + esc(String(ch.path)) + '</span><span class="diff-old">' + esc(String(ch.old)) + '</span><span class="diff-new">' + esc(String(ch.new)) + '</span></div>'
      ).join('');
    document.getElementById('diffCount').textContent = changes.length + ' ' + (changes.length !== 1 ? t('changes') : t('change'));
  }
  document.getElementById('diffModal').classList.add('show');
}

function closeDiff() { document.getElementById('diffModal').classList.remove('show'); }

/* ─── Download ─── */
async function downloadSave() {
  if (!editor) return;
  try {
    const data = editor.exportJSON();
    let content = data;
    if (floatPaths && floatPaths.size > 0) {
      content = customStringify(JSON.parse(data), floatPaths);
    }
    const blob = new Blob([content], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gamedata.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t('downloadSuccess'), 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

/* ─── Utilities ─── */
function num(n) { return Number(n).toLocaleString(); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function toast(msg, type) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'info');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 4000);
}

function glowField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('glow-highlight');
  setTimeout(() => el.classList.remove('glow-highlight'), 3000);
}

/* ─── Close dropdowns on outside click ─── */
document.addEventListener('click', e => {
  if (!e.target.closest('.lang-picker'))
    document.querySelectorAll('.lang-dropdown').forEach(d => d.classList.remove('show'));
});

/* ─── Responsive ─── */
function checkResponsive() {
  const toggle = document.getElementById('menuToggle');
  if (window.innerWidth <= 768) toggle.style.display = 'inline-flex';
  else { toggle.style.display = 'none'; document.getElementById('sidebar').classList.remove('open'); }
}

function autoDetectLang() {
  const nav = navigator.language || 'en';
  const allCodes = LANGS.flatMap(g => g.items.map(i => i.code));
  if (allCodes.includes(nav)) return nav;
  const base = nav.split('-')[0];
  if (allCodes.includes(base)) return base;
  return 'en';
}

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initIcons();
  const savedLang = localStorage.getItem('si_lang') || autoDetectLang();
  curLang = savedLang;
  populateLangList('langList');
  setLang(savedLang);
  applyTranslations();
  initUpload();
  checkResponsive();
  window.addEventListener('resize', checkResponsive);
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
    if (themes[themeIdx] === 'auto') {
      document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
      renderSettings();
    }
  });
  if (localStorage.getItem('si_agreed') === '1') {
    document.getElementById('agreementScreen').style.display = 'none';
    document.getElementById('uploadScreen').style.display = 'flex';
  }
});
