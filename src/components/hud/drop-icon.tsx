/**
 * src/components/hud/drop-icon.tsx
 * --------------------------------------------------------------------------
 * One drop's art, cropped out of its sprite sheet.
 *
 * The bag spent three rounds showing a colour chip and blaming the data. The art was
 * always there; the rendering was wrong twice over:
 *
 *   1. `background-position` percentages land differently in every engine, so the cell
 *      drifted off the element and drew nothing.
 *   2. The path carried a leading slash while every other texture in the game
 *      (`weapons/…`, `characters/…`) is relative. Whatever base the app is served from,
 *      those two spellings are not the same URL.
 *
 * So: a relative path, an oversized `<img>` inside a clipping box (plain arithmetic,
 * no percentage cropping), and the colour chip *underneath* as a floor - if the image
 * ever fails to load the cell still reads as that item instead of going blank.
 */

import React from 'react';

export interface DropIconSpec {
    /** Public path to the sheet, as written in the drop's YAML. */
    path: string;
    rows: number;
    cols: number;
    frame: number;
}

/** Displayed size of one cell, in px. */
export const DROP_ICON_CELL_PX = 26;

interface DropIconProps {
    icon?: DropIconSpec;
    /** Colour of the fallback chip, as written in the drop spec. */
    tint: number;
    label?: string;
}

export const DropIcon: React.FC<DropIconProps> = ({ icon, tint, label }) => {
    const chip = (
        <span
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundColor: `#${tint.toString(16).padStart(6, '0')}` }}
        />
    );

    if (!icon) {
        return (
            <span
                className="relative inline-block border border-black/60"
                style={{ width: DROP_ICON_CELL_PX, height: DROP_ICON_CELL_PX, opacity: 0.75 }}
                title={label}
            >
                {chip}
            </span>
        );
    }

    const chipColor = `#${tint.toString(16).padStart(6, '0')}`;
    const cols = Math.max(1, icon.cols);
    const rows = Math.max(1, icon.rows);
    const frame = Math.max(0, icon.frame);
    const col = frame % cols;
    const row = Math.floor(frame / cols);

    return (
        <span
            className="relative inline-block overflow-hidden"
            style={{ width: DROP_ICON_CELL_PX, height: DROP_ICON_CELL_PX }}
            title={label}
        >
            {/* Floor: the item's own colour, so a broken or slow path is a chip, not a
                hole. It used to be near-black, which is exactly what an empty cell looks
                like on this panel. */}
            <span aria-hidden className="absolute inset-0" style={{ backgroundColor: chipColor }} />
            <img
                src={icon.path}
                alt={label ?? ''}
                draggable={false}
                className="absolute max-w-none"
                style={{
                    width: `${cols * DROP_ICON_CELL_PX}px`,
                    height: `${rows * DROP_ICON_CELL_PX}px`,
                    left: `${-col * DROP_ICON_CELL_PX}px`,
                    top: `${-row * DROP_ICON_CELL_PX}px`,
                    imageRendering: 'pixelated',
                }}
            />
        </span>
    );
};