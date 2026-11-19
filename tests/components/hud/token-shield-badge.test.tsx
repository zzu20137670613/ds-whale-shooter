/**
 * tests/components/hud/token-shield-badge.test.tsx
 * --------------------------------------------------------------------------
 * 词元盾 chip: directly under the whale-girl's chip, same display logic, five rows.
 *
 * The owner (2026-11-12): `词元盾buff位置就放在鲸鱼娘本人游玩正下方，词元盾介绍直接复用
 * 鲸鱼娘本人游玩buff的显示逻辑，改为5级每级效果XXXX`。
 */

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { BUFF_CHIP_SHELL, BUFF_CHIP_TONE, BUFF_CHIP_WIDTH } from '@/components/hud/pet-buff-badge';
import { TokenShieldBadge } from '@/components/hud/token-shield-badge';
import { tokenShieldLevels } from '@/lib/drops/token-shield';
import * as mobileModule from '@/lib/mobile';
import { initialGameState, useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('TokenShieldBadge', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        // `t()` reads the locale module, not the store: the store action is what flips both.
        useGameStore.setState({ ...initialGameState, selectedCharacterId: 'deepseek' });
        useGameStore.getState().setLocale('zh-CN');
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        useGameStore.getState().setLocale('en');
        container.remove();
        vi.restoreAllMocks();
    });

    it('renders nothing before the first pickup', () => {
        act(() => {
            root.render(<TokenShieldBadge />);
        });
        expect(container.querySelector('[data-testid="token-shield-badge"]')).toBeNull();
    });

    it('shows the level on the chip', () => {
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 3 } });
        act(() => {
            root.render(<TokenShieldBadge />);
        });
        const chip = container.querySelector('[data-testid="token-shield-badge"]');
        expect(chip).not.toBeNull();
        expect(chip!.getAttribute('data-token-shield-level')).toBe('3');
        expect(container.textContent).toContain('词元盾');
        expect(container.textContent).toContain('Lv.3');
    });

    it('lists all ten levels in the tooltip, with the current share', () => {
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 3 } });
        act(() => {
            root.render(<TokenShieldBadge />);
        });
        const chip = container.querySelector('[data-testid="token-shield-badge"]')!;
        const title = chip.getAttribute('title') ?? '';
        const rows = tokenShieldLevels();
        expect(rows).toHaveLength(10);
        for (const row of rows) {
            expect(title, `Lv.${row.level} row`).toContain(`Lv.${row.level}：受伤时 ${row.percent}% 由灵力承担`);
        }
        // The "now" line uses the same ladder as the damage splitter.
        expect(title).toContain('30%');
    });

    it('belongs to the character who picked it up', () => {
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 4 } });
        act(() => {
            root.render(<TokenShieldBadge />);
        });
        expect(container.querySelector('[data-testid="token-shield-badge"]')).not.toBeNull();

        act(() => {
            useGameStore.setState({ selectedCharacterId: 'gpt' });
        });
        expect(container.querySelector('[data-testid="token-shield-badge"]')).toBeNull();
    });

    it('says so when the shield is maxed', () => {
        // 满级从第 5 级挪到第 10 级（2026-11-15），满级效果 70%。
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 10 } });
        act(() => {
            root.render(<TokenShieldBadge />);
        });
        const title = container.querySelector('[data-testid="token-shield-badge"]')!.getAttribute('title');
        expect(title).toContain('已满级');
        expect(title).toContain('70%');
    });

    it('opens the same lines on a tap when there is no hover', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 2 } });
        act(() => {
            root.render(<TokenShieldBadge />);
        });
        expect(container.querySelector('[data-testid="token-shield-panel"]')).toBeNull();

        const chip = container.querySelector('[data-testid="token-shield-badge"]')!;
        act(() => {
            chip.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        const panel = container.querySelector('[data-testid="token-shield-panel"]');
        expect(panel).not.toBeNull();
        expect(panel!.textContent).toContain('词元盾 Lv.2');
    });
    it('wears the same shell, background and width as the whale-girl chip', () => {
        // 主人 2026-11-12：`背景色改成跟鲸鱼娘 buff 一样的背景色，宽度也是`。
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 2 } });
        act(() => {
            root.render(<TokenShieldBadge />);
        });
        const chip = container.querySelector('[data-testid="token-shield-badge"]')!;
        const classes = chip.className;
        expect(classes).toContain(BUFF_CHIP_WIDTH);
        for (const cls of BUFF_CHIP_SHELL.split(' ')) {
            expect(classes, `missing ${cls}`).toContain(cls);
        }
        for (const cls of BUFF_CHIP_TONE.sky.split(' ')) {
            expect(classes, `missing ${cls}`).toContain(cls);
        }
    });

});