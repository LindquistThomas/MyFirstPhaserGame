/**
 * Shared geometry constants for floor-scene layout.
 *
 * Canonical source for mezzanine tier Y positions and catwalk thicknesses.
 * Import these in floor scenes instead of defining local magic numbers —
 * this keeps the jump-physics pitch (140 px between tiers) consistent and
 * makes global layout changes a single-file edit.
 *
 * Tier Y values apply to the Platform Team / Architecture floor pair.
 * Both rooms share the same tier pitch so jump physics carry across room
 * transitions on the same floor.
 *
 * Pitch: 140 px.  Ground (G) = GAME_HEIGHT − TILE_SIZE = 960 − 128 = 832.
 *   T1 = G − 140    = 692   (low mezzanine / WAF ledge)
 *   T2 = G − 280    = 552   (mid catwalks)
 *   T3 = G − 420    = 412   (upper station catwalks)
 *   T4 = G − 560    = 272   (top central island)
 */

/** Y of the first (lowest) mezzanine tier — 692 px from top. */
export const TIER_Y_T1 = 692;
/** Y of the second mezzanine tier — 552 px from top. */
export const TIER_Y_T2 = 552;
/** Y of the third mezzanine tier — 412 px from top. */
export const TIER_Y_T3 = 412;
/** Y of the fourth (top) mezzanine tier — 272 px from top. */
export const TIER_Y_T4 = 272;

/**
 * Standard catwalk body thickness in pixels. Matches the `buildCatwalks`
 * default so omitting `thickness` in a `LevelConfig.catwalks` entry
 * produces a slab of this depth.
 */
export const CATWALK_THICKNESS = 20;

/**
 * Thinner catwalk used on the Platform Team floor.
 * 16 px → 124 px clear headroom under a body (140 px pitch − 16 px slab),
 * which fits the 116 px player hitbox with a small safety margin.
 */
export const CATWALK_THICKNESS_PLATFORM = 16;
