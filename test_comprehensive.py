#!/usr/bin/env python3
"""Comprehensive test suite for Temple Run 2 Save Editor."""
import requests, json, sys, os

BASE = "http://localhost:8080"
ROOT = os.path.dirname(__file__)
SAVE = os.path.join(ROOT, "gamedata.txt")
if not os.path.exists(SAVE):
    SAVE = os.path.join(ROOT, "gamedata.sample.txt")
PASS = 0; FAIL = 0; ERRORS = []

def ok(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f"  ✓ {name}")
    else:
        FAIL += 1; ERRORS.append(f"{name}: {detail}")
        print(f"  ✗ {name} — {detail}")

def upload():
    """Upload save and return session_id + analysis."""
    with open(SAVE, "rb") as f:
        r = requests.post(f"{BASE}/api/upload", files={"file": f})
    ok("Upload status", r.status_code == 200, f"got {r.status_code}")
    j = r.json()
    ok("Upload has session_id", "session_id" in j)
    ok("Upload has analysis", "analysis" in j)
    return j.get("session_id"), j.get("analysis", {})

def edit(sid, action, params=None):
    r = requests.post(f"{BASE}/api/edit", json={"session_id": sid, "action": action, "params": params or {}})
    return r.json()

def set_mode(sid, mode):
    r = requests.post(f"{BASE}/api/mode", json={"session_id": sid, "mode": mode})
    return r.json()

# ═══════════════════════════════════════════════════════════════════════════
print("=" * 70)
print("TEMPLE RUN 2 — COMPREHENSIVE TEST SUITE")
print("=" * 70)

# ── 1. Upload & Analysis ─────────────────────────────────────────────────
print("\n[1] Upload & Analysis")
sid, a = upload()
if not sid:
    print("FATAL: No session. Aborting."); sys.exit(1)

ok("Analysis has meta", "meta" in a)
ok("Analysis has economy", "economy" in a)
ok("Analysis has characters", "characters" in a and len(a["characters"]) > 0)
ok("Analysis has pets", "pets" in a and len(a["pets"]) > 0)
ok("Analysis has hats", "hats" in a)
ok("Analysis has collectables", "collectables" in a)
ok("Analysis has artifacts", "artifacts" in a)
ok("Analysis has powers", "powers" in a)
ok("Analysis has regions", "regions" in a)
ok("Analysis has objectives", "objectives" in a)
ok("Analysis has battlePass", "battlePass" in a)
ok("Analysis has dailyChallenges", "dailyChallenges" in a)
ok("Analysis has perks", "perks" in a and len(a["perks"]) == 10)
ok("Analysis has potions", "potions" in a)
ok("Analysis has idolQuest", "idolQuest" in a)
ok("Analysis has dailyTotems", "dailyTotems" in a)
ok("Analysis has globalChallenges", "globalChallenges" in a)
ok("Analysis has minigame", "minigame" in a)
ok("Analysis has streak", "streak" in a)
ok("Analysis has stats", "stats" in a)
ok("Analysis has editLog", "editLog" in a)
ok("Analysis has mode", a.get("mode") == "inspect")
ok("Analysis has safeMax", "safeMax" in a)
ok("Analysis has maxMultiplier", a.get("maxMultiplier") == 230)
ok("Analysis has playerLevel", "playerLevel" in a)

# ── 2. Sanitize-on-Upload Verification ───────────────────────────────────
print("\n[2] Sanitize-on-Upload Verification")
# After upload, all hat NewAttachment should be False
for h in a.get("hats", []):
    if h.get("owned"):
        # Check via raw view
        break
# Check via raw to confirm NewAttachment=False
r = requests.post(f"{BASE}/api/raw", json={"session_id": sid})
raw = json.loads(r.json().get("raw", "{}"))
players = raw.get("data", {}).get("Players", [{}])
if players:
    ca = players[0].get("CharacterAttachments", [])
    all_false = all(e.get("NewAttachment") == False for e in ca if isinstance(e, dict))
    ok("NewAttachment all False after upload", all_false, f"Found True entries" if not all_false else "")
    # Check no Head in Attachments
    no_head = all("Head" not in c.get("Attachments", {}) for c in players[0].get("Characters", []))
    ok("No Head in Attachments after upload", no_head)
    # Check dedup
    aids = [e.get("AttachmentId") for e in ca if isinstance(e, dict)]
    ok("No duplicate AttachmentIds", len(aids) == len(set(aids)), f"dupes: {len(aids) - len(set(aids))}")

# ── 3. Mode Switching ────────────────────────────────────────────────────
print("\n[3] Mode Switching")
# inspect → blocks edits
r = edit(sid, "set_coins", {"amount": 999})
ok("Inspect blocks set_coins", r.get("result", "").startswith("ERROR") or r.get("is_error"))

# Switch to cosmetic
m = set_mode(sid, "cosmetic")
ok("Switch to cosmetic", m.get("mode") == "cosmetic")

# Cosmetic blocks currency
r = edit(sid, "set_coins", {"amount": 999})
ok("Cosmetic blocks set_coins", r.get("result", "").startswith("ERROR") or r.get("is_error"))

# Switch to experimental
m = set_mode(sid, "experimental")
ok("Switch to experimental", m.get("mode") == "experimental")

# Invalid mode
m2 = set_mode(sid, "invalid_mode")
ok("Invalid mode rejected", "error" in m2)

# ── 4. Currency Operations ───────────────────────────────────────────────
print("\n[4] Currency Operations")
r = edit(sid, "set_coins", {"amount": 5000})
ok("set_coins", not r.get("is_error"), r.get("result", ""))
a2 = r.get("analysis", {})
ok("coins updated", a2.get("economy", {}).get("coins") == 5000)
# LCC auto-adjust
ok("LCC >= coins", a2.get("economy", {}).get("lcc", 0) >= 5000)

r = edit(sid, "set_gems", {"amount": 200})
ok("set_gems", not r.get("is_error"), r.get("result", ""))
ok("gems updated", r.get("analysis", {}).get("economy", {}).get("gems") == 200)
ok("LSCC >= gems", r.get("analysis", {}).get("economy", {}).get("lscc", 0) >= 200)

r = edit(sid, "set_scrolls", {"amount": 100})
ok("set_scrolls", not r.get("is_error"), r.get("result", ""))
ok("scrolls updated", r.get("analysis", {}).get("economy", {}).get("scrolls") == 100)

r = edit(sid, "set_keys", {"amount": 50})
ok("set_keys", not r.get("is_error"), r.get("result", ""))
ok("keys updated", r.get("analysis", {}).get("economy", {}).get("keys") == 50)

r = edit(sid, "set_lcc", {"amount": 999999})
ok("set_lcc", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "set_lscc", {"amount": 99999})
ok("set_lscc", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "set_multiplier", {"value": 50.0})
ok("set_multiplier", not r.get("is_error"), r.get("result", ""))
ok("mult updated", r.get("analysis", {}).get("economy", {}).get("mult") == 50.0)

# Boundary: multiplier out of range
r = edit(sid, "set_multiplier", {"value": 1000.0})
ok("mult > max rejected", r.get("is_error", False), r.get("result", ""))

# Boundary: negative coins
r = edit(sid, "set_coins", {"amount": -1})
ok("negative coins rejected", r.get("is_error", False), r.get("result", ""))

# Max all currency
r = edit(sid, "max_all_currency")
ok("max_all_currency", not r.get("is_error"), r.get("result", ""))
eco = r.get("analysis", {}).get("economy", {})
ok("coins maxed", eco.get("coins", 0) > 1000000)
ok("gems maxed", eco.get("gems", 0) > 1000000)

# ── 5. Characters ────────────────────────────────────────────────────────
print("\n[5] Characters")
chars = a.get("characters", [])
owned = [c for c in chars if c.get("owned")]
unowned = [c for c in chars if not c.get("owned")]

ok("Characters exist", len(chars) > 0, f"count={len(chars)}")
ok("Some owned", len(owned) > 0)

# Set active
if owned:
    cid = owned[0]["id"]
    r = edit(sid, "set_active", {"id": cid})
    ok("set_active", not r.get("is_error"), r.get("result", ""))

    # Set skin
    r = edit(sid, "set_skin", {"charId": cid, "skinId": 1})
    ok("set_skin", not r.get("is_error"), r.get("result", ""))

    # Set power
    r = edit(sid, "set_power", {"charId": cid, "powerId": 0})
    ok("set_power", not r.get("is_error"), r.get("result", ""))

# Unlock a character
if unowned:
    uid = unowned[0]["id"]
    r = edit(sid, "unlock_character", {"id": uid})
    ok("unlock_character", not r.get("is_error"), r.get("result", ""))
    # Remove it back
    r = edit(sid, "remove_character", {"id": uid})
    ok("remove_character", not r.get("is_error"), r.get("result", ""))

# Unlock all
r = edit(sid, "unlock_all_characters")
ok("unlock_all_characters", not r.get("is_error"), r.get("result", ""))
all_owned_after = [c for c in r.get("analysis", {}).get("characters", []) if c.get("owned")]
ok("all chars owned", len(all_owned_after) >= len(chars) - 2)  # some may be special

# Remove all (then re-unlock)
r = edit(sid, "remove_all_characters")
ok("remove_all_characters", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "unlock_all_characters")  # restore

# ── 6. Pets ──────────────────────────────────────────────────────────────
print("\n[6] Pets")
pets = a.get("pets", [])
ok("Pets list exists", len(pets) > 0, f"count={len(pets)}")

unowned_pets = [p for p in pets if not p.get("owned")]
if unowned_pets:
    pid = unowned_pets[0]["id"]
    r = edit(sid, "unlock_pet", {"id": pid})
    ok("unlock_pet", not r.get("is_error"), r.get("result", ""))
    r = edit(sid, "remove_pet", {"id": pid})
    ok("remove_pet", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "unlock_all_pets")
ok("unlock_all_pets", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "remove_all_pets")
ok("remove_all_pets", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "unlock_all_pets")  # restore

# ── 7. Hats ──────────────────────────────────────────────────────────────
print("\n[7] Hats")
hats = a.get("hats", [])
ok("Hats list exists", len(hats) > 0, f"count={len(hats)}")

# unlock_hat_batch
r = edit(sid, "unlock_hat_batch", {"batchSize": 5})
ok("unlock_hat_batch", not r.get("is_error"), r.get("result", ""))

# unlock_all_hats
r = edit(sid, "unlock_all_hats")
ok("unlock_all_hats", not r.get("is_error"), r.get("result", ""))

# Equip a hat on a character (using already-owned hats from save)
owned_hats = [h for h in hats if h.get("owned")]
owned_chars = [c for c in a.get("characters", []) if c.get("owned")]
if owned_hats and owned_chars:
    hat_id = owned_hats[0]["id"]
    char_id = owned_chars[0]["id"]
    r = edit(sid, "equip_hat", {"charId": char_id, "id": hat_id})
    ok("equip_hat", not r.get("is_error"), r.get("result", ""))
    r = edit(sid, "remove_hat", {"charId": char_id})
    ok("remove_hat", not r.get("is_error"), r.get("result", ""))

# Remove ownership
if owned_hats:
    r = edit(sid, "remove_hat_ownership", {"id": owned_hats[0]["id"]})
    ok("remove_hat_ownership", not r.get("is_error"), r.get("result", ""))

# Remove all
r = edit(sid, "remove_all_hats")
ok("remove_all_hats", not r.get("is_error"), r.get("result", ""))

# ── 8. Collectables ─────────────────────────────────────────────────────
print("\n[8] Collectables")
collectables = a.get("collectables", [])
ok("Collectables list exists", len(collectables) > 0, f"count={len(collectables)}")

unredeemed = [c for c in collectables if not c.get("redeemed")]
if unredeemed:
    cid = unredeemed[0]["id"]
    r = edit(sid, "unlock_collectable", {"id": cid})
    ok("unlock_collectable", not r.get("is_error"), r.get("result", ""))
    r = edit(sid, "lock_collectable", {"id": cid})
    ok("lock_collectable", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "unlock_all_collectables")
ok("unlock_all_collectables", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "lock_all_collectables")
ok("lock_all_collectables", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "unlock_all_collectables")  # restore

# ── 9. Artifacts ─────────────────────────────────────────────────────────
print("\n[9] Artifacts")
artifacts = a.get("artifacts", [])
ok("Artifacts list exists", len(artifacts) > 0, f"count={len(artifacts)}")

unowned_arts = [ar for ar in artifacts if not ar.get("owned")]
owned_arts = [ar for ar in artifacts if ar.get("owned")]
if unowned_arts:
    pid = unowned_arts[0]["id"]
    r = edit(sid, "unlock_artifact", {"id": pid})
    ok("unlock_artifact", not r.get("is_error"), r.get("result", ""))
    r = edit(sid, "remove_artifact", {"id": pid})
    ok("remove_artifact", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "unlock_all_artifacts")
ok("unlock_all_artifacts", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "remove_all_artifacts")
ok("remove_all_artifacts", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "unlock_all_artifacts")  # restore

# ── 10. Powers ───────────────────────────────────────────────────────────
print("\n[10] Powers")
powers = a.get("powers", [])
ok("Powers list exists", len(powers) > 0, f"count={len(powers)}")

unowned_pows = [pw for pw in powers if not pw.get("owned")]
if unowned_pows:
    pid = unowned_pows[0]["id"]
    r = edit(sid, "unlock_power", {"id": pid})
    ok("unlock_power", not r.get("is_error"), r.get("result", ""))
    r = edit(sid, "remove_power", {"id": pid})
    ok("remove_power", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "unlock_all_powers")
ok("unlock_all_powers", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "max_power_levels")
ok("max_power_levels", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "remove_all_powers")
ok("remove_all_powers", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "unlock_all_powers")  # restore

# ── 11. Regions ──────────────────────────────────────────────────────────
print("\n[11] Regions")
regions = a.get("regions", [])
ok("Regions list exists", len(regions) > 0, f"count={len(regions)}")

unpurch = [r for r in regions if not r.get("purchased")]
if unpurch:
    rid = unpurch[0]["id"]
    r = edit(sid, "purchase_region", {"id": rid})
    ok("purchase_region", not r.get("is_error"), r.get("result", ""))
    r = edit(sid, "unpurchase_region", {"id": rid})
    ok("unpurchase_region", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "purchase_all_regions")
ok("purchase_all_regions", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "unpurchase_all_regions")
ok("unpurchase_all_regions", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "purchase_all_regions")  # restore

# ── 12. Objectives ───────────────────────────────────────────────────────
print("\n[12] Objectives")
objs = a.get("objectives", {})
ok("Objectives data", "items" in objs)

r = edit(sid, "complete_all_objectives")
ok("complete_all_objectives", not r.get("is_error"), r.get("result", ""))
comp = r.get("analysis", {}).get("objectives", {})
ok("all completed", comp.get("completed", 0) > 0)

# Uncomplete one
items = comp.get("items", [])
completed_items = [o for o in items if o.get("completed")]
if completed_items:
    pid = completed_items[0]["id"]
    r = edit(sid, "uncomplete_objective", {"id": pid})
    ok("uncomplete_objective", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "uncomplete_all_objectives")
ok("uncomplete_all_objectives", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "complete_all_objectives")  # restore

# Set player level
r = edit(sid, "set_player_level", {"level": 100})
ok("set_player_level", not r.get("is_error"), r.get("result", ""))

# ── 13. Battle Pass ──────────────────────────────────────────────────────
print("\n[13] Battle Pass")
bp = a.get("battlePass")
ok("Battle pass data exists", "battlePass" in a)  # may be None if no active BP in save

r = edit(sid, "complete_battle_pass")
ok("complete_battle_pass", not r.get("is_error"), r.get("result", ""))
bp_after = r.get("analysis", {}).get("battlePass", {})
if bp_after:
    ok("BP tiers unlocked", bp_after.get("unlockedTiers", 0) > 0, f"unlocked={bp_after.get('unlockedTiers', 0)}")
    ok("BP premium bought", bp_after.get("premium", False))

r = edit(sid, "reset_battle_pass")
ok("reset_battle_pass", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "complete_battle_pass")  # restore

# ── 14. Daily Challenges ─────────────────────────────────────────────────
print("\n[14] Daily Challenges")
dc = a.get("dailyChallenges", [])
ok("Daily challenges field", "dailyChallenges" in a, f"count={len(dc)}")

r = edit(sid, "complete_daily_challenges")
ok("complete_daily_challenges (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

r = edit(sid, "reset_daily_challenges")
ok("reset_daily_challenges (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

# ── 15. Perks ────────────────────────────────────────────────────────────
print("\n[15] Perks")
perks = a.get("perks", [])
ok("10 perks", len(perks) == 10, f"count={len(perks)}")

# Perks are server-managed — all perk operations return info messages
r = edit(sid, "max_perks")
ok("max_perks (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

r = edit(sid, "reset_perks")
ok("reset_perks (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

r = edit(sid, "set_perk", {"index": 0, "value": 5})
ok("set_perk (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

# ── 16. Potions ──────────────────────────────────────────────────────────
print("\n[16] Potions")
potions = a.get("potions", [])
ok("Potions exist", len(potions) > 0)

r = edit(sid, "max_potions")
ok("max_potions", not r.get("is_error"), r.get("result", ""))
pots_after = r.get("analysis", {}).get("potions", [])
all_999 = all(p.get("count") == 999 for p in pots_after)
ok("all potions at 999", all_999)

r = edit(sid, "reset_potions")
ok("reset_potions", not r.get("is_error"), r.get("result", ""))

# Set individual potion
if pots_after:
    ptype = pots_after[0].get("type", "PowerPotion")
    r = edit(sid, "set_potion", {"type": ptype, "count": 42})
    ok("set_potion", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "max_potions")  # restore

# ── 17. Daily Totems ─────────────────────────────────────────────────────
print("\n[17] Daily Totems")
dt = a.get("dailyTotems")
ok("Daily totems data", "dailyTotems" in a)  # may be None if no server data

r = edit(sid, "complete_daily_totems")
ok("complete_daily_totems", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "reset_daily_totems")
ok("reset_daily_totems", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "complete_daily_totems")  # restore

# ── 18. Idol Quest ───────────────────────────────────────────────────────
print("\n[18] Idol Quest")
iq = a.get("idolQuest")
ok("Idol quest data", "idolQuest" in a)  # may be None if no server data

# Idol Quest is server-tracked
r = edit(sid, "complete_idol_quest")
ok("complete_idol_quest (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

r = edit(sid, "reset_idol_quest")
ok("reset_idol_quest (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

# ── 19. Global Challenges ────────────────────────────────────────────────
print("\n[19] Global Challenges")
gc = a.get("globalChallenges", [])
ok("Global challenges data", isinstance(gc, list))  # may be empty if no active GC

# Global challenges are server-managed
r = edit(sid, "complete_global_challenges")
ok("complete_global_challenges (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

r = edit(sid, "reset_global_challenges")
ok("reset_global_challenges (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

# ── 20. Minigame ─────────────────────────────────────────────────────────
print("\n[20] Minigame")
mg = a.get("minigame", {})
ok("Minigame data", mg is not None)

r = edit(sid, "complete_minigame")
ok("complete_minigame", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "reset_minigame")
ok("reset_minigame", not r.get("is_error"), r.get("result", ""))
r = edit(sid, "complete_minigame")  # restore

# ── 21. Streak ───────────────────────────────────────────────────────────
print("\n[21] Streak")
# Streak is server-managed
r = edit(sid, "set_streak", {"value": 100})
ok("set_streak (server-managed)", "server" in r.get("result", "").lower(), r.get("result", ""))

# ── 22. Stats ────────────────────────────────────────────────────────────
print("\n[22] Stats")
r = edit(sid, "set_stat", {"key": "TRUNS", "value": 500})
ok("set_stat", not r.get("is_error"), r.get("result", ""))

# Out of range
r = edit(sid, "set_stat", {"key": "HS", "value": -1})
ok("negative stat rejected", r.get("is_error", False))

# ── 23. HRFL & Field Setters ─────────────────────────────────────────────
print("\n[23] HRFL & Field Setters")
r = edit(sid, "set_hrfl", {"value": True})
ok("set_hrfl", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "set_field", {"key": "testKey", "value": 42})
ok("set_field", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "set_data_field", {"key": "testDataKey", "value": "hello"})
ok("set_data_field", not r.get("is_error"), r.get("result", ""))

# Sensitive key blocked
r = edit(sid, "set_field", {"key": "iapt", "value": "hack"})
ok("sensitive key blocked", r.get("is_error", False))

# ── 24. Randomize ────────────────────────────────────────────────────────
print("\n[24] Randomize")
r = edit(sid, "randomize")
ok("randomize", not r.get("is_error"), r.get("result", ""))
ra = r.get("analysis", {})
ok("rand perks present", len(ra.get("perks", [])) == 10)
ok("rand potions present", len(ra.get("potions", [])) > 0)
ok("rand streak set", ra.get("streak", {}).get("cdcs", -1) >= 0)
ok("rand mult set", ra.get("economy", {}).get("mult", -1) >= 1.0)

r = edit(sid, "randomize_economy")
ok("randomize_economy", not r.get("is_error"), r.get("result", ""))

r = edit(sid, "randomize_stats")
ok("randomize_stats", not r.get("is_error"), r.get("result", ""))

# ── 25. Unlock Everything ────────────────────────────────────────────────
print("\n[25] Unlock Everything")
# Fresh upload for clean state
sid2, _ = upload()
set_mode(sid2, "experimental")
r = edit(sid2, "unlock_everything")
ok("unlock_everything", not r.get("is_error"), r.get("result", ""))
ae = r.get("analysis", {})
ok("UE chars owned", all(c.get("owned") for c in ae.get("characters", []) if c.get("id")))
ok("UE currencies maxed", ae.get("economy", {}).get("coins", 0) > 1000000)

# ── 26. Max Account ──────────────────────────────────────────────────────
print("\n[26] Max Account")
sid3, _ = upload()
set_mode(sid3, "experimental")
r = edit(sid3, "max_account")
ok("max_account", not r.get("is_error"), r.get("result", ""))
am = r.get("analysis", {})
ok("MA coins maxed", am.get("economy", {}).get("coins", 0) > 1000000)
ok("MA streak=365", am.get("streak", {}).get("cdcs") == 365)
# Perks are server-managed, so max_account won't change perk levels
ok("MA perks unchanged (server-managed)", len(am.get("perks", [])) == 10)
ok("MA potions maxed", all(p.get("count") == 999 for p in am.get("potions", [])))
# Multiplier should be calculated (1 + SM objectives + SM artifacts)
ok("MA mult calculated", am.get("economy", {}).get("mult", 0) >= 1.0)
# Check stats
stats = am.get("stats", {}).get("lifetime", {})
ok("MA HS maxed", stats.get("HS", 0) > 1000000)
ok("MA TRUNS maxed", stats.get("TRUNS", 0) > 1000000)
ok("MA TRESS maxed", stats.get("TRESS", 0) > 0)
ok("MA TS maxed", stats.get("TS", 0) > 0)
ok("MA TDCC maxed", stats.get("TDCC", 0) > 0)

# ── 27. Validate ─────────────────────────────────────────────────────────
print("\n[27] Validate")
r = requests.post(f"{BASE}/api/validate", json={"session_id": sid3})
v = r.json()
ok("validate response", "errors" in v and "warnings" in v)
ok("no validation errors (maxed)", v.get("errors_count", 99) == 0, f"errors: {v.get('errors', [])}")

# ── 28. Diff ─────────────────────────────────────────────────────────────
print("\n[28] Diff")
r = requests.post(f"{BASE}/api/diff", json={"session_id": sid3})
d = r.json()
ok("diff response", "total" in d and "changes" in d)
ok("diff has changes", d.get("total", 0) > 0, f"total={d.get('total', 0)}")

# ── 29. Hash Key ─────────────────────────────────────────────────────────
print("\n[29] Hash Key")
r = requests.post(f"{BASE}/api/hashkey", json={"session_id": sid3, "hash_key": "CustomKey", "hash_algo": "md5_append"})
ok("hashkey update", r.json().get("ok"))

# ── 30. Download ─────────────────────────────────────────────────────────
print("\n[30] Download")
r = requests.post(f"{BASE}/api/download", json={"session_id": sid3})
ok("download status", r.status_code == 200, f"got {r.status_code}: {r.text[:200] if r.status_code != 200 else 'ok'}")
if r.status_code == 200:
    dl = json.loads(r.content)
    ok("download has hash", "hash" in dl)
    ok("download has data", "data" in dl)
    # Verify NewAttachment=False in download
    dl_p = dl.get("data", {}).get("Players", [{}])[0]
    all_na_false = all(e.get("NewAttachment") == False for e in dl_p.get("CharacterAttachments", []) if isinstance(e, dict))
    ok("download NewAttachment=False", all_na_false)
    # No Head in Attachments
    no_head_dl = all("Head" not in c.get("Attachments", {}) for c in dl_p.get("Characters", []) if c.get("Attachments"))
    ok("download no Head", no_head_dl)
    # Re-upload the downloaded file to verify round-trip
    import io
    r2 = requests.post(f"{BASE}/api/upload", files={"file": ("gamedata.txt", io.BytesIO(r.content))})
    ok("round-trip re-upload", r2.status_code == 200, f"got {r2.status_code}")

# ── 31. Raw View & Raw Update ────────────────────────────────────────────
print("\n[31] Raw View & Raw Update")
r = requests.post(f"{BASE}/api/raw", json={"session_id": sid})
rj = r.json()
ok("raw view", "raw" in rj)
ok("raw annotations", "annotations" in rj and len(rj["annotations"]) > 10)

# Raw update (experimental mode already set for sid)
raw_data = json.loads(rj["raw"])
raw_data["data"]["Players"][0]["coinCount"] = 12345
r = requests.post(f"{BASE}/api/raw_update", json={
    "session_id": sid, "raw": json.dumps(raw_data)
})
ok("raw_update", r.json().get("result", "").startswith("Raw"))
ok("raw_update coins", r.json().get("analysis", {}).get("economy", {}).get("coins") == 12345)

# Raw update blocked in non-experimental mode
sid4, _ = upload()
r = requests.post(f"{BASE}/api/raw_update", json={
    "session_id": sid4, "raw": "{}"
})
ok("raw_update blocked in inspect", r.status_code == 400)

# ── 32. Error Handling ───────────────────────────────────────────────────
print("\n[32] Error Handling")
# Missing session
r = requests.post(f"{BASE}/api/edit", json={"session_id": "nonexistent", "action": "set_coins", "params": {"amount": 1}})
ok("missing session 404", r.status_code == 404)

# Unknown action
r = edit(sid, "nonexistent_action", {"foo": "bar"})
ok("unknown action error", "error" in r or r.get("result") is None, str(r))

# Missing params
r = edit(sid, "set_coins", {})
ok("missing params error", r.get("is_error", False) or "error" in r)

# Upload non-JSON
r = requests.post(f"{BASE}/api/upload", files={"file": ("test.txt", b"not json")})
ok("non-JSON upload rejected", r.status_code == 400)

# Upload missing hash
r = requests.post(f"{BASE}/api/upload", files={"file": ("test.txt", b'{"data": {}}')} )
ok("missing hash rejected", r.status_code == 400)

# No file upload
r = requests.post(f"{BASE}/api/upload")
ok("no file rejected", r.status_code == 400)

# ── 33. Stats Endpoint ───────────────────────────────────────────────────
print("\n[33] Stats Endpoint")
r = requests.post(f"{BASE}/api/stats", json={"session_id": sid})
sj = r.json()
ok("stats has lifetime", "lifetime" in sj)
ok("stats has perCharacter", "perCharacter" in sj)

# ── 34. Frontend Routes ─────────────────────────────────────────────────
print("\n[34] Frontend Routes")
r = requests.get(f"{BASE}/")
ok("homepage 200", r.status_code == 200)
ok("homepage has TR2", "Temple Run" in r.text or "TR2" in r.text or "temple" in r.text.lower())

r = requests.get(f"{BASE}/favicon.ico")
ok("favicon 200", r.status_code == 200)
ok("favicon is SVG", "svg" in r.text.lower())

# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print(f"RESULTS: {PASS} passed, {FAIL} failed out of {PASS + FAIL} tests")
print("=" * 70)
if ERRORS:
    print("\nFAILURES:")
    for e in ERRORS:
        print(f"  ✗ {e}")
    sys.exit(1)
else:
    print("\nAll tests passed! ✓")
    sys.exit(0)
