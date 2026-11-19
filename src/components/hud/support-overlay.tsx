/**
 * src/components/hud/support-overlay.tsx
 * --------------------------------------------------------------------------
 * The panel between the church walk-out and the walk home.
 *
 * Layout, on the owner's instruction (`微信按钮、支付宝按钮现在是在图片下方一行，设计的意图是与图片
 * 在同一行`): the two rails stack on the LEFT, the two portrait plates sit in the MIDDLE with a
 * caption over each, and one two-row-tall button on the RIGHT leads to the commission page.
 *
 * Both bottom buttons walk the player home, which is the only side effect this screen has.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EventBus } from '@/lib/events/bus';
import { RETURN_TO_PAVILION_EVENT } from '@/lib/merchant/logic';
import { fitScale } from '@/lib/hud/fit-scale';
import { SUPPORT_OPEN_EVENT } from '@/lib/story/settlement';
import { t } from '@/locales';

import { LetterDialog } from './letter-dialog';
import { CornerPixels, RETRO_BOX } from './retro-box';

/** Which page of the two the panel is showing. */
type SupportPage = 'donate' | 'custom';
/** Which payment rail's plates are on screen. */
type SupportMethod = 'wechat' | 'alipay';

/**
 * The plates, keyed by page + rail.
 *
 * Page one has its own pair per rail; page two shares its second plate between WeChat and
 * Alipay (`4是wx/zfb第二页的通用第二张图`).
 */
const PORTRAITS: Record<SupportPage, Record<SupportMethod, [string, string]>> = {
    donate: {
        wechat: [
            'assets/image/support/donate-wechat-a.jpg',
            'assets/image/support/donate-wechat-b.jpg',
        ],
        alipay: [
            'assets/image/support/donate-alipay-a.jpg',
            'assets/image/support/donate-alipay-b.jpg',
        ],
    },
    custom: {
        wechat: [
            'assets/image/support/custom-wechat-a.jpg',
            'assets/image/support/custom-shared-b.png',
        ],
        alipay: [
            'assets/image/support/custom-alipay-a.jpg',
            'assets/image/support/custom-shared-b.png',
        ],
    },
};

/** Captions over each plate, page one only - that is where he asked for them. */

export interface SupportOverlayProps {
    /** Called after the walk home has been requested. */
    onClose?: () => void;
}

function Plate({ id, src, caption }: { id: string; src: string; caption?: string }) {
    return (
        <div data-testid={id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {/* Reserved on BOTH pages, even when there is no caption: page two has no
                captions, and without this row its plates sat ~1.5rem higher than page one's
                (`两个页面现在有轻微的高度差了`). */}
            <span
                data-testid={`${id}-caption`}
                className="min-h-[1.5rem] font-mono text-[15px] leading-6 tracking-[0.18em] text-amber-200"
            >
                {caption ?? '\u00a0'}
            </span>
            <div className="flex w-full max-w-[80%] items-center justify-center border border-stone-800 bg-stone-950/80">
                {/* The source ratios differ (0.67 - 0.91), so `contain` keeps every plate
                    whole. The size is won by trimming the files, not by cropping here. */}
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="max-h-[21rem] w-full object-contain"
                />
            </div>
        </div>
    );
}

/** A stacked rail button. Two of these fill the left column. */
function RailButton(props: { id: string; active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            data-testid={props.id}
            onClick={props.onClick}
            className={`flex flex-1 items-center justify-center border font-mono text-[16px] tracking-[0.3em] transition-colors ${
                props.active
                    ? 'border-amber-600 bg-amber-900/40 text-amber-200'
                    : 'border-stone-700 bg-stone-900/60 text-stone-400 hover:text-stone-200'
            }`}
            style={{ writingMode: 'vertical-rl' }}
        >
            {props.label}
        </button>
    );
}

export function SupportOverlay({ onClose }: SupportOverlayProps) {
    const [open, setOpen] = useState(false);
    /** The commission page swaps its left button for a contact form. */
    const [letterOpen, setLetterOpen] = useState(false);
    const [page, setPage] = useState<SupportPage>('donate');
    const [method, setMethod] = useState<SupportMethod>('wechat');

    // Opened by the settlement finishing, closed by either bottom button. Mounted for the
    // whole app lifetime so the event is never missed.
    useEffect(() => {
        const handler = () => {
            setPage('donate');
            setMethod('wechat');
            setLetterOpen(false);
            setOpen(true);
        };
        EventBus.on(SUPPORT_OPEN_EVENT, handler);

        // `?supportDebug=1` opens it on boot so the four image sets can be checked without
        // playing the whole run to the church.
        if (window.location.search.includes('supportDebug')) setOpen(true);

        return () => EventBus.off(SUPPORT_OPEN_EVENT, handler);
    }, []);

    /**
     * 整块面板等比缩放到视野内 —— 主人 2026-11-16：`手机上最后的赞赏页面太大了，需要等比缩小`。
     *
     * 面板是按 67.5rem（1080px）画的，在手机横向的视口里宽度能被 `max-w` 夹住，
     * 但**高度**夹不住，图一多就被切掉。所以按实际尺寸算一个 ≤ 1 的比例整块缩放，
     * 而不是逐个改字号（改字号会把排版改歪）。
     *
     * 桌面上算出来就是 1，等于没动。
     */
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelScale, setPanelScale] = useState(1);

    useLayoutEffect(() => {
        if (!open) return;
        const fit = () => {
            const panel = panelRef.current;
            const box = panel?.parentElement;
            if (!panel || !box) return;
            setPanelScale(
                fitScale(panel.offsetWidth, panel.offsetHeight, box.clientWidth, box.clientHeight),
            );
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [open, page, method]);

    /** Both bottom buttons do this: walk home. */
    function goHome() {
        setOpen(false);
        onClose?.();
        EventBus.emit(RETURN_TO_PAVILION_EVENT);
    }

    if (!open) return null;

    const suffix = page === 'donate' ? 'donate' : 'custom';
    // Literal `t()` calls on purpose: the locale coverage test reads call sites, so an
    // indirection through an array would make both keys look unused.
    const captionA =
        page === 'donate' ? t('support.coinLine') : t('support.hundredLine');
    // The shared second plate on the commission page carries no caption.
    const captionB = page === 'donate' ? t('support.gachaLine') : undefined;
    const [left, right] = PORTRAITS[page][method];

    return (
        <div
            data-testid="support-overlay"
            className="pointer-events-auto absolute inset-0 z-[10002] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
            <div
                ref={panelRef}
                style={
                    panelScale < 1
                        ? { transform: `scale(${panelScale})`, transformOrigin: 'center' }
                        : undefined
                }
                className={`${RETRO_BOX} relative flex w-[67.5rem] max-w-[calc(100vw-2rem)] flex-col gap-[1rem] px-[1.875rem] py-[1.25rem]`}
            >
                <CornerPixels />

                <div className="border-b border-stone-800 pb-2 text-center font-mono text-[19px] font-bold tracking-[0.14em] text-amber-300">
                    {t('support.title')}
                </div>

                {/* 左：微信 / 支付宝（上下两行）· 中：两张竖屏图 · 右：二合一的长按钮 */}
                <div className="flex items-stretch gap-3">
                    <div className="flex w-12 flex-col gap-2">
                        <RailButton
                            id="support-method-wechat"
                            active={method === 'wechat'}
                            label={t('support.wechat')}
                            onClick={() => setMethod('wechat')}
                        />
                        <RailButton
                            id="support-method-alipay"
                            active={method === 'alipay'}
                            label={t('support.alipay')}
                            onClick={() => setMethod('alipay')}
                        />
                    </div>

                    <div className="flex min-w-0 flex-1 gap-3">
                        <Plate
                            id={`support-portrait-${suffix}-${method}-a`}
                            src={left}
                            caption={captionA}
                        />
                        <Plate
                            id={`support-portrait-${suffix}-${method}-b`}
                            src={right}
                            caption={captionB}
                        />
                    </div>

                    <button
                        type="button"
                        data-testid="support-page-toggle"
                        onClick={() => setPage(page === 'donate' ? 'custom' : 'donate')}
                        className="flex w-12 items-center justify-center gap-1 border border-stone-700 bg-stone-900/60 font-mono text-[15px] tracking-[0.25em] text-stone-300 hover:border-amber-700 hover:text-amber-200"
                        style={{ writingMode: 'vertical-rl' }}
                    >
                        {page === 'donate' ? (
                            <>
                                {t('support.custom')}
                                <ChevronRight
                                    className="size-4 shrink-0"
                                    style={{ writingMode: 'horizontal-tb' }}
                                />
                            </>
                        ) : (
                            <>
                                <ChevronLeft
                                    className="size-4 shrink-0"
                                    style={{ writingMode: 'horizontal-tb' }}
                                />
                                {t('support.back')}
                            </>
                        )}
                    </button>
                </div>

                {/* 底部两个按钮，都会回海边亭台 */}
                <div className="flex gap-3">
                    <Button
                        data-testid="support-thanked"
                        // The commission page asks for contact details instead of thanks.
                        onClick={page === 'custom' ? () => setLetterOpen(true) : goHome}
                        className="h-11 flex-1 rounded-none bg-amber-500 text-[16px] font-bold tracking-wider text-white hover:bg-amber-400"
                    >
                        {page === 'custom' ? t('support.fillInfo') : t('support.thanked')}
                    </Button>
                    <Button
                        data-testid="support-decline"
                        // On the commission page this is a 返回: it goes back a page instead of
                        // walking the player home (`右侧按钮改为返回，点击后逻辑等同返回前一个页面`).
                        onClick={page === 'custom' ? () => setPage('donate') : goHome}
                        variant="outline"
                        className="h-11 flex-1 rounded-none border-stone-700 bg-stone-900/80 text-[16px] font-semibold tracking-wider text-stone-300 hover:bg-stone-800 hover:text-amber-300"
                    >
                        {page === 'custom' ? t('support.goBack') : t('support.decline')}
                    </Button>
                </div>

                {letterOpen && (
                    <LetterDialog
                        variant="sponsor"
                        onClose={() => setLetterOpen(false)}
                        testId="support-letter-dialog"
                    />
                )}
            </div>
        </div>
    );
}