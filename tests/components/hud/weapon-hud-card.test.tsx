// @vitest-environment happy-dom
/**
 * tests/components/hud/weapon-hud-card.test.tsx
 * --------------------------------------------------------------------------
 * The small print under each weapon card: name, level, magazine / reserve.
 *
 * The owner, twice:
 *   `把武器卡片下方的武器名字和弹药/备弹数字体加大1号，在武器名字后方加上等级0/1/2/3/4/max`
 *   `武器卡片的字是不是加粗了？加粗取消，再大一号，把武器卡上字体颜色都与突击步枪字体保持一致`
 *
 * The second ask is really about legibility: the inactive cards were drawn in stone-400/500,
 * which on the dark HUD is the dimmest text in the whole game, so only the held weapon read
 * cleanly. Every card now uses the palette of the active one; the card's border, body tint and
 * ammo fill still say which one is in her hands.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WeaponHUDOverlay } from '@/components/hud/weapon-hud-overlay';
import { setLocale } from '@/locales';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<WeaponHUDOverlay />));
}

function slot(overrides: Record<string, unknown> = {}) {
    return {
        id: 'arcana-staff',
        name: '奥术法杖',
        ammo: 7,
        reserve: 21,
        clipSize: 8,
        level: 2,
        maxLevel: 4,
        ...overrides,
    };
}

beforeEach(() => {
    setLocale('zh-CN');
    useGameStore.setState({
        locale: 'zh-CN',
        hubsVisible: true,
        activeWeaponIndex: 0,
        activeWeaponName: '奥术法杖',
        slots: [slot()] as never,
    });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

const cards = () => Array.from(document.querySelectorAll('[data-weapon-card]'));

describe('the small print under a weapon card', () => {
    it('carries the weapon name at 11px and not bold', () => {
        render();
        const name = cards()[0].querySelector('[data-weapon-name]');
        expect(name?.textContent).toContain('奥术法杖');
        expect(name?.className).toContain('text-[11px]');
        expect(name?.className).not.toContain('font-bold');
        expect(name?.className).not.toContain('font-semibold');
    });

    it('carries the magazine / reserve at 12px', () => {
        render();
        const ammo = cards()[0].querySelector('[data-weapon-ammo]');
        expect(ammo?.textContent?.replace(/\s/g, '')).toBe('07/21');
        expect(ammo?.className).toContain('text-[12px]');
    });

    it('carries the level tag at 10px', () => {
        render();
        const level = cards()[0].querySelector('[data-weapon-level]');
        expect(level?.textContent).toBe('2');
        expect(level?.className).toContain('text-[10px]');
    });
});

describe('a melee card has no ammo line', () => {
    // The owner: `将近战武器下方的01/00都去掉，近战武器不需要这个，把近战武器的名字往下调一下，
    // 大概放在现在近战武器名字与01/00的分界线上`.
    const melee = () =>
        slot({
            id: 'whale-tail-slam',
            name: '鲸尾重击',
            ammo: 1,
            reserve: 0,
            clipSize: 1,
            level: 0,
            maxLevel: 0,
            melee: true,
        });

    it('prints no magazine / reserve at all', () => {
        useGameStore.setState({ slots: [melee()] as never });
        render();
        expect(cards()[0].querySelector('[data-weapon-name]')?.textContent).toContain('鲸尾重击');
        expect(cards()[0].querySelector('[data-weapon-ammo]')).toBeNull();
    });

    it('drops the name down to where the divider used to be', () => {
        useGameStore.setState({ slots: [melee()] as never });
        render();
        // The counter's height plus the column gap used to sit under the name; half of that
        // is the line the owner pointed at.
        expect(cards()[0].querySelector('[data-weapon-name]')?.className).toContain('mb-1.5');
    });

    it('leaves a ranged card exactly as it was', () => {
        render();
        expect(cards()[0].querySelector('[data-weapon-ammo]')).not.toBeNull();
        expect(cards()[0].querySelector('[data-weapon-name]')?.className).not.toContain('mb-1.5');
    });
});

describe('every card reads like the held one', () => {
    it('uses the active palette for the name', () => {
        render();
        expect(cards()[0].querySelector('[data-weapon-name]')?.className).toContain(
            'text-amber-200',
        );
    });

    it('uses the active palette for the ammo counter', () => {
        render();
        expect(cards()[0].querySelector('[data-weapon-ammo]')?.className).toContain(
            'text-amber-200',
        );
    });

    it('does not dim an inactive card’s text', () => {
        // Two guns, the first held: the second is inactive and used to be stone-400/500.
        useGameStore.setState({
            activeWeaponIndex: 0,
            slots: [slot(), slot({ id: 'assault-rifle', name: '突击步枪', ammo: 30, reserve: 90 })] as never,
        });
        render();

        const inactive = cards()[1];
        const name = inactive.querySelector('[data-weapon-name]')?.className ?? '';
        const ammo = inactive.querySelector('[data-weapon-ammo]')?.className ?? '';

        expect(name).toContain('text-amber-200');
        expect(ammo).toContain('text-amber-200');
        // No stone text anywhere on the card: it is the dimmest thing on the HUD.
        expect(name).not.toContain('text-stone-4');
        expect(ammo).not.toContain('text-stone-5');
    });

    it('still flags an empty reserve in red, whatever the card', () => {
        // The one deliberate exception: 0 spare rounds is a warning, not a palette choice.
        useGameStore.setState({
            activeWeaponIndex: 0,
            slots: [
                slot(),
                slot({ id: 'assault-rifle', name: '突击步枪', ammo: 30, reserve: 0 }),
            ] as never,
        });
        render();
        expect(cards()[1].querySelector('[data-weapon-ammo]')?.className).toContain('text-rose-400');
    });

    it('keeps the hotkey number readable on every card too', () => {
        useGameStore.setState({
            activeWeaponIndex: 0,
            slots: [slot(), slot({ id: 'assault-rifle', name: '突击步枪' })] as never,
        });
        render();
        const hotkeys = cards().map((card) => card.querySelector('[data-weapon-hotkey]'));
        expect(hotkeys[1]?.className).toContain('text-amber-200');
        for (const key of hotkeys) expect(key?.className).not.toContain('font-bold');
    });
});

describe('one colour for the whole card', () => {
    // The owner: `突击步枪下方的子弹/备弹的字体颜色跟突击步枪的字体颜色不一样...其他武器都查一下`.
    // The name is the reference; everything else has to match it, on every card.
    it('prints the name, level, ammo and hotkey in the same amber', () => {
        render();
        for (const card of cards()) {
            for (const selector of ['[data-weapon-name]', '[data-weapon-level]', '[data-weapon-ammo]', '[data-weapon-hotkey]']) {
                const el = card.querySelector(selector);
                if (!el) continue;
                expect(el.className, selector).toContain('text-amber-200');
            }
        }
    });

    it('leaves no second amber in the card at all', () => {
        render();
        for (const card of cards()) {
            expect(card.innerHTML).not.toContain('text-amber-300');
            expect(card.innerHTML).not.toContain('text-stone-500');
        }
    });

    it('keeps red for ONE case only: an empty reserve', () => {
        // `备弹 0` is a warning, not a palette choice - the owner asked for it to stand out.
        useGameStore.setState({
            slots: [
                slot({ id: 'assault-rifle', name: '突击步枪', ammo: 10, reserve: 0, clipSize: 35 }),
            ] as never,
        });
        render();
        const ammo = cards()[0].querySelector('[data-weapon-ammo]')!;
        expect(ammo.className).toContain('text-rose-400');
    });
});
