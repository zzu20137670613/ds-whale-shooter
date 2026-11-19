/**
 * tests/lib/phaser-global-usage.test.ts
 * --------------------------------------------------------------------------
 * 抓一种**编译期看不见**的运行时错误：直接用了 `Phaser.XXX` 却没 import。
 *
 * 2026-11-15 的现场（主人手机）：`monster:died: Phaser is not defined`。打死卷轴关 boss 时，
 * 词元盾落地要画光柱，`token-beam.ts` 里写了 `Phaser.BlendModes.ADD` —— 但那个文件没有
 * `import Phaser from 'phaser'`。因为 Phaser 的类型是全局命名空间，`tsc` 一声不吭，
 * 运行时却抛 ReferenceError；抛出点在死亡动画的 `delayedCall` 里，**不在**场景 update 的
 * try 之外，于是整条 RAF 链断掉、画布永久冻结（「界面不动、摇杆还能点」）。
 *
 * 这个测试扫一遍源码：凡是代码里出现 `Phaser.<成员>` 的文件，必须 import 过 phaser。
 * 只把它当运行值用（`Phaser.Scene` 之类只出现在类型位置）的文件不在此列 —— 所以这里匹配
 * 的是**取值成员**，不是类型名。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from './_source-scan';

/** 只可能出现在运行值位置上的成员（类型名如 Scene / GameObjects 不算）。 */
const RUNTIME_MEMBERS =
    /\bPhaser\.(BlendModes|Math|Physics|Display|TintModes|Scale|Cameras|Input|Time|Utils|Structs)\b/g;

/** 注释里提到 `Phaser.TintModes` 不算使用，扫之前先去掉注释。 */
function stripComments(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('Phaser runtime values', () => {
    it('every file that reads a Phaser value also imports phaser', () => {
        const offenders: string[] = [];

        for (const file of listSourceFiles()) {
            const code = stripComments(readFileSync(file, 'utf8'));
            RUNTIME_MEMBERS.lastIndex = 0;
            if (!RUNTIME_MEMBERS.test(code)) continue;
            if (/from\s+['"]phaser['"]/.test(code)) continue;
            offenders.push(file.replace(process.cwd() + join('', ''), '').replace(/\\/g, '/'));
        }

        expect(offenders).toEqual([]);
    });
});