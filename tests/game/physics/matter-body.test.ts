/**
 * tests/game/physics/matter-body.test.ts
 * --------------------------------------------------------------------------
 * `placeBody` 必须走 `Phaser.Physics.Matter.Matter.Body`，不能碰 `scene.matter.Body`。
 *
 * 2026-11-15 手机现场（栈是在屏幕上读出来的）：
 *
 *     TypeError: Cannot read property 'setPosition' of undefined
 *       at movePlayer
 *       at BossArenaLoop.walkThrough
 *       at BossArenaLoop.update
 *
 * 打死第 3 阶段 boss 之后，boss 走位要把玩家挪到下一块地图的落点；那行代码写的是
 * `(this.matter as any).Body.setPosition(...)`，而 `scene.matter` 上没有 `Body` ——
 * 它只有小写 `body`（一个 BodyFactory）。于是每一帧都在场景 update 里抛，世界就停住了。
 *
 * 真 Phaser 在 node 里 import 不起来（要 canvas），所以只桩掉用到的那一层。
 */

import { describe, expect, it, vi } from 'vitest';

// `vi.mock` 的工厂会被提升到文件顶部，里面不许引用普通顶层变量 —— 用 `vi.hoisted`。
const { setPosition, setVelocity } = vi.hoisted(() => ({
    setPosition: vi.fn(),
    setVelocity: vi.fn(),
}));

vi.mock('phaser', () => ({
    Physics: { Matter: { Matter: { Body: { setPosition, setVelocity } } } },
}));

import { matterBodyModule, placeBody } from '@/game/physics/matter-body';

describe('placeBody', () => {
    it('finds the Matter Body module through Phaser, not scene.matter', () => {
        expect(matterBodyModule()).toMatchObject({ setPosition: expect.any(Function) });
    });

    it('moves the body and stops it', () => {
        const body = { id: 'player' };
        setPosition.mockClear();
        setVelocity.mockClear();

        expect(placeBody(body, 120, 480)).toBe(true);

        expect(setPosition).toHaveBeenCalledWith(body, { x: 120, y: 480 });
        expect(setVelocity).toHaveBeenCalledWith(body, { x: 0, y: 0 });
    });

    it('reports false instead of throwing when the body is missing', () => {
        // 角色还没加载完时 BossArenaLoop 仍可能跑一帧 —— 不许因此冻住整局。
        expect(() => placeBody(undefined, 1, 2)).not.toThrow();
        expect(placeBody(undefined, 1, 2)).toBe(false);
        expect(placeBody(null, 1, 2)).toBe(false);
    });
});