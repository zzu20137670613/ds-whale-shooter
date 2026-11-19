"""Build the whale-shooter data workbook from `data-dump.json`.

Pipeline (both steps live in `tools/`, so the table can always be rebuilt):

    node scripts/dump-data.cjs        # YAML -> data-dump.json (repo's own js-yaml)
    python scripts/build-workbook.py  # JSON + old workbook -> new .xlsx

The old workbook is only read for the hand-written "其他模型对比" history sheet,
which no script can regenerate. Everything else is derived from the dump, so a
number in the table is always a number the game loads.

Run with the bundled Python (needs openpyxl):

    C:\\...\\dependencies\\python\\python.exe scripts/build-workbook.py
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

HERE = Path(__file__).resolve().parent  # ds-whale-shooter-PC/scripts/
REPO = HERE.parent  # ds-whale-shooter-PC/
WHALE = REPO.parent  # whale-shooter/ - where the dump and the .xlsx files live
DUMP = WHALE / "data-dump.json"
OLD = WHALE / "whale-shooter_数据总表.xlsx"
OUT = WHALE / f"whale-shooter_数据总表_{date.today().isoformat()}.xlsx"

HEADER_FILL = PatternFill("solid", fgColor="FFE8D8B8")
HEADER_FONT = Font(bold=True)
TITLE_FONT = Font(bold=True, size=12)

VIEW_W, VIEW_H = 2752, 1536  # one screen of the camera


def dump() -> dict:
    return json.loads(DUMP.read_text(encoding="utf-8"))


def flat(value) -> str | int | float:
    """Render a YAML value as a cell: numbers stay numbers, the rest is text."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, list):
        return " / ".join(flat(v) if not isinstance(v, dict) else brief(v) for v in value)
    if isinstance(value, dict):
        return brief(value)
    return str(value)


def brief(obj: dict) -> str:
    """A compact one-line rendering of a nested object."""
    parts = []
    for key, value in obj.items():
        if isinstance(value, dict):
            parts.append(f"{key}:" + brief(value))
        elif isinstance(value, list):
            parts.append(f"{key}:" + flat(value))
        else:
            parts.append(f"{key}={flat(value)}")
    return " ".join(parts)


def hex_colour(value) -> str:
    if not isinstance(value, int):
        return ""
    return f"#{value:06X}"


def screens(image_size: str) -> str:
    try:
        w, h = (int(n) for n in str(image_size).lower().split("x"))
    except ValueError:
        return ""
    cols, rows = w / VIEW_W, h / VIEW_H
    if cols == 1 and rows == 1:
        return "1 屏"
    return f"{cols:g}×{rows:g} 屏"


def write_sheet(book: Workbook, title: str, headers, rows, widths=None, freeze="A2"):
    sheet = book.create_sheet(title)
    sheet.append(list(headers))
    for cell in sheet[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True)
    for row in rows:
        sheet.append([flat(v) for v in row])
    for index, header in enumerate(headers, start=1):
        width = (widths or {}).get(header)
        if width:
            sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.freeze_panes = freeze
    sheet.auto_filter.ref = sheet.dimensions
    return sheet


def main() -> None:
    data = dump()["data"]
    weapons = data["weapons"]
    characters = data["characters"]
    monsters = data["monsters"]
    drops = data["drops"]
    levels = data["levels"]

    book = Workbook()
    book.remove(book.active)

    # ── 说明 ────────────────────────────────────────────────────────────────
    info = book.create_sheet("说明")
    info.append(["项目", "内容"])
    for cell in info[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
    counts = (
        f"关卡 {len(levels)} · 怪物 {len(monsters)} · 武器 {len(weapons)} · "
        f"角色 {len(characters)} · 掉落 {len(drops)} · "
        f"音效 {len(data.get('audios/sfx', {}))} · 音乐 {len(data.get('audios/music', {}))}"
    )
    for key, value in [
        ("这是什么", "the-11th-forest / whale-shooter 全量数据总表（由仓库 YAML 生成，不是手抄）"),
        ("本版日期", str(date.today())),
        ("数据来源", "public/data/**/*.yaml，用仓库自己的 js-yaml 解析"),
        ("怎么重新生成", "① node tools/dump-data.cjs  ② python tools/build-workbook.py"),
        ("为什么留脚本", "旧版只留了 dump、丢了构建脚本，数据一漂就得手改；这次两个脚本都在 tools/ 里"),
        ("数字口径", "表里的数字就是游戏加载到的数字；嵌套字段压成一行（key=value）"),
        ("单位说明", "projectile.speed 的单位是 px/帧；cooldownMs / reloadTimeMs 是毫秒；range 是像素"),
        ("关卡屏幕数", f"1 屏 = {VIEW_W}×{VIEW_H}（摄像机可视区），2×2 屏 = {VIEW_W * 2}×{VIEW_H * 2}"),
        ("本版数据量", counts),
        ("主子表", "其他模型对比 一页是人工维护的历史记录，脚本不覆盖"),
    ]:
        info.append([key, value])
    info.column_dimensions["A"].width = 16
    info.column_dimensions["B"].width = 96
    for row in info.iter_rows(min_row=2):
        row[1].alignment = Alignment(wrap_text=True, vertical="top")

    # ── 本版更新 ────────────────────────────────────────────────────────────
    changes = book.create_sheet("本版更新")
    changes.append(["类别", "变化", "细节", "相关提交"])
    for cell in changes[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
    beach = levels.get("beach-holiday", {})
    for row in [
        (
            "关卡",
            "海滩关从 1 屏扩成 2×2 屏",
            f"imageSize {beach.get('imageSize', '?')}（{screens(beach.get('imageSize', ''))}），"
            "坐标全线 ×2，底图换成 5504×3072 拼合图，营地合成进西北椰树影",
            "330af8e",
        ),
        (
            "关卡",
            "关卡 4 → 6，且换了一批",
            "现有：tavern / beach-holiday / sunlit-henge / dsh-atlantis / gpt-sky-city / starry-library；"
            "旧表的 sacred-forest-sanctuary 已不在，新增 dsh-atlantis、gpt-sky-city、starry-library",
            "—",
        ),
        (
            "玩法",
            "海水分区：外侧 2/3 不可达，内侧 1/3 可涉水",
            f"水墙改名 deep-water，x 756–804（= 岸线 1206 的 2/3）；BFS 验证深水可达格 = 0、浅水带 100% 可达",
            "0b914c4",
        ),
        (
            "玩法",
            "区域触发机制 triggers",
            "Level 新增可选 triggers 字段（id/zone/spawn），配套 TriggerController + 一次性记录 usedTriggers（一轮一次，清档重置）",
            "0ab2838",
        ),
        (
            "彩蛋",
            "躺椅 → 冰镇果汁 → 小桌",
            "踩椅面 (2600,880,200,220) → 苹果杯弹出 → 弧线落到小桌 (2790,908) → 捡起血蓝回满；触发区按抠图 alpha 定标（94% 是椅子）",
            "d956957 / ec32415",
        ),
        (
            "掉落",
            "新增 iced-juice（饥荒联机版的苹果杯）",
            "full-restore 效果，64×64 单帧贴图；替换原来的 beach-drink 占位图",
            "d31d099 / 93372e4",
        ),
        (
            "工程",
            "预加载清单漏收触发器奖励 → 运行时卡死，已修",
            "collectDropIds 补上 triggers[].spawn.type；并给 fire() 加兜底、加两条诊断日志",
            "ec32415 / 1d97a06",
        ),
        (
            "工程",
            "测试规模",
            "61 个测试文件 / 677 个用例（含直接读发布关卡 YAML 的回归测试）",
            "60cfb5b",
        ),
        (
            "美术",
            "彩蛋图形换成苹果杯",
            "Klei 原图，已在掉落 YAML 与 art-source README 标注出处",
            "d31d099",
        ),
    ]:
        changes.append(list(row))
    for column, width in zip("ABCD", (10, 34, 84, 18)):
        changes.column_dimensions[column].width = width
    for row in changes.iter_rows(min_row=2):
        row[2].alignment = Alignment(wrap_text=True, vertical="top")

    # ── 关卡 ────────────────────────────────────────────────────────────────
    rows = []
    for level_id, level in sorted(levels.items()):
        walls = level.get("airWalls") or []
        rows.append(
            [
                level_id,
                level.get("titleZh", ""),
                level.get("title", ""),
                Path(str(level.get("background", ""))).name,
                level.get("imageSize", ""),
                screens(level.get("imageSize", "")),
                "是" if level.get("tavern") else "",
                "否" if level.get("pixelLighting") is False else "",
                level.get("music") or "（无）",
                len(walls),
                len(level.get("monsters") or []),
                len(level.get("dropSpawns") or []),
                len(level.get("teleporters") or []),
                len(level.get("triggers") or []),
                len(level.get("materials") or []),
                len(level.get("npcSpawns") or []),
                "有" if level.get("backgroundBlocks") else "",
                level.get("characterSpawn") and "x=%.0f y=%.0f" % (
                    level["characterSpawn"]["x"],
                    level["characterSpawn"]["y"],
                ) or "",
                # 刷怪倍率：主人按这张表调怪物血量，所以倍率和池子直接摊在关卡页。
                (level.get("spawner") or {}).get("hpMultiplier", 1),
                (level.get("spawner") or {}).get("meleeHpMultiplier", 1),
                " / ".join((level.get("spawner") or {}).get("pool", {}).get("melee") or []),
                " / ".join((level.get("spawner") or {}).get("pool", {}).get("ranged") or []),
                " / ".join((level.get("spawner") or {}).get("finalWave", {}).get("far") or []),
            ]
        )
    write_sheet(
        book,
        "关卡",
        [
            "id",
            "中文名",
            "英文名",
            "背景图",
            "图像尺寸",
            "屏幕数",
            "酒馆",
            "关闭灯光",
            "音乐",
            "碰撞墙",
            "怪物数",
            "掉落数",
            "传送阵数",
            "触发器数",
            "装饰数",
            "NPC 数",
            "分块底图",
            "出生点",
            "全局HP倍率",
            "近战HP倍率",
            "近战池",
            "远程池",
            "最后一波指定",
        ],
        rows,
        widths={"id": 22, "中文名": 16, "英文名": 20, "背景图": 30, "图像尺寸": 12, "关": 10},
    )

    # ── 怪物 ────────────────────────────────────────────────────────────────
    rows = []
    for monster_id, monster in sorted(monsters.items()):
        body = monster.get("body") or {}
        drop_table = monster.get("drops") or []
        rows.append(
            [
                monster_id,
                monster.get("nameZh", ""),
                monster.get("name", ""),
                monster.get("hp", ""),
                monster.get("money", ""),
                monster.get("moveSpeed", ""),
                f"{body.get('halfW', '?')}×{body.get('halfH', '?')}",
                monster.get("weaponId", ""),
                " / ".join(
                    f"{d.get('dropId')} {round((d.get('chance') or 0) * 100)}%"
                    for d in drop_table
                ),
                "是" if monster.get("prop") else "",
                (monster.get("_comments") or "")[:90],
            ]
        )
    write_sheet(
        book,
        "怪物",
        ["id", "中文名", "英文名", "HP", "金钱", "移动速度", "碰撞体 W×H", "武器", "掉落表", "道具型", "备注"],
        rows,
        widths={"id": 18, "中文名": 14, "英文名": 18, "碰撞体 W×H": 12, "武器": 22, "掉落表": 40, "备注": 50},
    )

    # ── 武器 ────────────────────────────────────────────────────────────────
    rows = []
    for weapon_id, weapon in sorted(weapons.items()):
        upgrade = weapon.get("upgrades") or {}
        rows.append(
            [
                weapon_id,
                weapon.get("nameZh", ""),
                weapon.get("name", ""),
                weapon.get("damage", ""),
                weapon.get("cooldownMs", ""),
                weapon.get("range", ""),
                weapon.get("bulletsPerShot", ""),
                weapon.get("clipSize", ""),
                weapon.get("reloadTimeMs", ""),
                weapon.get("aoeRadius", "") or "",
                f"{weapon.get('hitWidth', '?')}×{weapon.get('hitHeight', '?')}",
                weapon.get("sfx") and brief(weapon["sfx"]) or "",
                " / ".join(str(c) for c in (upgrade.get("costs") or [])),
                upgrade.get("damageMulPerLevel", ""),
                (weapon.get("_comments") or "")[:90],
            ]
        )
    write_sheet(
        book,
        "武器",
        [
            "id",
            "中文名",
            "英文名",
            "伤害",
            "冷却 ms",
            "射程",
            "每次弹丸",
            "弹匣",
            "换弹 ms",
            "AoE 半径",
            "命中体 W×H",
            "音效",
            "升级价格",
            "每级伤害倍率",
            "备注",
        ],
        rows,
        widths={"id": 20, "中文名": 14, "英文名": 18, "命中体 W×H": 12, "音效": 34, "升级价格": 24, "备注": 50},
    )

    # ── 角色 ────────────────────────────────────────────────────────────────
    rows = []
    for char_id, char in sorted(characters.items()):
        body = char.get("body") or {}
        rows.append(
            [
                char_id,
                char.get("nameZh", ""),
                char.get("name", ""),
                char.get("hp", ""),
                char.get("sp", ""),
                char.get("luck", ""),
                char.get("moveSpeed", ""),
                char.get("spRegenMs", ""),
                f"{char.get('imageSize', '?')}",
                " / ".join(char.get("hotbar") or []),
                " / ".join(sorted((char.get("upgrades") or {}).keys())),
                "有" if char.get("skill") else "",
                char.get("descriptionZh") or "",
            ]
        )
    write_sheet(
        book,
        "角色",
        ["id", "中文名", "英文名", "HP", "SP", "幸运", "移速", "SP 再生 ms", "贴图尺寸", "初始武器", "升级项", "技能", "中文简介"],
        rows,
        widths={"id": 12, "中文名": 12, "英文名": 12, "初始武器": 32, "升级项": 24, "中文简介": 60},
    )

    # ── 角色升级 ────────────────────────────────────────────────────────────
    rows = []
    for char_id, char in sorted(characters.items()):
        for name, upgrade in sorted((char.get("upgrades") or {}).items()):
            rows.append(
                [
                    char_id,
                    char.get("name", ""),
                    name,
                    " / ".join(str(c) for c in (upgrade.get("costs") or [])),
                    len(upgrade.get("costs") or []),
                    brief({k: v for k, v in upgrade.items() if k != "costs"}),
                ]
            )
    write_sheet(
        book,
        "角色升级",
        ["角色", "英文名", "升级项", "各级价格", "级数", "每级效果"],
        rows,
        widths={"角色": 12, "英文名": 12, "升级项": 14, "各级价格": 30, "每级效果": 44},
    )

    # ── 技能 ────────────────────────────────────────────────────────────────
    rows = []
    for char_id, char in sorted(characters.items()):
        skill = char.get("skill") or {}
        if not skill:
            continue
        cost = []
        if "spCost" in skill:
            cost.append("SP %s" % skill["spCost"])
        if "spCostFraction" in skill:
            cost.append("SP %d%%" % round(skill["spCostFraction"] * 100))
        rest = {
            k: v
            for k, v in skill.items()
            if k not in ("name", "nameZh", "kind", "spCost", "spCostFraction", "cooldownMs")
        }
        rows.append(
            [
                char_id,
                char.get("name", ""),
                skill.get("nameZh", ""),
                skill.get("name", ""),
                skill.get("kind", ""),
                brief(rest),
                " / ".join(cost),
                skill.get("cooldownMs", ""),
            ]
        )
    write_sheet(
        book,
        "技能",
        ["角色", "英文名", "技能名", "英文技能名", "机制 kind", "参数", "消耗", "冷却 ms"],
        rows,
        widths={"角色": 12, "英文名": 14, "技能名": 16, "英文技能名": 18, "机制 kind": 16, "参数": 46, "消耗": 12},
    )

    # ── 掉落 ────────────────────────────────────────────────────────────────
    rows = []
    for drop_id, drop in sorted(drops.items()):
        visual = drop.get("visual") or {}
        sprite = drop.get("sprite") or {}
        rows.append(
            [
                drop_id,
                drop.get("name", ""),
                drop.get("kind", ""),
                brief(drop.get("effect") or {}),
                f"尺寸 {visual.get('size', '?')} / 色 {hex_colour(visual.get('tint'))}",
                drop.get("sfx", ""),
                Path(str(sprite.get("texture", ""))).name or "",
                (drop.get("_comments") or "")[:110],
            ]
        )
    write_sheet(
        book,
        "掉落",
        ["id", "名称", "类型", "效果", "视觉", "音效", "贴图", "备注"],
        rows,
        widths={"id": 18, "名称": 18, "类型": 10, "效果": 30, "视觉": 24, "音效": 20, "贴图": 20, "备注": 70},
    )

    # ── 音频 ────────────────────────────────────────────────────────────────
    rows = []
    for kind in ("sfx", "music"):
        for audio_id, audio in sorted(data.get(f"audios/{kind}", {}).items()):
            rows.append(
                [
                    kind,
                    audio_id,
                    audio.get("name", ""),
                    audio.get("volume", ""),
                    audio.get("loop") if audio.get("loop") is not None else "",
                    audio.get("fadeIn", ""),
                    audio.get("fadeOut", ""),
                    Path(str(audio.get("source", ""))).name,
                ]
            )
    write_sheet(
        book,
        "音频",
        ["类型", "id", "名称", "音量", "循环", "淡入 ms", "淡出 ms", "文件"],
        rows,
        widths={"类型": 8, "id": 28, "名称": 26, "文件": 32},
    )

    # ── 现状提醒 ────────────────────────────────────────────────────────────
    notes = book.create_sheet("现状提醒")
    notes.append(["#", "观察到的事实", "意味着什么", "想请你定"])
    for cell in notes[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
    facts = [
        (
            "8 个怪物全部 hp=1，攻击也被拍平",
            "提交 487d6fb「chore(data): flatten every monster hp and attack to 1」是有意做的；包含 200 金钱的 warden，现在任何一枪都能秒杀",
            "这是临时调试口径还是新方向？要不要按关卡重新配数值",
        ),
        (
            "dsh-atlantis 空气墙 0 面、掉落 0、怪 3 只",
            "关卡内部没有任何碰撞体，只有引擎在图像外圈自动加的边界墙兜底",
            "这关是还在铺图的半成品，还是故意做成开阔场",
        ),
        (
            "sacred-forest-sanctuary 已不在仓库",
            "旧表里有这关；现在是 dsh-atlantis / gpt-sky-city / starry-library 三关",
            "是改名替换，还是两关都要留",
        ),
        (
            "starry-library 11008×6144（4×4 屏、89 面墙）",
            "全项目最重的关卡：4 块底图、墙最多、寻路网格最大",
            "要不要先在这一关压性能预算",
        ),
        (
            "beach-holiday 5504×3072（2×2 屏）",
            "本版刚扩完：13 面墙 / 10 怪 / 1 掉落 / 1 触发器（苹果杯彩蛋），内侧 1/3 海水可涉水",
            "浅水区手感要不要调，营地尺度要不要改",
        ),
        (
            "掉落 beach-drink 与 iced-juice 效果完全相同",
            "都是 full-restore；beach-drink 是没自己贴图的旧占位（借 hp-shard 的格子）",
            "要不要把 beach-drink 退役，只留苹果杯",
        ),
        (
            "游戏流程顺序由 levels/index.yaml 决定",
            "当前 6 关的先后顺序就是玩家实际路线",
            "下一步是加新关，还是先把现有 6 关做扎实",
        ),
    ]
    for index, (fact, meaning, question) in enumerate(facts, start=1):
        notes.append([index, fact, meaning, question])
    for column, width in zip("ABCD", (5, 44, 58, 44)):
        notes.column_dimensions[column].width = width
    for row in notes.iter_rows(min_row=2):
        for cell in row[1:]:
            cell.alignment = Alignment(wrap_text=True, vertical="top")

    # ── 其他模型对比（人工维护，原样搬运） ──────────────────────────────────
    if OLD.exists():
        old = load_workbook(OLD, data_only=True)
        # The hand-written history sheet is matched loosely: its exact title
        # has drifted (and a workbook saved by another tool may rename it), but
        # it is always the second sheet of the old file.
        history = next((n for n in old.sheetnames if "模型" in n), None)
        if history is None and len(old.sheetnames) > 1:
            history = old.sheetnames[1]
        if history:
            source = old[history]
            rows = [
                [source.cell(row=r, column=c).value for c in range(1, source.max_column + 1)]
                for r in range(1, source.max_row + 1)
            ]
            write_sheet(
                book,
                "其他模型对比",
                rows[0],
                rows[1:],
                widths={"#": 5, "来源": 36, "内容": 64, "状态": 44},
            )

    # ── 模板（主人自己挑的关键数值，一屏对照） ───────────────────────────────
    #
    # The owner added this sheet by hand to the annotated workbook (2026-11-12:
    # `里面是我最关心的一些数值，你看一下，把脚本里固化把我这些东西也给输出出来`),
    # so the layout below is HIS, not mine: five characters first, then every
    # monster he fights, with the boss and the prop row last. Keep the column
    # order and the row order as they are - he tunes against this exact grid.
    TEMPLATE_ROWS = [
        ("character", "claude"),
        ("character", "deepseek"),
        ("character", "gemini"),
        ("character", "gpt"),
        ("character", "qwen"),
        ("monster", "gunner"),
        ("monster", "stalker"),
        ("monster", "sniper"),
        ("monster", "drone"),
        ("monster", "keeper"),
        ("monster", "drone-ultra"),
        ("monster", "warden"),
        ("monster", "bengbu-erba"),
        ("monster", "bunny"),
        ("monster", "kitty"),
        ("monster", "wanderer"),
        ("monster", "claude"),
        ("monster", "hollow-emblem"),
    ]

    def seconds_of(ms) -> str | float:
        """Milliseconds as seconds, so the sheet reads `0.2` not `200`."""
        if not isinstance(ms, (int, float)) or ms <= 0:
            return ""
        return round(ms / 1000, 2)

    def ladder_text(value) -> str:
        return "/".join(str(part) for part in value) if value else ""

    def drop_text(monster: dict) -> str:
        """The drop table in Chinese, probabilities included.

        主人 2026-11-12: `藤壶 ×3` hides the 100%/50%/5% ladder, so he cannot tune a drop
        rate from the sheet. Each entry now keeps its chain; identical 100% copies collapse
        into `名称 ×N`, anything with a real chance is spelled out.
        """
        merged: dict[str, dict] = {}
        for entry in monster.get("drops") or []:
            drop_id = entry.get("dropId")
            if not drop_id:
                continue
            chances = [entry.get("chance")]
            for key in ("chance2", "chance3"):
                if entry.get(key):
                    chances.append(entry[key])
            percents = [
                round(float(chance) * 100)
                for chance in chances
                if isinstance(chance, (int, float))
            ]
            slot = merged.setdefault(drop_id, {"percents": []})
            slot["percents"].extend(percents)

        parts = []
        for drop_id, slot in merged.items():
            spec = drops.get(drop_id) or {}
            zh = spec.get("nameZh") or drop_id
            percents = slot["percents"]
            if percents and all(p == 100 for p in percents):
                parts.append(f"{zh} ×{len(percents)}")
            elif percents:
                parts.append(f"{zh} " + "/".join(f"{p}%" for p in percents))
            else:
                parts.append(zh)
        return "；".join(parts) or "-"

    rows = []
    for kind, entity_id in TEMPLATE_ROWS:
        if kind == "character":
            spec = characters.get(entity_id) or {}
            hotbar = spec.get("hotbar") or []
            # 主人的话（2026-11-12）：`5个角色的都是近战武器，不是我要的，我要的是远程武器`。
            # hotbar 里近战在前、远程在后，所以挑第一个带 `projectile` 的，
            # 一个都没有才退回第一件（例如将来某个角色只带近战）。
            ranged = [
                weapon for weapon in hotbar
                if (weapons.get(weapon) or {}).get("projectile")
            ]
            weapon_id = ranged[0] if ranged else (hotbar[0] if hotbar else "")
            money = "-"
            drop_cell = "-"
        else:
            spec = monsters.get(entity_id) or {}
            weapon_id = spec.get("weaponId") or ""
            money = spec.get("money", "")
            drop_cell = drop_text(spec)
        weapon = weapons.get(weapon_id) or {}
        upgrade = weapon.get("upgrades") or {}
        rows.append(
            [
                entity_id,
                spec.get("nameZh") or spec.get("name") or "",
                spec.get("hp", ""),
                spec.get("moveSpeed", ""),
                weapon_id,
                weapon.get("nameZh", ""),
                ladder_text(upgrade.get("damagePerLevel")) or weapon.get("damage", ""),
                ladder_text(upgrade.get("costs")),
                money,
                seconds_of(weapon.get("cooldownMs")),
                weapon.get("range", ""),
                weapon.get("bulletsPerShot", 1),
                weapon.get("clipSize", ""),
                seconds_of(weapon.get("reloadTimeMs")),
                drop_cell,
            ]
        )

    write_sheet(
        book,
        "模板",
        [
            "id",
            "中文名",
            "HP",
            "移动速度",
            "武器id",
            "武器中文名",
            "武器各级伤害",
            "武器升级价格",
            "金钱（怪物）",
            "攻速（X秒/发）",
            "射程",
            "每次弹丸",
            "弹匣",
            "换弹 s",
            "掉落表(中文)",
        ],
        rows,
        widths={"id": 16, "中文名": 16, "武器id": 26, "武器中文名": 14, "武器各级伤害": 26, "武器升级价格": 22, "攻速（X秒/发）": 12, "掉落表(中文)": 52},
    )

    book.save(OUT)
    print(f"写入 {OUT}")
    print("工作表:", " / ".join(book.sheetnames))
    print(f"关卡 {len(levels)} · 怪物 {len(monsters)} · 武器 {len(weapons)} · 角色 {len(characters)} · 掉落 {len(drops)}")


if __name__ == "__main__":
    main()