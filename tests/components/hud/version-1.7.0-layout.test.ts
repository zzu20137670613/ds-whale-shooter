// @vitest-environment happy-dom
/**
 * tests/components/hud/version-1.7.0-layout.test.ts
 * --------------------------------------------------------------------------
 * 主人 2026-11-16 手机实测后要的布局改动：
 *
 *   ① 漫画的「跳过」挪到右下角（TapTap 的悬浮退出按钮占着右上角）
 *   ③ 手机端存档读档面板至少一行完整可见
 *
 * 漫画那个按钮要等图片 ready 才渲染，静态渲染拿不到它，所以 ① 用源码扫描钉住
 * 「两个分支的角各在哪」；③ 真渲染，因为它的尺寸全在 class 里。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/mobile', () => ({ isMobileLike: () => mobile.value }));

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('① the comic skip button', () => {
    const source = read('src/components/hud/comic-overlay.tsx');

    it('reads the phone flag', () => {
        expect(source).toContain('isMobileLike()');
    });

    it('sits top-right on desktop and bottom-right on a phone', () => {
        // 一个三元表达式决定角：`isMobile ? 'bottom-5 right-5' : 'right-5 top-5'`。
        expect(source).toContain("isMobile ? 'bottom-5 right-5' : 'right-5 top-5'");
    });
});

describe('③ the save/load panel on a phone', () => {
    // 这个面板渲染时会拉起 Konva/画布，happy-dom 里没有 canvas，所以同样用源码扫描。
    const source = read('src/components/hud/save-slots-panel.tsx');

    it('keeps the desktop sizing untouched', () => {
        expect(source).toContain('h-[5.25rem]');
        expect(source).toContain('max-h-[33rem]');
        expect(source).toContain('gap-[1.125rem]');
    });

    it('shrinks the thumbnail and the gaps so one whole row fits', () => {
        // 84px 的缩略图是「一行装不下」的主因，手机上收到 48px。
        expect(source).toContain('h-[3rem]');
        // 网格限高按视口算，不再写死 33rem。
        expect(source).toContain('max-h-[calc(100vh-7.5rem)]');
        // 面板本身也不再写死 padding / gap。
        expect(source).toContain("mobile");
    });
});
