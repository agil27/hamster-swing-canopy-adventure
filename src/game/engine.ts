import { audio } from './audio'
import {
  AIR_DRAG,
  CAMERA_ANCHOR_X,
  CAMERA_LERP,
  CEILING_Y,
  COMBO_STEPS,
  COMBO_WINDOW,
  COMFORT_SPEED,
  CRASH_SEQUENCE_DURATION,
  DISTANCE_SCORE_PER_METER,
  GRAVITY,
  GROUND_BOUNCE_VY,
  GROUND_Y,
  HEART_FULL_BONUS,
  HEART_RADIUS,
  HIGH_SCORE_KEY,
  HITSTOP_DURATION,
  HITSTOP_SCALE,
  HORIZONTAL_SCALE,
  HOOK_MAX_LENGTH,
  HOOK_MIN_LENGTH,
  HOOK_RANGE_AHEAD,
  HOOK_RANGE_BEHIND,
  HOOK_TRAVEL_SPEED,
  HURT_KNOCKBACK_VX,
  HURT_KNOCKBACK_VY,
  IFRAME_DURATION,
  MAX_HEARTS,
  MAX_SPEED,
  MUSHROOM_DURATION,
  MUSHROOM_RADIUS,
  MUSHROOM_SCORE,
  OVER_COMFORT_DRAG,
  PHYSICS_SUBSTEPS,
  PLAYER_RADIUS,
  PLAYER_START_VX,
  PLAYER_START_X,
  PLAYER_START_Y,
  PX_PER_METER,
  RELEASE_ASSIST_TIME,
  RELEASE_BOOST_X,
  RELEASE_BOOST_Y,
  ROPE_REEL_SPEED,
  SEED_RADIUS,
  SEED_SCORE,
  STOMP_BOUNCE_VY,
  STOMP_SCORE,
  STOMP_VY_THRESHOLD,
  VIEW_W,
  tierForDistance,
} from './constants'
import { ParticleSystem } from './particles'
import { clamp, damp, lerp } from './rng'
import {
  TUTORIAL_CELEBRATE_DURATION,
  TUTORIAL_DONE_DURATION,
  TUTORIAL_HINT_DURATION,
  TUTORIAL_INSTRUCTIONS,
  TUTORIAL_MISS_MARGIN_METERS,
  TUTORIAL_PHASES,
  TUTORIAL_PLACE_AHEAD_METERS,
  TUTORIAL_RELOCATE_METERS,
  TUTORIAL_RETRY_INSTRUCTIONS,
  TUTORIAL_SEED,
  TUTORIAL_SWING_REPS,
} from './tutorial'
import type { Anchor, GamePhase, HeartPickup, HudState, Monster, Mushroom } from './types'
import { World } from './world'

export interface Player {
  x: number
  y: number
  vx: number
  vy: number
  /** Ball spin, radians. */
  rot: number
  /** Squash amount, -1 (stretched along motion) .. 1 (squashed). */
  squash: number
  /** Direction the squash is aligned to. */
  squashAngle: number
  /** Cosmetic: ear twitch / blink timers. */
  blink: number
  earTwitch: number
  /** Cartoon tumble spin used by the crash sequence. */
  tumble: number
  facing: 1 | -1
  /** Remaining time on the post-release horizontal thrust, seconds. */
  assistTime: number
  /** Acceleration applied per second while assistTime > 0. */
  assistAccelX: number
}

type HookState = 'idle' | 'flying' | 'attached'

export interface Hook {
  state: HookState
  anchor: Anchor | null
  /** Rope tip while the hook is still in flight. */
  tipX: number
  tipY: number
  /** Resting rope length while attached. */
  restLen: number
  /** Actual measured length, used to draw elastic stretch. */
  length: number
  /** 0..1 grow-in used for the rope draw. */
  travel: number
}

const SPEED_RATINGS: Array<[number, string]> = [
  [22, 'Gentle Glide'],
  [42, 'Breezy'],
  [66, 'Swift'],
  [92, 'Blazing'],
  [124, 'Supersonic'],
]

function ratingFor(kmh: number) {
  for (const [limit, label] of SPEED_RATINGS) if (kmh < limit) return label
  return 'LEGENDARY!'
}

/** Sunday-strip callouts for a stomp — [word, colour], picked at random. */
const STOMP_WORDS: Array<[string, string]> = [
  ['POW!', '#ffd166'],
  ['BAM!', '#ff8f3f'],
  ['BONK!', '#ff6b9d'],
  ['SPLAT!', '#8bf59a'],
  ['WHAP!', '#5ec8ff'],
]

function readHighScore() {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeHighScore(v: number) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(v))
  } catch {
    /* storage can be unavailable in private windows — the run still counts */
  }
}

/**
 * The whole simulation. React only ever reads the HUD snapshot this publishes;
 * everything else lives here and in the renderer.
 */
export class GameEngine {
  readonly world = new World()
  readonly particles = new ParticleSystem()

  phase: GamePhase = 'menu'

  player: Player = {
    x: PLAYER_START_X,
    y: PLAYER_START_Y,
    vx: PLAYER_START_VX,
    vy: 0,
    rot: 0,
    squash: 0,
    squashAngle: 0,
    blink: 2,
    earTwitch: 1,
    tumble: 0,
    facing: 1,
    assistTime: 0,
    assistAccelX: 0,
  }

  hook: Hook = { state: 'idle', anchor: null, tipX: 0, tipY: 0, restLen: 0, length: 0, travel: 0 }

  // Run state ---------------------------------------------------------------
  score = 0
  distance = 0
  private scoredMeters = 0
  hearts = MAX_HEARTS
  combo = 1
  comboCount = 0
  comboTimer = 0
  bestCombo = 1
  seedsCollected = 0
  monstersStomped = 0
  invincibleTime = 0
  iframeTime = 0
  crashTimer = 0
  /** Brief slow-motion freeze on a stomp/smash/hit/fall impact. */
  hitStopTimer = 0
  /** How slow that freeze runs — set per-trigger by triggerHitStop(). */
  hitStopScale = HITSTOP_SCALE
  highScore = readHighScore()
  isNewHighScore = false

  // Presentation ------------------------------------------------------------
  camX = 0
  camY = 0
  shake = 0
  time = 0
  /** Slow-motion factor used for the crash beat. */
  timeScale = 1
  /** Screen flash colour + strength, drawn as a full-screen wash. */
  flash = 0
  flashColor = '#ffffff'
  private rainbowIndex = 0
  private ambientTimer = 0

  private pressed = false
  private hudTimer = 0
  onHud: ((s: HudState) => void) | null = null

  /** Set while a modal owns the screen; the world freezes but still renders. */
  paused = false

  // Tutorial ------------------------------------------------------------
  // Runs inside the normal 'playing' phase rather than a separate one, so
  // all the ordinary physics/render/HUD code just works unmodified; the
  // tutorial layer only watches state and nudges it. Four phases —
  // TUTORIAL_PHASES — each ending in success, never a forced rewind: a
  // failure revives the player in place (undoing its cost) and, if a fixed
  // target got missed, hops the target forward into reach instead.
  tutorialActive = false
  tutorialPhaseIndex = 0
  /** Counts down the closing "you're ready" note before handing off. */
  private tutorialStepTimer = 0
  private tutorialSwingReps = 0
  /** True for exactly one frame after a release, so a hook staying
   *  attached across many frames can't be counted as several reps. */
  private tutorialWasAttached = false
  /** Hearts value a mid-phase "hit" gets quietly restored to — the cost is
   *  undone rather than the player being sent back anywhere. */
  private tutorialSafeHearts = MAX_HEARTS
  /** The guaranteed teaching objects — each placed lazily, right as its own
   *  phase begins, so nothing shows up before it's actually relevant. */
  private tutorialMonster: Monster | null = null
  private tutorialMushroom: Mushroom | null = null
  private tutorialHeart: HeartPickup | null = null
  /** Current handwritten note, or '' when nothing is showing. Gameplay is
   *  never frozen for it — it just sits for a while and fades (see
   *  TUTORIAL_HINT_DURATION / TUTORIAL_HINT_FADE) and only comes back if
   *  the player fails the thing it was teaching. */
  tutorialHintText = ''
  /** Counts down the current note's remaining hold time; the render layer
   *  fades it out over the last TUTORIAL_HINT_FADE seconds of this. */
  tutorialHintTimer = 0
  /** Queued note + duration that takes over automatically the instant the
   *  current one's hold time elapses — chains a "Nice!" into the next
   *  phase's instruction without freezing anything in between. */
  private tutorialHintNextText = ''
  private tutorialHintNextDuration = 0

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  start(seed?: number) {
    this.world.reset(seed)
    this.particles.clear()
    this.tutorialActive = false
    this.tutorialHintText = ''
    this.tutorialHintTimer = 0
    this.tutorialHintNextText = ''
    this.tutorialMonster = null
    this.tutorialMushroom = null
    this.tutorialHeart = null

    this.player = {
      x: PLAYER_START_X,
      y: PLAYER_START_Y,
      vx: PLAYER_START_VX,
      vy: -60,
      rot: 0,
      squash: 0,
      squashAngle: 0,
      blink: 2,
      earTwitch: 1,
      tumble: 0,
      facing: 1,
      assistTime: 0,
      assistAccelX: 0,
    }
    this.hook = { state: 'idle', anchor: null, tipX: 0, tipY: 0, restLen: 0, length: 0, travel: 0 }

    this.score = 0
    this.distance = 0
    this.scoredMeters = 0
    this.hearts = MAX_HEARTS
    this.combo = 1
    this.comboCount = 0
    this.comboTimer = 0
    this.bestCombo = 1
    this.seedsCollected = 0
    this.monstersStomped = 0
    this.invincibleTime = 0
    this.iframeTime = 0
    this.crashTimer = 0
    this.hitStopTimer = 0
    this.hitStopScale = HITSTOP_SCALE
    this.isNewHighScore = false
    this.shake = 0
    this.flash = 0
    this.timeScale = 1
    this.pressed = false

    this.camX = this.player.x - CAMERA_ANCHOR_X
    this.camY = 0
    this.phase = 'playing'

    audio.setIntensity(1)
    audio.startMusic()
    this.publishHud(true)
  }

  toMenu() {
    this.phase = 'menu'
    this.publishHud(true)
  }

  /** Same run setup as start(), plus a fixed layout and a four-phase guided
   *  script — see TUTORIAL_PHASES and updateTutorial(). Nothing is placed
   *  upfront: each phase's teaching object appears only once that phase
   *  actually begins, so nothing shows up before it's relevant. */
  startTutorial() {
    this.start(TUTORIAL_SEED)
    this.tutorialActive = true
    this.tutorialPhaseIndex = 0
    this.tutorialStepTimer = 0
    this.tutorialSwingReps = 0
    this.tutorialWasAttached = false
    this.tutorialSafeHearts = this.hearts
    this.tutorialMonster = null
    this.tutorialMushroom = null
    this.tutorialHeart = null
    this.showTutorialHint(TUTORIAL_INSTRUCTIONS.swing)
    this.publishHud(true)
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  pressDown() {
    if (this.phase !== 'playing') return
    this.pressed = true
    this.castHook()
  }

  pressUp() {
    if (!this.pressed) return
    this.pressed = false
    this.releaseHook()
  }

  /** The lantern castHook() would grab right now, if any — shared with the
   *  tutorial's "point the arrow at it" logic so both always agree. */
  private findBestAnchor(): Anchor | null {
    const p = this.player
    const candidates = this.world.anchorsNear(p.x, HOOK_RANGE_AHEAD + 200)

    let best: Anchor | null = null
    let bestCost = Infinity
    for (const a of candidates) {
      if (a.x < p.x - HOOK_RANGE_BEHIND || a.x > p.x + HOOK_RANGE_AHEAD) continue
      // The rope has to pull upward to swing at all.
      if (a.y > p.y - 60) continue
      const dx = a.x - p.x
      const dy = a.y - p.y
      const d = Math.hypot(dx, dy)
      if (d > HOOK_MAX_LENGTH || d < 40) continue
      // Prefer a lantern a comfortable way ahead, then prefer a shorter rope.
      const cost = Math.abs(dx - 190) * 1 + d * 0.32
      if (cost < bestCost) {
        bestCost = cost
        best = a
      }
    }
    return best
  }

  /** Pick the most useful lantern ahead and fire the rope at it. */
  private castHook() {
    if (this.hook.state !== 'idle') return
    const p = this.player
    const best = this.findBestAnchor()

    if (!best) {
      // Nothing in reach — a little puff of effort so the input still reads.
      this.particles.dustPuff(p.x + 18, p.y - 20, 4, 'rgba(255,255,255,0.5)', 90)
      return
    }

    this.hook.state = 'flying'
    this.hook.anchor = best
    this.hook.tipX = p.x
    this.hook.tipY = p.y
    this.hook.travel = 0
    audio.hookShoot()
  }

  private releaseHook() {
    const h = this.hook
    if (h.state === 'idle') return
    const p = this.player

    if (h.state === 'attached') {
      const speed = Math.hypot(p.vx, p.vy)
      const boost = 0.55 + clamp(speed / 1100, 0, 0.85)
      // The vertical launch pop is instant — that snap is what makes a
      // release feel deliberate. The horizontal boost instead spreads out
      // over RELEASE_ASSIST_TIME as a smooth acceleration, so chaining
      // swings ramps up speed gradually rather than jumping in one tick.
      p.assistAccelX = (RELEASE_BOOST_X * boost) / RELEASE_ASSIST_TIME
      p.assistTime = RELEASE_ASSIST_TIME
      p.vy -= RELEASE_BOOST_Y * boost
      if (p.vx < 120) p.vx = 120

      this.particles.ring(p.x, p.y, 'rgba(255,240,190,0.85)', 26, 3.2, 0.4)
      this.particles.sparkleBurst(p.x, p.y, 8, '#ffe9a8', 210, 8)
      if (h.anchor) h.anchor.flash = 1
      audio.hookRelease(clamp(speed / 900, 0, 1))
    }

    if (h.anchor) h.anchor.active = false
    h.state = 'idle'
    h.anchor = null
    h.travel = 0
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------

  update(rawDt: number) {
    if (this.paused) return
    // Clamp so an alt-tab pause can never tunnel the player through the world.
    const realDt = Math.min(rawDt, 1 / 30)

    if (this.hitStopTimer > 0) this.hitStopTimer = Math.max(0, this.hitStopTimer - realDt)
    // Impact moments (stomps, hits, falls) freeze motion almost to a stop for
    // a beat — a classic "impact frame" that sells the hit without slowing
    // the whole game. Intensity varies per trigger — see triggerHitStop().
    const effectiveScale = this.hitStopTimer > 0 ? this.hitStopScale : this.timeScale
    const dt = realDt * effectiveScale
    this.time += dt

    if (this.phase === 'menu') {
      this.updateMenu(dt)
      return
    }

    // Safety net: the guided phases revive on any heart loss before the run
    // could ever actually end (see updateTutorial), but if some edge case
    // slips through, land here rather than actually ending the tutorial run.
    if (this.tutorialActive && this.phase === 'crashing') {
      this.phase = 'playing'
      this.tutorialRevive()
    }

    if (this.phase === 'crashing') {
      // Motion runs in slow-mo, but the sequence still lasts its stated 2s.
      this.updateCrash(dt, realDt)
      return
    }

    if (this.phase !== 'playing') {
      this.particles.update(dt)
      return
    }

    const p = this.player

    // --- timers -------------------------------------------------------------
    if (this.iframeTime > 0) this.iframeTime = Math.max(0, this.iframeTime - dt)
    if (this.invincibleTime > 0) {
      this.invincibleTime = Math.max(0, this.invincibleTime - dt)
      if (this.invincibleTime === 0) audio.setIntensity(1)
    }
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt)
      if (this.comboTimer === 0) this.resetCombo()
    }

    this.updateHook(dt)
    this.integrate(dt)
    this.world.update(this.camX)
    this.updateMonsters(dt)
    this.handleCollisions()
    this.updateCosmetics(dt)

    // --- distance & scoring -------------------------------------------------
    const meters = Math.max(0, (p.x - PLAYER_START_X) / PX_PER_METER)
    if (meters > this.distance) this.distance = meters
    const wholeMeters = Math.floor(this.distance)
    if (wholeMeters > this.scoredMeters) {
      this.score += (wholeMeters - this.scoredMeters) * DISTANCE_SCORE_PER_METER
      this.scoredMeters = wholeMeters
    }

    this.updateCamera(dt)
    this.particles.update(dt)
    if (this.tutorialActive) this.updateTutorial(dt)

    this.hudTimer += dt
    if (this.hudTimer > 0.06) this.publishHud()
  }

  private updateMenu(dt: number) {
    // Idle attract state: the world drifts gently behind the title card.
    this.camX += 26 * dt
    this.world.update(this.camX)
    this.ambientTimer -= dt
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.18
      this.particles.petal(
        this.camX + Math.random() * VIEW_W,
        CEILING_Y + Math.random() * 120,
        Math.random() < 0.5 ? 'rgba(255,214,235,0.75)' : 'rgba(255,245,200,0.7)',
      )
    }
    this.particles.update(dt)
    this.shake = damp(this.shake, 0, 8, dt)
  }

  private updateCrash(dt: number, realDt: number) {
    const p = this.player
    this.crashTimer -= realDt
    p.vy += GRAVITY * 0.85 * dt
    p.vx *= Math.exp(-1.4 * dt)
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.tumble += 13 * dt
    p.rot += 9 * dt

    if (p.y + PLAYER_RADIUS > GROUND_Y) {
      p.y = GROUND_Y - PLAYER_RADIUS
      if (p.vy > 90) {
        p.vy = -p.vy * 0.46
        this.particles.dustPuff(p.x, GROUND_Y, 10, 'rgba(255,248,225,0.85)', 200)
        this.particles.impactStars(p.x, p.y - 10, 4, '#ffd166')
        this.shake = Math.max(this.shake, 9)
      } else {
        p.vy = 0
      }
    }

    // Keep a trickle of dizzy stars circling the hamster.
    if (Math.random() < 0.3) {
      this.particles.sparkleBurst(p.x + (Math.random() - 0.5) * 40, p.y - 40, 1, '#ffe9a8', 60, 7)
    }

    this.timeScale = damp(this.timeScale, 0.72, 2.2, dt)
    this.updateCamera(dt)
    this.particles.update(dt)
    this.shake = damp(this.shake, 0, 6, dt)
    this.flash = damp(this.flash, 0, 5, dt)

    if (this.crashTimer <= 0) this.finishRun()
  }

  private finishRun() {
    this.phase = 'gameover'
    this.timeScale = 1
    audio.stopMusic()
    if (this.score > this.highScore) {
      this.highScore = this.score
      this.isNewHighScore = true
      writeHighScore(this.score)
      audio.highScoreFanfare()
    } else {
      audio.gameOver()
    }
    this.publishHud(true)
  }

  // -------------------------------------------------------------------------
  // Hook & motion
  // -------------------------------------------------------------------------

  private updateHook(dt: number) {
    const h = this.hook
    const p = this.player
    if (h.state === 'flying' && h.anchor) {
      const dx = h.anchor.x - h.tipX
      const dy = h.anchor.y - h.tipY
      const d = Math.hypot(dx, dy)
      const step = HOOK_TRAVEL_SPEED * dt
      if (d <= step) {
        // Attached — freeze the rope at whatever length we grabbed it.
        h.tipX = h.anchor.x
        h.tipY = h.anchor.y
        h.state = 'attached'
        h.anchor.active = true
        h.anchor.flash = 1
        const len = Math.hypot(p.x - h.anchor.x, p.y - h.anchor.y)
        h.restLen = clamp(len, HOOK_MIN_LENGTH, HOOK_MAX_LENGTH)
        h.length = h.restLen
        this.particles.sparkleBurst(h.anchor.x, h.anchor.y + 12, 7, '#ffe9a8', 160, 7)
        this.particles.ring(h.anchor.x, h.anchor.y + 10, 'rgba(255,225,150,0.8)', 14, 2.6, 0.35)
        audio.hookAttach()
      } else {
        h.tipX += (dx / d) * step
        h.tipY += (dy / d) * step
      }
    }

    if (h.state === 'attached' && h.anchor) {
      // Reeling in is what actually converts a swing into speed.
      h.restLen = Math.max(HOOK_MIN_LENGTH, h.restLen - ROPE_REEL_SPEED * dt)
      h.tipX = h.anchor.x
      h.tipY = h.anchor.y
    }
  }

  private integrate(dt: number) {
    const p = this.player
    const h = this.hook
    const sub = dt / PHYSICS_SUBSTEPS

    for (let i = 0; i < PHYSICS_SUBSTEPS; i++) {
      p.vy += GRAVITY * sub

      if (h.state === 'attached' && h.anchor) {
        // A gentle tangential push keeps a well-timed swing from stalling.
        const dx = p.x - h.anchor.x
        const dy = p.y - h.anchor.y
        const d = Math.hypot(dx, dy) || 1
        const tx = -dy / d
        const ty = dx / d
        const along = p.vx * tx + p.vy * ty
        const dir = along >= 0 ? 1 : -1
        const speed = Math.hypot(p.vx, p.vy)
        if (speed < MAX_SPEED * 0.75) {
          p.vx += tx * dir * 210 * sub
          p.vy += ty * dir * 210 * sub
        }
      } else {
        // Smooth post-release thrust: eases in the horizontal launch boost
        // over time instead of snapping it on all at once.
        if (p.assistTime > 0) {
          p.vx += p.assistAccelX * sub
          p.assistTime = Math.max(0, p.assistTime - sub)
        }

        // Air drag in free flight, with a soft ceiling above COMFORT_SPEED
        // so a long chain of good swings builds real speed but can't spiral
        // past a controllable, playable pace.
        const overComfort = Math.hypot(p.vx, p.vy) > COMFORT_SPEED
        const dragRate = AIR_DRAG + (overComfort ? OVER_COMFORT_DRAG : 0)
        p.vx *= Math.exp(-dragRate * sub)
      }

      p.x += p.vx * sub
      p.y += p.vy * sub

      if (h.state === 'attached' && h.anchor) {
        this.applyRopeConstraint()
      }
    }

    const speed = Math.hypot(p.vx, p.vy)
    if (speed > MAX_SPEED) {
      const k = MAX_SPEED / speed
      p.vx *= k
      p.vy *= k
    }

    p.facing = p.vx >= 0 ? 1 : -1

    // Ball rolls at the rate it travels.
    p.rot += (p.vx / PLAYER_RADIUS) * dt * 0.82

    this.handleBounds()
  }

  /** Rigid-with-give rope: correct position, then kill outward velocity. */
  private applyRopeConstraint() {
    const p = this.player
    const h = this.hook
    if (!h.anchor) return
    const dx = p.x - h.anchor.x
    const dy = p.y - h.anchor.y
    const d = Math.hypot(dx, dy) || 1
    h.length = d
    if (d <= h.restLen) return

    const nx = dx / d
    const ny = dy / d
    // 0.92 rather than 1.0 leaves a touch of elastic give in the rope.
    const correction = (d - h.restLen) * 0.92
    p.x -= nx * correction
    p.y -= ny * correction

    const radial = p.vx * nx + p.vy * ny
    if (radial > 0) {
      p.vx -= nx * radial * 0.96
      p.vy -= ny * radial * 0.96
    }
  }

  private handleBounds() {
    const p = this.player

    // Canopy: soft bonk, no damage.
    if (p.y - PLAYER_RADIUS < CEILING_Y + 6) {
      p.y = CEILING_Y + 6 + PLAYER_RADIUS
      if (p.vy < 0) {
        p.vy *= -0.32
        this.squashFrom(Math.PI / 2, 0.3)
        this.particles.dustPuff(p.x, p.y - PLAYER_RADIUS, 5, 'rgba(210,255,200,0.7)', 120)
      }
    }

    // Grass: the emergency trampoline.
    if (p.y + PLAYER_RADIUS > GROUND_Y) {
      p.y = GROUND_Y - PLAYER_RADIUS
      if (this.iframeTime > 0) {
        // Already invulnerable from a very recent hit — the bounce arc is
        // short enough that we can land again before the i-frames run out.
        // Cushion it quietly instead of stacking another heart loss on top:
        // that repeat-hit loop is what made a single mistake feel like three.
        if (p.vy > 0) p.vy = GROUND_BOUNCE_VY * 0.55
      } else if (p.vy > 30) {
        this.hitGround()
      } else if (p.vy > 0) {
        p.vy = 0
      }
    }
  }

  private hitGround() {
    const p = this.player

    if (this.invincibleTime > 0) {
      // Magic mushroom just bounces you back up, free of charge.
      p.vy = GROUND_BOUNCE_VY
      this.particles.dustPuff(p.x, GROUND_Y, 12, 'rgba(200,255,190,0.9)', 240)
      this.particles.ring(p.x, GROUND_Y - 8, 'rgba(160,255,150,0.85)', 24, 3.4, 0.4)
      this.squashFrom(Math.PI / 2, 0.55)
      this.shake = Math.max(this.shake, 8)
      // Light touch — this bounce is a reward, not a penalty.
      this.triggerHitStop(0.05, 0.25)
      audio.groundBounce()
      return
    }

    if (this.hearts > 1) {
      this.hearts -= 1
      this.iframeTime = IFRAME_DURATION
      p.vy = GROUND_BOUNCE_VY
      this.resetCombo()
      this.squashFrom(Math.PI / 2, 0.62)
      this.particles.dustPuff(p.x, GROUND_Y, 16, 'rgba(255,250,230,0.9)', 280)
      this.particles.ring(p.x, GROUND_Y - 8, 'rgba(255,214,102,0.9)', 26, 3.6, 0.45)
      this.particles.impactStars(p.x, GROUND_Y - 30, 5, '#ffd166')
      this.particles.popup(p.x, GROUND_Y - 90, 'SPRING SAVE!', '#ffd166', true, 28)
      this.shake = Math.max(this.shake, 14)
      this.flash = 0.35
      this.flashColor = '#ffd166'
      this.triggerHitStop(0.1, 0.18)
      audio.groundBounce()
      audio.hurt()
      this.publishHud(true)
      return
    }

    // Last heart — this is the run.
    this.hearts = 0
    this.beginCrash()
  }

  private beginCrash() {
    const p = this.player
    this.phase = 'crashing'
    this.crashTimer = CRASH_SEQUENCE_DURATION
    this.releaseHook()
    p.vy = -520
    p.vx = Math.max(60, p.vx * 0.42)
    this.resetCombo()
    this.shake = 22
    this.flash = 0.7
    this.flashColor = '#ff8b6b'
    // A sharp, dramatic freeze right at the instant the run ends, before
    // easing into the longer tumble slow-motion updateCrash() ramps up.
    this.triggerHitStop(0.16, 0.06)
    this.particles.impactStars(p.x, p.y, 14, '#ff9f68')
    this.particles.dustPuff(p.x, p.y, 18, 'rgba(255,240,215,0.9)', 320)
    this.particles.popup(p.x, p.y - 80, 'OUCH!', '#ff8b6b', true, 40)
    audio.stopMusic()
    audio.crash()
    this.publishHud(true)
  }

  // -------------------------------------------------------------------------
  // Monsters
  // -------------------------------------------------------------------------

  private updateMonsters(dt: number) {
    const x0 = this.camX - 300
    const x1 = this.camX + VIEW_W + 400
    for (const chunk of this.world.visibleChunks(x0, x1)) {
      for (const m of chunk.monsters) {
        if (m.dead) {
          m.deadTime += dt
          if (m.spin !== 0) {
            // Knockout spin — tumbles away off screen.
            m.spin += 14 * dt
            m.vy += GRAVITY * 0.5 * dt
            m.x += m.vx * dt
            m.y += m.vy * dt
          } else {
            // Stomped: squashes flat under the impact, then actually falls —
            // real accelerating gravity, no floor, no easing to a fixed
            // point — so it visibly plummets and drops away out of view
            // (Doodle Jump-style) instead of fading out while still on
            // screen. Gentle enough that the fall itself stays visible for
            // a beat rather than snapping out of view immediately.
            m.vy += GRAVITY * 0.8 * dt
            m.y += m.vy * dt
            m.squash = Math.min(1, m.squash + dt * 9)
          }
          continue
        }

        m.phase += dt
        switch (m.kind) {
          case 'slime': {
            // Hops along the grass on a lazy patrol.
            m.vy += GRAVITY * 0.55 * dt
            m.y += m.vy * dt
            if (m.y >= m.homeY) {
              m.y = m.homeY
              m.vy = -330
              m.squash = 0.5
            }
            m.squash = Math.max(0, m.squash - dt * 2.2)
            m.x += m.vx * m.dir * dt
            const slimeRange = 95 * HORIZONTAL_SCALE
            if (Math.abs(m.x - m.homeX) > slimeRange) {
              m.dir = m.x > m.homeX ? -1 : 1
              m.x = m.homeX + Math.sign(m.x - m.homeX) * slimeRange
            }
            break
          }
          case 'bat': {
            // Sinusoidal air patrol.
            m.x += m.vx * dt
            const batRange = 165 * HORIZONTAL_SCALE
            if (Math.abs(m.x - m.homeX) > batRange) {
              m.vx = -m.vx
              m.dir = m.vx >= 0 ? 1 : -1
              m.x = m.homeX + Math.sign(m.x - m.homeX) * batRange
            }
            m.y = m.homeY + Math.sin(m.phase * 2.1 + m.homeX * 0.01) * 56
            break
          }
          case 'hedgehog': {
            m.x += m.vx * m.dir * dt
            const hedgehogRange = 150 * HORIZONTAL_SCALE
            if (Math.abs(m.x - m.homeX) > hedgehogRange) {
              m.dir = m.x > m.homeX ? -1 : 1
              m.x = m.homeX + Math.sign(m.x - m.homeX) * hedgehogRange
            }
            m.y = m.homeY - Math.abs(Math.sin(m.phase * 8)) * 5
            break
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Collisions & rewards
  // -------------------------------------------------------------------------

  private handleCollisions() {
    const p = this.player
    const x0 = this.camX - 200
    const x1 = this.camX + VIEW_W + 300

    for (const chunk of this.world.visibleChunks(x0, x1)) {
      // --- seeds ------------------------------------------------------------
      for (const s of chunk.seeds) {
        if (s.taken) continue
        if (Math.abs(s.x - p.x) > 90 || Math.abs(s.y - p.y) > 90) continue
        if (Math.hypot(s.x - p.x, s.y - p.y) < PLAYER_RADIUS + SEED_RADIUS) {
          s.taken = true
          this.seedsCollected++
          this.bumpCombo()
          const gained = Math.round(SEED_SCORE * this.combo)
          this.score += gained
          this.particles.sparkleBurst(s.x, s.y, 9, '#ffe27a', 220, 8)
          this.particles.ring(s.x, s.y, 'rgba(255,226,122,0.75)', 12, 2.8, 0.3)
          this.particles.popup(s.x, s.y - 26, `+${gained}`, '#ffe27a', true, 26)
          audio.seed(this.comboCount)
          this.checkArcClear(s.arcId, s.x, s.y)
        }
      }

      // --- hearts -----------------------------------------------------------
      for (const hp of chunk.hearts) {
        if (hp.taken) continue
        if (Math.abs(hp.x - p.x) > 110 || Math.abs(hp.y - p.y) > 110) continue
        if (Math.hypot(hp.x - p.x, hp.y - p.y) < PLAYER_RADIUS + HEART_RADIUS) {
          hp.taken = true
          if (this.hearts < MAX_HEARTS) {
            this.hearts++
            this.particles.popup(hp.x, hp.y - 30, '+1 HEART', '#ff8fa8', true, 30)
          } else {
            this.score += HEART_FULL_BONUS
            this.particles.popup(hp.x, hp.y - 30, `+${HEART_FULL_BONUS}`, '#ff8fa8', true, 30)
          }
          this.particles.heartSparkle(hp.x, hp.y, 16)
          this.particles.ring(hp.x, hp.y, 'rgba(255,143,168,0.8)', 18, 3, 0.45)
          this.flash = 0.22
          this.flashColor = '#ff9fb6'
          audio.heart()
          this.publishHud(true)
        }
      }

      // --- mushrooms --------------------------------------------------------
      for (const mu of chunk.mushrooms) {
        if (mu.taken) continue
        if (Math.abs(mu.x - p.x) > 120 || Math.abs(mu.y - p.y) > 120) continue
        if (Math.hypot(mu.x - p.x, mu.y - p.y) < PLAYER_RADIUS + MUSHROOM_RADIUS) {
          mu.taken = true
          this.invincibleTime = MUSHROOM_DURATION
          this.score += MUSHROOM_SCORE
          this.particles.sparkleBurst(mu.x, mu.y, 20, '#8bf59a', 300, 11)
          this.particles.ring(mu.x, mu.y, 'rgba(139,245,154,0.9)', 22, 5, 0.6)
          this.particles.popup(mu.x, mu.y - 34, 'INVINCIBLE!', '#8bf59a', true, 34)
          this.flash = 0.4
          this.flashColor = '#a7f7b3'
          this.shake = Math.max(this.shake, 8)
          audio.mushroom()
          audio.setIntensity(1.7)
          this.publishHud(true)
        }
      }

      // --- monsters ---------------------------------------------------------
      for (const m of chunk.monsters) {
        if (m.dead) continue
        const dx = m.x - p.x
        const dy = m.y - p.y
        if (Math.abs(dx) > 120 || Math.abs(dy) > 120) continue
        if (Math.hypot(dx, dy) > PLAYER_RADIUS + m.radius) continue

        if (this.invincibleTime > 0) {
          this.smashMonster(m)
        } else if (p.vy >= STOMP_VY_THRESHOLD && p.y < m.y - m.radius * 0.25) {
          this.stompMonster(m)
        } else if (this.iframeTime <= 0) {
          this.takeDamage(m)
        }
      }
    }
  }

  /** Reward for sweeping an entire parabolic seed arc. */
  private checkArcClear(id: number, x: number, y: number) {
    for (const chunk of this.world.visibleChunks(this.camX - 1200, this.camX + VIEW_W + 1200)) {
      for (const s of chunk.seeds) {
        if (s.arcId === id && !s.taken) return
      }
    }
    const bonus = Math.round(200 * this.combo)
    this.score += bonus
    this.particles.popup(x, y - 60, `PERFECT ARC +${bonus}`, '#ffd166', true, 28)
    this.particles.sparkleBurst(x, y, 14, '#ffd166', 260, 10)
    audio.comboUp(this.comboCount)
  }

  private stompMonster(m: Monster) {
    const p = this.player
    m.dead = true
    m.deadTime = 0
    m.squash = 0.4 // already visibly compressed the instant the weight lands
    m.spin = 0
    m.vx = 0
    m.vy = 90 // a little starting pop so the fall reads immediately, not a slow drift
    this.monstersStomped++
    this.bumpCombo()

    const gained = Math.round(STOMP_SCORE * this.combo)
    this.score += gained

    // The hamster pops up hard while the monster is pressed straight down
    // and vanishes beneath it — opposite motions read much more clearly
    // than either alone.
    p.vy = STOMP_BOUNCE_VY
    this.squashFrom(Math.PI / 2, 0.68)
    // The longest, heaviest hitstop of any impact — the game's signature beat.
    this.triggerHitStop(HITSTOP_DURATION, HITSTOP_SCALE)

    this.particles.impactStars(m.x, m.y - 10, 13, '#ffd166')
    this.particles.dustPuff(m.x, m.y + 8, 14, 'rgba(255,250,235,0.9)', 280)
    this.particles.ring(m.x, m.y, 'rgba(255,255,255,0.85)', 24, 3.6, 0.4)
    const [word, wordColor] = STOMP_WORDS[Math.floor(Math.random() * STOMP_WORDS.length)]
    this.particles.comicPop(m.x, m.y - 78, word, wordColor)
    this.particles.popup(m.x, m.y - 34, `+${gained}`, '#ffd166', true, 26)
    this.shake = Math.max(this.shake, 16)
    audio.stomp()
    this.publishHud(true)
  }

  private smashMonster(m: Monster) {
    m.dead = true
    m.deadTime = 0
    // Non-zero spin selects the knockout-tumble defeat animation.
    m.spin = 0.001
    m.vx = (m.x > this.player.x ? 1 : -1) * (260 + Math.random() * 180)
    m.vy = -380 - Math.random() * 160
    this.monstersStomped++
    this.bumpCombo()

    const gained = Math.round(STOMP_SCORE * this.combo)
    this.score += gained
    this.particles.impactStars(m.x, m.y, 10, '#8bf59a')
    this.particles.sparkleBurst(m.x, m.y, 10, '#c9ffd4', 260, 9)
    this.particles.popup(m.x, m.y - 44, `SMASH +${gained}`, '#8bf59a', true, 28)
    this.shake = Math.max(this.shake, 9)
    this.triggerHitStop(0.05, 0.12)
    audio.smash()
  }

  private takeDamage(m: Monster) {
    const p = this.player
    this.hearts -= 1
    this.resetCombo()

    // The monster that hit you is removed immediately — otherwise the same
    // monster can end up "stomped" moments later during the knockback arc,
    // which reads as a confusing double interaction with the thing that
    // just hurt you. No score for it: this is a consequence, not a win.
    m.dead = true
    m.deadTime = 0
    m.spin = 0.001
    m.vx = (m.x > p.x ? 1 : -1) * (200 + Math.random() * 140)
    m.vy = -300 - Math.random() * 120

    if (this.hearts <= 0) {
      this.hearts = 0
      this.beginCrash()
      return
    }

    this.iframeTime = IFRAME_DURATION
    p.vy = HURT_KNOCKBACK_VY
    p.vx = Math.max(90, p.vx * 0.45) + (p.x < m.x ? HURT_KNOCKBACK_VX : -HURT_KNOCKBACK_VX) * 0.4
    this.releaseHook()
    this.squashFrom(Math.atan2(p.y - m.y, p.x - m.x), 0.5)
    // Real, but a notch shorter and lighter than a stomp's — landing a
    // stomp is the moment the game most wants to feel heavy.
    this.triggerHitStop(0.05, 0.13)

    this.particles.impactStars(p.x, p.y, 7, '#ff9f68')
    this.particles.popup(p.x, p.y - 60, '-1', '#ff8b8b', true, 32)
    this.shake = Math.max(this.shake, 16)
    this.flash = 0.45
    this.flashColor = '#ff7a6b'
    audio.hurt()
    this.publishHud(true)
  }

  // -------------------------------------------------------------------------
  // Tutorial
  // -------------------------------------------------------------------------

  /** Shows a handwritten note for `duration` seconds, then lets it fade.
   *  When `nextText` is given, that note takes over automatically — for
   *  its own `nextDuration` — the instant this one's hold time elapses, so
   *  a "Nice!" acknowledgement can chain straight into the next phase's
   *  instruction without ever freezing gameplay in between. */
  private showTutorialHint(
    text: string,
    duration = TUTORIAL_HINT_DURATION,
    nextText = '',
    nextDuration = TUTORIAL_HINT_DURATION,
  ) {
    this.tutorialHintText = text
    this.tutorialHintTimer = duration
    this.tutorialHintNextText = nextText
    this.tutorialHintNextDuration = nextDuration
  }

  /** Checked every frame while tutorialActive. Gameplay is never frozen:
   *  every guided phase ends in success, never a forced rewind — a heart
   *  lost (a hit, or a hard fall triggering the normal ground-save) is
   *  quietly undone in place, a soft landing with nothing to hook gets a
   *  gentle nudge back into the air, and a missed fixed target hops
   *  forward into reach — the player is never sent backward to retry
   *  anything. Each of those failure paths also brings the instruction
   *  note back if it had already faded. */
  private updateTutorial(dt: number) {
    const p = this.player
    const phase = TUTORIAL_PHASES[this.tutorialPhaseIndex]

    if (this.tutorialHintTimer > 0) {
      this.tutorialHintTimer = Math.max(0, this.tutorialHintTimer - dt)
      if (this.tutorialHintTimer === 0) {
        if (this.tutorialHintNextText) {
          this.tutorialHintText = this.tutorialHintNextText
          this.tutorialHintTimer = this.tutorialHintNextDuration
          this.tutorialHintNextText = ''
        } else {
          this.tutorialHintText = ''
        }
      }
    }

    if (phase === 'done') {
      this.tutorialStepTimer -= dt
      if (this.tutorialStepTimer <= 0) this.finishTutorial()
      return
    }

    if (this.hearts < this.tutorialSafeHearts) {
      this.tutorialRevive()
      return
    }
    if (this.hook.state === 'idle' && p.y + PLAYER_RADIUS >= GROUND_Y - 2) {
      this.tutorialGroundBounce()
    }

    switch (phase) {
      case 'swing': {
        if (this.hook.state === 'attached') {
          this.tutorialWasAttached = true
        } else if (this.hook.state === 'idle' && this.tutorialWasAttached) {
          this.tutorialWasAttached = false
          if (p.vx > PLAYER_START_VX * 0.5) {
            this.tutorialSwingReps++
            this.particles.popup(p.x, p.y - 50, `${this.tutorialSwingReps}/${TUTORIAL_SWING_REPS}`, '#ffd166', true, 24)
            if (this.tutorialSwingReps >= TUTORIAL_SWING_REPS) this.advanceTutorialPhase(1, 'Great swinging!')
          }
        }
        break
      }
      case 'stomp': {
        const m = this.tutorialMonster
        if (m?.dead) {
          this.advanceTutorialPhase(2, 'Nice STOMP!')
        } else if (m && (p.x - m.x) / PX_PER_METER > TUTORIAL_MISS_MARGIN_METERS) {
          this.relocateTutorialTarget('monster')
        }
        break
      }
      case 'mushroom': {
        const mu = this.tutorialMushroom
        if (mu?.taken) {
          this.advanceTutorialPhase(3, 'Invincible!')
        } else if (mu && (p.x - mu.x) / PX_PER_METER > TUTORIAL_MISS_MARGIN_METERS) {
          this.relocateTutorialTarget('mushroom')
        }
        break
      }
      case 'heart': {
        const h = this.tutorialHeart
        if (h?.taken) {
          this.advanceTutorialPhase(4)
        } else if (h && (p.x - h.x) / PX_PER_METER > TUTORIAL_MISS_MARGIN_METERS) {
          this.relocateTutorialTarget('heart')
        }
        break
      }
    }
  }

  /** Moves the tutorial to its next phase, right away — gameplay keeps
   *  running the whole time. When a celebrateText is given, that "Nice!"
   *  note shows first (TUTORIAL_CELEBRATE_DURATION) and then automatically
   *  chains into the new phase's instruction, which then sits and fades on
   *  its own like any other note (see showTutorialHint()). The new phase's
   *  teaching object is placed only now, at the player's current position,
   *  so nothing exists before this exact moment. */
  private advanceTutorialPhase(next: number, celebrateText?: string) {
    this.tutorialPhaseIndex = next
    // New baseline for the "hearts dropped" check above — each phase only
    // ever undoes damage taken *during* itself.
    this.tutorialSafeHearts = this.hearts
    const phase = TUTORIAL_PHASES[next]

    const aheadX = this.player.x + TUTORIAL_PLACE_AHEAD_METERS * PX_PER_METER
    if (phase === 'stomp') this.tutorialMonster = this.world.placeMonsterAt(aheadX, 'slime')
    else if (phase === 'mushroom') this.tutorialMushroom = this.world.placeMushroomAt(aheadX)
    else if (phase === 'heart') this.tutorialHeart = this.world.placeHeartAt(aheadX)

    if (phase === 'done') {
      this.tutorialStepTimer = TUTORIAL_DONE_DURATION
      this.showTutorialHint(TUTORIAL_INSTRUCTIONS.done, TUTORIAL_DONE_DURATION)
    } else if (celebrateText) {
      this.showTutorialHint(celebrateText, TUTORIAL_CELEBRATE_DURATION, TUTORIAL_INSTRUCTIONS[phase])
    } else {
      this.showTutorialHint(TUTORIAL_INSTRUCTIONS[phase])
    }
    audio.comboUp(0)
    this.publishHud(true)
  }

  /** Quietly undoes whatever just cost a heart and lets the player keep
   *  going from exactly where they are — the "unlimited attempts, never
   *  sent back" behaviour for getting hit or hitting the ground hard. */
  private tutorialRevive() {
    const p = this.player
    this.hearts = this.tutorialSafeHearts
    this.iframeTime = 0.6
    this.resetCombo()
    this.releaseHook()
    if (p.vy > -100) p.vy = -260 // pop back into the air if they were falling/settled

    const m = this.tutorialMonster
    if (m?.dead) {
      m.dead = false
      m.deadTime = 0
      m.squash = 0
      m.spin = 0
      m.x = m.homeX
      m.y = m.homeY
      m.vy = 0
    }

    this.flash = 0.25
    this.flashColor = '#ffb347'
    this.shake = Math.max(this.shake, 6)
    this.particles.popup(p.x, p.y - 60, 'Try again!', '#ffb347', true, 26)
    audio.uiClick()

    // Bring the note back — it had likely already faded by the time this
    // phase's own mistake happened.
    const retryText = TUTORIAL_RETRY_INSTRUCTIONS[TUTORIAL_PHASES[this.tutorialPhaseIndex]]
    if (retryText) this.showTutorialHint(retryText)

    this.publishHud(true)
  }

  /** A soft landing with nothing left to hook onto would otherwise strand
   *  the player — a small bounce keeps practice flowing without a heart
   *  cost or any of the drama of a real ground save. */
  private tutorialGroundBounce() {
    const p = this.player
    p.vy = GROUND_BOUNCE_VY * 0.55
    this.iframeTime = Math.max(this.iframeTime, 0.4)
    this.particles.dustPuff(p.x, GROUND_Y, 10, 'rgba(255,250,230,0.85)', 220)
    this.shake = Math.max(this.shake, 8)
    audio.groundBounce()

    // Falling with nothing hooked during the swing phase is exactly the
    // thing that note is teaching — bring it back if it had faded.
    if (TUTORIAL_PHASES[this.tutorialPhaseIndex] === 'swing') {
      this.showTutorialHint(TUTORIAL_RETRY_INSTRUCTIONS.swing ?? TUTORIAL_INSTRUCTIONS.swing)
    }
  }

  /** A fixed target the player overshot hops forward into reach instead of
   *  ever pulling the player back to retry it. */
  private relocateTutorialTarget(kind: 'monster' | 'mushroom' | 'heart') {
    const aheadX = this.player.x + TUTORIAL_RELOCATE_METERS * PX_PER_METER
    if (kind === 'monster' && this.tutorialMonster) {
      const m = this.tutorialMonster
      m.x = aheadX
      m.homeX = aheadX
      m.dead = false
      m.deadTime = 0
      m.squash = 0
      m.spin = 0
      m.vy = 0
    } else if (kind === 'mushroom' && this.tutorialMushroom) {
      this.tutorialMushroom.x = aheadX
      this.tutorialMushroom.taken = false
    } else if (kind === 'heart' && this.tutorialHeart) {
      this.tutorialHeart.x = aheadX
      this.tutorialHeart.taken = false
    }

    const retryText = TUTORIAL_RETRY_INSTRUCTIONS[TUTORIAL_PHASES[this.tutorialPhaseIndex]]
    if (retryText) this.showTutorialHint(retryText)
  }

  private finishTutorial() {
    this.tutorialActive = false
    this.tutorialHintText = ''
    this.tutorialHintTimer = 0
    this.tutorialHintNextText = ''
    this.publishHud(true)
  }

  // -------------------------------------------------------------------------
  // Combo
  // -------------------------------------------------------------------------

  private bumpCombo() {
    this.comboCount++
    this.comboTimer = COMBO_WINDOW
    const stepIndex = Math.min(Math.floor(this.comboCount / 4), COMBO_STEPS.length - 1)
    const next = COMBO_STEPS[stepIndex]
    if (next > this.combo) {
      this.combo = next
      this.bestCombo = Math.max(this.bestCombo, next)
      const p = this.player
      this.particles.popup(p.x, p.y - 92, `x${next.toFixed(1)} COMBO`, '#ff9f68', true, 32)
      this.particles.ring(p.x, p.y, 'rgba(255,159,104,0.8)', 30, 3, 0.5)
      this.shake = Math.max(this.shake, 6)
      audio.comboUp(stepIndex)
    }
  }

  private resetCombo() {
    this.combo = 1
    this.comboCount = 0
    this.comboTimer = 0
  }

  // -------------------------------------------------------------------------
  // Presentation helpers
  // -------------------------------------------------------------------------

  /** Squash the ball along a direction, used on every impact. */
  private squashFrom(angle: number, amount: number) {
    this.player.squashAngle = angle
    this.player.squash = Math.max(this.player.squash, amount)
  }

  /** Brief slow-motion freeze on an impact. `Math.max` on the timer so an
   *  overlapping trigger (e.g. a hit landing mid-hitstop) never cuts a
   *  longer freeze short. */
  private triggerHitStop(duration: number, scale: number) {
    if (duration >= this.hitStopTimer) this.hitStopScale = scale
    this.hitStopTimer = Math.max(this.hitStopTimer, duration)
  }

  private updateCosmetics(dt: number) {
    const p = this.player

    // G-force driven stretch: fast + tight swing = more deformation.
    let target = 0
    let angle = Math.atan2(p.vy, p.vx)
    if (this.hook.state === 'attached' && this.hook.anchor) {
      const speed = Math.hypot(p.vx, p.vy)
      const centripetal = (speed * speed) / Math.max(60, this.hook.restLen)
      target = -clamp(centripetal / 5200, 0, 0.34)
      angle = Math.atan2(p.y - this.hook.anchor.y, p.x - this.hook.anchor.x) + Math.PI / 2
    } else {
      const speed = Math.hypot(p.vx, p.vy)
      target = -clamp((speed - 380) / 2600, 0, 0.2)
    }
    p.squash = damp(p.squash, target, 7, dt)
    p.squashAngle = lerp(p.squashAngle, angle, 1 - Math.exp(-11 * dt))

    p.blink -= dt
    if (p.blink < -0.13) p.blink = 1.6 + Math.random() * 2.6
    p.earTwitch -= dt
    if (p.earTwitch < -0.25) p.earTwitch = 1.1 + Math.random() * 2.2

    this.shake = damp(this.shake, 0, 7.5, dt)
    this.flash = damp(this.flash, 0, 4.4, dt)

    // Rainbow trail while the mushroom is burning.
    if (this.invincibleTime > 0) {
      this.rainbowIndex++
      this.particles.rainbowTrail(p.x - p.vx * 0.02, p.y - p.vy * 0.02, this.rainbowIndex)
    }

    // Ambient spores drifting through the play area.
    this.ambientTimer -= dt
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.22
      this.particles.petal(
        this.camX + VIEW_W + 30,
        CEILING_Y + Math.random() * (GROUND_Y - CEILING_Y - 60),
        Math.random() < 0.5 ? 'rgba(255,224,240,0.6)' : 'rgba(224,255,214,0.55)',
      )
    }

    // Anchor lantern flashes fade out.
    for (const chunk of this.world.visibleChunks(this.camX - 200, this.camX + VIEW_W + 200)) {
      for (const a of chunk.anchors) {
        if (a.flash > 0) a.flash = Math.max(0, a.flash - dt * 2.4)
      }
    }
  }

  private updateCamera(dt: number) {
    const p = this.player
    // Look further ahead the faster we travel.
    const lead = clamp(p.vx * 0.16, -60, 170)
    const targetX = p.x - CAMERA_ANCHOR_X + lead
    this.camX = damp(this.camX, Math.max(0, targetX), CAMERA_LERP, dt)
    // The playfield is exactly one screen tall, so vertical stays locked.
    this.camY = 0
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  get speedKmh() {
    const p = this.player
    return (Math.hypot(p.vx, p.vy) / PX_PER_METER) * 3.6
  }

  publishHud(force = false) {
    if (!this.onHud) return
    if (!force && this.hudTimer < 0.06) return
    this.hudTimer = 0
    const tier = tierForDistance(this.distance)
    const kmh = this.speedKmh
    this.onHud({
      phase: this.phase,
      score: Math.round(this.score),
      distance: this.distance,
      hearts: this.hearts,
      combo: this.combo,
      comboTimer: this.comboTimer,
      comboCount: this.comboCount,
      speedKmh: kmh,
      speedRating: ratingFor(kmh),
      tierName: tier.name,
      tierAccent: tier.accent,
      tierId: tier.id,
      highScore: Math.round(this.highScore),
      isNewHighScore: this.isNewHighScore,
      invincibleTime: this.invincibleTime,
      seedsCollected: this.seedsCollected,
      monstersStomped: this.monstersStomped,
      bestCombo: this.bestCombo,
      swinging: this.hook.state === 'attached',
      tutorialActive: this.tutorialActive,
    })
  }
}
