/**
 * tests/lib/drops/effect-text.test.ts
 * --------------------------------------------------------------------------
 * 图鉴里「道具：效果」右边那半句，从 effect 现算。
 *
 * 数值是主人会反复改的东西（`将过载核心的数值改为补血60+补蓝30`、
 * `将海底特饮的数值改为补血30+补蓝60`），所以文案不能写死在 YAML 里 —— 一改数值，
 * 图鉴要跟着变。
 */

import { describe, expect, it } from 'vitest';

import { describeEffect } from '@/lib/drops/effect-text';
import { TOKEN_SHIELD_MAX_LEVEL } from '@/lib/drops/token-shield';

describe('describeEffect', () => {
    it('says how much HP a shard restores', () => {
        expect(describeEffect({ type: 'instant', hp: 25, sp: 0 }).zh).toBe('补血 25');
    });

    it('says how much SP a fragment restores', () => {
        expect(describeEffect({ type: 'instant', hp: 0, sp: 60 }).zh).toBe('补蓝 60');
    });

    it('lists both halves for the overcharge core', () => {
        expect(describeEffect({ type: 'instant', hp: 60, sp: 30 }).zh).toBe('补血 60 + 补蓝 30');
    });

    it('lists both halves for the deep sea drink', () => {
        expect(describeEffect({ type: 'instant', hp: 30, sp: 60 }).zh).toBe('补血 30 + 补蓝 60');
    });

    it('turns an ammo fraction into a percentage', () => {
        expect(describeEffect({ type: 'refill-ammo', ammoFraction: 0.3 }).zh).toBe('弹药补 30%');
    });

    it('describes the full restore and the token shield', () => {
        expect(describeEffect({ type: 'full-restore' }).zh).toBe('补满血与蓝');
        expect(describeEffect({ type: 'token-shield' }).zh).toContain('词元盾');
    });

    it('reads the shield cap from the constant, not a stale literal', () => {
        // 盾从 5 级扩到 10 级那次，图鉴里还挂着「最多 5 级」（主人 2026-11-16 指出）。
        const text = describeEffect({ type: 'token-shield' });
        expect(text.zh).toContain(`最多 ${TOKEN_SHIELD_MAX_LEVEL} 级`);
        expect(text.en).toContain(`max ${TOKEN_SHIELD_MAX_LEVEL}`);
        expect(text.zh).not.toContain('最多 5 级');
    });

    it('falls back to the item description for key items', () => {
        expect(
            describeEffect({ type: 'material', sellPrice: 0 }, '敬请期待（未至之境关键道具）').zh,
        ).toBe('敬请期待（未至之境关键道具）');
        expect(describeEffect({ type: 'material', sellPrice: 3 }).zh).toBe('材料 · 可出售');
    });

    it('always carries an English line too', () => {
        expect(describeEffect({ type: 'instant', hp: 60, sp: 30 }).en).toBe('+60 HP + +30 SP');
    });
});