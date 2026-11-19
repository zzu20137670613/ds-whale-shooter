/**
 * src/lib/story/seed-shop.ts
 * --------------------------------------------------------------------------
 * 创世线 — what seed offers once the story is over.
 *
 * The owner: after the boss level is cleared and the player is back at the pavilion, seed
 * stands in the top-left corner of 海边亭台; tapping her opens a shop shaped exactly like the
 * mysterious merchant's, with new contents:
 *
 *   1 探索 Claude 的星空图书馆
 *   2 探索 GPT 的天空之城
 *   3 探索 dsh 的亚特兰蒂斯
 *   4 探索未至之境        <- rainbow text; logic deliberately not written yet
 *   5 取消               <- the merchant shop's own bottom close button
 *
 * Why this lives in `lib/story` rather than in the component: the destinations are game data
 * (level ids), the component only draws them, and a future 「未至之境」 has to be able to
 * replace one entry without touching any JSX.
 */

/** One row of seed's shop. */
export interface SeedDestination {
    /** Stable id, also used for `data-testid`. */
    id: string;
    /** Level to travel to, or null while the destination is still a promise. */
    levelId: string | null;
    /**
     * Locale key suffix: the panel calls `t(`seedShop.${label}`)`.
     *
     * A template call rather than a stored full key because the locale coverage test only
     * sees literal `t('…')` or `t(`prefix.${…}`)` - a dynamically assembled key looked like a
     * dead entry and failed the build.
     */
    label: string;
    /**
     * Draw the label as a rainbow rather than amber.
     *
     * The owner asked for exactly one row to look special: `（4）探索未至之境--这个按钮做成好看的
     * 彩色字`. It is styling only - what the button *does* is the owner's next big idea and has
     * not been designed yet.
     */
    rainbow?: boolean;
}

/**
 * The four rows, in the order he dictated them.
 *
 * `未至之境` carries `levelId: null` on purpose: it must look alive and pressable while doing
 * nothing yet, rather than being greyed out as "not built" - it is the hook for the next chapter.
 */
export const SEED_DESTINATIONS: readonly SeedDestination[] = [
    {
          id: 'starry-library',
          levelId: 'starry-library-1-entrance',
          label: 'starryLibrary',
      },
    { id: 'sky-city', levelId: 'gpt-sky-city-1-entrance', label: 'skyCity' },
    { id: 'atlantis', levelId: 'dsh-atlantis-1-entrance', label: 'atlantis' },
    {
        id: 'unknown-realm',
        levelId: null,
        label: 'unknownRealm',
        rainbow: true,
    },
] as const;

/** Can this row travel anywhere yet? */
export function destinationIsOpen(destination: SeedDestination): boolean {
    return typeof destination.levelId === 'string' && destination.levelId.length > 0;
}

/**
 * Should seed (and the three cats) be standing at all?
 *
 * The gate is the whole story being finished: the ears and the cat CDKs are the 创世线's
 * epilogue, and they must not be reachable on a fresh save.
 */
export function epilogueIsOpen(endingCleared: boolean): boolean {
    return endingCleared;
}
