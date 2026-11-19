/**
 * tests/build/legacy-css.test.ts
 * --------------------------------------------------------------------------
 * The mobile bundle's stylesheet has to apply on Chromium 91.
 *
 * `@layer` needs Chrome 99, so the whole utilities layer is dropped there - which is exactly
 * what made the first mobile build look broken. This unwraps the layers; it cannot fix
 * `color-mix()`, and the tests say so rather than pretending otherwise.
 */

import { describe, expect, it } from 'vitest';

import { flattenLayers } from '../../vite/plugins/legacy-css.mjs';

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('unwrapping cascade layers', () => {
    it('deletes the ordering statement', () => {
        const css = '@layer theme, base, components, utilities;body{color:red}';
        expect(flattenLayers(css)).toBe('body{color:red}');
    });

    it('keeps the rules inside a layer block', () => {
        const css = '@layer utilities{.size-5{width:1.25rem;height:1.25rem}}';
        expect(flattenLayers(css)).toBe('.size-5{width:1.25rem;height:1.25rem}');
    });

    it('keeps the cascade order of the layers it flattens', () => {
        const css = [
            '@layer base{a{color:red}}',
            '@layer components{.b{x:1}}',
            '@layer utilities{.c{y:2}}',
        ].join('');
        const flat = flattenLayers(css);
        expect(flat).toBe('a{color:red}.b{x:1}.c{y:2}');
        expect(flat.indexOf('a{color:red}')).toBeLessThan(flat.indexOf('.b{x:1}'));
        expect(flat.indexOf('.b{x:1}')).toBeLessThan(flat.indexOf('.c{y:2}'));
    });

    it('leaves nested braces alone, so the block does not end early', () => {
        const css = '@layer utilities{.a{&:hover{color:red}}}body{margin:0}';
        const flat = flattenLayers(css);
        expect(flat).toBe('.a{&:hover{color:red}}body{margin:0}');
        expect(count(flat, '{')).toBe(count(flat, '}'));
    });

    it('handles a layer nested inside a media query', () => {
        const css = '@media (min-width:600px){@layer utilities{.a{x:1}}}';
        const flat = flattenLayers(css);
        expect(flat).toBe('@media (min-width:600px){.a{x:1}}');
        expect(count(flat, '{')).toBe(count(flat, '}'));
    });

    it('closes a layer after its last rule, not after its first', () => {
        // The bug that made the flattened sheet unusable: an "inside a layer" boolean made the
        // first rule's `}` look like the layer's, so every later rule came out one level deep.
        const css = '@layer utilities{.a{x:1}.b{y:2}.c{z:3}}';
        const flat = flattenLayers(css);
        expect(flat).toBe('.a{x:1}.b{y:2}.c{z:3}');
        expect(count(flat, '{')).toBe(count(flat, '}'));
    });

    it('handles a layer whose rules have nested blocks', () => {
        const css = '@layer components{.a{x:1}@media (min-width:1px){.b{y:2}}}';
        const flat = flattenLayers(css);
        expect(flat).toBe('.a{x:1}@media (min-width:1px){.b{y:2}}');
        expect(count(flat, '{')).toBe(count(flat, '}'));
    });

    it('ignores a brace inside a string, so the block does not end early', () => {
        // The bug this shipped with: `content: "}"` inside a layer closed the layer early and
        // everything after it ended up inside an anonymous block. Edge recovered, WebView 91
        // dropped every utility that followed.
        const css = '@layer utilities{.a:after{content:"}"}}.b{x:1}';
        const flat = flattenLayers(css);
        expect(flat).toBe('.a:after{content:"}"}.b{x:1}');
        // (.b survives outside the layer - that is the point; the literal `}` lives in a string.)
        expect(flat).not.toContain('@layer');
    });

    it('ignores a brace inside a comment', () => {
        const css = '@layer utilities{/* } */ .a{x:1}}';
        expect(flattenLayers(css)).toBe('/* } */ .a{x:1}');
    });

    it('leaves braces that were never inside a layer alone', () => {
        const css = 'body{margin:0}@layer utilities{.a{x:1}}p{padding:0}';
        expect(flattenLayers(css)).toBe('body{margin:0}.a{x:1}p{padding:0}');
    });

    it('is a no-op on a stylesheet without layers', () => {
        const css = 'body{margin:0}.a{color:red}';
        expect(flattenLayers(css)).toBe(css);
    });

    it('does not touch colour functions it cannot resolve', () => {
        // Honest limit: `color-mix()` still needs Chrome 111. Layout survives; a few
        // translucent backgrounds fall back to transparent on an old WebView.
        const css = '@layer utilities{.a{background:color-mix(in oklab,var(--c) 35%,transparent)}}';
        expect(flattenLayers(css)).toContain('color-mix');
    });

    it('survives Tailwind-shaped output, where a comment sits right before a layer', () => {
        const css = '/*! tailwindcss v4 */@layer theme{a{--x:1}}@layer utilities{.size-5{width:1.25rem}}';
        const flat = flattenLayers(css);
        expect(flat).toContain('.size-5{width:1.25rem}');
        expect(flat).not.toContain('@layer');
    });
});

describe('running it twice', () => {
    it('is stable, so a second pass cannot shift the file again', () => {
        const css = '@layer base{a{x:1}}@layer utilities{.size-5{width:1.25rem}}';
        const once = flattenLayers(css);
        expect(flattenLayers(once)).toBe(once);
    });
});
