/**
 * tests/components/hud/save-slot-plate.test.ts
 * --------------------------------------------------------------------------
 * 存档格里那块「地图名小牌子」。
 *
 * 主人 2026-11-16：存档的截图缩略图缩成小格子后「很小显示效果很差」，改用地图名那块小牌子。
 * 这块牌子是现渲染的 —— 存档里本来就有 `levelTitle` 与 `elapsedMs`，不再需要图片。
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SaveSlotPlate } from '@/components/hud/save-slot-plate';

const draw = (title: string, elapsedMs: number) =>
    renderToStaticMarkup(React.createElement(SaveSlotPlate, { title, elapsedMs }));

describe('SaveSlotPlate', () => {
    it('shows the map name and the clock, exactly like the HUD plate', () => {
        const html = draw('海边亭台', (63 * 60 + 59) * 1000);
        expect(html).toContain('海边亭台');
        expect(html).toContain('63:59');
        expect(html).toContain('data-testid="save-slot-plate"');
    });

    it('keeps the amber pixel title and the white clock', () => {
        const html = draw('开发者小屋', 64 * 60 * 1000 + 36_000);
        expect(html).toContain('text-amber-500');
        expect(html).toContain('64:36');
    });

    it('never renders an image - that is the whole point', () => {
        const html = draw('初遇之地', 1_000);
        expect(html).not.toContain('<img');
        expect(html).not.toContain('data:image');
    });

    it('truncates a long map name instead of pushing the plate wider', () => {
        const html = draw('Claude与deepseek的初遇之地', 0);
        expect(html).toContain('truncate');
    });
});