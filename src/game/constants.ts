/**
 * Tunable constants for Hamster Swing: Canopy Adventure.
 *
 * The simulation runs in a fixed "world" resolution and the renderer scales that
 * to whatever the canvas element happens to be, so every number here is in
 * world pixels / seconds and never needs to know about device pixel ratio.
 */

export const VIEW_W = 1280
export const VIEW_H = 720

/** Underside of the mossy canopy — every swing anchor lives near this line. */
export const CEILING_Y = 96
/** Top of the grass. Touching it costs a heart. */
export const GROUND_Y = 622
/** A quarter of the way down from the canopy to the grass — used to place
 *  both the hamster's starting height and the apex of the ground-bounce
 *  recovery arc, so "high up near the canopy" means the same thing in both
 *  places. */
const QUARTER_DOWN_Y = CEILING_Y + (GROUND_Y - CEILING_Y) * 0.25

/** World pixels per in-game metre, used for the distance readout + speedometer. */
export const PX_PER_METER = 40

export const GRAVITY = 1560
/** Horizontal drag while flying, as a per-second multiplier. */
export const AIR_DRAG = 0.13
export const MAX_SPEED = 1500

export const PLAYER_RADIUS = 27
export const PLAYER_START_X = 220
/** Starts high, a quarter of the way down from the canopy — plenty of room
 *  to fall into the first swing instead of starting low and cramped. */
export const PLAYER_START_Y = QUARTER_DOWN_Y
export const PLAYER_START_VX = 360

/** Camera keeps the hamster this far from the left edge. */
export const CAMERA_ANCHOR_X = 400
export const CAMERA_LERP = 7.5

// ---------------------------------------------------------------------------
// Hook / swing
// ---------------------------------------------------------------------------

/** How far ahead of the hamster we will look for a lantern to grab. */
export const HOOK_RANGE_AHEAD = 470
export const HOOK_RANGE_BEHIND = 90
export const HOOK_MAX_LENGTH = 520
export const HOOK_MIN_LENGTH = 90
/** Speed the rope tip travels while the hook is still flying to its anchor. */
export const HOOK_TRAVEL_SPEED = 3400
/** Rope shortens slightly while held — that is what builds swing speed. */
export const ROPE_REEL_SPEED = 46
/** Extra launch impulse applied on release. The vertical part is an instant
 *  "pop"; the horizontal part is spread over RELEASE_ASSIST_TIME instead of
 *  snapping instantly, so a release feels like a smooth accelerating launch
 *  rather than a sudden jump in speed. */
export const RELEASE_BOOST_X = 68
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
export const HURT_KNOCKBACK_VX = -150
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
export const STOMP_SCORE = 250
/** Brief slow-motion freeze on impact (stomp/smash) for a punchier feel. */
export const HITSTOP_DURATION = 0.055
export const HITSTOP_SCALE = 0.1
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

/** How many metres it takes a new tier's monster density to fully ease in. */
export const MONSTER_RAMP_METERS = 110

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
    from: 40,
    accent: '#ffd166',
    anchorGap: [220, 305],
    monsterDensity: 1.1,
    gloom: 0.16,
  },
  {
    id: 2,
    name: 'Dark Canopy',
    from: 150,
    accent: '#a78bfa',
    anchorGap: [255, 360],
    monsterDensity: 2.1,
    gloom: 0.42,
  },
  {
    id: 3,
    name: 'Extreme Rush',
    from: 350,
    accent: '#ff7b7b',
    anchorGap: [290, 430],
    monsterDensity: 3.1,
    gloom: 0.6,
  },
]

export function tierForDistance(meters: number): Tier {
  let tier = TIERS[0]
  for (const t of TIERS) if (meters >= t.from) tier = t
  return tier
}

/** Width of one procedurally generated slice of forest. */
export const CHUNK_WIDTH = 900
/** Keep this many chunks of world built ahead of the camera. */
export const CHUNKS_AHEAD = 4

export const HIGH_SCORE_KEY = 'hamster-swing:high-score'
export const MUTE_KEY = 'hamster-swing:muted'
