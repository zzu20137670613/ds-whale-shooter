// @vitest-environment happy-dom
/**
 * tests/components/hud/pet-buff-badge.test.tsx
 * --------------------------------------------------------------------------
 * The desktop-pet chip: shows the buff, explains it on hover, and hides when there is none.
 *
 * The owner's ask: `鲸鱼娘桌宠联动的那个buff要显示出来，加在键鼠操作的左边，悬浮显示有什么
 * 加成`. The placement is asserted in the settings row's own test; this one owns the content.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PetBuffBadge } from '@/components/hud/pet-buff-badge';
import { setLocale } from '@/locales';
import { useGameStore } from '@/store/game-store';
import type { PetBonus } from '@/lib/pet/lifetime';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const BONUS = (percent: number): PetBonus => ({
    percent,
    source: 'pet',
    label: 'Lv.10',
    suspended: true,
});

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<PetBuffBadge />));
}

const badge = () => document.querySelector('[data-testid="pet-buff-badge"]');

beforeEach(() => {
    setLocale('zh-CN');
    useGameStore.setState({ selectedCharacterId: 'deepseek', petBonus: BONUS(50), locale: 'zh-CN' });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useGameStore.setState({ petBonus: null });
});

describe('when the chip is there at all', () => {
    it('renders nothing before the pet reports in', () => {
        useGameStore.setState({ petBonus: null });
        render();
        expect(badge()).toBeNull();
    });

    it('renders nothing for a character the pet does not companion', () => {
        useGameStore.setState({ selectedCharacterId: 'qwen' });
        render();
        expect(badge()).toBeNull();
    });

    it('names the linkage and hides the numbers', () => {
        render();
        expect(badge()).not.toBeNull();
        // The owner's call: `🐳 +50% 改成【鲸鱼娘本人游玩】，数值什么的悬浮才能看到`.
        expect(badge()!.textContent).toContain('【鲸鱼娘本人游玩】');
        expect(badge()!.textContent).not.toContain('50');
        expect(badge()!.textContent).not.toContain('%');
    });
});

describe('the hover text', () => {
    it('names the linkage and every live bonus', () => {
        render();
        const title = badge()!.getAttribute('title') ?? '';
        expect(title).toContain('鲸鱼娘本人游玩');
        expect(title).toContain('桌宠联动加成');
        expect(title).toContain('生命 / 灵力 / 移速 +50%');
        expect(title).toContain('幸运 +2');
        expect(title).toContain('鲸鲸祝福');
        expect(title).toContain('×1.5');
    });

    it('drops the blessing lines below the top tier', () => {
        useGameStore.setState({ petBonus: BONUS(20) });
        render();
        const title = badge()!.getAttribute('title') ?? '';
        expect(title).toContain('+20%');
        expect(title).toContain('幸运 +1');
        expect(title).not.toContain('鲸鲸祝福');
    });

    it('speaks English when the locale is English', () => {
        setLocale('en');
        useGameStore.setState({ locale: 'en' });
        render();
        const title = badge()!.getAttribute('title') ?? '';
        expect(title).toContain('pet link bonus');
        expect(title).toContain('Luck');
    });

describe('the colour of the chip', () => {
    it('writes the top tier in warm white on near-black, rimmed in orange', () => {
        // The owner went pale yellow -> `橙色看起来也很费劲`, so the fix is contrast rather than
        // hue: coloured text on a tinted fill sits at the same brightness as the fill. Warm
        // white on the HUD's black reads at a glance; the orange rim keeps the "special state"
        // signal.
        render();
        const cls = badge()!.className;
        expect(cls).toContain('text-orange-50');
        expect(cls).toContain('bg-stone-950/85');
        expect(cls).toContain('border-orange-400/80');
        expect(cls).not.toContain('amber');
        // No mid-tone body text: that is the thing that was hard to read.
        expect(cls).not.toContain('text-orange-300');
    });

    it('keeps the cooler colour below the top tier', () => {
        useGameStore.setState({ petBonus: BONUS(20) });
        render();
        expect(badge()!.className).toContain('text-sky-100');
        expect(badge()!.className).not.toContain('orange');
    });
});

describe('the size of the chip', () => {
    it('is two steps bigger than the 11 px it shipped at', () => {
        render();
        const label = badge()!.querySelector('[data-pet-label]');
        const icon = badge()!.querySelector('[data-pet-icon]');
        expect(label?.className).toContain('text-[15px]');
        // The whale sits one step above the words, or it reads smaller than the text.
        expect(icon?.className).toContain('text-[19px]');
    });
});
});