/**
 * Tunable constants for Hamster Swing: Canopy Adventure.
 *
 * The simulation runs in a fixed "world" resolution and the renderer scales that
 * to whatever the canvas element happens to be, so every number here is in
 * world pixels / seconds and never needs to know about device pixel ratio.
 */

/**
 * Orientation switch — the "focus region" design
 * -----------------------------------------------------------------------
 * The vertical geometry (canopy, swing band, grass) never changes: VIEW_H,
 * CEILING_Y and GROUND_Y below are the same fixed numbers regardless of
 * device. What changes for a phone held upright is only the horizontal
 * *focus region* — how much world, left-to-right, the camera keeps in
 * view — because this is a side-scroller that needs some minimum
 * lookahead to plan a swing, and a phone's native portrait width would
 * leave none.
 *
 * Every constant below that is purely horizontal (never a radial/rope
 * quantity, never anything vertical) scales by the same HORIZONTAL_SCALE
 * factor as VIEW_W, so the *proportions* — how far you can see past the
 * hook's own reach, how densely lanterns and monsters are spaced — stay
 * identical to landscape. Only the physical distance shrinks to fit.
 * applyOrientation(), called from GameCanvas whenever the viewport's
 * orientation changes, is the one place that recomputes all of them.
 *
 * `let`, not `const`: every other module imports these by name, and ES
 * module bindings are live, so reassigning them here updates every reader
 * everywhere without threading a parameter through the whole render/engine
 * pipeline.
 *
 * On top of that pure geometric rescale, portrait also gets a deliberate
 * *mobile ease*: pace (SPEED_EASE) and monster density (DENSITY_EASE) drop
 * a further notch below what the geometry alone would give, because a
 * proportionally-identical difficulty still plays harder on a touchscreen
 * than a mouse/keyboard — less precise input, a thumb instead of a
 * pointer. Pure spatial layout (camera anchor, hook range, chunk width,
 * anchor gaps) stays exactly proportional; only speed and density get the
 * extra forgiveness.
 */
const LANDSCAPE_VIEW_W = 1280
const PORTRAIT_VIEW_W = 500
const PORTRAIT_SCALE = PORTRAIT_VIEW_W / LANDSCAPE_VIEW_W

/** Extra slowdown on top of the geometric scale, mobile only. */
const PORTRAIT_SPEED_EASE = 0.85
/** Extra cut to monster density, mobile only. */
const PORTRAIT_DENSITY_EASE = 0.7

const BASE_CAMERA_ANCHOR_X = 400
const BASE_HOOK_RANGE_AHEAD = 470
const BASE_HOOK_RANGE_BEHIND = 90
const BASE_CHUNK_WIDTH = 900
const BASE_PX_PER_METER = 40
const BASE_PLAYER_START_X = 220
const BASE_PLAYER_START_VX = 360
const BASE_RELEASE_BOOST_X = 68
const BASE_HURT_KNOCKBACK_VX = -150
const BASE_MONSTER_RAMP_METERS = 160

export let VIEW_W = LANDSCAPE_VIEW_W
/** World height in pixels — fixed in every orientation; see the note above. */
export const VIEW_H = 720

export let HORIZONTAL_SCALE = 1
/** Extra pace easing for mobile, on top of HORIZONTAL_SCALE — see the note above. */
export let SPEED_EASE = 1
/** Extra monster-density easing for mobile — see the note above. */
export let DENSITY_EASE = 1
/** Camera keeps the hamster this far from the left edge. */
export let CAMERA_ANCHOR_X = BASE_CAMERA_ANCHOR_X
/** How far ahead of the hamster we will look for a lantern to grab. */
export let HOOK_RANGE_AHEAD = BASE_HOOK_RANGE_AHEAD
export let HOOK_RANGE_BEHIND = BASE_HOOK_RANGE_BEHIND
/** Width of one procedurally generated slice of forest. */
export let CHUNK_WIDTH = BASE_CHUNK_WIDTH
/** World pixels per in-game metre, used for the distance readout + speedometer. */
export let PX_PER_METER = BASE_PX_PER_METER
export let PLAYER_START_X = BASE_PLAYER_START_X
export let PLAYER_START_VX = BASE_PLAYER_START_VX
/** Extra launch impulse applied on release. The vertical part is an instant
 *  "pop"; the horizontal part is spread over RELEASE_ASSIST_TIME instead of
 *  snapping instantly, so a release feels like a smooth accelerating launch
 *  rather than a sudden jump in speed. */
export let RELEASE_BOOST_X = BASE_RELEASE_BOOST_X
export let HURT_KNOCKBACK_VX = BASE_HURT_KNOCKBACK_VX
/** How many metres it takes a new tier's monster density to fully ease in.
 *  Stretched out for mobile alongside DENSITY_EASE, so the ramp itself is
 *  gentler too, not just its ceiling. */
export let MONSTER_RAMP_METERS = BASE_MONSTER_RAMP_METERS

/** Switch the world's horizontal focus region to suit the device's current
 *  orientation. Nothing vertical is touched — see the note above. */
export function applyOrientation(isPortrait: boolean) {
  HORIZONTAL_SCALE = isPortrait ? PORTRAIT_SCALE : 1
  SPEED_EASE = isPortrait ? PORTRAIT_SPEED_EASE : 1
  DENSITY_EASE = isPortrait ? PORTRAIT_DENSITY_EASE : 1
  VIEW_W = isPortrait ? PORTRAIT_VIEW_W : LANDSCAPE_VIEW_W
  CAMERA_ANCHOR_X = BASE_CAMERA_ANCHOR_X * HORIZONTAL_SCALE
  HOOK_RANGE_AHEAD = BASE_HOOK_RANGE_AHEAD * HORIZONTAL_SCALE
  HOOK_RANGE_BEHIND = BASE_HOOK_RANGE_BEHIND * HORIZONTAL_SCALE
  CHUNK_WIDTH = BASE_CHUNK_WIDTH * HORIZONTAL_SCALE
  PX_PER_METER = BASE_PX_PER_METER * HORIZONTAL_SCALE
  PLAYER_START_X = BASE_PLAYER_START_X * HORIZONTAL_SCALE
  PLAYER_START_VX = BASE_PLAYER_START_VX * HORIZONTAL_SCALE * SPEED_EASE
  RELEASE_BOOST_X = BASE_RELEASE_BOOST_X * HORIZONTAL_SCALE * SPEED_EASE
  HURT_KNOCKBACK_VX = BASE_HURT_KNOCKBACK_VX * HORIZONTAL_SCALE * SPEED_EASE
  MONSTER_RAMP_METERS = BASE_MONSTER_RAMP_METERS / DENSITY_EASE
}

/** Underside of the mossy canopy — every swing anchor lives near this line.
 *  Fixed in every orientation — see the note above. */
export const CEILING_Y = 96
/** Top of the grass. Touching it costs a heart. Fixed in every orientation. */
export const GROUND_Y = 622
/** A quarter of the way down from the canopy to the grass — used to place
 *  both the hamster's starting height and the apex of the ground-bounce
 *  recovery arc, so "high up near the canopy" means the same thing in both
 *  places. */
const QUARTER_DOWN_Y = CEILING_Y + (GROUND_Y - CEILING_Y) * 0.25

export const GRAVITY = 1560
/** Horizontal drag while flying, as a per-second multiplier. */
export const AIR_DRAG = 0.13
export const MAX_SPEED = 1500

export const PLAYER_RADIUS = 27
/** Starts high, a quarter of the way down from the canopy — plenty of room
 *  to fall into the first swing instead of starting low and cramped. */
export const PLAYER_START_Y = QUARTER_DOWN_Y

export const CAMERA_LERP = 7.5

// ---------------------------------------------------------------------------
// Hook / swing
// ---------------------------------------------------------------------------

export const HOOK_MAX_LENGTH = 520
export const HOOK_MIN_LENGTH = 90
/** Speed the rope tip travels while the hook is still flying to its anchor.
 *  Radial, like the rope's own length — not scaled by orientation. */
export const HOOK_TRAVEL_SPEED = 3400
/** Rope shortens slightly while held — that is what builds swing speed. */
export const ROPE_REEL_SPEED = 46
export const RELEASE_BOOST_Y = 150
/** How long the post-release horizontal thrust takes to fully apply. */
export const RELEASE_ASSIST_TIME = 0.4
/** Comfortable free-flight speed. Above this, extra drag kicks in so chaining
 *  many good swings builds speed noticeably but can't spiral out of control. */
export const COMFORT_SPEED = 780
export const OVER_COMFORT_DRAG = 0.4
/** Physics sub-steps per frame; keeps the rope constraint rock solid. */
export const PHYSICS_SUBSTEPS = 4

// ---------------------------------------------------------------------------
// Hearts / damage
// ---------------------------------------------------------------------------

export const MAX_HEARTS = 3
export const IFRAME_DURATION = 1.6
export const HURT_KNOCKBACK_VY = -260
/** Emergency spring cushion when the hamster hits the grass with hearts to
 *  spare. Deliberately dramatic — it pops all the way back up to
 *  QUARTER_DOWN_Y, the same height the hamster starts at, so there is a
 *  real, generous window to spot and hook a lantern again rather than just
 *  barely avoiding instant death. Derived from projectile motion (v² = 2gh)
 *  so it always reaches exactly that height regardless of tuning elsewhere. */
export const GROUND_BOUNCE_VY = -Math.sqrt(2 * GRAVITY * (GROUND_Y - PLAYER_RADIUS - QUARTER_DOWN_Y))
export const CRASH_SEQUENCE_DURATION = 2.0

// ---------------------------------------------------------------------------
// Stomping / scoring
// ---------------------------------------------------------------------------

/** A stomp only counts when the hamster is not rising faster than this. */
export const STOMP_VY_THRESHOLD = -40
export const STOMP_BOUNCE_VY = -420
/** Comfortably the biggest reward for a single action — stomping should be
 *  the thing players are visibly chasing, well above a seed (SEED_SCORE)
 *  or even a mushroom pickup (MUSHROOM_SCORE). */
export const STOMP_SCORE = 400
/** Slow-motion freeze on a stomp — short and snappy (0.14s read as too
 *  long/unnatural), but still tuned a notch heavier than getting hit so
 *  stomping stays the best-feeling impact in the game. */
export const HITSTOP_DURATION = 0.06
export const HITSTOP_SCALE = 0.08
export const SEED_SCORE = 100
export const HEART_FULL_BONUS = 500
export const MUSHROOM_SCORE = 300
export const DISTANCE_SCORE_PER_METER = 10

export const COMBO_WINDOW = 2.6
export const COMBO_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const
export const MAX_COMBO_MULTIPLIER = 4

export const MUSHROOM_DURATION = 6

// ---------------------------------------------------------------------------
// Collectible sizes
// ---------------------------------------------------------------------------

export const SEED_RADIUS = 13
export const HEART_RADIUS = 18
export const MUSHROOM_RADIUS = 21

// ---------------------------------------------------------------------------
// Difficulty tiers
// ---------------------------------------------------------------------------

export interface Tier {
  readonly id: number
  readonly name: string
  /** Distance in metres at which this tier begins. */
  readonly from: number
  readonly accent: string
  /** Horizontal gap between canopy lanterns. */
  readonly anchorGap: [number, number]
  /** Monsters per generated chunk, once this tier is fully "ramped in".
   *  Actual density eases up from the previous tier's value over
   *  MONSTER_RAMP_METERS rather than jumping the moment `from` is crossed. */
  readonly monsterDensity: number
  /** Ambient darkness of the canopy, 0..1. */
  readonly gloom: number
}

export const TIERS: readonly Tier[] = [
  {
    id: 0,
    name: 'Novice Runway',
    from: 0,
    accent: '#8fd96b',
    anchorGap: [190, 240],
    monsterDensity: 0,
    gloom: 0,
  },
  {
    id: 1,
    name: 'Forest Edge',
    from: 110,
    accent: '#ffd166',
    anchorGap: [220, 305],
    monsterDensity: 0.5,
    gloom: 0.16,
  },
  {
    id: 2,
    name: 'Dark Canopy',
    from: 280,
    accent: '#a78bfa',
    anchorGap: [255, 360],
    monsterDensity: 1,
    gloom: 0.42,
  },
  {
    id: 3,
    name: 'Extreme Rush',
    from: 550,
    accent: '#ff7b7b',
    anchorGap: [290, 430],
    monsterDensity: 1.6,
    gloom: 0.6,
  },
]

export function tierForDistance(meters: number): Tier {
  let tier = TIERS[0]
  for (const t of TIERS) if (meters >= t.from) tier = t
  return tier
}

/** Keep this many chunks of world built ahead of the camera. */
export const CHUNKS_AHEAD = 4

export const HIGH_SCORE_KEY = 'hamster-swing:high-score'
export const MUTE_KEY = 'hamster-swing:muted'
