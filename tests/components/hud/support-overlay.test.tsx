// @vitest-environment happy-dom
/**
 * tests/components/hud/support-overlay.test.tsx
 * --------------------------------------------------------------------------
 * The placeholder the owner asked for between the church and the pavilion.
 *
 * `在最后结算的牵手走出教堂之后，回到海边亭台之前，加一个占位弹框…两个按钮都会触发会亭台逻辑`.
 * Two pages, a 微信 / 支付宝 rail, and portrait slots that are stand-ins until the art lands.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SupportOverlay } from '@/components/hud/support-overlay';
import { EventBus } from '@/lib/events/bus';
import { RETURN_TO_PAVILION_EVENT } from '@/lib/merchant/logic';
import { SUPPORT_OPEN_EVENT } from '@/lib/story/settlement';
import { setLocale, t } from '@/locales';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    setLocale('zh-CN');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<SupportOverlay />));
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

const open = () => act(() => void EventBus.emit(SUPPORT_OPEN_EVENT));
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe('showing up', () => {
    it('is invisible until the settlement ends', () => {
        expect(q('support-overlay')).toBeNull();
        open();
        expect(q('support-overlay')).not.toBeNull();
    });
});

describe('the two pages', () => {
    it('starts on the support page with both portrait slots', () => {
        open();
        expect(q('support-portrait-donate-wechat-a')).not.toBeNull();
        expect(q('support-portrait-donate-wechat-b')).not.toBeNull();
    });

    it('flips to the commission page and back', () => {
        open();
        act(() => q('support-page-toggle')!.click());
        expect(q('support-portrait-custom-wechat-a')).not.toBeNull();
        act(() => q('support-page-toggle')!.click());
        expect(q('support-portrait-donate-wechat-a')).not.toBeNull();
    });
});

describe('the payment rail', () => {
    it('defaults to WeChat and switches to Alipay in place', () => {
        open();
        act(() => q('support-method-alipay')!.click());
        // Same page, different portraits - that is the whole "无感切换".
        expect(q('support-portrait-donate-alipay-a')).not.toBeNull();
        expect(q('support-portrait-donate-wechat-a')).toBeNull();
    });
});

describe('leaving', () => {
    for (const id of ['support-thanked', 'support-decline']) {
        it(`${id} walks the player home`, () => {
            open();
            const heard: string[] = [];
            const handler = () => heard.push('home');
            EventBus.on(RETURN_TO_PAVILION_EVENT, handler);
            act(() => q(id)!.click());
            EventBus.off(RETURN_TO_PAVILION_EVENT, handler);

            expect(heard).toEqual(['home']);
            expect(q('support-overlay')).toBeNull();
        });
    }

    it('names the buttons the way he asked', () => {
        expect(t('support.thanked')).toBe('已投，作者继续加油！');
        expect(t('support.decline')).toBe('不了，返回');
        expect(t('support.custom')).toBe('找作者定制专属隐藏地图');
    });
});

describe('the art', () => {
    const srcOf = (id: string) =>
        q(id)?.querySelector('img')?.getAttribute('src') ?? null;

    it('shows wx1/wx2 on the first page for WeChat', () => {
        open();
        expect(srcOf('support-portrait-donate-wechat-a')).toContain('donate-wechat-a.jpg');
        expect(srcOf('support-portrait-donate-wechat-b')).toContain('donate-wechat-b.jpg');
    });

    it('shows zfb1/zfb2 there for Alipay', () => {
        open();
        act(() => q('support-method-alipay')!.click());
        expect(srcOf('support-portrait-donate-alipay-a')).toContain('donate-alipay-a.jpg');
        expect(srcOf('support-portrait-donate-alipay-b')).toContain('donate-alipay-b.jpg');
    });

    it('gives page two wx3/zfb3 plus the shared 4', () => {
        open();
        act(() => q('support-page-toggle')!.click());
        expect(srcOf('support-portrait-custom-wechat-a')).toContain('custom-wechat-a.jpg');
        expect(srcOf('support-portrait-custom-wechat-b')).toContain('custom-shared-b.png');

        act(() => q('support-method-alipay')!.click());
        expect(srcOf('support-portrait-custom-alipay-a')).toContain('custom-alipay-a.jpg');
        // The shared second image is the same file on both rails.
        expect(srcOf('support-portrait-custom-alipay-b')).toContain('custom-shared-b.png');
    });

    it('never crops the art', () => {
        open();
        expect(q('support-portrait-donate-wechat-a')?.querySelector('img')?.className).toContain(
            'object-contain',
        );
    });
});

describe('the debug entry', () => {
    it('opens on boot when the URL says so', () => {
        // `单独加一个调试入口直接打开` - no need to play to the church to check the art.
        const source = readFileSync(
            join(process.cwd(), 'src', 'components', 'hud', 'support-overlay.tsx'),
            'utf8',
        );
        expect(source).toContain("search.includes('supportDebug')");
        expect(source).toMatch(/supportDebug[\s\S]{0,80}setOpen\(true\)/);
    });
});

describe('the new layout', () => {
    it('puts the two rails beside the plates, not under them', () => {
        open();
        const wechat = q('support-method-wechat')!;
        const alipay = q('support-method-alipay')!;
        const plateA = q('support-portrait-donate-wechat-a')!;

        // Same flex row: both rails and the plates share one parent.
        expect(wechat.parentElement?.parentElement).toBe(plateA.parentElement?.parentElement);
        expect(alipay.parentElement).toBe(wechat.parentElement);
    });

    it('captions the two plates on the first page', () => {
        open();
        expect(q('support-portrait-donate-wechat-a')?.textContent).toContain(
            t('support.coinLine'),
        );
        expect(q('support-portrait-donate-wechat-b')?.textContent).toContain(
            t('support.gachaLine'),
        );
    });

    it('says what he asked for in the title', () => {
        expect(t('support.title')).toBe('创作不易，投枚硬币支持一下作者吧 （≽^⚈⩊⚈^≼）');
    });
});

describe('the type scale', () => {
    const source = () =>
        readFileSync(
            join(process.cwd(), 'src', 'components', 'hud', 'support-overlay.tsx'),
            'utf8',
        );

    it('makes the title bigger, bold and centred', () => {
        const src = source();
        expect(src).toMatch(/text-\[19px\] font-bold[\s\S]{0,120}text-amber-300/);
        expect(src).toMatch(/text-center[\s\S]{0,120}text-\[19px\]/);
    });

    it('steps every other size up', () => {
        const src = source();
        expect(src).toContain('text-[15px] leading-6 tracking-[0.18em]'); // plate captions
        expect(src).toContain('text-[16px] tracking-[0.3em]'); // rail buttons
        expect(src).toContain('text-[16px] font-bold'); // thank-you button
    });

    it('shrinks the art by a fifth', () => {
        const src = source();
        expect(src).toContain('max-w-[80%]');
        expect(src).toContain('max-h-[21rem]');
    });
});

describe('the buttons on the commission page', () => {
    it('turns the left one into a contact form', () => {
        open();
        act(() => q('support-page-toggle')!.click());
        expect(q('support-thanked')?.textContent).toBe(t('support.fillInfo'));

        act(() => q('support-thanked')!.click());
        expect(q('support-letter-dialog')).not.toBeNull();
    });

    it('shows the sponsor wording, not the cabin wording', () => {
        open();
        act(() => q('support-page-toggle')!.click());
        act(() => q('support-thanked')!.click());

        const text = q('support-letter-dialog')!.textContent ?? '';
        expect(text).toContain('感谢金主大佬支持，请填写以下信息，作者会第一时间联系您');
        expect(text).not.toContain('这台电脑不是你的');
        // The first field asks for a contact, and the guestbook link is gone.
        expect(text).not.toContain('看看别人说了什么');
        expect(
            q('support-letter-dialog')!.querySelector('input')?.getAttribute('placeholder'),
        ).toContain('联系方式，必填');
    });

    it('turns the right one into 返回, which goes back a page instead of home', () => {
        open();
        act(() => q('support-page-toggle')!.click());
        expect(q('support-decline')?.textContent).toBe(t('support.goBack'));

        const heard: string[] = [];
        const handler = () => heard.push('home');
        EventBus.on(RETURN_TO_PAVILION_EVENT, handler);
        act(() => q('support-decline')!.click());
        EventBus.off(RETURN_TO_PAVILION_EVENT, handler);

        expect(heard).toEqual([]);
        // Back on the first page, still inside the panel.
        expect(q('support-portrait-donate-wechat-a')).not.toBeNull();
    });
});

describe('the two pages are the same height', () => {
    it('reserves the caption row even where there is no caption', () => {
        open();
        // Page one has real captions.
        expect(q('support-portrait-donate-wechat-a-caption')?.textContent).toBe(
            t('support.coinLine'),
        );

        act(() => q('support-page-toggle')!.click());
        const blank = q('support-portrait-custom-wechat-b-caption');
        expect(blank).not.toBeNull();
        // Non-breaking space, not empty: an empty span collapses and the plates ride up.
        expect(blank?.textContent?.trim()).toBe('');
        expect(blank?.textContent).toContain('\u00a0');
        expect(blank?.className).toContain('min-h-[1.5rem]');
    });

    it('captions the first plate on the commission page too', () => {
        // `在wx3/zfb3图片上方写投一发百连支持作者`
        open();
        act(() => q('support-page-toggle')!.click());
        expect(q('support-portrait-custom-wechat-a-caption')?.textContent).toBe(
            t('support.hundredLine'),
        );
        act(() => q('support-method-alipay')!.click());
        expect(q('support-portrait-custom-alipay-a-caption')?.textContent).toBe(
            t('support.hundredLine'),
        );
        expect(t('support.hundredLine')).toBe('投一发百连支持作者');
    });
});
