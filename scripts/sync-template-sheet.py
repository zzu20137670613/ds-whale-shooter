"""Diff the owner's 模板 sheet against the game data, and optionally apply it.

Owner: `模板sheet我改过数值了，你看一下给同步到代码里吧`。

The sheet is authoritative for these columns:
  HP / 移动速度 / 武器id / 武器各级伤害 / 武器升级价格 / 金钱（怪物） /
  攻速（X秒/发） / 射程 / 每次弹丸 / 弹匣 / 换弹 s

Empty cells mean "leave the YAML alone". The drop column is skipped on purpose:
it is a rendered summary, not a tiptap - the real tables live in the monster YAML.

Usage:
    python scripts/sync-template-sheet.py            # report only
    python scripts/sync-template-sheet.py --apply    # write the YAMLs
"""

from __future__ import annotations

import io
import os
import re
import sys

from openpyxl import load_workbook

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(
    os.path.dirname(REPO),
    "whale-shooter_数据总表_2026-11-12_标注.xlsx",
)
SHEET_NAME = "模板"
CHARACTERS = {"claude", "deepseek", "gemini", "gpt", "qwen"}


def read_sheet() -> list[dict]:
    book = load_workbook(SHEET, data_only=True)
    ws = book[SHEET_NAME]
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h) if h is not None else "" for h in rows[0]]
    out = []
    for index, raw in enumerate(rows[1:], start=2):
        if not raw or raw[0] in (None, ""):
            continue
        cell = dict(zip(headers, raw))
        out.append({"row": index, "cells": cell})
    return out


def split_ladder(value) -> list[int] | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return [int(value)]
    parts = [p.strip() for p in str(value).replace("，", "/").split("/") if p.strip()]
    try:
        return [int(float(p)) for p in parts]
    except ValueError:
        return None


def number(value) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def read(path: str) -> str:
    return io.open(path, encoding="utf-8", newline="").read().replace("\r\n", "\n")


def write(path: str, text: str) -> None:
    io.open(path, "w", encoding="utf-8", newline="\n").write(text)


def set_top_level(text: str, key: str, value: str) -> tuple[str, str | None]:
    """Replace a top-level `key: value` line, keeping any trailing comment."""
    pattern = re.compile(rf"^({re.escape(key)}:[ \t]*)([^#\n]*?)([ \t]*#.*)?$", re.M)
    found = pattern.search(text)
    if not found:
        return text, None
    old = found.group(2).strip()
    comment = found.group(3) or ""
    replacement = f"{found.group(1)}{value}{comment}"
    return text[: found.start()] + replacement + text[found.end():], old


def set_upgrade_list(text: str, key: str, values: list[int]) -> tuple[str, str | None]:
    """Replace `upgrades.<key>: [..]` without touching the rest of the file."""
    block = re.search(r"^upgrades:\n((?:[ \t]+.*\n|\s*\n)*)", text, re.M)
    if not block:
        return text, None
    body = block.group(1)
    pattern = re.compile(rf"^([ \t]+{re.escape(key)}:[ \t]*)(\[[^\]]*\]|[^\n]*)$", re.M)
    found = pattern.search(body)
    rendered = "[" + ", ".join(str(v) for v in values) + "]"
    if not found:
        return text, None
    old = found.group(2).strip()
    new_body = body[: found.start()] + found.group(1) + rendered + body[found.end():]
    return text[: block.start(1)] + new_body + text[block.end(1):], old


def same(old, new) -> bool:
    """`5` and `5.0` are the same number; only real edits count as changes."""
    try:
        return abs(float(old) - float(new)) < 1e-9
    except (TypeError, ValueError):
        return str(old) == str(new)


class Plan:
    def __init__(self) -> None:
        self.changes: list[tuple[str, str, str, str]] = []  # file, field, old, new
        self.skipped: list[tuple[str, str, str]] = []  # file, field, wanted

    def note(self, path: str, field: str, old, new) -> None:
        if old is None:
            # Key absent from the YAML (e.g. `bulletsPerShot`, which the schema
            # defaults to 1). Report it, but never invent the line.
            self.skipped.append((os.path.basename(path), field, str(new)))
            return
        if same(old, new):
            return
        self.changes.append((os.path.basename(path), field, str(old), str(new)))


def apply_sheet(apply: bool) -> Plan:
    plan = Plan()
    rows = read_sheet()

    for row in rows:
        cells = row["cells"]
        entity = str(cells.get("id") or "").strip()
        if not entity:
            continue
        # Row 18 repeats `claude` as the boss monster; rows 2-6 are the playable five.
        is_character = entity in CHARACTERS and row["row"] <= 6

        if is_character:
            path = os.path.join(REPO, "public", "data", "characters", f"{entity}.yaml")
        else:
            path = os.path.join(REPO, "public", "data", "monsters", f"{entity}.yaml")
        if not os.path.exists(path):
            if entity == "claude" and not is_character:
                path = os.path.join(REPO, "public", "data", "monsters", "claude.yaml")
            if not os.path.exists(path):
                print(f"  skip {entity}: no yaml at {path}")
                continue

        spec_text = read(path)
        hp = number(cells.get("HP"))
        speed = number(cells.get("移动速度"))
        money = number(cells.get("金钱（怪物）"))

        if hp is not None:
            spec_text, old = set_top_level(spec_text, "hp", str(int(hp)))
            plan.note(path, "hp", old, int(hp))
        if speed is not None:
            spec_text, old = set_top_level(spec_text, "moveSpeed", str(speed))
            plan.note(path, "moveSpeed", old, speed)
        if money is not None:
            spec_text, old = set_top_level(spec_text, "money", str(int(money)))
            plan.note(path, "money", old, int(money))

        if apply:
            write(path, spec_text)

        weapon_id = str(cells.get("武器id") or "").strip()
        if not weapon_id:
            continue
        weapon_path = os.path.join(REPO, "public", "data", "weapons", f"{weapon_id}.yaml")
        if not os.path.exists(weapon_path):
            print(f"  skip weapon {weapon_id}: missing yaml")
            continue
        weapon_text = read(weapon_path)

        ladder = split_ladder(cells.get("武器各级伤害"))
        if ladder:
            if len(ladder) == 1:
                weapon_text, old = set_top_level(weapon_text, "damage", str(ladder[0]))
                plan.note(weapon_path, "damage", old, ladder[0])
            else:
                weapon_text, old = set_top_level(weapon_text, "damage", str(ladder[0]))
                plan.note(weapon_path, "damage", old, ladder[0])
                weapon_text, old = set_upgrade_list(weapon_text, "damagePerLevel", ladder)
                plan.note(weapon_path, "upgrades.damagePerLevel", old, ladder)

        costs = split_ladder(cells.get("武器升级价格"))
        if costs:
            weapon_text, old = set_upgrade_list(weapon_text, "costs", costs)
            plan.note(weapon_path, "upgrades.costs", old, costs)

        interval = number(cells.get("攻速（X秒/发）"))
        if interval:
            weapon_text, old = set_top_level(weapon_text, "cooldownMs", str(int(round(interval * 1000))))
            plan.note(weapon_path, "cooldownMs", old, int(round(interval * 1000)))

        reach = number(cells.get("射程"))
        if reach is not None:
            weapon_text, old = set_top_level(weapon_text, "range", str(int(reach)))
            plan.note(weapon_path, "range", old, int(reach))

        pellets = number(cells.get("每次弹丸"))
        if pellets is not None:
            weapon_text, old = set_top_level(weapon_text, "bulletsPerShot", str(int(pellets)))
            plan.note(weapon_path, "bulletsPerShot", old, int(pellets))

        clip = number(cells.get("弹匣"))
        if clip is not None:
            weapon_text, old = set_top_level(weapon_text, "clipSize", str(int(clip)))
            plan.note(weapon_path, "clipSize", old, int(clip))

        reload_s = number(cells.get("换弹 s"))
        if reload_s is not None:
            weapon_text, old = set_top_level(weapon_text, "reloadTimeMs", str(int(round(reload_s * 1000))))
            plan.note(weapon_path, "reloadTimeMs", old, int(round(reload_s * 1000)))

        if apply:
            write(weapon_path, weapon_text)

    return plan


def main() -> None:
    apply = "--apply" in sys.argv
    plan = apply_sheet(apply)
    print(f"{'APPLIED' if apply else 'DRY RUN'} - {len(plan.changes)} changes")
    for name, field, old, new in plan.changes:
        print(f"  {name:32s} {field:24s} {old:>28s} -> {new}")
    if plan.skipped:
        print(f"  (skipped {len(plan.skipped)} keys the YAML does not carry - schema defaults stand)")
        for name, field, wanted in plan.skipped:
            print(f"    {name:32s} {field:24s} wanted {wanted}")


if __name__ == "__main__":
    main()