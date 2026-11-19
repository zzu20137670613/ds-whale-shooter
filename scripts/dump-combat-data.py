"""
Dump weapons + monsters as JSON so the workbook builder can reorder the tables
without a YAML parser on the Python side.

Classification comes from data, not from prose:
  * a weapon is 角色武器 when some character lists it in `hotbar`, plus the two
    reserved rewards that `weapons/index.yaml` calls "not in any loadout";
  * a weapon is 怪物武器 when some monster names it as `weaponId`;
  * melee vs ranged is read from the weapon itself: no `projectile.speed` means
    there is no bullet, which is exactly what `isMelee` means in the engine.
"""

import json
import os
import re
from pathlib import Path

ROOT = os.environ.get("WHALE_REPO") or str(Path(__file__).resolve().parent.parent)
OUT = os.path.join(os.environ["TEMP"], "combat-data.json")

# `weapons/index.yaml` labels these two as reserved rewards outside any loadout.
RESERVED_PLAYER_WEAPONS = {"arcana-staff", "rocket-launcher"}


def read(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def num(text, pattern):
    match = re.search(pattern, text, re.M)
    return float(match[1]) if match else None


def word(text, pattern):
    # re.M matters: every pattern here is anchored with ^ and the keys live on
    # their own lines. Without it, `name` and `nameZh` silently came back None.
    match = re.search(pattern, text, re.M)
    value = match[1].strip()
    return value.strip("\"'").strip() if match else None


def weapons():
    folder = os.path.join(ROOT, "public", "data", "weapons")
    result = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".yaml") or name == "index.yaml":
            continue
        text = read(os.path.join(folder, name))
        costs = re.search(r"costs:\s*\[([^\]]+)\]", text)
        result.append(
            {
                "id": name[:-5],
                "name": word(text, r"^name:\s*(.+)$"),
                "nameZh": word(text, r'^nameZh:\s*"?(.+?)"?$'),
                "dmg": num(text, r"^\s*damage:\s*([\d.]+)"),
                "cd": num(text, r"cooldownMs:\s*(\d+)"),
                "range": num(text, r"^\s*range:\s*([\d.]+)"),
                # bulletsPerShot is the real key; `count` never existed and made
                # White Dragon Fangs read as a 54 DPS gun instead of 108.8.
                "count": num(text, r"bulletsPerShot:\s*(\d+)") or 1,
                "clip": num(text, r"clipSize:\s*(\d+)"),
                "reload": num(text, r"reloadTimeMs:\s*(\d+)"),
                "speed": num(text, r"speed:\s*([\d.]+)"),
                "life": num(text, r"lifeMs:\s*(\d+)"),
                "aoe": num(text, r"aoeRadius:\s*([\d.]+)"),
                "costs": [int(x) for x in costs[1].split(",")] if costs else [],
                "mul": num(text, r"damageMulPerLevel:\s*([\d.]+)"),
                # Explicit ladder wins in the engine; the sheet should show the
                # same number the game uses.
                "damagePerLevel": (
                    [int(x) for x in re.search(r"damagePerLevel:\s*\[([^\]]+)\]", text, re.M)[1].split(",")]
                    if re.search(r"damagePerLevel:\s*\[([^\]]+)\]", text, re.M)
                    else None
                ),
            }
        )
    return result


def characters():
    folder = os.path.join(ROOT, "public", "data", "characters")
    result = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".yaml") or name == "index.yaml":
            continue
        text = read(os.path.join(folder, name))
        hotbar = re.search(r"hotbar:\s*\n((?:\s*-\s*\S+\n)+)", text)
        result.append(
            {
                "id": name[:-5],
                "name": word(text, r"^name:\s*(.+)$"),
                "nameZh": word(text, r'^nameZh:\s*"?(.+?)"?$'),
                "hotbar": [line.strip(" -") for line in hotbar[1].splitlines()] if hotbar else [],
            }
        )
    return result


def monsters():
    folder = os.path.join(ROOT, "public", "data", "monsters")
    result = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".yaml") or name == "index.yaml":
            continue
        text = read(os.path.join(folder, name))
        drops = re.findall(r"-\s*dropId:\s*(\S+)\s*\n\s*chance:\s*([\d.]+)", text)
        result.append(
            {
                "id": name[:-5],
                "name": word(text, r"^name:\s*(.+)$"),
                "nameZh": word(text, r'^nameZh:\s*"?(.+?)"?$'),
                "hp": num(text, r"^hp:\s*([\d.]+)"),
                "money": num(text, r"^money:\s*([\d.]+)"),
                "moveSpeed": num(text, r"moveSpeed:\s*([\d.]+)"),
                "halfW": num(text, r"halfW:\s*(\d+)"),
                "halfH": num(text, r"halfH:\s*(\d+)"),
                "weaponId": word(text, r"weaponId:\s*(\S+)"),
                "prop": bool(re.search(r"^prop:\s*true", text, re.M)),
                "drops": [{"dropId": d, "chance": float(c)} for d, c in drops],
            }
        )
    return result


weapon_list = weapons()
character_list = characters()
monster_list = monsters()

monster_weapon_ids = {m["weaponId"] for m in monster_list if m["weaponId"]}
character_weapon_ids = {w for c in character_list for w in c["hotbar"]}
character_weapon_ids |= RESERVED_PLAYER_WEAPONS

for weapon in weapon_list:
    weapon["isMelee"] = weapon["speed"] is None
    if weapon["id"] in monster_weapon_ids:
        weapon["side"] = "monster"
    elif weapon["id"] in character_weapon_ids:
        weapon["side"] = "character"
    else:
        # Nothing owns it: kept visible and flagged rather than silently dropped.
        weapon["side"] = "unowned"

weapon_by_id = {w["id"]: w for w in weapon_list}
for monster in monster_list:
    weapon = weapon_by_id.get(monster["weaponId"])
    monster["isMelee"] = weapon["isMelee"] if weapon else None
    monster["prop"] = monster["prop"] or monster["id"] == "hollow-emblem"

payload = {
    "weapons": weapon_list,
    "characters": character_list,
    "monsters": monster_list,
}
with open(OUT, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=1)

print("导出:", OUT)
print("  武器", len(weapon_list), "把:",
      {s: sum(1 for w in weapon_list if w["side"] == s) for s in ("character", "monster", "unowned")})
print("  未归属:", [w["id"] for w in weapon_list if w["side"] == "unowned"] or "（无）")
print("  怪物", len(monster_list), "只:",
      {k: sum(1 for m in monster_list if (m["prop"] and k == "道") or (not m["prop"] and m["isMelee"] and k == "近") or (not m["prop"] and m["isMelee"] is False and k == "远"))
       for k in ("道", "近", "远")})
