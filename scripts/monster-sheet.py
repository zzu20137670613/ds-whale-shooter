"""Add a 血量变迁 sheet: the tuned HP before it was flattened, the design-sheet
HP that replaced it, and the effective HP each level applies today.

The owner remembered an undocumented HP change. It was commit 487d6fb
(2026-10-20, "flatten every monster hp and attack to 1"), which threw away the
hand-tuned pool and replaced it with 1; c9567ff then wrote in the design-sheet
numbers, and 32bed1a added the 2x / melee multipliers on top. This sheet puts all
three generations side by side so he can rebuild the curve he actually wants.
"""

from __future__ import annotations

import io
import re
import subprocess
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = Path(
    r"C:\Users\15639732925\Documents\deepseek-harness\default-workspace\whale-shooter\ds-whale-shooter-PC"
)
DATA = ROOT / "public" / "data"
OUT = Path(
    r"C:\Users\15639732925\Documents\deepseek-harness\default-workspace\whale-shooter\怪物数值表-2026-11-12.xlsx"
)

HEADER_FILL = PatternFill("solid", fgColor="1F2937")
HEADER_FONT = Font(bold=True, color="F9FAFB", size=11)
BOSS_FILL = PatternFill("solid", fgColor="4C1D95")
WARN_FILL = PatternFill("solid", fgColor="7C2D12")

# 被 487d6fb 拍平之前的那一批（git: 487d6fb~1）。
BEFORE_FLATTEN = {
    "drone": 160,
    "drone-ultra": 320,
    "gunner": 120,
    "keeper": 400,
    "sniper": 90,
    "stalker": 140,
    "warden": 1500,
}
# 设计表那一批（git: c9567ff）。
DESIGN_SHEET = {
    "drone": 70,
    "drone-ultra": 90,
    "gunner": 40,
    "keeper": 90,
    "sniper": 60,
    "stalker": 55,
    "warden": 100,
}


def read(path: Path) -> str:
    return io.open(path, encoding="utf-8").read()


def scalar(text: str, key: str, *, any_indent: bool = False) -> str | None:
    head = r"^\s*" if any_indent else r"^"
    match = re.search(rf"{head}{key}:\s*(.+?)\s*$", text, re.M)
    return match.group(1).strip().strip('"\'') if match else None


def number(text: str, key: str, *, any_indent: bool = False) -> float | None:
    raw = scalar(text, key, any_indent=any_indent)
    try:
        return float(raw) if raw is not None else None
    except ValueError:
        return None


def spawner_block(text: str) -> str:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.strip() == "spawner:":
            collected = [line]
            for follow in lines[index + 1 :]:
                if re.match(r"^[A-Za-z#]", follow):
                    break
                collected.append(follow)
            return "\n".join(collected)
    return ""


def pool_ids(block: str, key: str) -> list[str]:
    match = re.search(rf"^\s*{key}:\s*\[(.*?)\]", block, re.M)
    return [part.strip() for part in match.group(1).split(",") if part.strip()] if match else []


def final_wave_ids(block: str) -> list[str]:
    match = re.search(r"^\s*finalWave:\s*\n((?:\s+.*\n?)*)", block, re.M)
    return re.findall(r"^\s*-\s*([a-z0-9-]+)\s*$", match.group(1), re.M) if match else []


def monsters() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    for path in sorted((DATA / "monsters").glob("*.yaml")):
        if path.stem == "index":
            continue
        text = read(path)
        rows[path.stem] = {
            "id": path.stem,
            "nameZh": scalar(text, "nameZh") or "",
            "name": scalar(text, "name") or "",
            "hp": number(text, "hp"),
            "money": number(text, "money"),
            "moveSpeed": number(text, "moveSpeed"),
            "armor": number(text, "armor") or 0,
            "weaponId": scalar(text, "weaponId") or "",
            "bossAttack": scalar(text, "bossAttack") or "",
            "damageScale": number(text, "bossAttackDamageScale"),
            "text": text,
        }
    return rows


def weapons() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    for path in sorted((DATA / "weapons").glob("*.yaml")):
        if path.stem == "index":
            continue
        text = read(path)
        rows[path.stem] = {
            "cooldownMs": number(text, "cooldownMs"),
            "damage": number(text, "damage"),
            "aoeRadius": number(text, "aoeRadius"),
        }
    return rows


def levels() -> list[dict]:
    rows: list[dict] = []
    for path in sorted((DATA / "levels").glob("*.yaml")):
        if path.stem == "index":
            continue
        text = read(path)
        block = spawner_block(text)
        if not block:
            continue
        rows.append(
            {
                "id": path.stem,
                "titleZh": scalar(text, "titleZh") or "",
                "waves": number(block, "waves", any_indent=True),
                "hpMultiplier": number(block, "hpMultiplier", any_indent=True) or 1,
                "meleeHpMultiplier": number(block, "meleeHpMultiplier", any_indent=True) or 1,
                "melee": pool_ids(block, "melee"),
                "ranged": pool_ids(block, "ranged"),
                "finalWave": final_wave_ids(block),
            }
        )
    return rows


def style(sheet, widths: list[int]) -> None:
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    for cell in sheet[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions


def main() -> int:
    mon = monsters()
    wpn = weapons()
    lvls = levels()

    book = Workbook()

    # ── 怪物 ──
    sheet = book.active
    sheet.title = "怪物"
    sheet.append(
        ["id", "中文名", "英文名", "HP", "金钱", "移速", "护甲", "武器", "武器冷却ms", "每次伤害", "爆炸半径", "守关招式", "伤害倍率"]
    )
    for row in mon.values():
        weapon = wpn.get(row["weaponId"], {})
        sheet.append(
            [
                row["id"],
                row["nameZh"],
                row["name"],
                row["hp"],
                row["money"],
                row["moveSpeed"],
                row["armor"],
                row["weaponId"],
                weapon.get("cooldownMs"),
                weapon.get("damage"),
                weapon.get("aoeRadius"),
                row["bossAttack"],
                row["damageScale"],
            ]
        )
    style(sheet, [22, 12, 20, 8, 6, 7, 6, 26, 11, 9, 10, 14, 9])

    # ── 血量变迁 ──
    sheet = book.create_sheet("血量变迁")
    sheet.append(
        [
            "id",
            "中文名",
            "① 拍平前(10-20)",
            "② 设计表(10-27)",
            "③ 现在基础",
            "③÷①",
            "说明",
        ]
    )
    for monster_id, before in BEFORE_FLATTEN.items():
        row = mon.get(monster_id, {})
        now = row.get("hp")
        ratio = None if not now else round(now / before, 2)
        sheet.append(
            [
                monster_id,
                row.get("nameZh", ""),
                before,
                DESIGN_SHEET.get(monster_id),
                now,
                ratio,
                "被 487d6fb 拍平成 1，之后按设计表重写",
            ]
        )
        if ratio is not None and ratio < 0.9:
            for cell in sheet[sheet.max_row]:
                cell.fill = WARN_FILL
    style(sheet, [16, 12, 15, 14, 12, 8, 34])

    # ── 关卡×怪物 ──
    sheet = book.create_sheet("关卡×怪物")
    sheet.append(
        ["关卡 id", "中文标题", "波数", "怪", "位置", "基础 HP", "全局倍率", "近战倍率", "实际 HP", "拍平前基准", "备注"]
    )
    for level in lvls:
        for monster_id in level["melee"]:
            base = mon.get(monster_id, {}).get("hp")
            sheet.append(
                [
                    level["id"],
                    level["titleZh"],
                    level["waves"],
                    monster_id,
                    "近战池",
                    base,
                    level["hpMultiplier"],
                    level["meleeHpMultiplier"],
                    None if base is None else round(base * level["hpMultiplier"] * level["meleeHpMultiplier"], 1),
                    BEFORE_FLATTEN.get(monster_id),
                    "",
                ]
            )
        for monster_id in level["ranged"]:
            base = mon.get(monster_id, {}).get("hp")
            sheet.append(
                [
                    level["id"],
                    level["titleZh"],
                    level["waves"],
                    monster_id,
                    "远程池",
                    base,
                    level["hpMultiplier"],
                    1,
                    None if base is None else round(base * level["hpMultiplier"], 1),
                    BEFORE_FLATTEN.get(monster_id),
                    "",
                ]
            )
        for monster_id in level["finalWave"]:
            base = mon.get(monster_id, {}).get("hp")
            sheet.append(
                [
                    level["id"],
                    level["titleZh"],
                    level["waves"],
                    monster_id,
                    "最后一波(点名)",
                    base,
                    1,
                    1,
                    base,
                    None,
                    "守关 boss 用自己 YAML 的血量，不吃倍率",
                ]
            )
    style(sheet, [34, 26, 6, 16, 16, 9, 10, 10, 10, 11, 40])

    # ── 守关boss ──
    sheet = book.create_sheet("守关boss")
    sheet.append(["id", "中文名", "HP", "移速", "借用的招式", "伤害倍率", "单次伤害", "掉落"])
    borrow = {"triple-cannon": 130, "barrage": 130, "wrath": 180}
    for row in mon.values():
        if not row["bossAttack"]:
            continue
        drops: dict[str, int] = {}
        for entry in re.finditer(r"dropId:\s*([a-z0-9-]+)((?:\s+chance\d?:.*\n?)+)", row["text"]):
            copies = 1 + len(re.findall(r"chance\d:\s*[1-9]", entry.group(2)))
            drops[entry.group(1)] = drops.get(entry.group(1), 0) + copies
        sheet.append(
            [
                row["id"],
                row["nameZh"],
                row["hp"],
                row["moveSpeed"],
                row["bossAttack"],
                row["damageScale"],
                round(borrow.get(row["bossAttack"], 0) * (row["damageScale"] or 1), 1),
                ", ".join(f"{k}×{v}" for k, v in drops.items()),
            ]
        )
        for cell in sheet[sheet.max_row]:
            cell.fill = BOSS_FILL
    style(sheet, [14, 12, 8, 7, 16, 10, 10, 44])

    # ── 武器 ──
    sheet = book.create_sheet("武器")
    sheet.append(["id", "冷却ms", "发/秒", "单发伤害", "爆炸半径"])
    for weapon_id, weapon in sorted(wpn.items()):
        cooldown = weapon.get("cooldownMs")
        sheet.append(
            [
                weapon_id,
                cooldown,
                None if not cooldown else round(1000 / cooldown, 2),
                weapon.get("damage"),
                weapon.get("aoeRadius"),
            ]
        )
    style(sheet, [26, 9, 9, 10, 10])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    book.save(OUT)
    print(f"saved {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())