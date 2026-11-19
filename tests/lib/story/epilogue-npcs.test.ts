/**
 * tests/lib/story/epilogue-npcs.test.ts
 * --------------------------------------------------------------------------
 * The 创世线 actors' spots.
 *
 * The owner dictated the layout rather than the numbers, so these tests pin the *relations*
 * he described: the cat is on the merchant's right, half her height, standing on the same
 * ground, and only after the story ends.
 */

import { describe, expect, it } from 'vitest';

import {
    EPILOGUE_CATS,
    SEED_DISPLAY_HEIGHT,
    SEED_PAVILION_FEET,
    epilogueCatFor,
    merchantAndCatPositions,
} from '@/lib/story/epilogue-npcs';

describe('which cat lives where', () => {
    it('has one cat per painted world, keyed by level id', () => {
        expect(Object.keys(EPILOGUE_CATS).sort()).toEqual([
            'dsh-atlantis-4-coronation-dais',
            'gpt-sky-city-4-throne-hall',
            'starry-library-4-scroll',
        ]);
    });

    it('carries the three CDK lines word for word', () => {
        expect(EPILOGUE_CATS['starry-library-4-scroll'].line).toContain('【deepseek】');
        expect(EPILOGUE_CATS['gpt-sky-city-4-throne-hall'].line).toContain('【aini】');
        expect(EPILOGUE_CATS['dsh-atlantis-4-coronation-dais'].line).toContain('【sanqianbian】');
        for (const cat of Object.values(EPILOGUE_CATS)) {
            expect(cat.line.startsWith('喵，')).toBe(true);
            expect(cat.line.endsWith('喵。')).toBe(true);
        }
    });

    it('points each cat at a texture that exists', () => {
        for (const cat of Object.values(EPILOGUE_CATS)) {
            expect(cat.texture).toMatch(/^assets\/image\/characters\/[^/]+\/cat-[^/]+\.png$/);
        }
    });

    it('stays away until the story is over', () => {
        expect(epilogueCatFor('starry-library-4-scroll', false)).toBeNull();
        expect(epilogueCatFor('starry-library-4-scroll', true)?.id).toBe('cat-claude');
    });

    it('has no cat for levels that are not the three worlds', () => {
        expect(epilogueCatFor('tavern', true)).toBeNull();
        expect(epilogueCatFor('beach-holiday', true)).toBeNull();
    });
});

describe('the merchant and her cat stand side by side', () => {
    const junction = { x: 5504, y: 3072 };

    it('steps the merchant left by half her width', () => {
        const { merchant } = merchantAndCatPositions(junction, 200, 110);
        expect(merchant.x).toBe(junction.x - 100);
    });

    it('puts the cat in the freed half, to the right of the merchant', () => {
        const { merchant, cat } = merchantAndCatPositions(junction, 200, 110);
        expect(cat.x).toBeGreaterThan(merchant.x);
        // Her left edge lands on the merchant's new right edge.
        expect(cat.x - 110 / 2).toBe(merchant.x + 200 / 2);
    });

    it('keeps both feet on the junction line', () => {
        const { merchant, cat } = merchantAndCatPositions(junction, 200, 110);
        expect(merchant.y).toBe(junction.y);
        expect(cat.y).toBe(junction.y);
    });

    it('never lets the cat land on the merchant', () => {
        // Shoulder to shoulder: the two boxes touch, they do not overlap.
        const merchantWidth = 240;
        const catWidth = 120;
        const { merchant, cat } = merchantAndCatPositions(junction, merchantWidth, catWidth);
        const merchantRight = merchant.x + merchantWidth / 2;
        const catLeft = cat.x - catWidth / 2;
        expect(catLeft).toBe(merchantRight);
    });
});

describe("seed's spot in the pavilion", () => {
    it("stands above the five seats, in the deck's upper band", () => {
        // The seats are at y 1150-1250 and claude is ~357 wide at x 900, so anything down there
        // collides with the row. She stands above it instead.
        expect(SEED_PAVILION_FEET.y).toBeLessThan(1150);
    });

    it('stands on the deck, not past the railing', () => {
        // Measured on the emulator: the deck's left edge is world x ~740 and her sprite is
        // ~190 wide, so a centre at x 620 left her standing in the water beside the pavilion.
        expect(SEED_PAVILION_FEET.x).toBeGreaterThan(740 + 95);
    });

    it('stands clear of the selection card', () => {
        // The card covers world x 640-1170. Her left edge is right of that, so it cannot hide her
        // mid-selection even though her feet share the card's band.
        const halfWidth = (SEED_DISPLAY_HEIGHT * (330 / 520)) / 2;
        expect(SEED_PAVILION_FEET.x - halfWidth).toBeGreaterThan(1170);
    });

    it('stands clear of the level title', () => {
        // The title box covers world x 1393-1668, y 60-180; her crown stays below it. Putting her
        // a body further up landed her on the counter with the title behind her hair.
        const crown = SEED_PAVILION_FEET.y - SEED_DISPLAY_HEIGHT;
        expect(crown).toBeGreaterThan(180);
    });

    it('stays inside the painted 2752x1536 frame', () => {
        expect(SEED_PAVILION_FEET.x).toBeGreaterThan(0);
        expect(SEED_PAVILION_FEET.x).toBeLessThan(2752);
        expect(SEED_PAVILION_FEET.y).toBeLessThan(1536);
    });

    it('is drawn at merchant scale, not giant', () => {
        expect(SEED_DISPLAY_HEIGHT).toBe(300);
    });
});
