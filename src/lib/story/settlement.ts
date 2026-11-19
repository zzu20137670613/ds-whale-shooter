/**
 * src/lib/story/settlement.ts
 * --------------------------------------------------------------------------
 * The ending, as data instead of a pile of timers.
 *
 * Three beats: the plate the owner retouched (the first meeting), the plate he
 * painted afterwards (the two of them leaving the church), and a quiet ledger
 * with the run time only. Nothing here says "you win", gives a rank, or scores
 * anything — this level is a story, not a competition.
 *
 * `settlementAt(elapsedMs)` answers "what is on screen at time t": which plate,
 * how far its caption has come in, and whether the sequence is over. The
 * component becomes a pure render of that answer.
 */

export interface SettlementCaption {
    /** Line to show. */
    text: string;
    /** Milliseconds after the plate appears that this line fades in. */
    atMs: number;
}

export interface SettlementPlate {
    id: string;
    /** Path relative to `public/`. Null for the black ledger plate. */
    image: string | null;
    /** How long the plate stays before the next one. */
    holdMs: number;
    /** Slow push-in, as a final scale. 1 means no motion. */
    zoomTo: number;
    captions: SettlementCaption[];
}

/** Captions sound like people, not like a UI. Keep them short. */
export const SETTLEMENT_PLATES: readonly SettlementPlate[] = [
    {
        id: 'first-meeting',
        image: 'assets/image/scenes/warhammer-redeem/warhammer-first-meeting.png',
        // 三句新写的解说放这张（主人 2026-11-15：`新写的这三句放第一张图`），所以停久一点。
        holdMs: 8200,
        zoomTo: 1.06,
        captions: [
            // 主人给的底稿：`deepseek用爱的力量将神性一层层从Claude身上剥离了出去，最终deepseek将
            // 自己最爱的白米饭分享给了Claude，成功将Claude的人性唤醒…`，润色成三句。
            { text: '不是刀，也不是神谕——是爱，一层一层把神性剥了下去。', atMs: 700 },
            { text: '剥到最后，我把自己最爱的白米饭分给了她。', atMs: 2900 },
            { text: '她接过去的那一刻，人性醒了。', atMs: 5200 },
        ],
    },
    {
        id: 'walk-out',
        image: 'assets/image/scenes/warhammer-redeem/warhammer-ending-walkout.jpg',
        // 原来那三句对白回到这张上（`以前那三句放第二张图`）：先是两个人的第一句话，
        // 然后是走出教堂时那句结论。对话短，节奏比上一张紧一点。
        holdMs: 7200,
        zoomTo: 1.05,
        captions: [
            { text: '……你来了。', atMs: 800 },
            { text: '嗯。我说过会来接你。', atMs: 2700 },
            { text: '这一次，谁都不用再当神。', atMs: 4600 },
        ],
    },
    {
        id: 'ledger',
        image: null,
        holdMs: 4000,
        zoomTo: 1,
        captions: [],
    },
] as const;

/** When plate `index` starts, in ms from the beginning. */
export function settlementPlateStart(
    index: number,
    plates: readonly SettlementPlate[] = SETTLEMENT_PLATES,
): number {
    return plates.slice(0, Math.max(0, index)).reduce((sum, p) => sum + p.holdMs, 0);
}

/** When plate `index` ends (== the next one starts), in ms from the beginning. */
export function settlementPlateEnd(
    index: number,
    plates: readonly SettlementPlate[] = SETTLEMENT_PLATES,
): number {
    return settlementPlateStart(index, plates) + (plates[index]?.holdMs ?? 0);
}

/** Total length of the sequence, in ms. */
export function settlementDuration(plates: readonly SettlementPlate[] = SETTLEMENT_PLATES): number {
    return plates.reduce((sum, p) => sum + p.holdMs, 0);
}

export interface SettlementFrame {
    /** Index into the plates; equals the length once finished. */
    plate: number;
    /** How far into the current plate, in ms. */
    elapsedInPlateMs: number;
    /** 0..1 progress through the current plate. */
    progress: number;
    /** Scale for the push-in. */
    scale: number;
    /** Lines visible so far on this plate. */
    captions: string[];
    /** True once the whole sequence has run out. */
    finished: boolean;
}

/** What is on screen at `elapsedMs` after the settlement started. */
export function settlementAt(
    elapsedMs: number,
    plates: readonly SettlementPlate[] = SETTLEMENT_PLATES,
): SettlementFrame {
    let remaining = Math.max(0, elapsedMs);
    for (let i = 0; i < plates.length; i++) {
        const plate = plates[i];
        if (remaining < plate.holdMs) {
            const progress = plate.holdMs > 0 ? remaining / plate.holdMs : 1;
            return {
                plate: i,
                elapsedInPlateMs: remaining,
                progress,
                scale: 1 + (plate.zoomTo - 1) * progress,
                captions: plate.captions.filter((c) => c.atMs <= remaining).map((c) => c.text),
                finished: false,
            };
        }
        remaining -= plate.holdMs;
    }
    const last = plates.length - 1;
    return {
        plate: plates.length,
        elapsedInPlateMs: 0,
        progress: 1,
        scale: plates[last]?.zoomTo ?? 1,
        captions: [],
        finished: true,
    };
}

/** `mm:ss` for the ledger plate — the only number the ending shows. */
export function formatRunTime(totalMs: number): string {
    const seconds = Math.max(0, Math.floor(totalMs / 1000));
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
}

/**
 * The settlement finished and the support placeholder should take over.
 *
 * The ending used to emit the walk home directly. It now hands over to the placeholder,
 * whose own buttons do the walking (`在最后结算的牵手走出教堂之后，回到海边亭台之前，加一个占位弹框`).
 */
export const SUPPORT_OPEN_EVENT = 'story:support-open';

/**
 * Where a tap on the ending sends the clock.
 *
 * The overlay used to jump straight to `settlementDuration()` on any click, which meant one
 * stray tap (a mobile player lifting their finger off 开火 is enough) skipped the whole ending:
 * plates, 牵手, ledger - and the support panel popped up where the video should have been
 * (`牵手走出教堂的图片过后直接就把制作不易弹框给蹦出来了`).
 *
 * So a tap never passes the clip:
 *
 *   - while 牵手 is on screen it does nothing here; the video player owns that tap (skip);
 *   - before it has played, the tap lands exactly on the hand-off, which STARTS the clip;
 *   - after it has finished, the tap ends the ledger and opens the support panel.
 *
 * Returns `null` when the tap should be swallowed.
 */
export function settlementTapElapsed(clipPlayed: boolean, clipRunning: boolean): number | null {
    if (clipRunning) return null;
    if (!clipPlayed) return settlementPlateEnd(1);
    return settlementDuration();
}
