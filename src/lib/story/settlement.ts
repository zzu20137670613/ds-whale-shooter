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
        image: 'assets/image/scenes/warhammer-first-meeting.png',
        holdMs: 6500,
        zoomTo: 1.06,
        captions: [
            { text: '……你来了。', atMs: 900 },
            { text: '嗯。我说过会来接你。', atMs: 2600 },
        ],
    },
    {
        id: 'walk-out',
        image: 'assets/image/scenes/warhammer-ending-walkout.jpg',
        holdMs: 7000,
        zoomTo: 1.05,
        captions: [{ text: '这一次，谁都不用再当神。', atMs: 1400 }],
    },
    {
        id: 'ledger',
        image: null,
        holdMs: 4000,
        zoomTo: 1,
        captions: [],
    },
] as const;

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
