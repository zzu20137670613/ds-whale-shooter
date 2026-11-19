/**
 * src/lib/physics/safe-remove.ts
 * --------------------------------------------------------------------------
 * Taking a body out of a Matter world that may already be gone.
 *
 * Entering the cabin from the pavilion black-screened with
 *
 *   TypeError: Cannot read properties of null (reading 'remove')
 *     at Monster.destroy (monster.ts:363)
 *     at MonsterController.destroy
 *     at LoadScene.shutdown
 *
 * Scene shutdown destroys the Matter world before the monsters get their turn, so
 * `scene.matter.world.remove(body)` threw, the shutdown aborted halfway, and the next
 * scene never finished coming up - a black screen.
 *
 * Teardown must never throw. This is the one place that decides that.
 */

interface RemovableWorld {
    // Matter's `World.remove(body)` is typed against its own Body; a teardown helper must
    // accept the engine's real signature as well as hand-rolled fakes.
    remove?: (body: never) => unknown;
}

/**
 * Remove `body` from `world` when both are still around.
 *
 * Returns whether a removal actually happened, which is only useful to tests - callers
 * on a teardown path should ignore it.
 */
export function safeRemoveBody(world: RemovableWorld | null | undefined, body: unknown): boolean {
    if (!world || typeof world.remove !== 'function' || !body) return false;
    try {
        (world.remove as (b: unknown) => unknown)(body);
        return true;
    } catch {
        // A world mid-teardown can still refuse the call; there is nothing left to do
        // about a body that is about to be garbage anyway.
        return false;
    }
}