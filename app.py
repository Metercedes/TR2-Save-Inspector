#!/usr/bin/env python3
"""Save File Inspector Backend"""

from flask import Flask, request, jsonify, render_template, send_file  # type: ignore[import-untyped]
import json, os, uuid, io, copy, hashlib, hmac as hmac_mod, random, time
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, cast

JsonObj = dict[str, Any]

app = Flask(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
TS_SENTINEL = -62135596800
HASH_KEY = "BonusItemProtoData"
HASH_ALGO = "md5_append"
INT32_MAX = 2_147_483_647
SAFE_MAX = INT32_MAX - 2_000_000          # headroom so earning more in-game won't overflow
MAX_MULTIPLIER = 230                       # sum of ScoreMultiplier objective Points (game may use int or float)
MAX_PLAYER_LEVEL = 286                     # sum of all objective Points
_BASE = os.path.dirname(os.path.abspath(__file__))
CFG_DIR = os.path.join(_BASE, "Config")
MAX_SESSIONS = 50
SESSION_TTL = 3600  # seconds
SENSITIVE = frozenset(["iapt", "siapt", "iappc", "iapms", "abgid", "PDILDK"])
DEPRECATED_ARTIFACT_PIDS: frozenset[int] = frozenset()  # reserved for future use
EXTRA_ARTIFACT_PIDS = frozenset(range(51, 56))  # PIDs 51-55: valid in-game but not in Artifacts.txt
LEGACY_PLAYER_KEYS = frozenset(["hatsPurchased", "collectablesRedeemed"])  # replaced by CharacterAttachments/CollectablesFound
PERK_MAX_DEPTHS = [10, 10, 10, 10, 10, 10, 5, 10, 10, 10]  # max depth per perk group 0-9
PERK_NAMES = ["Coin Value", "Shield Duration", "Coin Magnet", "Boost Distance",
              "Pickup Spawn", "Power Meter", "Save Me", "Head Start",
              "Score Multiplier", "Bolt Distance"]
POTION_TYPES = ["Mirage", "PhoenixWings", "Multimeter", "DemonMonkey", "TimeWarp"]

sessions: dict[str, dict[str, Any]] = {}

def _cleanup_sessions() -> None:
    """Evict expired sessions and enforce MAX_SESSIONS."""
    now = time.monotonic()
    expired = [k for k, v in sessions.items() if now - v.get("ts", 0) > SESSION_TTL]
    for k in expired:
        del sessions[k]
    if len(sessions) > MAX_SESSIONS:
        by_age = sorted(sessions, key=lambda k: sessions[k].get("ts", 0))
        for k in by_age[:len(sessions) - MAX_SESSIONS]:
            del sessions[k]

# ── Hash ──────────────────────────────────────────────────────────────────────
def compute_hash(obj: JsonObj, key: str = HASH_KEY, algo: str = HASH_ALGO) -> str:
    raw = json.dumps(obj, separators=(",", ":"), ensure_ascii=True).encode()
    kb = key.encode()
    match algo:
        case "md5_append":   return hashlib.md5(raw + kb).hexdigest()
        case "md5_prepend":  return hashlib.md5(kb + raw).hexdigest()
        case "hmac_md5":     return hmac_mod.new(kb, raw, hashlib.md5).hexdigest()
        case "hmac_sha256":  return hmac_mod.new(kb, raw, hashlib.sha256).hexdigest()[:32]
        case _: raise ValueError(f"Unknown algo: {algo}")


def fmt_ts(v: Any) -> str:
    if v == TS_SENTINEL: return "Unset"
    try: return datetime.fromtimestamp(float(v), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except Exception: return str(v)


# ── Config ────────────────────────────────────────────────────────────────────
class ConfigDB:
    # CIDs defined in the Unity asset bundle but missing from the text config's NDR.
    # Holiday (Cat 42/43): 292-301, Haunted Harvest (Cat 46/47/48): 312-326, Safari (Cat 49): 327-334
    BUNDLE_EXTRA_CIDS: set[int] = set(range(292, 302)) | set(range(312, 335))
    BUNDLE_CID_NAMES: dict[int, str] = {
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
    }

    # Known game item IDs (fallback when Config directory is missing)
    _KNOWN_PET_IDS: set[int] = set(range(1, 55))  # PIDs 1-54
    # 136 obtainable hat CIDs extracted from Config/gameConfig.txt (AttachmentData).
    # These are hats shown in the hats menu.  Character-specific built-in cosmetics
    # (Hair = CharId * 1000, e.g. 50000, 54000, 61000, 62000) are NOT included —
    # they belong to a separate system (CharacterPersonalAttachmentParentAssigner).
    _KNOWN_ATTACHMENT_IDS: set[int] = {
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 24, 25, 26, 27, 28, 31, 32, 33, 37, 41, 43, 44, 45, 47, 49, 50,
        51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 65, 67, 69, 71, 72,
        73, 74, 75, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91,
        92, 93, 94, 96, 97, 98, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
        110, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125,
        126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 141,
        142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157,
    }
    _KNOWN_ARTIFACT_PIDS: list[int] = list(range(51))  # PIDs 0-50 (config range)
    _KNOWN_POWER_PIDS: list[int] = list(range(7))  # PIDs 0-6
    _KNOWN_COLLECTABLE_IDS: set[int] = set(range(306)) | set(range(312, 335))  # 0-305 + 312-334

    def __init__(self, d: str):
        self.chars: dict[int, JsonObj] = {}
        self.pets: dict[int, JsonObj] = {}
        self.regions: dict[int, JsonObj] = {}
        self.attachments: dict[int, JsonObj] = {}
        self.artifacts: list[JsonObj] = []
        self.powers: list[JsonObj] = []
        self.objectives: list[JsonObj] = []
        self.challenges: JsonObj = {}
        self.collectables: dict[int, JsonObj] = {}  # CID → {CID, BN, active}
        self.individual_collectables: set[int] = set()  # individual item IDs from NDR (not categories)
        self.products: list[JsonObj] = []
        self._load(d)

    @classmethod
    def from_save_data(cls, save: JsonObj) -> "ConfigDB":
        """Build a fallback config from the save data when Config files are missing."""
        obj = object.__new__(cls)
        obj.challenges = {}
        obj.products = []

        data = save.get("data", {})
        p = data.get("Players", [{}])[0]

        # Characters: CharacterUnlockInfos has ALL character CIDs (even locked)
        cui = data.get("CharacterUnlockInfos", {})
        char_cids: set[int] = {int(k) for k in cui}
        # Also include any owned characters not in CUI
        for c in p.get("Characters", []):
            cid = c.get("CharId")
            if cid is not None:
                char_cids.add(int(cid))
        obj.chars = {cid: {"CID": cid, "DN": f"Character#{cid}"} for cid in char_cids}

        # Pets: known range + any owned
        pet_ids = set(cls._KNOWN_PET_IDS)
        for x in p.get("CharacterPets", []):
            pid = x.get("PetId")
            if pid is not None:
                pet_ids.add(int(pid))
        obj.pets = {pid: {"CID": pid, "DN": f"Pet#{pid}"} for pid in pet_ids}

        # Hats: 136 obtainable hats from gameConfig.txt + any extra owned in save
        att_ids = set(cls._KNOWN_ATTACHMENT_IDS)
        for x in p.get("CharacterAttachments", []):
            aid = x.get("AttachmentId")
            if aid is not None:
                att_ids.add(int(aid))
        obj.attachments = {aid: {"CID": aid, "DN": f"Hat#{aid}"} for aid in att_ids}

        # Artifacts: known config PIDs
        obj.artifacts = [{"PID": pid, "Title": f"Artifact#{pid}"} for pid in cls._KNOWN_ARTIFACT_PIDS]

        # Powers: known PIDs
        obj.powers = [{"PID": pid, "Title": f"Power#{pid}"} for pid in cls._KNOWN_POWER_PIDS]

        # Objectives: all 124 known PIDs (0-123) with estimated Points summing to MAX_PLAYER_LEVEL
        # Distribution: 86 objectives × 2pts + 38 objectives × 3pts = 172+114 = 286
        obj.objectives = [{"PID": pid, "Points": 2 if pid < 86 else 3} for pid in range(124)]

        # Regions: extract from save's RM data
        obj.regions = {}
        for r in p.get("RM", {}).get("RegSaveData", []):
            rid = r.get("ID")
            if rid is not None:
                obj.regions[int(rid)] = {"ID": rid, "DN": f"Region#{rid}"}

        # Collectables: known full set + bundle extras
        all_coll = set(cls._KNOWN_COLLECTABLE_IDS) | cls.BUNDLE_EXTRA_CIDS
        for x in p.get("CollectablesFound", []):
            cid = x.get("CollectableId") if isinstance(x, dict) else x
            if cid is not None:
                all_coll.add(int(cid))
        obj.collectables = {cid: {"CID": cid, "BN": f"Collectable#{cid}", "active": True} for cid in all_coll}
        obj.individual_collectables = set(all_coll) | cls.BUNDLE_EXTRA_CIDS

        return obj

    def merge_save_data(self, save: JsonObj) -> None:
        """Supplement this config with items found in the save data.

        Ensures items already present in the save are never stripped during
        export validation, even if the Config files are incomplete."""
        data = save.get("data", {})
        p = data.get("Players", [{}])[0]
        for x in p.get("CharacterAttachments", []):
            aid = x.get("AttachmentId")
            if aid is not None and int(aid) not in self.attachments:
                self.attachments[int(aid)] = {"CID": int(aid), "DN": f"Hat#{aid}"}
        for x in p.get("CharacterPets", []):
            pid = x.get("PetId")
            if pid is not None and int(pid) not in self.pets:
                self.pets[int(pid)] = {"CID": int(pid), "DN": f"Pet#{pid}"}
        for x in p.get("CollectablesFound", []):
            cid = x.get("CollectableId") if isinstance(x, dict) else x
            if cid is not None:
                ic = int(cid)
                if ic not in self.collectables:
                    self.collectables[ic] = {"CID": ic, "BN": f"Collectable#{ic}", "active": True}
                self.individual_collectables.add(ic)
        for pid in p.get("artifactsPurchased", []):
            if isinstance(pid, int) and not any(a.get("PID") == pid for a in self.artifacts):
                self.artifacts.append({"PID": pid, "Title": f"Artifact#{pid}"})
        cui = data.get("CharacterUnlockInfos", {})
        for k in cui:
            try:
                cid = int(k)
                if cid not in self.chars:
                    self.chars[cid] = {"CID": cid, "DN": f"Character#{cid}"}
            except (ValueError, TypeError):
                pass

    def _load(self, d: str) -> None:
        gc = os.path.join(d, "gameConfig.txt")
        cat_activity: JsonObj = {}
        if os.path.exists(gc):
            with open(gc, encoding="utf-8") as f:
                for line in f:
                    parts = line.strip().split(";", 2)
                    if len(parts) < 3: continue
                    t = parts[1].split("#")[0]
                    try: data: JsonObj = cast(JsonObj, json.loads(parts[2]))
                    except Exception: continue
                    if not isinstance(data, dict): continue
                    if t == "CharData":
                        cid: int = int(data.get("CID", -1))
                        if cid != -1: self.chars[cid] = data
                    elif t == "PetData":
                        cid = int(data.get("CID", -1))
                        if cid != -1: self.pets[cid] = data
                    elif t == "RegInfo":
                        bi = data.get("BI", {})
                        rid = int(bi.get("ID", -1))
                        if rid != -1:
                            self.regions.setdefault(rid, {}).update(bi)
                    elif t == "RegDisplayInfo":
                        rid = int(data.get("ID", -1))
                        if rid != -1:
                            self.regions.setdefault(rid, {}).update(data)
                    elif t == "AttachmentData":
                        cid = int(data.get("CID", -1))
                        if cid != -1: self.attachments[cid] = data
                    elif t == "CollectablesCategoryInfo":
                        cid = int(data.get("CID", -1))
                        if cid != -1: self.collectables[cid] = {"CID": cid, "BN": data.get("BN", f"Category#{cid}"), "active": True}
                    elif t == "CollectablesCategoryActivity":
                        cat_activity = data
                    elif t == "CollectablesIndividual":
                        ndr = data.get("NDR", {})
                        self.individual_collectables = {int(k) for k in ndr}
                        self.individual_collectables |= self.BUNDLE_EXTRA_CIDS
                    elif t == "ProductData":
                        self.products.append(data)
            # Apply activity flags after all categories are loaded
            for k, v in cat_activity.items():
                try:
                    cat_id = int(k)
                    if cat_id in self.collectables:
                        self.collectables[cat_id]["active"] = bool(v)
                except (ValueError, TypeError):
                    pass
        configs: list[tuple[str, str, str | None]] = [
            ("Artifacts.txt", "artifacts", "list"),
            ("Powers.txt", "powers", None),
            ("Objectives.txt", "objectives", None),
            ("Challenges.txt", "challenges", None),
        ]
        for fname, attr, key in configs:
            fp = os.path.join(d, fname)
            if not os.path.exists(fp): continue
            try:
                with open(fp, encoding="utf-8") as f:
                    raw: JsonObj = cast(JsonObj, json.load(f).get("data", {}))
            except Exception: continue
            if key:
                setattr(self, attr, raw.get(key, []) if isinstance(raw, dict) else [])
            else:
                setattr(self, attr, raw if isinstance(raw, (list, dict)) else [])

    def char_name(self, cid: int) -> str:
        c = self.chars.get(cid)
        return str(c.get("DN", f"Character#{cid}")) if c else f"Character#{cid}"
    def pet_name(self, pid: int) -> str:
        p = self.pets.get(pid)
        return str(p.get("DN", f"Pet#{pid}")) if p else f"Pet#{pid}"
    def region_name(self, rid: int) -> str:
        r = self.regions.get(rid)
        return str(r.get("DN", r.get("N", f"Region#{rid}"))) if r else f"Region#{rid}"
    def artifact_name(self, pid: int) -> str:
        for a in self.artifacts:
            if a.get("PID") == pid: return str(a.get("Title", f"Artifact#{pid}"))
        return f"Artifact#{pid}"
    def power_name(self, pid: int) -> str:
        for p in self.powers:
            if p.get("PID") == pid: return str(p.get("Title", f"Power#{pid}"))
        return f"Power#{pid}"
    def att_name(self, aid: int) -> str:
        a = self.attachments.get(aid)
        return str(a.get("DN", f"Hat#{aid}")) if a else f"Hat#{aid}"
    def collectable_name(self, cid: int) -> str:
        c = self.collectables.get(cid)
        if c: return str(c.get("BN", f"Collectable#{cid}"))
        if cid in self.BUNDLE_CID_NAMES: return self.BUNDLE_CID_NAMES[cid]
        if cid in self.individual_collectables: return f"Item #{cid}"
        return f"Collectable#{cid}"

    def char_unlock_type(self, cid: int) -> str:
        c = self.chars.get(cid)
        if not c: return "Unknown"
        ct = str(c.get("PCT", c.get("CT", "")))
        return {"Free": "Free", "Coin": "Coins", "Special": "Gems", "RealMoney": "IAP",
                "Token": "Token", "Totem": "Totem", "Scroll": "Scroll", "Ad": "Ad"}.get(ct, ct)

    def product_name(self, pid: str) -> str:
        for p in self.products:
            if p.get("PID") == pid: return str(p.get("DN", p.get("N", pid)))
        return str(pid)


# ── Editor ────────────────────────────────────────────────────────────────────
class SaveEditor:
    def __init__(self, save: JsonObj, cfg: ConfigDB | None):
        self.original: JsonObj = copy.deepcopy(save)
        self.working: JsonObj = copy.deepcopy(save)
        self.cfg = cfg
        self.log: list[JsonObj] = []
        self.mode = "inspect"

    def _valid_artifact_id(self, pid: int) -> bool:
        if not self.cfg: return True
        if pid in EXTRA_ARTIFACT_PIDS: return True
        return any(a.get("PID") == pid for a in self.cfg.artifacts)

    def _valid_attachment_id(self, aid: int) -> bool:
        if not self.cfg: return True
        return aid in self.cfg.attachments

    @staticmethod
    def _is_char_specific_hair(char: JsonObj) -> bool:
        """True if the character's Hair is a built-in cosmetic (Hair == CharId * 1000)."""
        hair = char.get("Attachments", {}).get("Hair")
        return hair is not None and hair == char.get("CharId", -1) * 1000

    def set_mode(self, m: str) -> None:
        if m not in ("inspect", "cosmetic", "experimental"): raise ValueError(m)
        self.mode = m

    def p(self) -> JsonObj:
        return self.working["data"]["Players"][0]  # type: ignore[no-any-return]
    def d(self) -> JsonObj:
        return self.working["data"]  # type: ignore[no-any-return]

    def _log(self, a: str, det: str, risk: str) -> None:
        self.log.append({"action": a, "detail": det, "risk": risk, "mode": self.mode})

    def _chk(self, exp: bool = False) -> str | None:  # noqa: FBT001,FBT002
        if self.mode == "inspect": return "ERROR: Switch mode first."
        if exp and self.mode != "experimental": return "ERROR: Needs Experimental mode."
        return None

    # ── Currency ──
    def set_coins(self, v: int) -> str:
        if e := self._chk(True): return e
        if v < 0 or v > SAFE_MAX: return f"ERROR: Value out of range (0..{SAFE_MAX})."
        p = self.p(); old = p.get("coinCount", 0); p["coinCount"] = v
        extra = ""
        if v > p.get("LCC", 0):
            old_lcc = p.get("LCC", 0); p["LCC"] = v
            extra = f" (LCC auto-adjusted: {old_lcc} → {v})"
            self._log("auto_set_lcc", f"{old_lcc}→{v}", "HIGH")
        self._log("set_coins", f"{old}→{v}", "MED"); return f"Coins: {old} → {v}{extra}"

    def set_gems(self, v: int) -> str:
        if e := self._chk(True): return e
        if v < 0 or v > SAFE_MAX: return f"ERROR: Value out of range (0..{SAFE_MAX})."
        p = self.p(); old = p.get("specialCurrencyCount", 0); p["specialCurrencyCount"] = v
        extra = ""
        if v > p.get("LSCC", 0):
            old_lscc = p.get("LSCC", 0); p["LSCC"] = v
            extra = f" (LSCC auto-adjusted: {old_lscc} → {v})"
            self._log("auto_set_lscc", f"{old_lscc}→{v}", "HIGH")
        self._log("set_gems", f"{old}→{v}", "MED"); return f"Gems: {old} → {v}{extra}"

    def set_scrolls(self, v: int) -> str:
        if e := self._chk(True): return e
        if v < 0 or v > SAFE_MAX: return f"ERROR: Value out of range (0..{SAFE_MAX})."
        p = self.p(); old = p.get("scrollCount", 0); p["scrollCount"] = v
        self._log("set_scrolls", f"{old}→{v}", "MED"); return f"Scrolls: {old} → {v}"

    def set_keys(self, v: int) -> str:
        if e := self._chk(True): return e
        if v < 0 or v > SAFE_MAX: return f"ERROR: Value out of range (0..{SAFE_MAX})."
        p = self.p(); old = p.get("minigameTicketCount", 0); p["minigameTicketCount"] = v
        self._log("set_keys", f"{old}→{v}", "MED"); return f"Keys: {old} → {v}"

    def set_lcc(self, v: int) -> str:
        if e := self._chk(True): return e
        if v < 0 or v > SAFE_MAX: return f"ERROR: Value out of range (0..{SAFE_MAX})."
        p = self.p(); old = p.get("LCC", 0); p["LCC"] = v
        extra = ""
        if v < p.get("coinCount", 0):
            old_coins = p.get("coinCount", 0); p["coinCount"] = v
            extra = f" (Coins auto-adjusted: {old_coins} → {v})"
            self._log("auto_set_coins", f"{old_coins}→{v}", "MED")
        self._log("set_lcc", f"{old}→{v}", "HIGH"); return f"LCC: {old} → {v}{extra}"

    def set_lscc(self, v: int) -> str:
        if e := self._chk(True): return e
        if v < 0 or v > SAFE_MAX: return f"ERROR: Value out of range (0..{SAFE_MAX})."
        p = self.p(); old = p.get("LSCC", 0); p["LSCC"] = v
        extra = ""
        if v < p.get("specialCurrencyCount", 0):
            old_gems = p.get("specialCurrencyCount", 0); p["specialCurrencyCount"] = v
            extra = f" (Gems auto-adjusted: {old_gems} → {v})"
            self._log("auto_set_gems", f"{old_gems}→{v}", "MED")
        self._log("set_lscc", f"{old}→{v}", "HIGH"); return f"LSCC: {old} → {v}{extra}"

    def set_multiplier(self, v: float) -> str:
        if e := self._chk(True): return e
        if v < 0.1 or v > 500: return "ERROR: Multiplier out of range (0.1..500)."
        p = self.p(); old = p.get("SBC", 1.0); p["SBC"] = float(v)
        self._log("set_mult", f"{old}→{v}", "MED"); return f"Multiplier: {old} → {float(v)}"

    # ── Characters ──
    def set_active(self, cid: int) -> str:
        if e := self._chk(): return e
        p = self.p(); owned = [c.get("CharId") for c in p.get("Characters", [])]
        if cid not in owned: return f"ERROR: Character {cid} not owned."
        old = p.get("activePlayerCharacter"); p["activePlayerCharacter"] = cid
        nm = self.cfg.char_name(cid) if self.cfg else str(cid)
        self._log("set_active", f"{old}→{cid}", "LOW"); return f"Active: {nm}"

    def set_skin(self, cid: int, skin: int) -> str:
        if e := self._chk(): return e
        p = self.p()
        for c in p.get("Characters", []):
            if c.get("CharId") == cid:
                c["SkinId"] = skin
                self._log("set_skin", f"CID{cid} skin={skin}", "LOW")
                return f"Skin set to {skin}"
        return f"ERROR: Character {cid} not owned."

    def set_power(self, cid: int, pid: int) -> str:
        if e := self._chk(): return e
        p = self.p()
        for c in p.get("Characters", []):
            if c.get("CharId") == cid:
                c["PowerId"] = pid
                self._log("set_power", f"CID{cid} power={pid}", "LOW")
                return "Power set"
        return f"ERROR: Character {cid} not owned."

    def unlock_char(self, cid: int) -> str:
        if e := self._chk(True): return e
        p = self.p()
        if cid in [c.get("CharId") for c in p.get("Characters", [])]:
            return "Already owned."
        entry: JsonObj = OrderedDict([("Version", 1), ("CharId", cid), ("SkinId", 0), ("PowerId", 2)])
        p.setdefault("Characters", []).append(entry)
        nm = self.cfg.char_name(cid) if self.cfg else str(cid)
        self._log("unlock_char", f"{cid} ({nm})", "HIGH"); return f"Unlocked {nm}"

    def unlock_all_chars(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); existing = {c.get("CharId") for c in p.get("Characters", [])}
        # Add characters from CharacterUnlockInfos (game's canonical character list)
        all_cids: set[int] = set()
        cui = self.d().get("CharacterUnlockInfos", {})
        if cui is None: cui = {}
        for k in cui:
            try: all_cids.add(int(k))
            except (ValueError, TypeError): pass
        if self.cfg:
            all_cids |= set(self.cfg.chars.keys())
        n = 0
        for cid in sorted(all_cids - existing):
            entry: JsonObj = OrderedDict([("Version", 1), ("CharId", cid), ("SkinId", 0), ("PowerId", 2)])
            p.setdefault("Characters", []).append(entry)
            n += 1
        # Ensure CharacterUnlockInfos has entries for ALL characters (existing + new)
        for cid in sorted(all_cids | existing):
            k = str(cid)
            if k not in cui:
                cui[k] = [OrderedDict([("IA", False), ("CT", "Free"), ("C", 0), ("OS", False),
                    ("SC", 0), ("SCT", "Coin"), ("SSD", "1/1/0001 12:00:00 AM"),
                    ("STD", "1/1/0001 12:00:00 AM"), ("SED", "1/1/0001 12:00:00 AM"),
                    ("IL", False), ("ADL", False), ("LSD", "1/1/0001 12:00:00 AM"),
                    ("LTD", "1/1/0001 12:00:00 AM"), ("LED", "1/1/0001 12:00:00 AM"), ("NHEN", 0)])]
        self.d()["CharacterUnlockInfos"] = cui
        # Grant tokens for token-gated characters
        uctkn = p.get("UCTKN", {}); nt = 0
        for cid in all_cids:
            cd = self.cfg.chars.get(cid, {}) if self.cfg else {}
            ct = str(cd.get("PCT", cd.get("CT", "")))
            if ct == "Token":
                k = str(cid)
                cur = uctkn.get(k, 0)
                if cur < 999:
                    uctkn[k] = 999; nt += 1
        if nt: p["UCTKN"] = uctkn
        extra = ""
        if nt: extra = f" (+{nt} token entries)"
        self._log("unlock_all_chars", f"{n} added{extra}", "HIGH"); return f"Unlocked {n} characters{extra}"

    def remove_char(self, cid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); chars = p.get("Characters", [])
        if cid == p.get("activePlayerCharacter"): return "ERROR: Cannot remove active character."
        before = len(chars)
        p["Characters"] = [c for c in chars if c.get("CharId") != cid]
        if len(p["Characters"]) == before: return f"ERROR: Character {cid} not owned."
        nm = self.cfg.char_name(cid) if self.cfg else str(cid)
        self._log("remove_char", f"{cid} ({nm})", "HIGH"); return f"Removed {nm}"

    def remove_all_chars(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); active = p.get("activePlayerCharacter"); chars = p.get("Characters", [])
        kept = [c for c in chars if c.get("CharId") == active]
        n = len(chars) - len(kept); p["Characters"] = kept
        self._log("remove_all_chars", f"-{n}", "HIGH"); return f"Removed {n} characters (kept active)"

    # ── Pets ──
    def unlock_pet(self, pid: int) -> str:
        if e := self._chk(True): return e
        p = self.p()
        if pid in [x.get("PetId") for x in p.get("CharacterPets", [])]: return "Already owned."
        p.setdefault("CharacterPets", []).append(OrderedDict([("Version", 1), ("PetId", pid), ("NewPet", False)]))
        nm = self.cfg.pet_name(pid) if self.cfg else str(pid)
        self._log("unlock_pet", f"{pid} ({nm})", "HIGH"); return f"Unlocked {nm}"

    def unlock_all_pets(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); existing = {x.get("PetId") for x in p.get("CharacterPets", [])}
        all_pids: set[int] = set()
        if self.cfg: all_pids = set(self.cfg.pets.keys())
        n = 0
        for pid in sorted(all_pids - existing):
            p.setdefault("CharacterPets", []).append(OrderedDict([("Version", 1), ("PetId", pid), ("NewPet", False)]))
            n += 1
        self._log("unlock_all_pets", f"{n}", "HIGH"); return f"Unlocked {n} pets"

    def remove_pet(self, pid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); pets = p.get("CharacterPets", []); before = len(pets)
        p["CharacterPets"] = [x for x in pets if x.get("PetId") != pid]
        if len(p["CharacterPets"]) == before: return f"ERROR: Pet {pid} not owned."
        nm = self.cfg.pet_name(pid) if self.cfg else str(pid)
        self._log("remove_pet", f"{pid} ({nm})", "HIGH"); return f"Removed {nm}"

    def remove_all_pets(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); n = len(p.get("CharacterPets", []))
        p["CharacterPets"] = []
        self._log("remove_all_pets", f"-{n}", "HIGH"); return f"Removed {n} pets"

    # ── Hats (136 obtainable accessories from gameConfig.txt AttachmentData) ──
    # Save format: CharacterAttachments = [{Version:1, AttachmentId:N, NewAttachment:false}, ...]
    # Equipped: Characters[].Attachments.Hair = attachment CID
    # Character-specific cosmetics (Hair = CharId*1000) are a separate system — NOT managed here.

    def equip_hat(self, cid: int, hat: int) -> str:
        if e := self._chk(): return e
        if not self._valid_attachment_id(hat):
            return f"ERROR: Hat {hat} not found in config."
        p = self.p()
        for c in p.get("Characters", []):
            if c.get("CharId") == cid:
                c.setdefault("Attachments", {})["Hair"] = hat
                ca = p.get("CharacterAttachments", [])
                if hat not in {e.get("AttachmentId") for e in ca if isinstance(e, dict)}:
                    ca.append(OrderedDict([("Version", 1), ("AttachmentId", hat), ("NewAttachment", False)]))
                    p["CharacterAttachments"] = ca
                nm = self.cfg.att_name(hat) if self.cfg else str(hat)
                self._log("equip_hat", f"CID{cid}→{hat}", "LOW"); return f"Equipped {nm}"
        return f"ERROR: Character {cid} not found."

    def remove_hat(self, cid: int) -> str:
        if e := self._chk(): return e
        for c in self.p().get("Characters", []):
            if c.get("CharId") == cid:
                if self._is_char_specific_hair(c):
                    return "Cannot remove built-in character cosmetic."
                att = c.get("Attachments", {})
                if "Hair" in att: del att["Hair"]
                if not att and "Attachments" in c: del c["Attachments"]
                self._log("remove_hat", f"CID{cid}", "LOW"); return "Hat removed"
        return f"ERROR: Character {cid} not found."

    def unlock_hat(self, hat_id: int, char_id: int | None = None) -> str:
        if e := self._chk(): return e
        if not self._valid_attachment_id(hat_id):
            return f"ERROR: Hat {hat_id} not found in config."
        p = self.p(); ca = p.get("CharacterAttachments", [])
        if hat_id in {e.get("AttachmentId") for e in ca if isinstance(e, dict)}:
            return "Already owned."
        ca.append(OrderedDict([("Version", 1), ("AttachmentId", hat_id), ("NewAttachment", False)]))
        p["CharacterAttachments"] = ca
        nm = self.cfg.att_name(hat_id) if self.cfg else str(hat_id)
        self._log("unlock_hat", f"{hat_id}", "LOW"); return f"Unlocked {nm}"

    def unlock_all_hats(self) -> str:
        if e := self._chk(): return e
        if not self.cfg: return "ERROR: No config loaded."
        p = self.p(); ca = p.get("CharacterAttachments", [])
        existing = {e.get("AttachmentId") for e in ca if isinstance(e, dict)}
        n = 0
        for aid in sorted(self.cfg.attachments):
            if aid not in existing:
                ca.append(OrderedDict([("Version", 1), ("AttachmentId", aid), ("NewAttachment", False)]))
                n += 1
        p["CharacterAttachments"] = ca
        self._log("unlock_all_hats", f"+{n}", "HIGH"); return f"Unlocked {n} hats (total: {len(ca)})"

    def unlock_hat_batch(self, batch_size: int = 5) -> str:
        if e := self._chk(): return e
        if not self.cfg: return "ERROR: No config loaded."
        batch_size = max(1, min(batch_size, 136))
        p = self.p(); ca = p.get("CharacterAttachments", [])
        existing = {e.get("AttachmentId") for e in ca if isinstance(e, dict)}
        not_owned = sorted(aid for aid in self.cfg.attachments if aid not in existing)
        if not not_owned:
            return f"All {len(self.cfg.attachments)} hats already unlocked!"
        batch = not_owned[:batch_size]
        for aid in batch:
            ca.append(OrderedDict([("Version", 1), ("AttachmentId", aid), ("NewAttachment", False)]))
        p["CharacterAttachments"] = ca
        remaining = len(not_owned) - len(batch)
        names = ", ".join(self.cfg.att_name(a) for a in batch[:3])
        if len(batch) > 3: names += f" +{len(batch)-3} more"
        self._log("unlock_hat_batch", f"+{len(batch)}", "LOW")
        return f"Unlocked {len(batch)} hats ({names}). {remaining} remaining. Load the game and open the hats menu to download their bundles before unlocking more."

    def remove_hat_ownership(self, hat_id: int) -> str:
        if e := self._chk(): return e
        p = self.p(); ca = p.get("CharacterAttachments", [])
        removed = False
        before = len(ca)
        ca = [e for e in ca if e.get("AttachmentId") != hat_id]
        if len(ca) < before: p["CharacterAttachments"] = ca; removed = True
        for c in p.get("Characters", []):
            att = c.get("Attachments", {})
            if att.get("Hair") == hat_id:
                if self._is_char_specific_hair(c):
                    continue  # preserve built-in character cosmetics
                del att["Hair"]; removed = True
                if not att and "Attachments" in c: del c["Attachments"]
        if not removed: return f"ERROR: Hat {hat_id} not owned."
        nm = self.cfg.att_name(hat_id) if self.cfg else str(hat_id)
        self._log("remove_hat_own", f"{hat_id}", "LOW"); return f"Removed {nm}"

    def remove_all_hats(self) -> str:
        if e := self._chk(): return e
        n = 0
        for c in self.p().get("Characters", []):
            if self._is_char_specific_hair(c):
                continue  # preserve built-in character cosmetics
            att = c.get("Attachments", {})
            if "Hair" in att: del att["Hair"]; n += 1
            if not att and "Attachments" in c: del c["Attachments"]
        p = self.p(); n2 = len(p.get("CharacterAttachments", []))
        p["CharacterAttachments"] = []
        self._log("remove_all_hats", f"-{n} unequipped, -{n2} unlocked", "LOW"); return f"Removed {n} equipped + {n2} owned hats"

    # ── Collectables ──
    def unlock_collectable(self, cid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); cf = p.get("CollectablesFound", [])
        if cid in {e.get("CollectableId") for e in cf}: return "Already redeemed."
        cf.append(OrderedDict([("CollectableId", cid), ("NumFound", 1), ("NumRewarded", 1), ("FoundState", "CollectFound_FoundNotViewed")]))
        p["CollectablesFound"] = cf
        nm = self.cfg.collectable_name(cid) if self.cfg else str(cid)
        self._log("unlock_collect", f"{cid}", "HIGH"); return f"Redeemed {nm}"

    def unlock_all_collectables(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); cf = p.get("CollectablesFound", [])
        existing = {e.get("CollectableId") for e in cf if isinstance(e, dict)}
        # Fix existing entries with NumRewarded=0
        nfix = 0
        for entry in cf:
            if entry.get("NumRewarded", 0) < 1:
                entry["NumRewarded"] = 1; entry["NumFound"] = max(entry.get("NumFound", 0), 1); nfix += 1
        # Add new collectables from config
        all_ids: set[int] = set()
        if self.cfg:
            all_ids = set(self.cfg.collectables.keys()) | self.cfg.individual_collectables
        n = 0
        for cid in sorted(all_ids - existing):
            cf.append(OrderedDict([("CollectableId", cid), ("NumFound", 1), ("NumRewarded", 1), ("FoundState", "CollectFound_FoundNotViewed")]))
            n += 1
        p["CollectablesFound"] = cf
        self._log("unlock_all_collect", f"+{n} new, {nfix} fixed", "HIGH"); return f"Unlocked {n} collectables, fixed {nfix}"

    def lock_collectable(self, cid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); cf = p.get("CollectablesFound", [])
        before = len(cf)
        cf = [e for e in cf if e.get("CollectableId") != cid]
        if len(cf) == before: return f"ERROR: Collectable {cid} not redeemed."
        p["CollectablesFound"] = cf
        nm = self.cfg.collectable_name(cid) if self.cfg else str(cid)
        self._log("lock_collect", f"{cid}", "HIGH"); return f"Locked {nm}"

    def lock_all_collectables(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); n = len(p.get("CollectablesFound", []))
        p["CollectablesFound"] = []
        self._log("lock_all_collect", f"-{n}", "HIGH"); return f"Locked {n} collectables"

    # ── Artifacts ──
    def unlock_artifact(self, pid: int) -> str:
        if e := self._chk(True): return e
        if pid in DEPRECATED_ARTIFACT_PIDS:
            return f"ERROR: Artifact {pid} is deprecated by the game."
        if not self._valid_artifact_id(pid):
            return f"ERROR: Artifact {pid} not found in config."
        p = self.p(); lst = p.get("artifactsPurchased", [])
        if pid in lst: return "Already owned."
        lst.append(pid); p["artifactsPurchased"] = lst
        nm = self.cfg.artifact_name(pid) if self.cfg else str(pid)
        self._log("unlock_art", f"{pid}", "HIGH"); return f"Unlocked {nm}"

    def unlock_all_artifacts(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); lst = p.get("artifactsPurchased", [])
        existing = set(lst)
        all_pids: set[int] = set()
        if self.cfg:
            all_pids = {a["PID"] for a in self.cfg.artifacts if a.get("PID") is not None}
        all_pids |= EXTRA_ARTIFACT_PIDS
        all_pids -= DEPRECATED_ARTIFACT_PIDS
        n = 0
        for pid in sorted(all_pids - existing):
            lst.append(pid); n += 1
        p["artifactsPurchased"] = lst
        self._log("unlock_all_arts", f"{n}", "HIGH"); return f"Unlocked {n} artifacts"

    def remove_artifact(self, pid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); lst = p.get("artifactsPurchased", [])
        if pid not in lst: return f"ERROR: Artifact {pid} not owned."
        lst.remove(pid); p["artifactsPurchased"] = lst
        nm = self.cfg.artifact_name(pid) if self.cfg else str(pid)
        self._log("remove_art", f"{pid}", "HIGH"); return f"Removed {nm}"

    def remove_all_artifacts(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); n = len(p.get("artifactsPurchased", []))
        p["artifactsPurchased"] = []
        self._log("remove_all_arts", f"-{n}", "HIGH"); return f"Removed {n} artifacts"

    # ── Powers ──
    def unlock_power(self, pid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); lst = p.get("powersPurchased", [])
        if pid in lst: return "Already owned."
        lst.append(pid); p["powersPurchased"] = lst
        nm = self.cfg.power_name(pid) if self.cfg else str(pid)
        self._log("unlock_pow", f"{pid}", "HIGH"); return f"Unlocked {nm}"

    def unlock_all_powers(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); lst = p.get("powersPurchased", [])
        existing = set(lst)
        all_pids: set[int] = set()
        if self.cfg:
            all_pids = {pw["PID"] for pw in self.cfg.powers if pw.get("PID") is not None}
        n = 0
        for pid in sorted(all_pids - existing):
            lst.append(pid); n += 1
        p["powersPurchased"] = lst
        self._log("unlock_all_pows", f"{n}", "HIGH"); return f"Unlocked {n} powers"

    def remove_power(self, pid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); lst = p.get("powersPurchased", [])
        if pid not in lst: return f"ERROR: Power {pid} not owned."
        lst.remove(pid); p["powersPurchased"] = lst
        nm = self.cfg.power_name(pid) if self.cfg else str(pid)
        self._log("remove_pow", f"{pid}", "HIGH"); return f"Removed {nm}"

    def remove_all_powers(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); n = len(p.get("powersPurchased", []))
        p["powersPurchased"] = []
        self._log("remove_all_pows", f"-{n}", "HIGH"); return f"Removed {n} powers"

    def max_power_levels(self) -> str:
        return "Power upgrade levels are server-managed and cannot be set via save editing."

    # ── Regions ──
    def purchase_region(self, rid: int) -> str:
        if e := self._chk(True): return e
        for r in self.p().get("RM", {}).get("RegSaveData", []):
            if r.get("ID") == rid:
                if r.get("P"): return "Already purchased."
                r["P"] = True; r["DLAS"] = True
                nm = self.cfg.region_name(rid) if self.cfg else str(rid)
                self._log("purch_reg", f"{rid}", "HIGH"); return f"Purchased {nm}"
        return f"ERROR: Region {rid} not in save."

    def purchase_all_regions(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); rm = p.setdefault("RM", {}); rsd = rm.get("RegSaveData", [])
        existing = {r.get("ID") for r in rsd}
        n = 0
        # Purchase existing unpurchased regions
        for r in rsd:
            if not r.get("P"): r["P"] = True; r["DLAS"] = True; n += 1
        # Add missing regions from config
        if self.cfg:
            for rid in sorted(set(self.cfg.regions.keys()) - existing):
                rsd.append(OrderedDict([("ID", rid), ("P", True), ("DLAS", True)]))
                n += 1
        rm["RegSaveData"] = rsd; p["RM"] = rm
        self._log("purch_all_reg", f"+{n}", "HIGH"); return f"Purchased {n} regions"

    def unpurchase_region(self, rid: int) -> str:
        if e := self._chk(True): return e
        for r in self.p().get("RM", {}).get("RegSaveData", []):
            if r.get("ID") == rid:
                if not r.get("P"): return "Already not purchased."
                r["P"] = False
                nm = self.cfg.region_name(rid) if self.cfg else str(rid)
                self._log("unpurch_reg", f"{rid}", "HIGH"); return f"Unpurchased {nm}"
        return f"ERROR: Region {rid} not in save."

    def unpurchase_all_regions(self) -> str:
        if e := self._chk(True): return e
        n = 0
        for r in self.p().get("RM", {}).get("RegSaveData", []):
            if r.get("P"): r["P"] = False; n += 1
        self._log("unpurch_all_reg", f"-{n}", "HIGH"); return f"Unpurchased {n} regions"

    # ── Objectives ──
    def complete_all_objectives(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); done = set(p.get("objectives", []))
        all_pids: set[int] = set()
        if self.cfg:
            all_pids = {o["PID"] for o in self.cfg.objectives if o.get("PID") is not None}
        n = 0
        for pid in sorted(all_pids - done):
            done.add(pid); n += 1
        p["objectives"] = sorted(done)
        if "objectivesActiveData" in p: p["objectivesActiveData"] = []
        self._log("complete_objs", f"+{n}", "HIGH"); return f"Completed {n} objectives ({len(done)} total)"

    def uncomplete_objective(self, pid: int) -> str:
        if e := self._chk(True): return e
        p = self.p(); lst = p.get("objectives", [])
        if pid not in lst: return f"ERROR: Objective {pid} not completed."
        lst.remove(pid); p["objectives"] = lst
        self._log("uncomplete_obj", f"{pid}", "HIGH"); return f"Uncompleted objective {pid}"

    def uncomplete_all_objectives(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); n = len(p.get("objectives", []))
        p["objectives"] = []
        if "objectivesActiveData" in p: p["objectivesActiveData"] = []
        self._log("uncomplete_all_objs", f"-{n}", "HIGH"); return f"Uncompleted {n} objectives"

    # ── Battle Pass ──
    def complete_battle_pass(self) -> str:
        if e := self._chk(True): return e
        p = self.p()
        # Minimum 150 runs required for temple pass / battle pass access
        gs = p.setdefault("gameStats", {}); stats = gs.setdefault("LS", {}).setdefault("Stats", {})
        truns = stats.get("TRUNS", 0); runs_adjusted = False
        if truns < 150:
            stats["TRUNS"] = 150; runs_adjusted = True
        bppdm = p.get("BPPDM", {}); bp_list = bppdm.get("BPPPD", [])
        if not bp_list: return "No active battle pass."
        bp = bp_list[0]; bp_id = bp.get("BPIDK")
        tiers = bp.get("BPCDK", {}).get("BPTR", [])
        if not tiers: return "No tiers."
        # Get max TTV (XP threshold) for progress bar
        max_ttv = 0
        for t in tiers:
            ttv = t.get("TTV", 0)
            if ttv > max_ttv: max_ttv = ttv
        # Build BPTPLK tier progress list from tier data
        tp_list = bp.get("BPTPLK", [])
        existing_tids = {tp.get("BPTIK") for tp in tp_list}
        for t in tiers:
            tid = t.get("TTID")
            if tid not in existing_tids:
                tp_list.append(OrderedDict([
                    ("BPTIK", tid), ("BPTUK", True), ("BPTRK", False),
                    ("BPTCDK", copy.deepcopy(t))
                ]))
        # Mark all tiers as unlocked
        for tp in tp_list:
            tp["BPTUK"] = True
            tp["BPTRK"] = False
        bp["BPTPLK"] = tp_list
        # Update BPCDDM: expand UnlockedTiers, clear ClaimedTiers
        num_tiers = len(tiers)
        bpcddm = p.get("BPCDDM") or []
        found_bp = False
        for entry in bpcddm:
            if isinstance(entry, dict) and entry.get("BPID", bp_id) == bp_id:
                entry["UnlockedTiers"] = list(range(1, num_tiers + 1))
                entry["ClaimedTiers"] = []
                found_bp = True; break
        if not found_bp:
            bpcddm.append(OrderedDict([("BPID", bp_id),
                ("UnlockedTiers", list(range(1, num_tiers + 1))), ("ClaimedTiers", [])]))
        p["BPCDDM"] = bpcddm
        # Ensure premium pass is bought and selected
        bp["BPBPSK"] = True
        bp["BPSELK"] = True
        # Set total score stat high enough to fill the progress bar
        ts_stat = stats.get("TS", 0)
        if ts_stat < max_ttv:
            stats["TS"] = max(ts_stat, max_ttv)
        msg = f"Battle pass completed ({num_tiers} tiers unlocked)"
        if runs_adjusted:
            msg += f" | Total runs auto-adjusted from {truns} to 150"
        self._log("complete_bp", f"{len(tp_list)} tiers" + (f" (runs {truns}→150)" if runs_adjusted else ""), "HIGH"); return msg

    def reset_battle_pass(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); bp_list = p.get("BPPDM", {}).get("BPPPD", [])
        if not bp_list: return "No active battle pass."
        bp = bp_list[0]; bp_id = bp.get("BPIDK")
        bp["BPTPLK"] = []
        self._log("reset_bp", "Reset all tiers", "HIGH"); return "Battle pass reset"

    # ── Daily Challenges ──
    def complete_daily_challenges(self) -> str:
        return "Daily challenges are refreshed by the server each session. Changes will not persist."

    def reset_daily_challenges(self) -> str:
        return "Daily challenges are refreshed by the server each session. Changes will not persist."

    # ── HRFL ──
    def set_hrfl(self, v: bool) -> str:
        if e := self._chk(True): return e
        old = self.d().get("HRFL"); self.d()["HRFL"] = v
        self._log("set_hrfl", f"{old}→{v}", "HIGH"); return f"HRFL: {old} → {v}"

    # ── Field ──
    def set_field(self, key: str, val: Any) -> str:
        if e := self._chk(True): return e
        if key in SENSITIVE: return f"ERROR: '{key}' is IAP-sensitive."
        self.p()[key] = val; self._log("set_field", key, "HIGH"); return f"{key} updated"

    def set_data_field(self, key: str, val: Any) -> str:
        if e := self._chk(True): return e
        self.d()[key] = val; self._log("set_data_field", key, "HIGH"); return f"{key} updated"

    # ── Perks ──
    def max_perks(self) -> str:
        return "Perk upgrades are server-managed and cannot be set via save editing."

    def reset_perks(self) -> str:
        return "Perk upgrades are server-managed and cannot be set via save editing."

    def set_perk(self, idx: int, val: int) -> str:
        return "Perk upgrades are server-managed and cannot be set via save editing."

    # ── Potions ──
    def max_potions(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); pots = p.get("PotionsAvailableData", [])
        existing_types = {pt.get("Type") for pt in pots}
        for pt in pots: pt["Count"] = 999
        for t in POTION_TYPES:
            if t not in existing_types:
                pots.append(OrderedDict([("Count", 999), ("Type", t)]))
        p["PotionsAvailableData"] = pots
        self._log("max_potions", f"{len(pots)} potions set to 999", "HIGH"); return f"Set {len(pots)} potions to 999"

    def reset_potions(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); pots = p.get("PotionsAvailableData", [])
        for pt in pots: pt["Count"] = 0
        self._log("reset_potions", "All potions reset", "HIGH"); return "All potions reset"

    def set_potion(self, ptype: str, count: int) -> str:
        if e := self._chk(True): return e
        if count < 0 or count > SAFE_MAX: return "ERROR: Value out of range."
        p = self.p(); pots = p.get("PotionsAvailableData", [])
        for pt in pots:
            if pt.get("Type") == ptype:
                old = pt["Count"]; pt["Count"] = count
                self._log("set_potion", f"{ptype}: {old}→{count}", "HIGH"); return f"{ptype}: {old} → {count}"
        pots.append({"Count": count, "Type": ptype}); p["PotionsAvailableData"] = pots
        self._log("set_potion", f"{ptype}: 0→{count}", "HIGH"); return f"{ptype}: 0 → {count}"

    # ── Daily Totems ──
    TOTEM_NAMES: list[str] = ["Emerald", "Copper", "Gold", "Silver", "Ruby"]

    def complete_daily_totems(self) -> str:
        return "Daily totems are refreshed by the server each session. Changes will not persist."

    def reset_daily_totems(self) -> str:
        return "Daily totems are refreshed by the server each session. Changes will not persist."

    # ── Idol Quest ──
    def complete_idol_quest(self) -> str:
        return "Idol Quest progress is server-tracked and cannot be modified via save editing."

    def reset_idol_quest(self) -> str:
        return "Idol Quest progress is server-tracked and cannot be modified via save editing."

    # ── Streak ──
    def get_streak(self) -> JsonObj:
        p = self.p(); d = self.d()
        return {
            "cdcs": p.get("cdcs", 0),
            "ldcs": p.get("ldcs", 0),
            "DaysPlayed": d.get("DaysPlayed", 0),
            "DaysSinceInstall": d.get("DaysSinceInstall", 0),
        }

    def set_streak(self, value: int) -> str:
        return "Daily streak counter is server-managed and cannot be set via save editing."

    # ── Global Challenges ──
    def complete_global_challenges(self) -> str:
        return "Global challenges are entirely server-managed and cannot be modified via save editing."

    def reset_global_challenges(self) -> str:
        return "Global challenges are entirely server-managed and cannot be modified via save editing."

    # ── Minigame ──
    def complete_minigame(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); mg = p.get("MGSDK", {})
        if not mg: return "No minigame data found."
        cls = mg.get("CLSDK", {})
        if not cls: return "No current minigame level."
        # Set high-score completion flag
        mg["HIWCK"] = True
        ltdk = cls.get("LTDK", {})
        n = 0
        for tid_str, tier in ltdk.items():
            if not tier.get("CIDK"): tier["CIDK"] = True; n += 1
        p["MGSDK"] = mg
        self._log("complete_mg", f"{n} tiers", "HIGH"); return f"Completed {n} minigame tiers"

    def reset_minigame(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); mg = p.get("MGSDK", {})
        cls = mg.get("CLSDK", {})
        ltdk = cls.get("LTDK", {})
        n = 0
        for tid_str, tier in ltdk.items():
            if "CIDK" in tier: del tier["CIDK"]; n += 1
        p["MGSDK"] = mg
        self._log("reset_mg", f"{n} tiers", "HIGH"); return f"Reset {n} minigame tiers"

    # ── Unlock Everything ──
    def unlock_everything(self) -> str:
        if e := self._chk(True): return e
        r: list[str] = []
        r.append(self.unlock_all_chars())
        r.append(self.unlock_all_pets())
        r.append(self.unlock_all_artifacts())
        r.append(self.unlock_all_collectables())
        r.append(self.unlock_all_powers())
        r.append(self.purchase_all_regions())
        r.append(self.complete_all_objectives())
        r.append(self.unlock_all_hats())
        r.append(self.complete_battle_pass())
        r.append(self.max_potions())
        r.append(self.complete_minigame())
        # Ensure currencies are sufficient for all unlock types
        p = self.p(); op = self.original["data"]["Players"][0]  # type: ignore[index]
        p["scrollCount"] = max(p.get("scrollCount", 0), SAFE_MAX)
        p["minigameTicketCount"] = max(p.get("minigameTicketCount", 0), SAFE_MAX)
        p["coinCount"] = max(p.get("coinCount", 0), SAFE_MAX)
        p["specialCurrencyCount"] = max(p.get("specialCurrencyCount", 0), SAFE_MAX)
        p["LCC"] = max(SAFE_MAX, p.get("LCC", 0), op.get("LCC", 0))
        p["LSCC"] = max(SAFE_MAX, p.get("LSCC", 0), op.get("LSCC", 0))
        r.append("All currencies maxed")
        return " | ".join(r)

    # ── Max All Currency ──
    def max_all_currency(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); op = self.original["data"]["Players"][0]  # type: ignore[index]
        p["LCC"] = max(SAFE_MAX, op.get("LCC", 0))
        p["LSCC"] = max(SAFE_MAX, op.get("LSCC", 0))
        p["coinCount"] = SAFE_MAX; p["specialCurrencyCount"] = SAFE_MAX
        p["scrollCount"] = SAFE_MAX; p["minigameTicketCount"] = SAFE_MAX
        self._log("max_all_currency", "All currencies maxed", "HIGH"); return "All currencies set to maximum"

    # ── Stats ──
    def get_stats(self) -> JsonObj:
        gs = self.p().get("gameStats", {})
        ls = gs.get("LS", {}).get("Stats", {})
        cs: JsonObj = {}
        for k, v in gs.get("CharStats", {}).items():
            cs[k] = v.get("Stats", {})
        return {"lifetime": ls, "perCharacter": cs}

    def set_stat(self, key: str, val: int) -> str:
        if e := self._chk(True): return e
        if val < 0 or val > SAFE_MAX: return f"ERROR: Value out of range (0..{SAFE_MAX})."
        gs = self.p().setdefault("gameStats", {})
        stats = gs.setdefault("LS", {}).setdefault("Stats", {})
        old = stats.get(key, 0); stats[key] = val
        self._log("set_stat", f"{key}: {old}\u2192{val}", "HIGH"); return f"{key}: {old} \u2192 {val}"

    def set_player_level(self, target: int) -> str:
        if e := self._chk(True): return e
        if not self.cfg or not self.cfg.objectives:
            return "ERROR: No objectives data available."
        if target < 0: return "ERROR: Level must be non-negative."
        p = self.p(); done = set(p.get("objectives", []))
        current = sum(o.get("Points", 0) for o in self.cfg.objectives if o.get("PID") in done)
        if target == current: return f"Already at level {current}."
        if target > current:
            for obj in self.cfg.objectives:
                if current >= target: break
                pid = obj.get("PID")
                if pid is not None and pid not in done:
                    done.add(pid); current += obj.get("Points", 0)
        else:
            for obj in reversed(self.cfg.objectives):
                if current <= target: break
                pid = obj.get("PID")
                if pid is not None and pid in done:
                    done.remove(pid); current -= obj.get("Points", 0)
        p["objectives"] = sorted(done)
        if "objectivesActiveData" in p: p["objectivesActiveData"] = []
        self._log("set_level", f"\u2192{current}", "HIGH"); return f"Player level set to {current}"

    # ── Randomize ──
    @staticmethod
    def _rr(target: int, pct: float = 0.3) -> int:
        """Random value around target ± pct (e.g. 0.3 = ±30%)."""
        lo = max(0, int(target * (1 - pct))); hi = int(target * (1 + pct))
        return random.randint(lo, hi)

    def randomize_values(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); op = self.original["data"]["Players"][0]  # type: ignore[index]
        orig_lcc = op.get("LCC", 0); orig_lscc = op.get("LSCC", 0)
        # Economy – realistic targets
        coins = self._rr(8500, 0.3); gems = self._rr(120, 0.4)
        scrolls = self._rr(180, 0.5); keys = self._rr(45, 0.5)
        # Lifetime coin/gem counts must be >= current
        lcc = max(self._rr(22_000_000, 0.3), coins, orig_lcc)
        lscc = max(self._rr(50_000, 0.3), gems, orig_lscc)
        p["coinCount"] = coins; p["specialCurrencyCount"] = gems
        p["scrollCount"] = scrolls; p["minigameTicketCount"] = keys
        p["LCC"] = lcc; p["LSCC"] = lscc
        # Stats – realistic targets with enforced constraints
        gs = p.setdefault("gameStats", {}); ls = gs.setdefault("LS", {}).setdefault("Stats", {})
        hs = self._rr(12_800_000, 0.3)
        hsnr = min(self._rr(9_900_000, 0.3), hs)    # HSNR <= HS
        ld = self._rr(68_400, 0.25)
        ldnc = min(self._rr(54_200, 0.25), ld)       # LDNC <= LD
        runs = max(self._rr(11_000, 0.3), 150)       # min 150 for battle pass
        td = max(self._rr(88_000_000, 0.25), ld * runs // 10)  # TD >> LD
        tress = min(self._rr(3800, 0.4), runs)       # TRESS <= TRUNS
        tcc = max(self._rr(22_000_000, 0.3), lcc)    # TCC >= LCC
        lcc = tcc; p["LCC"] = lcc     # keep consistent
        tgc = max(self._rr(50_000, 0.3), lscc)       # TGC >= LSCC
        lscc = tgc; p["LSCC"] = lscc  # keep consistent
        hcc = self._rr(6800, 0.3); hgc = self._rr(14, 0.5)
        ls["HS"] = hs; ls["HSNR"] = hsnr; ls["LD"] = ld; ls["LDNC"] = ldnc
        ls["TD"] = td; ls["TRUNS"] = runs; ls["TRESS"] = tress
        ls["TCC"] = tcc; ls["TGC"] = tgc; ls["HCC"] = hcc; ls["HGC"] = hgc
        # Additional stats
        tdcc = self._rr(300, 0.4); twcc = self._rr(60, 0.4)
        thsu = self._rr(1200, 0.3); tmhsu = self._rr(300, 0.4)
        ticc = self._rr(10_000_000, 0.3); lpv119 = self._rr(500, 0.4)
        ls["TDCC"] = tdcc; ls["TWCC"] = twcc
        ls["THSU"] = thsu; ls["TMHSU"] = tmhsu
        ls["TICC"] = ticc; ls["LPV119"] = lpv119
        # Perks – always maxed
        perk_levels = list(PERK_MAX_DEPTHS)
        p["consumablesDepthPurchased"] = perk_levels
        # Potions – random counts (0..50 realistic range)
        pots = p.get("PotionsAvailableData", [])
        existing_types = {pt.get("Type") for pt in pots}
        for pt in pots: pt["Count"] = random.randint(0, 50)
        for t in POTION_TYPES:
            if t not in existing_types: pots.append({"Count": random.randint(0, 50), "Type": t})
        p["PotionsAvailableData"] = pots
        # Streak – random realistic streak (0..30)
        streak = random.randint(0, 30)
        p["cdcs"] = streak; p["ldcs"] = max(p.get("ldcs", 0), streak)
        self._log("randomize", f"Coins:{coins} HS:{hs} Runs:{runs} Streak:{streak}", "HIGH")
        return f"Randomized: Coins={coins}, Gems={gems}, HS={hs}, Runs={runs}, Streak={streak}, Perks={perk_levels}"

    def randomize_economy(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); op = self.original["data"]["Players"][0]  # type: ignore[index]
        orig_lcc = op.get("LCC", 0); orig_lscc = op.get("LSCC", 0)
        coins = self._rr(8500, 0.3); gems = self._rr(120, 0.4)
        scrolls = self._rr(180, 0.5); keys = self._rr(45, 0.5)
        lcc = max(self._rr(22_000_000, 0.3), coins, orig_lcc)
        lscc = max(self._rr(50_000, 0.3), gems, orig_lscc)
        p["coinCount"] = coins; p["specialCurrencyCount"] = gems
        p["scrollCount"] = scrolls; p["minigameTicketCount"] = keys
        p["LCC"] = lcc; p["LSCC"] = lscc
        gs = p.setdefault("gameStats", {}); ls = gs.setdefault("LS", {}).setdefault("Stats", {})
        ls["TCC"] = max(ls.get("TCC", 0), lcc)
        ls["TGC"] = max(ls.get("TGC", 0), lscc)
        ls["HCC"] = max(ls.get("HCC", 0), self._rr(6800, 0.3))
        ls["HGC"] = max(ls.get("HGC", 0), self._rr(14, 0.5))
        # Streak
        streak = random.randint(0, 30)
        p["cdcs"] = streak; p["ldcs"] = max(p.get("ldcs", 0), streak)
        self._log("randomize_economy", f"Coins:{coins} Gems:{gems}", "HIGH")
        return f"Randomized economy: Coins={coins}, Gems={gems}, Streak={streak}"

    def randomize_stats(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); op = self.original["data"]["Players"][0]  # type: ignore[index]
        orig_lcc = op.get("LCC", 0); orig_lscc = op.get("LSCC", 0)
        gs = p.setdefault("gameStats", {}); ls = gs.setdefault("LS", {}).setdefault("Stats", {})
        # Generate base values
        hs = self._rr(12_800_000, 0.3)
        hsnr = min(self._rr(9_900_000, 0.3), hs)    # HSNR <= HS
        ld = self._rr(68_400, 0.25)
        ldnc = min(self._rr(54_200, 0.25), ld)       # LDNC <= LD
        runs = max(self._rr(11_000, 0.3), 150)       # min 150 for battle pass
        td = max(self._rr(88_000_000, 0.25), ld * runs // 10)  # TD >> LD
        tress = min(self._rr(3800, 0.4), runs)       # TRESS <= TRUNS
        hcc = self._rr(6800, 0.3)
        hgc = self._rr(14, 0.5)
        # Coin/gem stats: TCC >= LCC >= coinCount, TGC >= LSCC >= gems
        coins = p.get("coinCount", 0); gems = p.get("specialCurrencyCount", 0)
        lcc = max(p.get("LCC", orig_lcc), coins)
        lscc = max(p.get("LSCC", orig_lscc), gems)
        tcc = max(self._rr(22_000_000, 0.3), lcc)
        tgc = max(self._rr(50_000, 0.3), lscc)
        # Sync LCC/LSCC up if TCC/TGC increased them
        p["LCC"] = max(lcc, tcc); p["LSCC"] = max(lscc, tgc)
        ls["HS"] = hs; ls["HSNR"] = hsnr; ls["LD"] = ld; ls["LDNC"] = ldnc
        ls["TD"] = td; ls["TRUNS"] = runs; ls["TRESS"] = tress
        ls["TCC"] = tcc; ls["TGC"] = tgc; ls["HCC"] = hcc; ls["HGC"] = hgc
        # Additional stats
        tdcc = self._rr(300, 0.4); twcc = self._rr(60, 0.4)
        thsu = self._rr(1200, 0.3); tmhsu = self._rr(300, 0.4)
        ticc = self._rr(10_000_000, 0.3); lpv119 = self._rr(500, 0.4)
        ls["TDCC"] = tdcc; ls["TWCC"] = twcc
        ls["THSU"] = thsu; ls["TMHSU"] = tmhsu
        ls["TICC"] = ticc; ls["LPV119"] = lpv119
        # Clamp current balance to lifetime if needed
        if p.get("coinCount", 0) > p["LCC"]: p["coinCount"] = p["LCC"]
        if p.get("specialCurrencyCount", 0) > p["LSCC"]: p["specialCurrencyCount"] = p["LSCC"]
        # Perks – always maxed
        perk_levels = list(PERK_MAX_DEPTHS)
        p["consumablesDepthPurchased"] = perk_levels
        # Potions – random counts
        pots = p.get("PotionsAvailableData", [])
        existing_types = {pt.get("Type") for pt in pots}
        for pt in pots: pt["Count"] = random.randint(0, 50)
        for t in POTION_TYPES:
            if t not in existing_types: pots.append({"Count": random.randint(0, 50), "Type": t})
        p["PotionsAvailableData"] = pots
        # Streak
        streak = random.randint(0, 30)
        p["cdcs"] = streak; p["ldcs"] = max(p.get("ldcs", 0), streak)
        self._log("randomize_stats", f"HS:{hs} Runs:{runs} Streak:{streak}", "HIGH")
        return f"Randomized stats: HS={hs}, Runs={runs}, Perks randomized, Streak={streak}"

    # ── Max Account ──
    def max_account(self) -> str:
        if e := self._chk(True): return e
        p = self.p(); op = self.original["data"]["Players"][0]  # type: ignore[index]
        max_lcc = max(SAFE_MAX, op.get("LCC", 0)); max_lscc = max(SAFE_MAX, op.get("LSCC", 0))
        p["LCC"] = max_lcc; p["coinCount"] = max_lcc
        p["LSCC"] = max_lscc; p["specialCurrencyCount"] = max_lscc
        p["scrollCount"] = SAFE_MAX; p["minigameTicketCount"] = SAFE_MAX
        # Max multiplier: sum of ScoreMultiplier objective Points + SM artifact contributions
        sm_pts = sum(o.get("Points", 0) for o in self.cfg.objectives if o.get("RD", {}).get("T") == "ScoreMultiplier") if self.cfg else 0
        calc = sm_pts if sm_pts > 0 else MAX_MULTIPLIER
        # Preserve original SBC type (game may use int or float depending on version)
        orig_sbc = p.get("SBC", 0)
        new_sbc = max(calc, int(orig_sbc))
        p["SBC"] = new_sbc if isinstance(orig_sbc, int) else float(new_sbc)
        r: list[str] = ["Economy maxed"]
        r.append(self.unlock_everything())
        gs = p.setdefault("gameStats", {}); ls = gs.setdefault("LS", {}).setdefault("Stats", {})
        ls["HS"] = SAFE_MAX; ls["HSNR"] = SAFE_MAX
        ls["LD"] = SAFE_MAX; ls["LDNC"] = SAFE_MAX
        ls["TD"] = SAFE_MAX; ls["TRUNS"] = max(ls.get("TRUNS", 0), SAFE_MAX)
        ls["TCC"] = max_lcc; ls["TGC"] = max_lscc
        ls["HCC"] = SAFE_MAX; ls["HGC"] = SAFE_MAX
        ls["TRESS"] = SAFE_MAX; ls["TS"] = SAFE_MAX
        ls["TDCC"] = SAFE_MAX; ls["TWCC"] = SAFE_MAX
        r.append("Stats maxed")
        r.append(self.max_perks())
        r.append(self.max_potions())
        r.append(self.max_power_levels())
        r.append(self.complete_daily_totems())
        r.append(self.complete_idol_quest())
        r.append(self.complete_global_challenges())
        r.append(self.complete_minigame())
        # Max streak
        p["cdcs"] = 365; p["ldcs"] = max(p.get("ldcs", 0), 365)
        r.append("Streak maxed (365)")
        self._log("max_account", "Full max", "HIGH"); return " | ".join(r)

    # ── Analysis ──
    def analysis(self) -> JsonObj:
        d = self.d(); p = self.p(); cfg = self.cfg

        # Characters
        chars: list[JsonObj] = []; owned_cids: set[int] = set()
        for c in p.get("Characters", []):
            cid = c.get("CharId"); owned_cids.add(cid)
            hh = c.get("Attachments", {}).get("Hair")
            chars.append({"id": cid, "name": cfg.char_name(cid) if cfg else f"#{cid}",
                "skinId": c.get("SkinId", 0), "powerId": c.get("PowerId", 0),
                "hat": hh, "hatName": cfg.att_name(hh) if cfg and hh else None,
                "active": cid == p.get("activePlayerCharacter"), "owned": True,
                "unlockType": cfg.char_unlock_type(cid) if cfg else "?"})
        if cfg:
            for cid in sorted(cfg.chars):
                if cid not in owned_cids:
                    chars.append({"id": cid, "name": cfg.char_name(cid), "owned": False, "active": False,
                        "unlockType": cfg.char_unlock_type(cid)})

        # Pets
        pets: list[JsonObj] = []; owned_pids: set[int] = set()
        for pe in p.get("CharacterPets", []):
            pid = pe.get("PetId"); owned_pids.add(pid)
            pets.append({"id": pid, "name": cfg.pet_name(pid) if cfg else f"#{pid}", "owned": True})
        if cfg:
            for pid in sorted(cfg.pets):
                if pid not in owned_pids:
                    pets.append({"id": pid, "name": cfg.pet_name(pid), "owned": False})

        # Hats (136 obtainable accessories — excludes character-specific cosmetics)
        hat_char_map: dict[int, JsonObj] = {}
        for c in p.get("Characters", []):
            hh = c.get("Attachments", {}).get("Hair")
            # Only map hats that are actual obtainable attachments (not char-specific Hair=CID*1000)
            if hh is not None and (not cfg or hh in cfg.attachments):
                cid = c.get("CharId")
                hat_char_map[hh] = {"charId": cid, "charName": cfg.char_name(cid) if cfg else f"#{cid}"}
        owned_hats = {e.get("AttachmentId") for e in p.get("CharacterAttachments", []) if isinstance(e, dict)}
        hats: list[JsonObj] = []
        if cfg:
            for aid in sorted(cfg.attachments):
                equipped = aid in hat_char_map
                owned = aid in owned_hats or equipped
                entry: JsonObj = {"id": aid, "name": cfg.att_name(aid), "owned": owned, "equipped": equipped}
                if equipped: entry["equippedOn"] = hat_char_map[aid]
                hats.append(entry)

        # Collectables
        redeemed: set[int] = {e["CollectableId"] for e in p.get("CollectablesFound", []) if isinstance(e, dict) and e.get("CollectableId") is not None}
        collectables: list[JsonObj] = []
        shown_ids: set[int] = set()
        if cfg:
            # Categories first
            for cid in sorted(cfg.collectables):
                cat = cfg.collectables[cid]
                collectables.append({"id": cid, "name": cat.get("BN", ""), "active": cat.get("active", True), "redeemed": cid in redeemed, "type": "category"})
                shown_ids.add(cid)
            # Individual items from config
            for iid in sorted(cfg.individual_collectables - set(cfg.collectables)):
                collectables.append({"id": iid, "name": f"Item #{iid}", "active": True, "redeemed": iid in redeemed, "type": "individual"})
                shown_ids.add(iid)
        # Any extra IDs in save not yet shown
        for eid in sorted(redeemed - shown_ids):
            collectables.append({"id": eid, "name": f"Item #{eid}", "active": True, "redeemed": True, "type": "individual"})

        # Artifacts
        oa = set(p.get("artifactsPurchased", [])); artifacts: list[JsonObj] = []
        if cfg:
            for a in cfg.artifacts:
                pid = a.get("PID")
                artifacts.append({"id": pid, "name": a.get("Title", ""), "desc": a.get("Description", ""), "owned": pid in oa})
            # Include extra artifact PIDs (valid in-game but not in config file)
            for pid in sorted(EXTRA_ARTIFACT_PIDS):
                if pid not in DEPRECATED_ARTIFACT_PIDS:
                    artifacts.append({"id": pid, "name": f"Artifact #{pid}", "desc": "(Extra artifact)", "owned": pid in oa})

        # Powers
        op = set(p.get("powersPurchased", [])); powers: list[JsonObj] = []
        if cfg:
            for pw in cfg.powers:
                pid = pw.get("PID")
                powers.append({"id": pid, "name": pw.get("Title", ""), "desc": pw.get("Description", ""), "owned": pid in op})

        # Regions
        rs = {r.get("ID"): r.get("P", False) for r in p.get("RM", {}).get("RegSaveData", [])}; regions: list[JsonObj] = []
        if cfg:
            for rid in sorted(cfg.regions):
                regions.append({"id": rid, "name": cfg.region_name(rid), "purchased": bool(rs.get(rid)), "inSave": rid in rs})

        # Objectives
        done = set(p.get("objectives", [])); objectives: list[JsonObj] = []
        if cfg:
            for obj in cfg.objectives:
                pid = obj.get("PID")
                objectives.append({"id": pid, "title": obj.get("Title", ""), "desc": obj.get("DescriptionPre", ""),
                    "points": obj.get("Points", 0), "completed": pid in done})
        total_pts = sum(o.get("Points", 0) for o in (cfg.objectives if cfg else []) if o.get("PID") in done)
        max_pts = sum(o.get("Points", 0) for o in (cfg.objectives if cfg else []))
        game_level = len(done) // 8
        max_game_level = len(cfg.objectives) // 8 if cfg else game_level

        # Battle Pass
        bp_info: JsonObj | None = None; bp_list: list[Any] = p.get("BPPDM", {}).get("BPPPD", [])
        if bp_list:
            bp = bp_list[0]; bpc: JsonObj = bp.get("BPCDK", {}); tiers: list[Any] = bpc.get("BPTR", [])
            claimed_tids: list[Any] = []; unlocked_tids: list[Any] = []
            for c in p.get("BPCDDM", []):
                if c.get("BPID") == bp.get("BPIDK"):
                    claimed_tids = c.get("ClaimedTiers", [])
                    unlocked_tids = c.get("UnlockedTiers", [])
            bp_info = {"id": bp.get("BPIDK"), "title": str(bpc.get("BPT", "?")),
                "totalTiers": len(tiers), "unlockedTiers": len(unlocked_tids),
                "claimedTiers": len(claimed_tids),
                "premium": bp.get("BPBPSK", False),
                "start": fmt_ts(bpc.get("BPSD")), "end": fmt_ts(bpc.get("BPED"))}

        # Daily Challenges
        dc: list[JsonObj] = [{"title": ch.get("Title", ""), "desc": ch.get("DescriptionPre", ""),
               "target": ch.get("SV", 0), "earned": ch.get("EarnedSV", 0),
               "status": ch.get("ObjectiveStatus", "?"), "pid": ch.get("PID")} for ch in p.get("NCA", [])]

        # Perks
        perk_depths = p.get("consumablesDepthPurchased") or [0] * len(PERK_MAX_DEPTHS)
        perks: list[JsonObj] = []
        for i, name in enumerate(PERK_NAMES):
            cur = perk_depths[i] if i < len(perk_depths) else 0
            perks.append({"index": i, "name": name, "level": cur, "max": PERK_MAX_DEPTHS[i]})

        # Potions
        potions: list[JsonObj] = []
        pots_data = p.get("PotionsAvailableData", [])
        existing_types = set()
        for pt in pots_data:
            existing_types.add(pt.get("Type", ""))
            potions.append({"type": pt.get("Type", "?"), "count": pt.get("Count", 0)})
        for t in POTION_TYPES:
            if t not in existing_types:
                potions.append({"type": t, "count": 0})

        # Idol Quest
        iq_data = p.get("WFRDK", {})
        idol_quest: JsonObj | None = None
        if iq_data:
            levels = iq_data.get("WFRDLDK", [])
            completed_levels = sum(1 for lv in levels if lv.get("C"))
            idol_quest = {"cfid": iq_data.get("CFID"), "end": fmt_ts(iq_data.get("WED")),
                "completed": bool(iq_data.get("WFRDCK", False)),
                "progress": iq_data.get("WFRDPK", 0),
                "levelsCompleted": completed_levels,
                "totalLevels": max(len(levels), 5)}

        # Daily Totems
        dt_data = p.get("DCPGDK", {})
        daily_totems: JsonObj | None = None
        if dt_data:
            totems = dt_data.get("DCTLK", [])
            daily_totems = {
                "task": dt_data.get("BTK", ""), "desc": dt_data.get("BDK", ""),
                "value": dt_data.get("BVK", 0), "duration": dt_data.get("BDVK", 0),
                "totems": [{"type": t.get("TTK", ""), "name": t.get("TINK", ""),
                    "found": bool(t.get("TIK", 0))} for t in totems],
                "totalFound": sum(1 for t in totems if t.get("TIK")),
                "totalTotems": len(totems)}

        # Global Challenges
        gc_data = p.get("RCPDM", {})
        global_challenges: list[JsonObj] = []
        for ch in gc_data.get("RCPPD", []):
            global_challenges.append({
                "id": ch.get("RCID"), "end": fmt_ts(ch.get("RCED")),
                "target": ch.get("RCTG", 0), "current": ch.get("RCTC", 0),
                "score": ch.get("RCTS", 0), "runs": ch.get("RCTR", 0)})

        # Minigame
        mg = p.get("MGSDK", {})
        mg_cls = mg.get("CLSDK", {})
        mg_tiers: list[JsonObj] = []
        for tid_str, tier in mg_cls.get("LTDK", {}).items():
            mg_tiers.append({"tier": tid_str, "completed": tier.get("CIDK", False)})
        mg_info: JsonObj = {"level": mg_cls.get("LIDK", 0), "tiers": mg_tiers,
            "totalTiers": len(mg_tiers), "completedTiers": sum(1 for t in mg_tiers if t["completed"])}

        return {
            "meta": {"hash": self.working.get("hash", ""), "version": d.get("version"),
                "HRFL": d.get("HRFL"), "ts": fmt_ts(d.get("TS")), "installDate": fmt_ts(d.get("InstallDate")),
                "daysSinceInstall": d.get("DaysSinceInstall"), "daysPlayed": d.get("DaysPlayed"),
                "totalRuns": d.get("NoOfRunsSinceInstall") or p.get("gameStats", {}).get("LS", {}).get("Stats", {}).get("TRUNS", 0),
                "cloud": d.get("CloudSavedVersion")},
            "economy": {"coins": p.get("coinCount", 0), "gems": p.get("specialCurrencyCount", 0),
                "scrolls": p.get("scrollCount", 0), "keys": p.get("minigameTicketCount", 0),
                "lcc": p.get("LCC", 0), "lscc": p.get("LSCC", 0), "mult": p.get("SBC", 1.0)},
            "characters": chars, "pets": pets, "hats": hats, "collectables": collectables, "artifacts": artifacts,
            "powers": powers, "regions": regions,
            "objectives": {"completed": len(done), "total": len(cfg.objectives) if cfg else len(done),
                "items": objectives, "level": total_pts},
            "activeChar": p.get("activePlayerCharacter"),
            "playerLevel": total_pts, "maxLevel": max_pts,
            "gameLevel": game_level, "maxGameLevel": max_game_level,
            "safeMax": SAFE_MAX, "maxMultiplier": MAX_MULTIPLIER,
            "battlePass": bp_info, "dailyChallenges": dc,
            "perks": perks, "potions": potions,
            "idolQuest": idol_quest, "dailyTotems": daily_totems,
            "globalChallenges": global_challenges,
            "minigame": mg_info,
            "streak": self.get_streak(),
            "stats": self.get_stats(),
            "mode": self.mode, "editLog": self.log,
        }

    def _sanitize_on_upload(self) -> None:
        """Fix critical save issues immediately on upload so analysis shows clean state."""
        p = self.p()
        # Fix NewAttachment=True storm — having many hats "new" simultaneously
        # causes the game to crash when opening the hats section
        for e in p.get("CharacterAttachments", []):
            if isinstance(e, dict) and e.get("NewAttachment") is not False:
                e["NewAttachment"] = False
        # Fix NewPet=True for same reason
        for e in p.get("CharacterPets", []):
            if isinstance(e, dict) and e.get("NewPet") is not False:
                e["NewPet"] = False
        # Strip stale Head values from character Attachments (game uses Hair, not Head)
        for c in p.get("Characters", []):
            att = c.get("Attachments", {})
            if "Head" in att:
                del att["Head"]
                if not att and "Attachments" in c: del c["Attachments"]
        # Deduplicate CharacterAttachments
        seen_aids: set[int] = set()
        deduped: list[Any] = []
        for e in p.get("CharacterAttachments", []):
            if isinstance(e, dict):
                aid = e.get("AttachmentId")
                if aid is not None and aid not in seen_aids:
                    deduped.append(e); seen_aids.add(aid)
        p["CharacterAttachments"] = deduped
        # Normalize CollectablesFound — convert bare ints to dicts
        cf = p.get("CollectablesFound", [])
        normalized: list[Any] = []
        for x in cf:
            if isinstance(x, int):
                normalized.append(OrderedDict([("CollectableId", x), ("NumFound", 1), ("NumRewarded", 1), ("FoundState", "CollectFound_FoundNotViewed")]))
            elif isinstance(x, dict):
                normalized.append(x)
        p["CollectablesFound"] = normalized
        # Also apply to original so diff shows only real user edits
        op = self.original["data"]["Players"][0]  # type: ignore[index]
        for e in op.get("CharacterAttachments", []):
            if isinstance(e, dict) and e.get("NewAttachment") is not False:
                e["NewAttachment"] = False
        for e in op.get("CharacterPets", []):
            if isinstance(e, dict) and e.get("NewPet") is not False:
                e["NewPet"] = False
        for c in op.get("Characters", []):
            att = c.get("Attachments", {})
            if "Head" in att:
                del att["Head"]
                if not att and "Attachments" in c: del c["Attachments"]
        # Normalize CollectablesFound in original too
        ocf = op.get("CollectablesFound", [])
        onorm: list[Any] = []
        for x in ocf:
            if isinstance(x, int):
                onorm.append(OrderedDict([("CollectableId", x), ("NumFound", 1), ("NumRewarded", 1), ("FoundState", "CollectFound_FoundNotViewed")]))
            elif isinstance(x, dict):
                onorm.append(x)
        op["CollectablesFound"] = onorm

    @staticmethod
    def _preserve_float_types(orig: Any, working: Any) -> None:
        """Recursively ensure numeric types in working match what orig had (float↔int)."""
        if isinstance(orig, dict) and isinstance(working, dict):
            for k in orig:
                if k in working:
                    if isinstance(orig[k], float) and isinstance(working[k], int):
                        working[k] = float(working[k])
                    elif isinstance(orig[k], int) and isinstance(working[k], float):
                        working[k] = int(working[k])
                    elif isinstance(orig[k], (dict, list)):
                        SaveEditor._preserve_float_types(orig[k], working[k])
        elif isinstance(orig, list) and isinstance(working, list):
            for i in range(min(len(orig), len(working))):
                if isinstance(orig[i], float) and isinstance(working[i], int):
                    working[i] = float(working[i])
                elif isinstance(orig[i], int) and isinstance(working[i], float):
                    working[i] = int(working[i])
                elif isinstance(orig[i], (dict, list)):
                    SaveEditor._preserve_float_types(orig[i], working[i])

    def _sanitize_for_export(self) -> None:
        """Clean up save structure to match the game's expected schema."""
        p = self.p()
        # Fix activePlayerCharacter if present and None or missing from owned list
        owned_cids = [c.get("CharId") for c in p.get("Characters", []) if c.get("CharId") is not None]
        if "activePlayerCharacter" in p:
            if p["activePlayerCharacter"] not in owned_cids and owned_cids:
                p["activePlayerCharacter"] = owned_cids[0]
        # Preserve empty Attachments/Pets dicts — game expects them on certain characters
        # Remove legacy keys replaced by new format
        for k in LEGACY_PLAYER_KEYS:
            if k in p:
                del p[k]
        # Remove keys that the game does not persist (server-managed)
        # These get stripped by the game on load; including them causes no harm
        # but adds noise and confuses diffs.
        op_orig = self.original["data"]["Players"][0]  # type: ignore[index]
        for k in ("PowerUpLevels", "consumablesDepthPurchased", "cdcs"):
            if k in p and k not in op_orig:
                del p[k]
        # Remove objectivesActiveData if empty
        if "objectivesActiveData" in p and not p["objectivesActiveData"]:
            del p["objectivesActiveData"]
        # Keep BPCDDM (battle pass claimed data) — needed for tier reward state
        # Remove deprecated artifact PIDs
        if "artifactsPurchased" in p:
            arts = p["artifactsPurchased"]
            if self.cfg:
                valid_art = {a.get("PID") for a in self.cfg.artifacts if a.get("PID") is not None}
                valid_art |= EXTRA_ARTIFACT_PIDS
                arts = [pid for pid in arts if pid in valid_art]
            p["artifactsPurchased"] = [pid for pid in arts if pid not in DEPRECATED_ARTIFACT_PIDS]
        # Deduplicate CharacterAttachments and validate against 136 obtainable hat CIDs
        ca_raw = p.get("CharacterAttachments", [])
        seen_aids: set[int] = set()
        ca: list[Any] = []
        for e in ca_raw:
            if isinstance(e, dict):
                aid = e.get("AttachmentId")
                valid = aid is not None and (not self.cfg or aid in self.cfg.attachments)
                if valid and aid is not None and aid not in seen_aids:
                    ca.append(e); seen_aids.add(aid)
        if ca_raw or ca:
            p["CharacterAttachments"] = ca
        # Hair handling: two distinct systems use the Hair field
        # 1. Obtainable hats (CIDs 1-157): stored in CharacterAttachments, can be equipped/removed
        # 2. Character-specific built-in cosmetics (Hair = CharId*1000, e.g. 50000, 54000, 61000, 62000):
        #    NOT in CharacterAttachments, integral to the character — stripping causes crash
        # Strategy: strip Head (stale), preserve Hair if it's a known attachment OR the original value
        kept_aids = {e.get("AttachmentId") for e in p.get("CharacterAttachments", []) if isinstance(e, dict)}
        orig_hair: dict[int, int] = {}
        for c in (self.original["data"]["Players"][0].get("Characters", [])  # type: ignore[index]
                  if self.original else []):
            att = c.get("Attachments", {})
            h = att.get("Hair")
            if h is not None:
                orig_hair[c.get("CharId")] = h
        for c in p.get("Characters", []):
            att = c.get("Attachments", {})
            if "Head" in att:
                del att["Head"]
            hair = att.get("Hair")
            cid = c.get("CharId")
            if hair is not None and hair not in kept_aids and orig_hair.get(cid) != hair:
                # Only strip Hair if it's neither a known attachment NOR the original value
                del att["Hair"]
            if not att and "Attachments" in c: del c["Attachments"]
        # Safety backstop: restore character-specific Hair (Hair == CharId*1000) if lost
        for c in p.get("Characters", []):
            cid = c.get("CharId")
            expected_hair = cid * 1000 if cid is not None else None
            if expected_hair is not None and orig_hair.get(cid) == expected_hair:
                att = c.get("Attachments")
                if att is None:
                    c["Attachments"] = {"Hair": expected_hair}
                elif "Hair" not in att:
                    att["Hair"] = expected_hair
        # Set NewAttachment to False — having many hats marked "new" simultaneously
        # causes the game to crash when opening the hats section (asset load storm)
        for e in p.get("CharacterAttachments", []):
            if isinstance(e, dict) and e.get("NewAttachment") is not False:
                e["NewAttachment"] = False
        # Set NewPet to False for same reason
        for e in p.get("CharacterPets", []):
            if isinstance(e, dict) and e.get("NewPet") is not False:
                e["NewPet"] = False
        # Validate collectable IDs
        if self.cfg and "CollectablesFound" in p:
            valid_col = set(self.cfg.collectables) | self.cfg.individual_collectables
            p["CollectablesFound"] = [e for e in p["CollectablesFound"]
                if isinstance(e, dict) and e.get("CollectableId") in valid_col]
        # Type preservation: ensure numeric types match original (game may require int or float)
        # Scan original player data for type mismatches and enforce original type
        op = self.original["data"]["Players"][0]  # type: ignore[index]
        for key, oval in op.items():
            if isinstance(oval, float) and key in p and isinstance(p[key], int):
                p[key] = float(p[key])
            elif isinstance(oval, int) and key in p and isinstance(p[key], float):
                p[key] = int(p[key])
        # Also check nested dicts/lists that might contain float timestamps
        for key in op:
            if key in p and isinstance(op[key], (dict, list)):
                self._preserve_float_types(op[key], p[key])
        # Preserve float types at data level too (e.g. TS, StoreItems timestamps)
        od_orig = self.original["data"]  # type: ignore[index]
        od_work = self.d()
        for key, oval in od_orig.items():
            if key == "Players":
                continue
            if isinstance(oval, float) and key in od_work and isinstance(od_work[key], int):
                od_work[key] = float(od_work[key])
            elif isinstance(oval, int) and key in od_work and isinstance(od_work[key], float):
                od_work[key] = int(od_work[key])
            elif isinstance(oval, (dict, list)) and key in od_work:
                self._preserve_float_types(oval, od_work[key])
        # Key-preservation safety net: restore any original keys that were
        # accidentally dropped (e.g. via raw editing).  This prevents silent
        # data loss on download.
        op = self.original["data"]["Players"][0]  # type: ignore[index]
        for k in op:
            if k not in p and k not in LEGACY_PLAYER_KEYS:
                p[k] = copy.deepcopy(op[k])
        od = self.original["data"]  # type: ignore[index]
        for k in od:
            if k not in self.d() and k != "Players":
                self.d()[k] = copy.deepcopy(od[k])

    def validate(self) -> JsonObj:
        errors: list[str] = []; warnings: list[str] = []
        p = self.p(); op = self.original["data"]["Players"][0]  # type: ignore[index]
        if p.get("coinCount", 0) > p.get("LCC", 0): errors.append("Coins exceed LCC.")
        if p.get("specialCurrencyCount", 0) > p.get("LSCC", 0): errors.append("Gems exceed LSCC.")
        active_char = p.get("activePlayerCharacter")
        owned_char_ids = [c.get("CharId") for c in p.get("Characters", [])]
        if "activePlayerCharacter" not in p:
            pass  # Key absent — game handles this natively
        elif active_char is None:
            if owned_char_ids:
                warnings.append("Active character is None (will be auto-fixed on download).")
            else:
                warnings.append("No characters owned.")
        elif active_char not in owned_char_ids:
            warnings.append(f"Active character {active_char} not in owned list.")
        if p.get("LCC", 0) < op.get("LCC", 0): warnings.append("LCC decreased from original value.")
        if p.get("LSCC", 0) < op.get("LSCC", 0): warnings.append("LSCC decreased from original value.")
        if p.get("coinCount", 0) < 0: errors.append("Negative coin balance.")
        if p.get("specialCurrencyCount", 0) < 0: errors.append("Negative gem balance.")
        if self.cfg:
            valid_art = {a.get("PID") for a in self.cfg.artifacts if a.get("PID") is not None}
            valid_art |= EXTRA_ARTIFACT_PIDS
            invalid_art = [pid for pid in p.get("artifactsPurchased", []) if pid not in valid_art]
            if invalid_art:
                errors.append(f"artifactsPurchased has invalid PIDs: {sorted(set(invalid_art))}.")
            deprecated = [pid for pid in p.get("artifactsPurchased", []) if pid in DEPRECATED_ARTIFACT_PIDS]
            if deprecated:
                warnings.append(f"artifactsPurchased includes deprecated PIDs: {sorted(set(deprecated))}.")
            valid_att = set(self.cfg.attachments)
            owned = {e.get("AttachmentId") for e in p.get("CharacterAttachments", []) if isinstance(e, dict)}
            invalid_owned = [aid for aid in owned if aid is not None and aid not in valid_att]
            if invalid_owned:
                errors.append(f"CharacterAttachments has invalid AttachmentId values: {sorted(set(invalid_owned))}.")
            # Note: Character Attachments.Hair uses a different ID scheme
            # (charId*1000 for defaults) than config attachment CIDs, so we
            # only validate Hair values that fall within the config CID range.
            equipped = []
            for c in p.get("Characters", []):
                hair = (c.get("Attachments") or {}).get("Hair")
                if hair is not None and hair in valid_att:
                    equipped.append(hair)
            missing_owned = [aid for aid in equipped if aid not in owned]
            if missing_owned:
                warnings.append(f"Equipped hats missing from CharacterAttachments: {sorted(set(missing_owned))}.")
        issues = errors + warnings
        return {"errors": errors, "warnings": warnings, "issues": issues,
            "issues_count": len(issues), "errors_count": len(errors),
            "risk": "HIGH" if errors else ("MED" if warnings else "LOW")}

    def diff(self) -> JsonObj:
        ch: list[JsonObj] = []
        def cmp(path: str, a: Any, b: Any) -> None:
            if a == b: return
            if isinstance(a, dict) and isinstance(b, dict):
                for k in set(list(a.keys()) + list(b.keys())):
                    cmp(f"{path}.{k}", a.get(k, "<absent>"), b.get(k, "<absent>"))
            elif isinstance(a, list) and isinstance(b, list) and len(a) != len(b):
                ch.append({"path": path, "old": f"[{len(a)}]", "new": f"[{len(b)}]"})
            elif a != b:
                ch.append({"path": path, "old": str(a)[:80] if not isinstance(a, (int, float, bool, str)) else a,
                    "new": str(b)[:80] if not isinstance(b, (int, float, bool, str)) else b})
        cmp("", self.original, self.working)
        return {"total": len(ch), "changes": ch[:200]}


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index(): return render_template("index.html")

@app.route("/favicon.ico")
def favicon():
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%234F46E5"/><path d="M12 12l8 8M20 12l-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>'
    return app.response_class(svg, mimetype="image/svg+xml")

@app.route("/api/upload", methods=["POST"])
def api_upload():
    f = request.files.get("file")
    if not f: return jsonify({"error": "No file."}), 400
    try: content = f.read().decode("utf-8")
    except UnicodeDecodeError: return jsonify({"error": "Not UTF-8."}), 400
    try: save = json.loads(content, object_pairs_hook=OrderedDict)
    except json.JSONDecodeError: return jsonify({"error": "Invalid JSON."}), 400
    if "hash" not in save or "data" not in save:
        return jsonify({"error": "Invalid save file format."}), 400
    cfg = ConfigDB(CFG_DIR) if os.path.isdir(CFG_DIR) else ConfigDB.from_save_data(save)
    cfg.merge_save_data(save)  # ensure original save items are never stripped
    ed = SaveEditor(save, cfg)
    # Fix critical save issues on upload (NewAttachment storm, Head values, etc.)
    ed._sanitize_on_upload()
    _cleanup_sessions()
    sid = uuid.uuid4().hex; sessions[sid] = {"ed": ed, "hk": HASH_KEY, "ha": HASH_ALGO, "ts": time.monotonic()}
    return jsonify({"session_id": sid, "analysis": ed.analysis()})

@app.route("/api/mode", methods=["POST"])
def api_mode():
    b = request.get_json(silent=True) or {}; s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    try: s["ed"].set_mode(b.get("mode", "inspect"))
    except ValueError as e: return jsonify({"error": str(e)}), 400
    return jsonify({"mode": b.get("mode"), "analysis": s["ed"].analysis()})

@app.route("/api/edit", methods=["POST"])
def api_edit():
    b = request.get_json(silent=True) or {}; s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    ed: SaveEditor = s["ed"]; a = b.get("action", ""); p = b.get("params", {})
    r = _dispatch(ed, a, p)
    if r is None: return jsonify({"error": f"Unknown action: {a}"}), 400
    try:
        ana = ed.analysis()
    except Exception as e:
        return jsonify({"error": f"Analysis failed after '{a}': {type(e).__name__}: {e}"}), 500
    return jsonify({"result": r, "is_error": r.startswith("ERROR"), "analysis": ana})

def _dispatch(ed: SaveEditor, a: str, p: JsonObj) -> str | None:
    try:
        match a:
            case "set_coins": return ed.set_coins(int(p["amount"]))
            case "set_gems": return ed.set_gems(int(p["amount"]))
            case "set_scrolls": return ed.set_scrolls(int(p["amount"]))
            case "set_keys": return ed.set_keys(int(p["amount"]))
            case "set_lcc": return ed.set_lcc(int(p["amount"]))
            case "set_lscc": return ed.set_lscc(int(p["amount"]))
            case "set_multiplier": return ed.set_multiplier(float(p["value"]))
            case "set_active": return ed.set_active(int(p["id"]))
            case "set_skin": return ed.set_skin(int(p["charId"]), int(p["skinId"]))
            case "set_power": return ed.set_power(int(p["charId"]), int(p["powerId"]))
            case "unlock_character": return ed.unlock_char(int(p["id"]))
            case "unlock_all_characters": return ed.unlock_all_chars()
            case "remove_character": return ed.remove_char(int(p["id"]))
            case "remove_all_characters": return ed.remove_all_chars()
            case "unlock_pet": return ed.unlock_pet(int(p["id"]))
            case "unlock_all_pets": return ed.unlock_all_pets()
            case "remove_pet": return ed.remove_pet(int(p["id"]))
            case "remove_all_pets": return ed.remove_all_pets()
            case "equip_hat": return ed.equip_hat(int(p["charId"]), int(p["id"]))
            case "remove_hat": return ed.remove_hat(int(p["charId"]))
            case "unlock_hat": return ed.unlock_hat(int(p["id"]))
            case "unlock_all_hats": return ed.unlock_all_hats()
            case "unlock_hat_batch": return ed.unlock_hat_batch(int(p.get("batchSize", 5)))
            case "remove_hat_ownership": return ed.remove_hat_ownership(int(p["id"]))
            case "remove_all_hats": return ed.remove_all_hats()
            case "unlock_collectable": return ed.unlock_collectable(int(p["id"]))
            case "unlock_all_collectables": return ed.unlock_all_collectables()
            case "lock_collectable": return ed.lock_collectable(int(p["id"]))
            case "lock_all_collectables": return ed.lock_all_collectables()
            case "max_all_currency": return ed.max_all_currency()
            case "unlock_artifact": return ed.unlock_artifact(int(p["id"]))
            case "unlock_all_artifacts": return ed.unlock_all_artifacts()
            case "remove_artifact": return ed.remove_artifact(int(p["id"]))
            case "remove_all_artifacts": return ed.remove_all_artifacts()
            case "unlock_power": return ed.unlock_power(int(p["id"]))
            case "unlock_all_powers": return ed.unlock_all_powers()
            case "remove_power": return ed.remove_power(int(p["id"]))
            case "remove_all_powers": return ed.remove_all_powers()
            case "max_power_levels": return ed.max_power_levels()
            case "purchase_region": return ed.purchase_region(int(p["id"]))
            case "purchase_all_regions": return ed.purchase_all_regions()
            case "unpurchase_region": return ed.unpurchase_region(int(p["id"]))
            case "unpurchase_all_regions": return ed.unpurchase_all_regions()
            case "complete_all_objectives": return ed.complete_all_objectives()
            case "uncomplete_objective": return ed.uncomplete_objective(int(p["id"]))
            case "uncomplete_all_objectives": return ed.uncomplete_all_objectives()
            case "complete_battle_pass": return ed.complete_battle_pass()
            case "reset_battle_pass": return ed.reset_battle_pass()
            case "complete_daily_challenges": return ed.complete_daily_challenges()
            case "reset_daily_challenges": return ed.reset_daily_challenges()
            case "max_perks": return ed.max_perks()
            case "reset_perks": return ed.reset_perks()
            case "set_perk": return ed.set_perk(int(p["index"]), int(p["value"]))
            case "max_potions": return ed.max_potions()
            case "reset_potions": return ed.reset_potions()
            case "set_potion": return ed.set_potion(str(p["type"]), int(p["count"]))
            case "complete_daily_totems": return ed.complete_daily_totems()
            case "reset_daily_totems": return ed.reset_daily_totems()
            case "complete_idol_quest": return ed.complete_idol_quest()
            case "reset_idol_quest": return ed.reset_idol_quest()
            case "complete_global_challenges": return ed.complete_global_challenges()
            case "reset_global_challenges": return ed.reset_global_challenges()
            case "complete_minigame": return ed.complete_minigame()
            case "reset_minigame": return ed.reset_minigame()
            case "set_hrfl": return ed.set_hrfl(bool(p.get("value", False)))
            case "set_field": return ed.set_field(str(p["key"]), p["value"])
            case "set_data_field": return ed.set_data_field(str(p["key"]), p["value"])
            case "unlock_everything": return ed.unlock_everything()
            case "randomize": return ed.randomize_values()
            case "randomize_economy": return ed.randomize_economy()
            case "randomize_stats": return ed.randomize_stats()
            case "max_account": return ed.max_account()
            case "set_stat": return ed.set_stat(str(p["key"]), int(p["value"]))
            case "set_player_level": return ed.set_player_level(int(p["level"]))
            case "set_streak": return ed.set_streak(int(p["value"]))
    except (KeyError, ValueError, TypeError) as e:
        return f"ERROR: Invalid parameters: {e}"
    except Exception as e:
        return f"ERROR: {type(e).__name__}: {e}"
    return None

@app.route("/api/validate", methods=["POST"])
def api_validate():
    b = request.get_json(silent=True) or {}; s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    return jsonify(s["ed"].validate())

@app.route("/api/diff", methods=["POST"])
def api_diff():
    b = request.get_json(silent=True) or {}; s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    return jsonify(s["ed"].diff())

@app.route("/api/hashkey", methods=["POST"])
def api_hashkey():
    b = request.get_json(silent=True) or {}; s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    s["hk"] = b.get("hash_key", HASH_KEY); s["ha"] = b.get("hash_algo", HASH_ALGO)
    return jsonify({"ok": True})

@app.route("/api/stats", methods=["POST"])
def api_stats():
    b = request.get_json(silent=True) or {}; s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    return jsonify(s["ed"].get_stats())

@app.route("/api/download", methods=["POST"])
def api_download():
    b = request.get_json(silent=True) or {}; s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    ed: SaveEditor = s["ed"]
    ed._sanitize_for_export()
    rpt = ed.validate()
    if rpt.get("errors_count", 0) > 0:
        return jsonify({"error": "Validation failed.", "validation": rpt}), 400
    try:
        ed.working["hash"] = compute_hash(ed.working["data"], s.get("hk", HASH_KEY), s.get("ha", HASH_ALGO))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    raw = json.dumps(ed.working, separators=(",", ":"), ensure_ascii=True)
    buf = io.BytesIO(raw.encode()); buf.seek(0)
    return send_file(buf, mimetype="text/plain", as_attachment=True, download_name="gamedata.txt")

ANNOTATIONS: JsonObj = {
    "hash": "Save integrity hash (auto recalculated on export)",
    "data": "Root data container",
    "version": "Save format version number",
    "HRFL": "Has Run First Launch flag (tutorial state)",
    "TS": "Save timestamp (Unix epoch seconds)",
    "InstallDate": "Installation date (Unix epoch)",
    "DaysSinceInstall": "Days since initial install",
    "DaysPlayed": "Total days played",
    "NoOfRunsSinceInstall": "Total run count",
    "CloudSavedVersion": "Cloud sync version identifier",
    "Players": "Player profile array",
    "coinCount": "Current coin balance",
    "specialCurrencyCount": "Current gem/premium currency balance",
    "scrollCount": "Map scroll count",
    "minigameTicketCount": "Treasure chest key count",
    "LCC": "Lifetime Coins Collected (must never decrease)",
    "LSCC": "Lifetime Special Currency Collected (must never decrease)",
    "SBC": "Score Bonus Coefficient (score multiplier)",
    "activePlayerCharacter": "Currently selected character ID",
    "Characters": "Array of owned character objects",
    "CharacterPets": "Array of owned pet objects",
    "artifactsPurchased": "List of purchased artifact IDs",
    "collectablesRedeemed": "[LEGACY] List of redeemed collectable category IDs",
    "CollectablesFound": "List of found collectable entries [{CollectableId, NumFound, NumRewarded, FoundState}]",
    "CharacterAttachments": "List of owned hat/attachment entries [{Version, AttachmentId, NewAttachment}]",
    "powersPurchased": "List of purchased power up IDs",
    "objectives": "List of completed objective IDs",
    "objectivesActiveData": "Currently active objective tracking",
    "NCA": "Daily challenge data array",
    "RM": "Region/Map manager data",
    "BPPDM": "Battle Pass player data manager",
    "BPCDDM": "Battle Pass claimed rewards data",
    "WFRDK": "Idol Quest (Weekly Featured Run) data",
    "DCPGDK": "Daily Totems challenge data",
    "RCPDM": "Global Challenges (Region Challenge) data",
    "consumablesDepthPurchased": "Perk upgrade levels per category",
    "PotionsAvailableData": "Available potion counts by type",
    "UCTKN": "Unlock tokens per character",
    "CharId": "Character identifier",
    "SkinId": "Skin variant index",
    "PowerId": "Equipped power up ID",
    "PetId": "Pet identifier",
    "Attachments": "Hat/accessory data for this character",
    "gameStats": "Game statistics container",
    "HS": "High Score (best run score)",
    "HSNR": "High Score No Revive (best score without revive)",
    "LD": "Longest Distance (meters in best run)",
    "LDNC": "Longest Distance No Continue",
    "TD": "Total Distance (cumulative meters)",
    "TRUNS": "Total Runs count",
    "TRESS": "Total Resurrections used",
    "TCC": "Total Coins Collected (lifetime)",
    "TGC": "Total Gems Collected (lifetime)",
    "HCC": "Highest Coins in one run",
    "HGC": "Highest Gems in one run",
    "TS": "Total Score (lifetime cumulative)",
    "TDCC": "Total Daily Challenge Completions",
    "TWCC": "Total Weekly Challenge Completions",
    "THSU": "Total Head Start Uses",
    "TMHSU": "Total Mega Head Start Uses",
    "TICC": "Total Items Collected (Coins)",
    "LPV119": "Last Played Version stat",
    "MGSDK": "Minigame storage data",
    "DLSDK": "Daily Login storage data",
    "DCPTDK": "Daily Challenge progress tracking",
    "DACI": "Daily Activity checklist (7 items)",
    "PotionsGiveAwayData": "Free potion giveaway tracking",
}


@app.route("/api/raw", methods=["POST"])
def api_raw():
    b = request.get_json(silent=True) or {}
    s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    ed: SaveEditor = s["ed"]
    formatted = json.dumps(ed.working, indent=2, ensure_ascii=True)
    return jsonify({"raw": formatted, "annotations": ANNOTATIONS})


@app.route("/api/raw_update", methods=["POST"])
def api_raw_update():
    b = request.get_json(silent=True) or {}
    s = sessions.get(b.get("session_id", ""))
    if not s: return jsonify({"error": "Session not found."}), 404
    ed: SaveEditor = s["ed"]
    if ed.mode != "experimental":
        return jsonify({"error": "Raw editing requires Experimental mode."}), 400
    raw_text = b.get("raw", "")
    try:
        parsed = json.loads(raw_text, object_pairs_hook=OrderedDict)
    except json.JSONDecodeError as ex:
        return jsonify({"error": f"JSON syntax error: {ex}"}), 400
    if not isinstance(parsed, dict) or "hash" not in parsed or "data" not in parsed:
        return jsonify({"error": "Invalid structure. Must contain hash and data fields."}), 400
    ed.working = parsed
    # Warn about dropped keys so user is aware of potential data loss
    dropped_p: list[str] = []; dropped_d: list[str] = []
    op = ed.original["data"]["Players"][0]  # type: ignore[index]
    np = parsed.get("data", {}).get("Players", [{}])[0]
    for k in op:
        if k not in np:
            dropped_p.append(k)
    for k in ed.original["data"]:  # type: ignore[union-attr]
        if k not in parsed.get("data", {}):
            dropped_d.append(k)
    warn = ""
    if dropped_p or dropped_d:
        warn = f" Warning: {len(dropped_p)} player keys and {len(dropped_d)} data keys dropped (will be auto-restored on download)."
    ed._log("raw_edit", f"Manual JSON modification applied{warn}", "HIGH")
    result_msg = f"Raw changes applied.{warn}"
    return jsonify({"result": result_msg, "analysis": ed.analysis()})


if __name__ == "__main__":
    print("TR2 Save Inspector running at http://localhost:8080")
    app.run(debug=False, port=8080)
