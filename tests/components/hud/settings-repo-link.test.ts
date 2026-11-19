/**
 * tests/components/hud/settings-repo-link.test.ts
 * --------------------------------------------------------------------------
 * 设置面板里那个 Gitee 图标指向哪。
 *
 * 主人 2026-11-19：`把链接指向的 https://gitee.com/zzu20137670613/ds-whale-shooter-PC
 * 改成 https://gitee.com/zzu20137670613/`。
 *
 * 为什么从具体仓库改成主页：那个账号下不止这一个项目（枪火柔情电脑版、手机版、
 * 以后的新仓库），指向主页让玩家自己挑，也免得每次加仓库都回来改代码。
 *
 * 源码扫描而不是渲染：这个组件挂在一个要 Phaser 实例的面板里，
 * 在纯测试环境里渲染它代价太大，而这里要钉住的只是**那个字符串**。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const source = readFileSync(join(ROOT, 'src', 'components', 'hud', 'settings-overlay.tsx'), 'utf8');

describe('the settings panel gitee link', () => {
    it('points at the owner page, not a single repository', () => {
        expect(source).toContain("'https://gitee.com/zzu20137670613/'");
    });

    it('no longer hardcodes a repository path', () => {
        expect(source).not.toContain('gitee.com/zzu20137670613/ds-whale-shooter-PC');
        expect(source).not.toContain('gitee.com/zzu20137670613/ds-whale-shooter-mobile');
    });

    it('still hides itself in store builds', () => {
        // 商店包里不留外链：`STORE_BUILD ? '' : …` 这条规矩不能因为换链接丢掉。
        expect(source).toContain("STORE_BUILD ? '' : GITEE_OWNER_URL");
    });
});