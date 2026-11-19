/**
 * src/lib/quips/loader.ts
 * --------------------------------------------------------------------------
 * 读一遍 `public/data/quips.yaml`，进程内缓存。
 *
 * 台词表很小（几十行），整局只需要读一次 —— 所以缓存 promise，别每次抽都去 fetch。
 * 走 `handle-fetch`（规则见 CLAUDE.md 第 7 条）：浏览器里就是普通 fetch，
 * Node 里它会翻译成 file:// 路径，测试与脚本不用另写一套。
 */

import { fetch } from '@/lib/handle-fetch';

import { parseQuipsYaml } from './parser';
import type { Quip } from './pool';

const QUIPS_URL = '/data/quips.yaml';

let cached: Promise<Quip[]> | null = null;

/** 取全部台词（首次读取后缓存）。 */
export function fetchQuips(): Promise<Quip[]> {
    if (!cached) {
        cached = fetch(QUIPS_URL)
            .then((res) => res.text())
            .then((text) => parseQuipsYaml(text))
            .catch((error) => {
                // 读不到就当没有台词：一句话不该让整局起不来。
                console.warn('[quips] failed to load', error);
                cached = null;
                return [] as Quip[];
            });
    }
    return cached;
}