/**
 * src/lib/inventory/inventory.ts
 * --------------------------------------------------------------------------
 * The backpack: 60 slots, 10 wide by 6 tall, the same item stacking to 30 per
 * slot.
 *
 * Pure functions over a plain array so the awkward cases are testable without a
 * scene or a store: a stack that fills mid-pickup, a bag that can only take part
 * of a drop, and a bag so full that a monster's barnacle has to stay on the
 * floor. The store owns the array; this module owns the arithmetic.
 *
 * Slots are positional (index = grid cell), which is what lets an empty slot sit
 * between two stacks visually. `addToInventory` therefore compacts nothing: it
 * reuses partial stacks of the same item, then appends.
 */

/** Grid: 10 wide x 6 tall, per the owner's spec. */
export const INVENTORY_COLUMNS = 10;
export const INVENTORY_ROWS = 6;
export const INVENTORY_SLOTS = INVENTORY_COLUMNS * INVENTORY_ROWS;

/** One stack tops out at 30 units. */
export const INVENTORY_STACK_MAX = 30;

export interface InventorySlot {
    /** Drop spec id, e.g. `barnacle`. */
    dropId: string;
    /** Units in this slot, 1..INVENTORY_STACK_MAX. */
    count: number;
}

export interface AddResult {
    /** The bag afterwards. Identical reference when nothing was accepted. */
    slots: InventorySlot[];
    /** How many units actually went in; 0 means the pickup must stay put. */
    added: number;
}

export function emptyInventory(): InventorySlot[] {
    return [];
}

/** Total units of `dropId`, summed across stacks. */
export function countOf(slots: readonly InventorySlot[], dropId: string): number {
    return slots.reduce((sum, slot) => (slot.dropId === dropId ? sum + slot.count : sum), 0);
}

/** Index of the first slot holding `dropId`, or -1. */
export function findSlot(slots: readonly InventorySlot[], dropId: string): number {
    return slots.findIndex((slot) => slot.dropId === dropId);
}

/**
 * Whether at least one unit of `dropId` would fit: either an existing stack is
 * below the cap, or there is a free slot to open a new stack in.
 */
export function isPickupPossible(slots: readonly InventorySlot[], dropId: string): boolean {
    if (slots.some((slot) => slot.dropId === dropId && slot.count < INVENTORY_STACK_MAX)) {
        return true;
    }
    return slots.length < INVENTORY_SLOTS;
}

/**
 * Put up to `count` units of `dropId` into the bag.
 *
 * Fills existing partial stacks first (oldest first), then opens new slots until
 * the bag is full. Never partially mutates the caller's array: a partial pickup
 * returns a new array holding only what fit.
 */
export function addToInventory(
    slots: readonly InventorySlot[],
    dropId: string,
    count: number,
): AddResult {
    if (!Number.isFinite(count) || count <= 0) return { slots: slots as InventorySlot[], added: 0 };

    const next = slots.map((slot) => ({ ...slot }));
    let remaining = Math.floor(count);
    let added = 0;

    // 1. top up existing stacks
    for (const slot of next) {
        if (remaining === 0) break;
        if (slot.dropId !== dropId) continue;
        const room = INVENTORY_STACK_MAX - slot.count;
        if (room <= 0) continue;
        const take = Math.min(room, remaining);
        slot.count += take;
        remaining -= take;
        added += take;
    }

    // 2. open new slots while there is space
    while (remaining > 0 && next.length < INVENTORY_SLOTS) {
        const take = Math.min(INVENTORY_STACK_MAX, remaining);
        next.push({ dropId, count: take });
        remaining -= take;
        added += take;
    }

    if (added === 0) return { slots: slots as InventorySlot[], added: 0 };
    return { slots: next, added };
}

/**
 * Take `count` units off the slot at `index`. Emptied slots disappear, which
 * shifts later slots left - the backpack UI reads positions from this array.
 */
export function removeFromInventory(
    slots: readonly InventorySlot[],
    index: number,
    count = 1,
): InventorySlot[] {
    if (index < 0 || index >= slots.length) return slots as InventorySlot[];
    const next = slots.map((slot) => ({ ...slot }));
    const slot = next[index];
    slot.count -= Math.max(1, Math.floor(count));
    if (slot.count <= 0) next.splice(index, 1);
    return next;
}