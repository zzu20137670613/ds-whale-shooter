"""
Build the annotated copy of the data master workbook.

Two rules for this file:
  * It never touches the original. The source is opened read-only and saved to
    a `_标注` sibling, so the owner keeps a clean reference copy.
  * Red means "verified problem, with the code path that proves it" - not
    "looks odd". An earlier claim of mine (that stated `range` contradicted the
    ballistic range) was wrong: bullets are destroyed by `expired || distSq >=
    maxDistance ** 2` in src/game/weapons/logic.ts, so effective range is
    min(range, speed * life) and every weapon is range-bound. That correction
    is written into the legend sheet rather than quietly dropped.
"""

import json
import os
import shutil
from datetime import date
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = str(Path(__file__).resolve().parent.parent.parent)  # whale-shooter/
SRC = os.environ.get("ANNOTATE_SRC") or os.path.join(
    ROOT, f"whale-shooter_数据总表_{date.today().isoformat()}.xlsx"
)
DST = os.environ.get("ANNOTATE_OUT") or os.path.join(
    ROOT, f"whale-shooter_数据总表_{date.today().isoformat()}_标注.xlsx"
)  # ANNOTATE_OUT lets this run while the real file is open in Excel.
# One source of truth: dump_combat_data.py classifies weapons and monsters and
# carries the explicit damage ladders. Reading the older weapons.json here meant
# the sheet kept showing formula values after the data moved to explicit tables.
_COMBAT = json.load(open(os.path.join(os.environ["TEMP"], "combat-data.json"), encoding="utf-8"))
WEAPONS = _COMBAT["weapons"]

RED_FILL = PatternFill("solid", fgColor="FFC7CE")
RED_FONT = Font(color="9C0006", bold=True)
GREY_FILL = PatternFill("solid", fgColor="D9D9D9")
HEAD_FILL = PatternFill("solid", fgColor="DBE5F1")
BOLD = Font(bold=True)

FPS = 60.0
DEFAULT_LIFE_MS = 1500


def metrics(w: dict) -> dict:
    dmg = w["dmg"] or 0
    cd = w["cd"] or 1000
    count = w["count"] or 1
    clip, reload_ms = w["clip"], w["reload"]
    burst = dmg * count / (cd / 1000.0)
    if clip and reload_ms:
        sustained = dmg * count * clip / (clip * (cd / 1000.0) + reload_ms / 1000.0)
    else:
        sustained = burst
    costs = w["costs"] or []
    total = sum(costs)
    mul = w["mul"]
    levels = len(costs) or 0
    table = w.get("damagePerLevel")
    if table:
        # The ladder is explicit now: the last entry IS the maxed damage.
        max_dmg = float(table[-1])
        factor = (max_dmg / dmg) if dmg else 1.0
        max_sustained = sustained * factor
    else:
        max_dmg = dmg * (mul ** levels) if mul and levels else dmg
        max_sustained = sustained * (mul ** levels) if mul and levels else sustained
    is_melee = w["speed"] is None
    if is_melee:
        effective = w["range"]
    else:
        life = w["life"] or DEFAULT_LIFE_MS
        ballistic = w["speed"] * FPS * (life / 1000.0)
        effective = min(w["range"] or ballistic, ballistic)
    return {
        "burst": burst,
        "sustained": sustained,
        "total_cost": total,
        "max_dmg": max_dmg,
        "max_sustained": max_sustained,
        "is_melee": is_melee,
        "effective": effective,
        "value": (max_sustained / total * 100) if total else 0.0,
    }


shutil.copyfile(SRC, DST)
wb = load_workbook(DST)

# ── 1. the existing 武器 sheet: flag the cells that mislead ────────────────
ws = wb["武器"]
header = [c.value for c in ws[1]]
col = {name: i + 1 for i, name in enumerate(header) if name}
NAME_COL = col["英文名"]
RANGE_COL = col["射程"]
DMG_COL = col["伤害"]

flagged_melee = []
flagged_hot = {"Frostmourne", "White Dragon Fangs"}
for row in range(2, ws.max_row + 1):
    english = ws.cell(row=row, column=NAME_COL).value
    if not english:
        continue
    w = next((x for x in WEAPONS if x["name"] == english), None)
    if not w:
        continue
    m = metrics(w)
    cell = ws.cell(row=row, column=RANGE_COL)
    if m["is_melee"]:
        cell.fill = RED_FILL
        cell.font = RED_FONT
        cell.comment = Comment(
            "近战判定半径，不是弹道射程。\n"
            "这六把没有弹丸（isMelee），引擎跳过射程判定，\n"
            "所以 180~300 这个数在近战武器上读起来像'射程很短'。",
            "第八世",
        )
        flagged_melee.append(english)
    if english in flagged_hot:
        d = ws.cell(row=row, column=DMG_COL)
        d.fill = RED_FILL
        d.font = RED_FONT

ws.cell(
    row=1,
    column=RANGE_COL,
).comment = Comment(
    "红底 = 近战武器的近战判定半径，与远程弹道射程不是一回事。\n"
    "有效射程 = min(射程, 弹速 x 寿命)，见 _标注说明 页。",
    "第八世",
)

# ── 2. a computed sheet, so the numbers live next to the source ────────────
if "武器·核算" in wb.sheetnames:
    del wb["武器·核算"]
calc = wb.create_sheet("武器·核算")
head = [
    "id", "中文名", "类型", "伤害", "冷却ms", "每次弹丸(bulletsPerShot)", "弹匣", "换弹ms",
    "射程(表)", "弹速px/帧", "寿命ms", "有效射程",
    "爆发DPS", "持续DPS", "满级伤害", "满级DPS", "升级总价", "每百金DPS", "标注",
]
calc.append(head)
for c in calc[1]:
    c.fill = HEAD_FILL
    c.font = BOLD
    c.alignment = Alignment(horizontal="center")

rows = []
for w in WEAPONS:
    m = metrics(w)
    notes = []
    if m["is_melee"]:
        notes.append("近战（无弹丸）")
    if w["clip"] and w["reload"]:
        notes.append("弹匣：持续输出被换弹压掉")
    if w["id"] == "hollow-emblem":
        notes.append("剧情道具，非战斗武器")
    if w["name"] == "Frostmourne":
        notes.append("近战；满级 DPS 全场最高（110.6）")
    if w["name"] == "Nashor's Tooth":
        notes.append("近战；每百金性价比全场最高（12.71）")
    if w["name"] == "White Dragon Fangs":
        notes.append("爆发最高，无短板")
    rows.append([
        w["id"], w["nameZh"] or w["name"],
        "近战" if m["is_melee"] else "远程",
        w["dmg"], w["cd"], w["count"], w["clip"], w["reload"],
        w["range"], w["speed"], w["life"],
        round(m["effective"]) if m["effective"] else None,
        round(m["burst"], 1), round(m["sustained"], 1),
        round(m["max_dmg"], 1), round(m["max_sustained"], 1),
        m["total_cost"], round(m["value"], 2),
        "；".join(notes),
    ])

rows.sort(key=lambda r: (r[2] != "远程", -r[13]))
for r in rows:
    calc.append(r)
    last = calc.max_row
    if r[0] == "hollow-emblem":
        for c in calc[last]:
            c.fill = GREY_FILL
        continue
    # Red the rows whose numbers break the curve, so they are visible without a filter.
    if r[0] in {"frostmourne", "white-dragon-fangs", "nashors-tooth"}:
        calc.cell(row=last, column=13).fill = RED_FILL
        calc.cell(row=last, column=13).font = RED_FONT
    if r[0] == "hollow-emblem" or "弹匣" in r[18]:
        calc.cell(row=last, column=14).fill = RED_FILL

widths = [18, 16, 8, 7, 8, 9, 7, 8, 9, 10, 8, 9, 9, 9, 9, 9, 9, 10, 30]
for i, width in enumerate(widths, start=1):
    calc.column_dimensions[calc.cell(row=1, column=i).column_letter].width = width
calc.freeze_panes = "D2"
for row in calc.iter_rows(min_row=2, min_col=13, max_col=18):
    for c in row:
        c.number_format = "0.0"

# ── 3. legend, including the correction ────────────────────────────────────
if "标注说明" in wb.sheetnames:
    del wb["标注说明"]
legend = wb.create_sheet("标注说明")
legend.append(["标红项", "含义", "依据"])
for c in legend[1]:
    c.fill = HEAD_FILL
    c.font = BOLD
legend.append([
    "1. 近战武器的「射程」",
    f"红底共 {len(flagged_melee)} 格：{', '.join(flagged_melee)}。这些武器没有弹丸，"
    "引擎跳过射程判定，那 180~300 是近战判定半径，不是弹道射程。",
    "src/game/weapons/logic.ts: isMelee 的弹丸不进 range 判定",
])
legend.append([
    "2. 弹匣武器的「持续DPS」",
    "弹匣类 16.7~33.1，无弹匣类 37.8~57.9。换弹只让你停手，没有任何补偿——"
    "这是当前最大的一处结构性失衡。",
    "武器·核算 第 14 列，按 clip x cooldown + reload 折算",
])
legend.append([
    "3. 三把超模",
    "近战两把吃到了全部好处、又没有射程代价：Frostmourne 满级 110.6（全场最高）/ 每百金 12.29；"
    "Nashor's Tooth 满级 106.7 / 每百金 12.71（全场最高）。"
    "同价突击步枪每百金只有 6.26，即近战单位的钱买到 2 倍的输出。"
    "White Dragon Fangs：爆发 111.1（全场最高）、持续 61.7、射程 560、弹匣 25，没有短板。",
    "武器·核算 的 DPS 与每百金列",
])
legend.append([
    "4. 已作废的一条",
    "我先前说「表里的射程与物理弹道差 4 倍，是矛盾」——错了，结论作废。"
    "弹丸销毁条件是 `expired || distSq >= maxDistance ** 2`，谁先到算谁，"
    "所以有效射程 = min(射程, 弹速 x 寿命)。逐把验算后，没有一把是寿命先到，"
    "表里的射程数字是准的；moss-bark 的 2879 只是用不上的潜力。",
    "src/game/weapons/logic.ts:483-484",
])
legend.append([
    "5. 灰底行",
    "hollow-emblem（空心徽记）：60 秒冷却、伤害 1、射程 1，是剧情道具，配平请排除。",
    "public/data/weapons/hollow-emblem.yaml",
])
legend.append([
    "6. 这张表已经无法重新生成",
    "说明页写的 tools/dump-data.cjs + tools/build-workbook.py 在仓库里不存在"
    "（scripts/ 只有 12 个别的脚本，git 里也从没提交过这两个）。"
    "所以本次标注是照着当前 YAML 手算的，不是跑脚本出来的；"
    "要恢复一键生成，得重写这两个脚本。",
    "git ls-files tools 为空；scripts/ 目录清单",
])
legend.column_dimensions["A"].width = 24
legend.column_dimensions["B"].width = 78
legend.column_dimensions["C"].width = 36
for row in legend.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical="top")

wb.save(DST)
print("已生成:", DST)
print("工作表:", wb.sheetnames)
print("标红近战武器:", flagged_melee)


