// @vitest-environment happy-dom
/**
 * tests/components/hud/shop-panel.test.tsx
 * --------------------------------------------------------------------------
 * The tavern shop's contract: it prices from the character spec, refuses
 * what the wallet cannot cover, records what it sells, and speaks both
 * languages.
 *
 * `fetchCharacter` is mocked (the real one goes over the network); the
 * spec itself is parsed by the REAL parser, so the pricing path under test
 * is the same one the game uses.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShopPanel } from '@/components/hud/shop-panel';
import { fetchCharacter } from '@/lib/characters';
import { parseCharacterYaml } from '@/lib/characters/parser';
import { SHOP_RESTORE_VITALS_EVENT, SHOP_RESTORE_VITALS_PRICE } from '@/lib/characters/vitals';
import { EventBus } from '@/lib/events/bus';
import { MERCHANT_SHOP_EVENT, RETURN_TO_PAVILION_EVENT } from '@/lib/merchant/logic';
import { fetchWeapon } from '@/lib/weapons';
import { parseWeaponYaml } from '@/lib/weapons/parser';
import { setLocale } from '@/locales';
import { useGameStore } from '@/store/game-store';

vi.mock('@/lib/characters', () => ({ fetchCharacter: vi.fn() }));
vi.mock('@/lib/weapons', () => ({ fetchWeapon: vi.fn() }));

// Without this, React's `act()` refuses to flush and the DOM never catches
// up with a click — every HUD component test in this repo sets it.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const SPEC = parseCharacterYaml(
    `
id: dummy
name: Dummy
hp: 100
sp: 50
luck: 4
moveSpeed: 5
spRegenMs: 4000
body: { halfW: 16, halfH: 16 }
dodge: { spCost: 10, speed: 12, durationMs: 200, cooldownMs: 500 }
hotbar: []
upgrades:
    armor:
        costs: [30, 60]
        effects:
            - { stat: hp, mode: mul, perLevel: 1.10 }
    luck:
        costs: [80]
        effects:
            - { stat: luck, mode: add, perLevel: 1 }
`,
    'dummy',
);

const WEAPON = parseWeaponYaml(
    `
name: Shotgun
nameZh: "霰弹枪"
damage: 5
cooldownMs: 800
range: 400
clipSize: 5
reloadTimeMs: 2400
bulletsPerShot: 5
projectile:
    speed: 22
    visual: { radius: 4, width: 16, height: 4, color: 1 }
upgrades:
    costs: [40, 90]
    damageMulPerLevel: 1.5
`,
    'shotgun',
);

describe('ShopPanel', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

    const click = (id: string) =>
        act(() => {
            (q(id) as HTMLElement).click();
        });

    /**
     * The panel has no toggle of its own any more: the mysterious merchant
     * is the button. Her click arrives on the bus, so that is what the tests
     * fire.
     */
    const merchantClick = () =>
        act(() => {
            EventBus.emit(MERCHANT_SHOP_EVENT);
        });

    const render = async () => {
        await act(async () => {
            root.render(<ShopPanel />);
        });
    };

    const openShop = async () => {
        await render();
        merchantClick();
    };

    beforeEach(() => {
        vi.mocked(fetchCharacter).mockResolvedValue(SPEC);
        vi.mocked(fetchWeapon).mockResolvedValue(WEAPON);
        setLocale('en');
        useGameStore.setState({
            money: 0,
            selectedCharacterId: 'dummy',
            upgradeLevels: {},
            weaponLevels: {},
            slots: [],
            locale: 'en',
        });
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        vi.clearAllMocks();
    });

    it('renders nothing at all until the merchant is clicked', async () => {
        await render();

        expect(q('shop-toggle')).toBeNull();
        expect(q('shop-panel')).toBeNull();
    });

    it('opens when the merchant is clicked and shows the balance', async () => {
        useGameStore.setState({ money: 250 });

        await openShop();

        expect(q('shop-panel')).not.toBeNull();
        expect(q('shop-balance')?.textContent).toContain('250');
    });

    it('lists one row per upgrade ladder in the spec', async () => {
        await openShop();

        expect(q('shop-row-armor')).not.toBeNull();
        expect(q('shop-row-luck')).not.toBeNull();
    });

    it('shows the next price from the YAML ladder', async () => {
        await openShop();

        expect(q('shop-buy-armor')?.textContent).toContain('30');
    });

    it('sells a level: deducts the price and records the purchase', async () => {
        useGameStore.setState({ money: 100 });

        await openShop();
        click('shop-buy-armor');

        expect(useGameStore.getState().money).toBe(70);
        expect(useGameStore.getState().upgradeLevels.armor).toBe(1);
    });

    it('charges the next rung after a purchase', async () => {
        useGameStore.setState({ money: 100 });

        await openShop();
        click('shop-buy-armor');

        expect(q('shop-buy-armor')?.textContent).toContain('60');
        expect(q('shop-level-armor')?.textContent).toContain('1/2');
    });

    it('sells a full HP + SP refill and tells the character', async () => {
        useGameStore.setState({ money: 500, hp: 10, maxHp: 100, sp: 0, maxSp: 50 });

        await openShop();

        const heard: string[] = [];
        const handler = () => heard.push('restore');
        EventBus.on(SHOP_RESTORE_VITALS_EVENT, handler);
        click('shop-restore-vitals');
        EventBus.off(SHOP_RESTORE_VITALS_EVENT, handler);

        expect(heard).toEqual(['restore']);
        expect(useGameStore.getState().money).toBe(500 - SHOP_RESTORE_VITALS_PRICE);
    });

    it('refuses the refill when the pools are already full', async () => {
        useGameStore.setState({ money: 500, hp: 100, maxHp: 100, sp: 50, maxSp: 50 });

        await openShop();

        expect((q('shop-restore-vitals') as HTMLButtonElement).disabled).toBe(true);
        click('shop-restore-vitals');
        expect(useGameStore.getState().money).toBe(500);
    });

    it('offers a way home and leaves the navigation to the app', async () => {
        await openShop();

        const heard: string[] = [];
        const handler = () => heard.push('return');
        EventBus.on(RETURN_TO_PAVILION_EVENT, handler);
        click('shop-return-home');
        EventBus.off(RETURN_TO_PAVILION_EVENT, handler);

        expect(heard).toEqual(['return']);
        // The panel must not import the Phaser bootstrap itself; asking the
        // app is the whole contract.
    });

    it('disables a row the player cannot afford and sells nothing', async () => {
        useGameStore.setState({ money: 10 });

        await openShop();

        expect((q('shop-buy-armor') as HTMLButtonElement).disabled).toBe(true);

        click('shop-buy-armor');

        expect(useGameStore.getState().money).toBe(10);
        expect(useGameStore.getState().upgradeLevels.armor).toBeUndefined();
    });

    it('marks a maxed ladder instead of offering a price', async () => {
        useGameStore.setState({ money: 999, upgradeLevels: { armor: 2 } });

        await openShop();

        expect(q('shop-maxed-armor')).not.toBeNull();
        expect(q('shop-buy-armor')).toBeNull();
    });

    it('asks for a character before selling anything', async () => {
        useGameStore.setState({ selectedCharacterId: null });

        await openShop();

        expect(q('shop-hint')).not.toBeNull();
        expect(q('shop-row-armor')).toBeNull();
    });

    it('relabels itself when the language changes', async () => {
        await openShop();

        expect(q('shop-row-armor')?.textContent).toContain('Armor');

        act(() => {
            useGameStore.getState().setLocale('zh-CN');
        });

        expect(q('shop-row-armor')?.textContent).toContain('护甲');
    });

    it('lists a held weapon that has a ladder', async () => {
        useGameStore.setState({
            slots: [{ id: 'shotgun', name: 'Shotgun', ammo: 5, clipSize: 5 }],
        });

        await openShop();

        expect(q('shop-weapon-row-shotgun')).not.toBeNull();
    });

    it('names a held weapon in the shop language', async () => {
        // The weapon's English `name` is the code-side identity; what a player
        // reads is the language they picked. This row used to render `name`
        // directly, so the Chinese build showed "Shotgun".
        useGameStore.setState({
            slots: [{ id: 'shotgun', name: 'Shotgun', ammo: 5, clipSize: 5 }],
        });

        await openShop();

        expect(q('shop-weapon-row-shotgun')?.textContent).toContain('Shotgun');

        act(() => {
            useGameStore.getState().setLocale('zh-CN');
        });

        expect(q('shop-weapon-row-shotgun')?.textContent).toContain('霰弹枪');
    });

    it('says so when the hotbar is empty', async () => {
        await openShop();

        expect(q('shop-weapons-empty')).not.toBeNull();
    });

    it('sells a weapon level: deducts the price and records it', async () => {
        useGameStore.setState({
            money: 100,
            slots: [{ id: 'shotgun', name: 'Shotgun', ammo: 5, clipSize: 5 }],
        });

        await openShop();
        click('shop-weapon-buy-shotgun');

        expect(useGameStore.getState().money).toBe(60);
        expect(useGameStore.getState().weaponLevels.shotgun).toBe(1);
    });

    it('marks a maxed weapon ladder instead of offering a price', async () => {
        useGameStore.setState({
            money: 999,
            weaponLevels: { shotgun: 2 },
            slots: [{ id: 'shotgun', name: 'Shotgun', ammo: 5, clipSize: 5 }],
        });

        await openShop();

        expect(q('shop-weapon-maxed-shotgun')).not.toBeNull();
        expect(q('shop-weapon-buy-shotgun')).toBeNull();
    });

    it('prices an ammo refill by the missing rounds and refills the slots', async () => {
        useGameStore.setState({
            money: 100,
            slots: [{ id: 'shotgun', name: 'Shotgun', ammo: 1, clipSize: 5 }],
        });

        await openShop();

        // (5 - 1) missing rounds * AMMO_REFILL_PRICE_PER_ROUND (2)
        expect(q('shop-refill')?.textContent).toContain('8');

        click('shop-refill');

        expect(useGameStore.getState().money).toBe(92);
        expect(useGameStore.getState().slots[0].ammo).toBe(5);
    });

    it('disables the refill once the hotbar is full, and charges nothing', async () => {
        useGameStore.setState({
            money: 100,
            slots: [{ id: 'shotgun', name: 'Shotgun', ammo: 5, clipSize: 5 }],
        });

        await openShop();

        expect((q('shop-refill') as HTMLButtonElement).disabled).toBe(true);

        click('shop-refill');

        expect(useGameStore.getState().money).toBe(100);
    });
});
