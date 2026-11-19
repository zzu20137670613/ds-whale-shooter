import { describe, expect, it } from 'vitest';

import { fitZoom, imageRenderingForZoom } from '@/lib/canvas-fit';

describe('lib/canvas-fit — fitZoom', () => {
    it('picks the smaller ratio so 100% of the game map is visible inside the container', () => {
        expect(fitZoom(844, 390, 1536, 864)).toBeCloseTo(390 / 864, 5);
        expect(fitZoom(900, 600, 1536, 864)).toBeCloseTo(900 / 1536, 5);
    });

    it('is 1 for an exact match', () => {
        expect(fitZoom(1536, 864, 1536, 864)).toBe(1);
    });

    it('falls back to 1 on a zero-sized box (pre-layout)', () => {
        expect(fitZoom(0, 0, 1536, 864)).toBe(1);
    });

    it('shrinks a full-size level into a typical window — the real-world case', () => {
        // The canvas renders 1:1 with the level art (2752x1536), so a
        // 1920x1080 window lands just under 0.70: a FRACTIONAL downscale,
        // which is why the filter chosen below matters so much.
        expect(fitZoom(1920, 1080, 2752, 1536)).toBeCloseTo(0.6977, 3);
    });
});

describe('lib/canvas-fit — imageRenderingForZoom', () => {
    it('keeps hard pixels when magnifying', () => {
        expect(imageRenderingForZoom(1)).toBe('pixelated');
        expect(imageRenderingForZoom(1.5)).toBe('pixelated');
        expect(imageRenderingForZoom(2)).toBe('pixelated');
    });

    it('treats an exact 1:1 as magnify, so the pixel grid stays hard', () => {
        expect(imageRenderingForZoom(1)).toBe('pixelated');
    });

    it('filters smoothly when shrinking, so no source rows are dropped', () => {
        expect(imageRenderingForZoom(0.99)).toBe('auto');
        expect(imageRenderingForZoom(0.6977)).toBe('auto');
        expect(imageRenderingForZoom(0.25)).toBe('auto');
    });

    it('falls back to smooth filtering for a degenerate zoom', () => {
        expect(imageRenderingForZoom(0)).toBe('auto');
        expect(imageRenderingForZoom(Number.NaN)).toBe('auto');
    });
});
