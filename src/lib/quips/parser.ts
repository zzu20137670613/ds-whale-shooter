/**
 * src/lib/quips/parser.ts
 * --------------------------------------------------------------------------
 * `public/data/quips.yaml` 的解析器。
 *
 * 台词是**内容**，不是逻辑 —— 放在 YAML 里，主人自己能改字，不用碰代码。
 * 校验尽量松（只要求 id 唯一、text 非空），因为这是给人写的文件：
 * 一个写错的 id 不该让整局游戏起不来，但也别让两句重复的台词混进去。
 */

import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';

import type { Quip } from './pool';

const QuipSchema = z
    .object({
        id: z.string().min(1),
        /** 分类，只给人看；抽的时候一视同仁。 */
        group: z.string().min(1).default('meta'),
        text: z.string().min(1),
    })
    .strict();

const QuipsFileSchema = z
    .object({
        quips: z.array(QuipSchema),
    })
    .strict();

/** 解析一份台词表。id 重复直接报错 —— 那样"洗牌不重复"才有意义。 */
export function parseQuipsYaml(source: string): Quip[] {
    const parsed = QuipsFileSchema.parse(parseYaml(source));
    const seen = new Set<string>();
    for (const quip of parsed.quips) {
        if (seen.has(quip.id)) {
            throw new Error(`quips.yaml: duplicated id "${quip.id}"`);
        }
        seen.add(quip.id);
    }
    return parsed.quips;
}