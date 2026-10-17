import { BOOT_LOADING } from '@/lib/boot-loading/config';

/**
 * The runner that walks the progress bar: 鲸鲸 herself, redrawn as a 20×24 pixel sprite so she
 * stays crisp at any CSS size (`image-rendering: pixelated` does the nearest-neighbour upscale —
 * the canvas backing store is always exactly one sprite, and CSS sizes it in whole multiples of
 * that in index.html).
 *
 * She is the same face as the loading key art: long blue hair that pales to white at the tips, a
 * frilled white headdress, a navy maid dress under a white apron that carries the little whale
 * mark. Every colour here is sampled straight off that art, so the sprite and the illustration
 * behind it read as one character rather than two.
 *
 * The walk is four frames on the SAME rhythm the characters breathe on: one full walk cycle takes
 * exactly one breath period, `2π / BOOT_LOADING.BREATH_W`. The stride lives in the legs — nothing
 * above them moves — and the two pass frames bob up a pixel, so the step reads as a step.
 */

/** Sprite width, in pixels. Every row is exactly this long. */
export const RUNNER_W = 20;

/** Sprite height, in pixels. Every frame is exactly this tall. */
export const RUNNER_H = 24;

/** Frames the sprite switches through per breath. Four frames = one left-right stride. */
export const RUNNER_STEPS_PER_BREATH = 4;

/**
 * Every colour the sprite can use, keyed by the single character that stands for it in the row
 * strings below: a dark outline plus one flat tone per material, with a shade or a highlight only
 * where the art needs one — the jaw, the lit streak down her hair, the eye catchlight. `.` is
 * transparent and deliberately has no entry.
 */
export const RUNNER_PALETTE = {
    o: '#131a33', // outline - the dark rim that holds the figure together
    A: '#fbfbf8', // the frilled headdress, white
    H: '#3e5d9d', // hair, the blue she and the key art share
    l: '#629ac5', // hair, the lit streak down the crown
    W: '#dceef5', // hair tips - they pale to white, her signature
    S: '#f8d9c0', // warm skin
    s: '#e3b494', // skin shade - the jaw and the blush line
    E: '#1f3262', // the iris
    e: '#ffffff', // the catchlight; without it the eyes vanish at 20 px
    B: '#e58aa0', // the mouth and the cheeks
    D: '#22305c', // the maid dress, navy
    P: '#f6f7f5', // the apron, white
    m: '#4a86c8', // the little whale mark on the apron
    K: '#1a2444', // her shoes
} as const;

/** The character a sprite pixel is drawn with. */
export type PaletteKey = keyof typeof RUNNER_PALETTE;

/** Every character the row strings may contain: the palette plus `.` for transparent. */
export type PaletteChar = '.' | PaletteKey;

/** One frame: a grid of palette characters, plus how far it is bobbed up, in pixels. */
export type RunnerFrame = { rows: string[]; bob: number };

const FRAME_CONTACT_L: RunnerFrame = {
    bob: 0,
    rows: [
        '....................', //  0  empty margin, so the bob on the pass frames has room
        '.......o.o..........', //  1  the ahoge - one stray hair, the only thing above the frill
        '....oAAAAAAAAo......', //  2  frilled headdress: a single scalloped row, white
        '...oHHHHHHHHHHo.....', //  3  her hair, wide and low - the head is over half the sprite
        '..oHHlllllllHHo.....',
        '..oHlllllllllHo.....',
        '..oHHSSSSSSSHHo.....', //  6  forehead
        '..oHSEESSSEESHo.....', //  7  two big anime eyes, split by a narrow bridge
        '..oHSEeSSSEeSHo.....', //  8  catchlights, one in each eye
        '..oHHSSSBBSSHHo.....', //  9  cheeks and an open mouth
        '..oWHHSSSSSHHWo.....', // 10  chin: the hair already paling to white at the temples
        '..oWWHHsSSsHHWWo....', // 11  neck, where the jaw shade meets the pale tips
        '..oWWHHDDDDHHWWo....', // 12  shoulders - maid dress, her hair falling past them either side
        '..oWWHDPPPPDHWWo....', // 13  apron bib
        '..oWWHDPmmPDHWWo....', // 14  the little whale mark on the apron
        '..oWWHDPmmPDHWWo....',
        '..oWWDDPPPPDDWWo....', // 16  apron hem, dress either side
        '.oWWDDDDDDDDDDWWo...', // 17  the skirt, flaring out past her hair
        '.oWWDDDDDDDDDDWWo...',
        '.oWWDDDDDDDDDDWWo...',
        '..oWDDDDDDDDDDWo....', // 20  hem
        '...ooooooooooo......', // 21  the row she stands on
        '...oKKo...oKKo......', // 22  one foot forward
        '...oooo...oooo......',
    ],
};

const FRAME_PASS_DOWN: RunnerFrame = {
    bob: 1,
    rows: [
        '....................', //  0  empty margin, so the bob on the pass frames has room
        '.......o.o..........', //  1  the ahoge - one stray hair, the only thing above the frill
        '....oAAAAAAAAo......', //  2  frilled headdress: a single scalloped row, white
        '...oHHHHHHHHHHo.....', //  3  her hair, wide and low - the head is over half the sprite
        '..oHHlllllllHHo.....',
        '..oHlllllllllHo.....',
        '..oHHSSSSSSSHHo.....', //  6  forehead
        '..oHSEESSSEESHo.....', //  7  two big anime eyes, split by a narrow bridge
        '..oHSEeSSSEeSHo.....', //  8  catchlights, one in each eye
        '..oHHSSSBBSSHHo.....', //  9  cheeks and an open mouth
        '..oWHHSSSSSHHWo.....', // 10  chin: the hair already paling to white at the temples
        '..oWWHHsSSsHHWWo....', // 11  neck, where the jaw shade meets the pale tips
        '..oWWHHDDDDHHWWo....', // 12  shoulders - maid dress, her hair falling past them either side
        '..oWWHDPPPPDHWWo....', // 13  apron bib
        '..oWWHDPmmPDHWWo....', // 14  the little whale mark on the apron
        '..oWWHDPmmPDHWWo....',
        '..oWWDDPPPPDDWWo....', // 16  apron hem, dress either side
        '.oWWDDDDDDDDDDWWo...', // 17  the skirt, flaring out past her hair
        '.oWWDDDDDDDDDDWWo...',
        '.oWWDDDDDDDDDDWWo...',
        '..oWDDDDDDDDDDWo....', // 20  hem
        '...ooooooooooo......', // 21  the row she stands on
        '....oKKo.oKKo.......', // 22  both feet in, under her
        '....oooo.oooo.......',
    ],
};

const FRAME_CONTACT_R: RunnerFrame = {
    bob: 0,
    rows: [
        '....................', //  0  empty margin, so the bob on the pass frames has room
        '.......o.o..........', //  1  the ahoge - one stray hair, the only thing above the frill
        '....oAAAAAAAAo......', //  2  frilled headdress: a single scalloped row, white
        '...oHHHHHHHHHHo.....', //  3  her hair, wide and low - the head is over half the sprite
        '..oHHlllllllHHo.....',
        '..oHlllllllllHo.....',
        '..oHHSSSSSSSHHo.....', //  6  forehead
        '..oHSEESSSEESHo.....', //  7  two big anime eyes, split by a narrow bridge
        '..oHSEeSSSEeSHo.....', //  8  catchlights, one in each eye
        '..oHHSSSBBSSHHo.....', //  9  cheeks and an open mouth
        '..oWHHSSSSSHHWo.....', // 10  chin: the hair already paling to white at the temples
        '..oWWHHsSSsHHWWo....', // 11  neck, where the jaw shade meets the pale tips
        '..oWWHHDDDDHHWWo....', // 12  shoulders - maid dress, her hair falling past them either side
        '..oWWHDPPPPDHWWo....', // 13  apron bib
        '..oWWHDPmmPDHWWo....', // 14  the little whale mark on the apron
        '..oWWHDPmmPDHWWo....',
        '..oWWDDPPPPDDWWo....', // 16  apron hem, dress either side
        '.oWWDDDDDDDDDDWWo...', // 17  the skirt, flaring out past her hair
        '.oWWDDDDDDDDDDWWo...',
        '.oWWDDDDDDDDDDWWo...',
        '..oWDDDDDDDDDDWo....', // 20  hem
        '...ooooooooooo......', // 21  the row she stands on
        '....oKKo..oKKo......', // 22  the other foot forward
        '....oooo..oooo......',
    ],
};

const FRAME_PASS_STAGGER: RunnerFrame = {
    bob: 1,
    rows: [
        '....................', //  0  empty margin, so the bob on the pass frames has room
        '.......o.o..........', //  1  the ahoge - one stray hair, the only thing above the frill
        '....oAAAAAAAAo......', //  2  frilled headdress: a single scalloped row, white
        '...oHHHHHHHHHHo.....', //  3  her hair, wide and low - the head is over half the sprite
        '..oHHlllllllHHo.....',
        '..oHlllllllllHo.....',
        '..oHHSSSSSSSHHo.....', //  6  forehead
        '..oHSEESSSEESHo.....', //  7  two big anime eyes, split by a narrow bridge
        '..oHSEeSSSEeSHo.....', //  8  catchlights, one in each eye
        '..oHHSSSBBSSHHo.....', //  9  cheeks and an open mouth
        '..oWHHSSSSSHHWo.....', // 10  chin: the hair already paling to white at the temples
        '..oWWHHsSSsHHWWo....', // 11  neck, where the jaw shade meets the pale tips
        '..oWWHHDDDDHHWWo....', // 12  shoulders - maid dress, her hair falling past them either side
        '..oWWHDPPPPDHWWo....', // 13  apron bib
        '..oWWHDPmmPDHWWo....', // 14  the little whale mark on the apron
        '..oWWHDPmmPDHWWo....',
        '..oWWDDPPPPDDWWo....', // 16  apron hem, dress either side
        '.oWWDDDDDDDDDDWWo...', // 17  the skirt, flaring out past her hair
        '.oWWDDDDDDDDDDWWo...',
        '.oWWDDDDDDDDDDWWo...',
        '..oWDDDDDDDDDDWo....', // 20  hem
        '...ooooooooooo......', // 21  the row she stands on
        '...oKKo.....oKKo....', // 22  scissored across each other
        '....oooo....oooo....',
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
