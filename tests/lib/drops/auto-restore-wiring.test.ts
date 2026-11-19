/**
 * tests/lib/drops/auto-restore-wiring.test.ts
 * --------------------------------------------------------------------------
 * The rule above is worth nothing if the scene never calls it.
 *
 * `lib/drops/auto-restore.ts` is pure, so its own tests stay green even when the controller
 * stops asking - which is exactly how the mobile-only version could have silently died. These
 * assertions read the controller's source and pin the wiring instead.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(join(process.cwd(), 'src', 'game', 'drops', 'drop.ts'), 'utf8');

describe('DropController wiring', () => {
    it('runs the check every frame', () => {
        const update = SOURCE.slice(SOURCE.indexOf('    update(): void {'));
        const body = update.slice(0, update.indexOf('const charX'));
        expect(body).toContain('this.autoRestore();');
    });

    it('advances BOTH pools through the hysteresis helper', () => {
        expect(SOURCE).toContain('nextRestoreArmed(this.restoreArmed.hp, vitals.hp, vitals.maxHp)');
        expect(SOURCE).toContain('nextRestoreArmed(this.restoreArmed.sp, vitals.sp, vitals.maxSp)');
    });

    it('reads the bag by kind, so HP never drinks the SP potion', () => {
        expect(SOURCE).toContain('restoreSlotIndex(inventory, kind)');
    });

    it('no longer asks whether this is a phone', () => {
        // 主人 2026-11-13：`此机制给PC端也加上吧`。 The gate that made it mobile-only is gone.
        const start = SOURCE.indexOf('private autoRestore()');
        const body = SOURCE.slice(start, start + 1600);
        expect(body).not.toContain('isMobileLike');
    });

    it('names the pool it refilled', () => {
        expect(SOURCE).toContain('生命碎片自动使用');
        expect(SOURCE).toContain('灵力碎片自动使用');
    });

    it('says so when the pool is armed but the bag has no potion', () => {
        // 主人 2026-11-14 追加：`把那一句单独加回来`。静默跳过读起来像机制坏了。
        expect(SOURCE).toContain('没有生命碎片，自动补给跳过');
        expect(SOURCE).toContain('没有灵力碎片，自动补给跳过');
        // 每上一次膛只提醒一次，不刷屏。
        expect(SOURCE).toContain('this.restoreMissingNotified[kind]');
    });

    it('throws the interval at the top of the check', () => {
        expect(SOURCE).toContain('AUTO_RESTORE_INTERVAL_MS');
    });
});
