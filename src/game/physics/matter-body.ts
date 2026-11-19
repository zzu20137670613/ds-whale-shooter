/**
 * src/game/physics/matter-body.ts
 * --------------------------------------------------------------------------
 * 直接摆一个 Matter 刚体，并把速度清零。
 *
 * 为什么要有这个文件：Phaser 4 里 `scene.matter` 是 `MatterPhysics` 门面，它**没有** `Body`
 * 这个成员 —— 它上面的是 `body`（小写，一个 BodyFactory，只能造刚体，不能 setPosition）。
 * 真正的 Matter 模块在 `Phaser.Physics.Matter.Matter.Body`。
 *
 * 2026-11-15 手机现场就是这样炸的：
 *
 *     TypeError: Cannot read property 'setPosition' of undefined
 *       at movePlayer
 *       at BossArenaLoop.walkThrough
 *       at BossArenaLoop.update
 *
 * 打掉第 3 阶段 boss 之后，`BossArenaLoop` 要把玩家挪到下一个地块的落点，走的是
 * `(this.matter as any).Body.setPosition(...)`。`scene.matter.Body` 是 undefined，于是整条
 * 场景 update 每帧都在第一行断掉 —— 画面还在、人物还在，但世界不动了。
 *
 * `MonsterController` 一直是拿对的（`this.matter = Phaser.Physics.Matter.Matter`），所以怪物
 * 那边从来没出过这个问题。这里把取法收成一处，谁要摆刚体都从这里拿。
 */

import * as Phaser from 'phaser';

/** Matter 命名空间里我们用到的那两个静态方法。 */
export interface MatterBodyModule {
    setPosition: (body: unknown, position: { x: number; y: number }) => void;
    setVelocity: (body: unknown, velocity: { x: number; y: number }) => void;
}

/**
 * `Phaser.Physics.Matter.Matter` —— 注意是三层，不是 `scene.matter.Body`。
 *
 * 拿不到时返回 null 而不是抛：这条路径跑在场景 update 里，一个 undefined 就能冻住整局。
 */
export function matterBodyModule(): MatterBodyModule | null {
    const api = Phaser as unknown as {
        Physics?: { Matter?: { Matter?: { Body?: MatterBodyModule } } };
    };
    return api.Physics?.Matter?.Matter?.Body ?? null;
}

/**
 * 把刚体摆到 (x, y) 并停住。
 *
 * @returns 真的摆上了才 true；`body` 为空或引擎模块缺失时 false，调用方可以据此决定要不要
 *          继续（比如走位动画该不该往下走）。
 */
export function placeBody(body: unknown, x: number, y: number): boolean {
    const matterBody = matterBodyModule();
    if (!matterBody || !body) return false;
    matterBody.setPosition(body, { x, y });
    matterBody.setVelocity(body, { x: 0, y: 0 });
    return true;
}