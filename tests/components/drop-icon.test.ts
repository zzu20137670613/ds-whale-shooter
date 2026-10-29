/**
 * tests/components/drop-icon.test.ts
 * --------------------------------------------------------------------------
 * The crop maths and the relative path.
 *
 * Rendered to a string, so there is no DOM, no store and no Phaser in the way - this is
 * exactly the piece that kept failing while the pipeline tests stayed green.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DROP_ICON_CELL_PX, DropIcon } from '@/components/hud/drop-icon';

const sheet = { path: 'assets/image/drops/drops.png', rows: 4, cols: 4, frame: 4 };

describe('DropIcon', () => {
    it('crops frame 4 as row 1, column 0 of a 4x4 sheet', () => {
        const html = renderToStaticMarkup(React.createElement(DropIcon, { icon: sheet, tint: 0xff3355 }));
        expect(html).toContain('src="assets/image/drops/drops.png"');
        expect(html).toContain(`width:${4 * DROP_ICON_CELL_PX}px`);
        expect(html).toContain(`height:${4 * DROP_ICON_CELL_PX}px`);
        expect(html).toContain('left:0px');
        expect(html).toContain(`top:${-1 * DROP_ICON_CELL_PX}px`);
    });

    it('keeps the path relative - a leading slash is a different URL under a base path', () => {
        const html = renderToStaticMarkup(React.createElement(DropIcon, { icon: sheet, tint: 0 }));
        expect(html).not.toContain('src="/assets/');
    });

    it('falls back to the colour chip when the drop has no art', () => {
        const html = renderToStaticMarkup(React.createElement(DropIcon, { tint: 0x23c9d0 }));
        expect(html).not.toContain('<img');
        expect(html).toContain('#23c9d0');
    });

    it('handles a single-cell sheet without dividing by zero', () => {
        const html = renderToStaticMarkup(
            React.createElement(DropIcon, { icon: { ...sheet, rows: 1, cols: 1, frame: 0 }, tint: 0 }),
        );
        expect(html).toContain(`width:${DROP_ICON_CELL_PX}px`);
        expect(html).toContain('left:0px');
        expect(html).toContain('top:0px');
    });
});