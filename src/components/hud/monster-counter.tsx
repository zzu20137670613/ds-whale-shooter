/**
 * src/components/hud/monster-counter.tsx
 * --------------------------------------------------------------------------
 * 剩余怪物数：X - one line under the combo counter.
 *
 * The owner: `在右上角连击数的下方位置添加一行：剩余怪物数：X  X跟随地图上剩余怪物数实时变化`.
 *
 * Bare amber text on the scene, with no chip behind it: the owner read the 80%-black chip as a
 * black bar hanging under the line (`下方为啥有个黑条，这行字不是直接底版全透明的吗`). The drop
 * shadow is what keeps it legible over a bright floor, so that stays.
 */

import { useEffect, useState } from 'react';

import { MONSTER_COUNTER_TOP_PX, RIGHT_EDGE_PX } from '@/lib/hud/mobile-layout';
import { isMobileLike } from '@/lib/mobile';
import { EventBus } from '@/lib/events/bus';
import { MONSTERS_REMAINING_EVENT } from '@/lib/monsters/remaining';
import type { MonstersRemainingPayload } from '@/lib/monsters/remaining';
import { t } from '@/locales';

export function MonsterCounter() {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        const onRemaining = (payload?: MonstersRemainingPayload) => {
            if (!payload || typeof payload.count !== 'number') return;
            setCount(payload.count);
        };
        EventBus.on(MONSTERS_REMAINING_EVENT, onRemaining);
        return () => {
            EventBus.off(MONSTERS_REMAINING_EVENT, onRemaining);
        };
    }, []);

    // Nothing has reported yet: this is a level without a controller, or the tavern.
    if (count === null) return null;

    // 手机端：紧贴武器格下沿（右上角一列的顺序是 武器 → 剩余怪物数 → 连击数）。
    const mobile = isMobileLike();

    return (
        <div
            data-monster-counter
            className="pointer-events-none absolute top-[10.5rem] right-6 z-20 select-none px-2 py-0.5 font-mono text-[13px] tracking-wide text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
            style={
                mobile
                    ? { top: MONSTER_COUNTER_TOP_PX, right: RIGHT_EDGE_PX + 8, bottom: 'auto' }
                    : undefined
            }
        >
            {t('hud.remainingMonsters')}
            {count}
        </div>
    );
}
