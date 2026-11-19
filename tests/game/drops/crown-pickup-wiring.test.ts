/**
 * tests/game/drops/crown-pickup-wiring.test.ts
 * --------------------------------------------------------------------------
 * 加冕之冠的 +100 上限必须**捡到的这一刻**就生效。
 *
 * 主人 2026-11-17 实机反馈：`特效完整，图片完整，但是实机测试的的血蓝上限并未增加`。
 *
 * 原因：加成只在 `resolve-scene`（开场景）时算了一次。玩家是在关卡里捡到它的 ——
 * 那一刻 spec 早就建好了，所以界面上什么也不会变，得先离开地图再进来才看得到。
 *
 * 这条测试把"接在拾取路径上"钉住：两处接线少一处，玩家就还是看不到变化。
 * 用源码扫描而不是跑 Phaser：`Character` 与场景都依赖真实引擎，light unit 环境里跑不起来。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('the crown applies the moment it is picked up', () => {
    const drop = read('src/game/drops/drop.ts');

    it('calls adjustHeldMaxBonus from the bag-pickup branch', () => {
        expect(drop).toContain('adjustHeldMaxBonus');
        // 必须在 `added > 0` 里面：背包满、东西还留在地上时不能加。
        const bagBranch = drop.slice(drop.indexOf('addInventoryItem(dropKey, 1)'));
        expect(bagBranch.slice(0, 800)).toContain('adjustHeldMaxBonus');
    });

    it('reads the bonus from the drop spec rather than hardcoding +100', () => {
        expect(drop).toContain('maxBonusOf');
    });

    it('applies it on every character (re)load in the scene', () => {
        const scene = read('src/game/scenes/scene.ts');
        // 三个 loadCharacter 站点（关卡 / 酒馆刷新 / 酒馆确认）都要补一次，
        // 否则重进场景就丢加成。
        const calls = scene.split('this.applyHeldMaxBonus()').length - 1;
        expect(calls).toBeGreaterThanOrEqual(3);
    });

    it('keeps the bookkeeping so repeated calls cannot stack', () => {
        const logic = read('src/game/characters/logic.ts');
        expect(logic).toContain('heldBonus');
        // 记录已经加过多少，才能在"拿走"时减回去。
        expect(logic).toContain('this.heldBonus.hp + delta.hp');
    });
});