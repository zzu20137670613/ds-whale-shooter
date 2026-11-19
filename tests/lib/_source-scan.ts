/**
 * tests/lib/_source-scan.ts
 * 遍历 `src/` 下的源码文件，给"扫全仓"这类测试用（不许用 glob 依赖，手写走一遍）。
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** `src/` 下所有 .ts / .tsx 的绝对路径。 */
export function listSourceFiles(dir: string = SRC): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listSourceFiles(full));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            out.push(full);
        }
    }
    return out;
}