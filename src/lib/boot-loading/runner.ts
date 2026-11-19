import { BOOT_LOADING } from '@/lib/boot-loading/config';

/**
 * The runner that walks the progress bar: DeepSeek herself, taken from the very same
 * 立绘 the desktop-pet side of the project draws her from (a 512x512 transparent PNG), cropped
 * to her silhouette, scaled to 40x48 and quantised to sixteen colours so she reads as pixel art
 * instead of a shrunk illustration.
 *
 * So this file is GENERATED DATA, not hand-drawn art - the palette and the frames both come out
 * of that PNG. The walk is a bounce, not a leg cycle: a single-frame 立绘 has no walk poses in
 * it, so the four frames are the one figure under a one-pixel bob and a one-pixel sway. They run
 * on the SAME rhythm the characters breathe on - one full cycle per breath, `2π /
 * BOOT_LOADING.BREATH_W` - so she steps in time with the art behind her.
 *
 * 40x48 is deliberate: index.html sizes the element 1x on desktop and a half on a phone, so the
 * sprite is never upscaled and every device scale lands on a whole or half pixel.
 */

/** Sprite width, in pixels. Every row is exactly this long. */
export const RUNNER_W = 40;

/** Sprite height, in pixels. Every frame is exactly this tall. */
export const RUNNER_H = 48;

/** Frames the sprite switches through per breath. Four frames = one left-right stride. */
export const RUNNER_STEPS_PER_BREATH = 4;

/**
 * The 20 colours of the quantised 立绘, keyed by the single character that stands for it in
 * the row strings below. The characters run in descending frequency, so `a` is whatever colour
 * she wears most and the last letter the rarest. Letters rather than hex digits on purpose:
 * TypeScript reads numeric property keys as numbers, which would make `keyof` a mix of numbers
 * and strings. `.` is transparent and deliberately has no entry.
 */
export const RUNNER_PALETTE = {
    a: '#31559a', // 207 px
    b: '#ece2de', // 147 px
    c: '#23325c', // 128 px
    d: '#576b9d', // 102 px
    e: '#9d98a2', // 77 px
    f: '#575669', // 42 px
    g: '#2c486d', // 20 px
    h: '#010204', // 15 px
    i: '#acb4cb', // 11 px
    j: '#d0b3a9', // 9 px
    k: '#6f87a3', // 8 px
    l: '#213d83', // 6 px
    m: '#4c8dcf', // 6 px
    n: '#c5bec6', // 5 px
    o: '#e5c1b2', // 5 px
    p: '#427bc8', // 4 px
    q: '#89766f', // 4 px
    r: '#3c73c2', // 3 px
    s: '#8b817c', // 3 px
    t: '#acc6d5', // 3 px
} as const;

/** The character a sprite pixel is drawn with. */
export type PaletteKey = keyof typeof RUNNER_PALETTE;

/** Every character the row strings may contain: the palette plus `.` for transparent. */
export type PaletteChar = '.' | PaletteKey;

/** One frame: a grid of palette characters, plus how far it is bobbed up, in pixels. */
export type RunnerFrame = { rows: string[]; bob: number };

/** Contact: the base pose, standing square on the bar. */
/** Contact: the base pose, standing square on the bar. */
/** Contact: the base pose, standing square on the bar. */
/** Contact: the base pose, standing square on the bar. */
const FRAME_CONTACT_L: RunnerFrame = {
    bob: 0,
    rows: [
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..............beeebb....................',
        '............bbbbbbbbb...................',
        '..........jbnedeedeebbb.................',
        '.........bbedccaccaadebb................',
        '.........beaalaaaacaadebb...............',
        '........beaaaaaaaaaaaakebd..............',
        '........iapaaaaaaaaaadadbb..............',
        '........daarapmhpapmaaaaebd.............',
        '........aaaaaarraaaaaaaadbd.............',
        '........aaaaaaaaaddaaaaaaed.............',
        '........aaadddddddeddaaaaaaa............',
        '........aaaeeddddebddddaaaaa............',
        '.......adddbbdedebbbedddagcc............',
        '.......addesqeeeejffqhddaccgg...........',
        '......ccddhfcfeebocchfddagcccc..........',
        '.....cccddfiadbbbbdaieddadiedff.........',
        '.....eikdadbitbbbbttbeddccebbe..........',
        '........cadjobbbbbbojddgccc.............',
        '........aagebbbbbbbbefaaccaa............',
        '........aaaceobbbbjkcaaacaa.............',
        '........aadccffqeqfcdmaccaa.............',
        '......aaaamgfejjbcdekadaclaa............',
        '.......aaaacsebobeeegcfcaaaa............',
        '......aaaaccfbjsbbffcccaaaaaa...........',
        '.....aacaachfnefbechcccaaagaaa..........',
        '.....aa.aaccccccchccccaaaa.daa...ga.....',
        '....aaa.daccchcchccccfdada.m....aaa.....',
        '......d.a.accebbedccfedda.kdc...aga.....',
        '......mda.deebbbbnedcekagdaaag.caa......',
        '..........ebbbbbbbbnghd.g.gaacacc.......',
        '.........ebbbbbbbbbbdhce.......c........',
        '.........fbbbbbbbbbbfccfb......c........',
        '........cebbbbbibbbbecccff.....c........',
        '........cfbbbbildibeccccccg....a........',
        '.......ffcebbbbbibbdcccffcc...ac........',
        '.......cfccibbbbbeklffhfcddlaagc........',
        '......bdhgdaaeekecadcfccebflacc.........',
        '.......nedadaaaaaddaccfbbgcccc..........',
        '.........ebedddddddeebbefccaa...........',
        '............bbjbebbb....................',
        '.............ee..hef....................',
        '.............df..fdh....................',
        '.............c...c......................',
    ],
};

/** Pass: she rises a pixel - the bounce the walk reads from. */
const FRAME_PASS_DOWN: RunnerFrame = {
    bob: 1,
    rows: [
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..............beeebb....................',
        '............bbbbbbbbb...................',
        '..........jbnedeedeebbb.................',
        '.........bbedccaccaadebb................',
        '.........beaalaaaacaadebb...............',
        '........beaaaaaaaaaaaakebd..............',
        '........iapaaaaaaaaaadadbb..............',
        '........daarapmhpapmaaaaebd.............',
        '........aaaaaarraaaaaaaadbd.............',
        '........aaaaaaaaaddaaaaaaed.............',
        '........aaadddddddeddaaaaaaa............',
        '........aaaeeddddebddddaaaaa............',
        '.......adddbbdedebbbedddagcc............',
        '.......addesqeeeejffqhddaccgg...........',
        '......ccddhfcfeebocchfddagcccc..........',
        '.....cccddfiadbbbbdaieddadiedff.........',
        '.....eikdadbitbbbbttbeddccebbe..........',
        '........cadjobbbbbbojddgccc.............',
        '........aagebbbbbbbbefaaccaa............',
        '........aaaceobbbbjkcaaacaa.............',
        '........aadccffqeqfcdmaccaa.............',
        '......aaaamgfejjbcdekadaclaa............',
        '.......aaaacsebobeeegcfcaaaa............',
        '......aaaaccfbjsbbffcccaaaaaa...........',
        '.....aacaachfnefbechcccaaagaaa..........',
        '.....aa.aaccccccchccccaaaa.daa...ga.....',
        '....aaa.daccchcchccccfdada.m....aaa.....',
        '......d.a.accebbedccfedda.kdc...aga.....',
        '......mda.deebbbbnedcekagdaaag.caa......',
        '..........ebbbbbbbbnghd.g.gaacacc.......',
        '.........ebbbbbbbbbbdhce.......c........',
        '.........fbbbbbbbbbbfccfb......c........',
        '........cebbbbbibbbbecccff.....c........',
        '........cfbbbbildibeccccccg....a........',
        '.......ffcebbbbbibbdcccffcc...ac........',
        '.......cfccibbbbbeklffhfcddlaagc........',
        '......bdhgdaaeekecadcfccebflacc.........',
        '.......nedadaaaaaddaccfbbgcccc..........',
        '.........ebedddddddeebbefccaa...........',
        '............bbjbebbb....................',
        '.............ee..hef....................',
        '.............df..fdh....................',
        '.............c...c......................',
    ],
};

/** Contact: the base pose slid a pixel right, so the step sways. */
const FRAME_CONTACT_R: RunnerFrame = {
    bob: 0,
    rows: [
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '...............beeebb...................',
        '.............bbbbbbbbb..................',
        '...........jbnedeedeebbb................',
        '..........bbedccaccaadebb...............',
        '..........beaalaaaacaadebb..............',
        '.........beaaaaaaaaaaaakebd.............',
        '.........iapaaaaaaaaaadadbb.............',
        '.........daarapmhpapmaaaaebd............',
        '.........aaaaaarraaaaaaaadbd............',
        '.........aaaaaaaaaddaaaaaaed............',
        '.........aaadddddddeddaaaaaaa...........',
        '.........aaaeeddddebddddaaaaa...........',
        '........adddbbdedebbbedddagcc...........',
        '........addesqeeeejffqhddaccgg..........',
        '.......ccddhfcfeebocchfddagcccc.........',
        '......cccddfiadbbbbdaieddadiedff........',
        '......eikdadbitbbbbttbeddccebbe.........',
        '.........cadjobbbbbbojddgccc............',
        '.........aagebbbbbbbbefaaccaa...........',
        '.........aaaceobbbbjkcaaacaa............',
        '.........aadccffqeqfcdmaccaa............',
        '.......aaaamgfejjbcdekadaclaa...........',
        '........aaaacsebobeeegcfcaaaa...........',
        '.......aaaaccfbjsbbffcccaaaaaa..........',
        '......aacaachfnefbechcccaaagaaa.........',
        '......aa.aaccccccchccccaaaa.daa...ga....',
        '.....aaa.daccchcchccccfdada.m....aaa....',
        '.......d.a.accebbedccfedda.kdc...aga....',
        '.......mda.deebbbbnedcekagdaaag.caa.....',
        '...........ebbbbbbbbnghd.g.gaacacc......',
        '..........ebbbbbbbbbbdhce.......c.......',
        '..........fbbbbbbbbbbfccfb......c.......',
        '.........cebbbbbibbbbecccff.....c.......',
        '.........cfbbbbildibeccccccg....a.......',
        '........ffcebbbbbibbdcccffcc...ac.......',
        '........cfccibbbbbeklffhfcddlaagc.......',
        '.......bdhgdaaeekecadcfccebflacc........',
        '........nedadaaaaaddaccfbbgcccc.........',
        '..........ebedddddddeebbefccaa..........',
        '.............bbjbebbb...................',
        '..............ee..hef...................',
        '..............df..fdh...................',
        '..............c...c.....................',
    ],
};

/** Pass: up a pixel and the other way - the far half of the sway. */
const FRAME_PASS_STAGGER: RunnerFrame = {
    bob: 1,
    rows: [
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.............beeebb.....................',
        '...........bbbbbbbbb....................',
        '.........jbnedeedeebbb..................',
        '........bbedccaccaadebb.................',
        '........beaalaaaacaadebb................',
        '.......beaaaaaaaaaaaakebd...............',
        '.......iapaaaaaaaaaadadbb...............',
        '.......daarapmhpapmaaaaebd..............',
        '.......aaaaaarraaaaaaaadbd..............',
        '.......aaaaaaaaaddaaaaaaed..............',
        '.......aaadddddddeddaaaaaaa.............',
        '.......aaaeeddddebddddaaaaa.............',
        '......adddbbdedebbbedddagcc.............',
        '......addesqeeeejffqhddaccgg............',
        '.....ccddhfcfeebocchfddagcccc...........',
        '....cccddfiadbbbbdaieddadiedff..........',
        '....eikdadbitbbbbttbeddccebbe...........',
        '.......cadjobbbbbbojddgccc..............',
        '.......aagebbbbbbbbefaaccaa.............',
        '.......aaaceobbbbjkcaaacaa..............',
        '.......aadccffqeqfcdmaccaa..............',
        '.....aaaamgfejjbcdekadaclaa.............',
        '......aaaacsebobeeegcfcaaaa.............',
        '.....aaaaccfbjsbbffcccaaaaaa............',
        '....aacaachfnefbechcccaaagaaa...........',
        '....aa.aaccccccchccccaaaa.daa...ga......',
        '...aaa.daccchcchccccfdada.m....aaa......',
        '.....d.a.accebbedccfedda.kdc...aga......',
        '.....mda.deebbbbnedcekagdaaag.caa.......',
        '.........ebbbbbbbbnghd.g.gaacacc........',
        '........ebbbbbbbbbbdhce.......c.........',
        '........fbbbbbbbbbbfccfb......c.........',
        '.......cebbbbbibbbbecccff.....c.........',
        '.......cfbbbbildibeccccccg....a.........',
        '......ffcebbbbbibbdcccffcc...ac.........',
        '......cfccibbbbbeklffhfcddlaagc.........',
        '.....bdhgdaaeekecadcfccebflacc..........',
        '......nedadaaaaaddaccfbbgcccc...........',
        '........ebedddddddeebbefccaa............',
        '...........bbjbebbb.....................',
        '............ee..hef.....................',
        '............df..fdh.....................',
        '............c...c.......................',
    ],
};

export const RUNNER_FRAMES: readonly RunnerFrame[] = [
    FRAME_CONTACT_L,
    FRAME_PASS_DOWN,
    FRAME_CONTACT_R,
    FRAME_PASS_STAGGER,
];

/** One opaque sprite pixel. */
export type RunnerPixel = { x: number; y: number; color: string; key: PaletteKey };

/** Index of a frame. */
export type RunnerFrameIndex = 0 | 1 | 2 | 3;

/**
 * Which walk frame belongs at time `t` (s). Locked to the breath: the frame advances
 * `RUNNER_STEPS_PER_BREATH` times per `2π / w`, so the stride is evenly spaced in time and one
 * full cycle lands exactly on one breath. The phase — not the breath VALUE — is what steps,
 * because the breath curve is flat at its peak and a value-quantised flip there is invisible.
 */
export function runnerFrameAt(t: number, w: number): RunnerFrameIndex {
    const phase = (((((t * w) / (2 * Math.PI)) % 1) + 1) % 1) * RUNNER_STEPS_PER_BREATH;
    return (Math.floor(phase) % RUNNER_FRAMES.length) as RunnerFrameIndex;
}

/** One breath in seconds — the runner's stride period. */
export function runnerStrideS(w: number): number {
    return (2 * Math.PI) / w / RUNNER_STEPS_PER_BREATH;
}

/** Flatten a frame into drawable pixels. Pure — the caller decides how to paint them. */
export function runnerPixels(frame: RunnerFrame): RunnerPixel[] {
    const out: RunnerPixel[] = [];
    frame.rows.forEach((row, y) => {
        for (let x = 0; x < RUNNER_W; x++) {
            const key = row[x] as PaletteChar;
            if (key === '.') continue;
            out.push({ x, y: y - frame.bob, color: RUNNER_PALETTE[key], key });
        }
    });
    return out;
}

/**
 * Paint one frame into a `RUNNER_W × RUNNER_H` 2D context, one `fillRect` per pixel. The context
 * is never scaled, so the backing store stays 1:1 with the sprite and the browser does the crisp
 * upscale. `bob` lifts the figure inside the canvas.
 */
export function drawRunnerFrame(ctx: CanvasRenderingContext2D, frame: RunnerFrame): void {
    ctx.clearRect(0, 0, RUNNER_W, RUNNER_H);
    for (const p of runnerPixels(frame)) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 1, 1);
    }
}

/**
 * Put the runner into `#boot` and animate it. Returns a disposer, or null when there is no
 * `.pixel-runner` in the document. Owns its own rAF (it has to run on the static-fallback path
 * too, where the WebGL loop never starts), pauses while the tab is hidden, and stops on its own
 * once the splash is removed.
 */
export function mountRunner(root: ParentNode): (() => void) | null {
    const el = root.querySelector('.pixel-runner');
    if (!(el instanceof HTMLElement)) return null;

    const canvas = document.createElement('canvas');
    canvas.width = RUNNER_W;
    canvas.height = RUNNER_H;
    canvas.className = 'runner-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    el.replaceChildren(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // The canvas is transparent, so the inline first-paint frame on .pixel-runner would show
    // through every other frame (and the bob). Drop it the moment the canvas can draw.
    el.style.backgroundImage = 'none';

    // Reduced motion: pose him, don't walk him. Same rule as the WebGL splash.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        drawRunnerFrame(ctx, RUNNER_FRAMES[0]);
        return null;
    }

    let raf = 0;
    let disposed = false;
    const t0 = performance.now();

    const frame = (now: number): void => {
        drawRunnerFrame(
            ctx,
            RUNNER_FRAMES[runnerFrameAt((now - t0) / 1000, BOOT_LOADING.BREATH_W)],
        );
        raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVisibility);
        observer.disconnect();
    };

    const onVisibility = (): void => {
        if (document.hidden) {
            cancelAnimationFrame(raf);
            raf = 0;
        } else if (!disposed && !raf) {
            raf = requestAnimationFrame(frame);
        }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // The splash removes itself on dismissal; nothing else will tell us.
    const observer = new MutationObserver(() => {
        if (!el.isConnected) dispose();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return dispose;
}
