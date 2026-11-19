/**
 * src/lib/story/epilogue-npcs.ts
 * --------------------------------------------------------------------------
 * Where the 创世线 actors stand once the story is over.
 *
 * The owner's layout, verbatim:
 *
 *   `在boss战通关之后加在三大关的神秘商人脚边，高度的话等比缩放为神秘商人高度的一半`
 *   `猫猫放右边，boss通关后把神秘商人往左移神秘商人宽度的一半，挪出来的一半给猫猫`
 *
 * So the merchant steps left by half her own width, and the freed half becomes the cat's
 * berth with its feet on the same line. Both maths are pure and live here rather than in the
 * Phaser controller, because "did the cat end up next to her or on top of her" is the kind of
 * thing that should be answerable without booting the engine.
 */

/** Texture key the cat is loaded under. One cat per level, so one key is enough. */
export const EPILOGUE_CAT_TEXTURE_KEY = 'epilogue-cat';

/** seed, standing in the pavilion. */
export const SEED_TEXTURE_KEY = 'seed-pavilion';
export const SEED_TEXTURE_PATH = 'assets/image/characters/epilogue/seed-npc.png';

/** The three epilogue cats, one per painted world. */
export interface EpilogueCat {
    /** Texture file under `public/`. */
    texture: string;
    /** What she says when tapped - the owner's CDK, word for word. */
    line: string;
    /** Locale-independent id, also used for `data-testid`-style debugging. */
    id: string;
}

/**
 * Which cat sits in which level.
 *
 * The three codes concatenate into a video-tool CDK - `deepseek` + `aini` + `sanqianbian` -
 * which is deliberately spread across the three worlds so a player has to visit all of them.
 */
export const EPILOGUE_CATS: Readonly<Record<string, EpilogueCat>> = {
    'starry-library-4-scroll': {
        id: 'cat-claude',
        texture: 'assets/image/characters/epilogue/cat-claude.png',
        line: '喵，神秘小代码第一段是【deepseek】喵。',
    },
    'gpt-sky-city-4-throne-hall': {
        id: 'cat-gpt',
        texture: 'assets/image/characters/epilogue/cat-gpt.png',
        line: '喵，神秘小代码第二段是【aini】喵。',
    },
    'dsh-atlantis-4-coronation-dais': {
        id: 'cat-dsh',
        texture: 'assets/image/characters/epilogue/cat-dsh.png',
        line: '喵，神秘小代码第三段是【sanqianbian】喵。',
    },
} as const;

/** The cat for a level, or null when this level has none / the story is not over. */
export function epilogueCatFor(levelId: string, endingCleared: boolean): EpilogueCat | null {
    if (!endingCleared) return null;
    return EPILOGUE_CATS[levelId] ?? null;
}

/** A point in world pixels. */
export interface Point {
    x: number;
    y: number;
}

/**
 * Where the merchant and her cat end up.
 *
 * `merchant` keeps the same feet line and moves left by half its own width; `cat` takes the
 * middle of the space that opens up on the right. Both are foot-anchored (origin 0.5, 1).
 */
export function merchantAndCatPositions(
    junction: Point,
    merchantWidth: number,
    catWidth: number,
): { merchant: Point; cat: Point } {
    const halfMerchant = merchantWidth / 2;
    return {
        // She keeps the same feet line and steps left by half of herself, which opens the
        // right half of her old box.
        merchant: { x: Math.round(junction.x - halfMerchant), y: junction.y },
        // The cat's left edge sits exactly on the merchant's new right edge: shoulder to
        // shoulder, no overlap and no gap. Using the cat's own width matters — placing it at
        // the *centre* of the freed half drew a 120px cat inside a 75px berth and clipped her
        // into the merchant.
        cat: { x: Math.round(junction.x + catWidth / 2), y: junction.y },
    };
}

/**
 * seed's feet in 海边亭台: the upper-left of the deck, where the whale girl stood before the
 * seats were moved down (`用那个位置就行`).
 *
 * The five seats now sit at y 1150-1250 with the comment explaining why: the selection card is
 * ~400px tall and a head near the top of the 2752x1536 frame pushed it off screen. seed carries
 * no card, so the upper band of the deck is free for her.
 *
 * Three things on this deck fight for the same pixels, measured on the emulator at 1600x900:
 *
 *   - the selection card covers world x 640-1170, y 516-822 (she must not stand behind it),
 *   - the level title sits at world x 1393-1668, y 60-180 (she must not cover it),
 *   - the counter runs across the top, and the painted frame ends at y 0 (a 300-tall sprite with
 *     her feet above y 300 has her crown cut off).
 *
 * The owner asked for a step of 1.5 body-widths right and up from where he saw her - but he saw
 * the *previous* build, the one that had her out in the water at x 620. The full step from there
 * lands her on the counter, over the title. This spot is the same step taken from the deck: right
 * of the card, below the counter, clear of the title.
 */
export const SEED_PAVILION_FEET: Point = { x: 1400, y: 540 };

/** Height seed stands at, in world pixels. Merchant is 300; she is a person, not a giant. */
export const SEED_DISPLAY_HEIGHT = 300;
