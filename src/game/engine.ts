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
  TUTORIAL_CLUSTER_GAP_METERS,
  TUTORIAL_DONE_DURATION,
  TUTORIAL_FALL_TEXT,
  TUTORIAL_HEART_COLLECT_TEXT,
  TUTORIAL_HEART_FALL_TEXT,
  TUTORIAL_HINT_DURATION,
  TUTORIAL_HIT_INSTRUCTIONS,
  TUTORIAL_INSTRUCTIONS,
  TUTORIAL_MISS_INSTRUCTIONS,
  TUTORIAL_MISS_MARGIN_METERS,
  TUTORIAL_MUSHROOM_COUNT,
  TUTORIAL_MUSHROOM_SMASH_TARGET,
  TUTORIAL_MUSHROOM_SMASH_TEXT,
  TUTORIAL_MUSHROOM_WAVE_COUNT,
  TUTORIAL_MUSHROOM_WAVE_GAP_METERS,
  TUTORIAL_PHASES,
  TUTORIAL_PLACE_AHEAD_METERS,
  TUTORIAL_SEED,
  TUTORIAL_STOMP_MONSTER_COUNT,
  TUTORIAL_SWING_REPS,
} from './tutorial'
import type { TutorialPhase } from './tutorial'
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
  /** The x position "distance" is measured from — normally PLAYER_START_X
   *  for the whole run, but the tutorial moves this up to wherever the
   *  player actually is the moment it hands off to normal play (see
   *  finishTutorial()), so practice never counts toward distance, score,
   *  or the leaderboard. */
  private distanceBaselineX = PLAYER_START_X
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
  /** Bumped every time a heart pickup actually heals a lost heart — see
   *  HudState.heartsFlashId. */
  heartsFlashId = 0

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
  // tutorial layer only watches state and nudges it. Five phases —
  // TUTORIAL_PHASES — each opening frozen for the player's own next press
  // (see tutorialWaitingForInput), then ending only in success, never a
  // forced rewind: a failure revives the player in place (undoing its
  // cost) and, if a fixed target got missed, hops the target forward into
  // reach instead.
  tutorialActive = false
  tutorialPhaseIndex = 0
  /** True while a phase's opening instruction has the sim fully frozen,
   *  waiting for the player's own next press — see pressDown() and
   *  beginTutorialPhase(). Never used for a mid-phase retry note; those
   *  stay non-blocking. */
  tutorialWaitingForInput = false
  /** Set alongside a queued celebrate→instruction chain (see
   *  showTutorialHint()) to freeze the instant that chain lands on the
   *  instruction — so the celebrate note itself still plays out live, and
   *  only the phase's real opening note blocks on a press. */
  private tutorialFreezeOnNext = false
  /** Counts down the closing "you're ready" note before handing off. */
  private tutorialStepTimer = 0
  private tutorialSwingReps = 0
  /** True for exactly one frame after a release, so a hook staying
   *  attached across many frames can't be counted as several reps. */
  private tutorialWasAttached = false
  /** Hearts value a mid-phase "hit" gets quietly restored to — the cost is
   *  undone rather than the player being sent back anywhere. */
  private tutorialSafeHearts = MAX_HEARTS
  /** The guaranteed teaching objects, spawned by beginTutorialPhase() the
   *  instant the player's own press starts that phase (or, for a
   *  miss-relocate mid-phase, once the retry note has had its say — see
   *  tutorialPendingPlacement). Stomp and mushroom each spawn a small
   *  cluster (landing/grabbing any one of them counts) rather than a
   *  single all-or-nothing target — see TUTORIAL_STOMP_MONSTER_COUNT /
   *  TUTORIAL_MUSHROOM_COUNT. Once the mushroom's grabbed, tutorialMonsters
   *  is reused for the smash wave (see TUTORIAL_MUSHROOM_WAVE_COUNT). */
  private tutorialMonsters: Monster[] = []
  private tutorialMushrooms: Mushroom[] = []
  private tutorialHeart: HeartPickup | null = null
  /** True from the moment the mushroom's grabbed until the smash target's
   *  met — tutorialMonsters is the wave during this window, not a stomp
   *  cluster or a bonus prop. */
  private tutorialMushroomWaveActive = false
  /** A phase whose teaching object hasn't spawned yet — waiting for the
   *  current (non-blocking, auto-fading) note to finish. Only used for a
   *  mid-phase miss-relocate and the heart phase's post-intro pickup;
   *  never for a phase's own opening spawn, which is press-driven (see
   *  beginTutorialPhase()). Consumed the instant tutorialHintText next
   *  goes back to '' (see updateTutorial()). */
  private tutorialPendingPlacement: TutorialPhase | null = null
  /** Set the instant a stomp lands on one of tutorialMonsters, consumed at
   *  the very top of the next updateTutorial() tick — a real hit ALSO
   *  leaves that monster with dead === true (it's removed either way, see
   *  takeDamage), so a plain "is it dead?" check can't tell a win from a
   *  loss. This flag is the one unambiguous signal, and checking it before
   *  anything else means an unrelated same-frame heart loss (e.g. a hard
   *  landing right after the stomp's own bounce) can never look at that
   *  same dead flag first and revive the very monster that was just won
   *  against. */
  private tutorialStompLanded = false
  /** Set the instant a real hit (not a stomp) lands on one of
   *  tutorialMonsters — the one thing that actually earns the phase's
   *  "Ouch, you got hit" retry note. An unrelated heart loss (a hard
   *  ground landing, say) undoes the heart the same as any hit would, but
   *  must never show that note — nothing was actually hit. Consumed by
   *  tutorialRevive(). */
  private tutorialHitByMonster = false
  /** Current handwritten note, or '' when nothing is showing. A phase's
   *  opening note stays up indefinitely (frozen, waiting for a press); any
   *  other note just sits for a while and fades on its own (see
   *  TUTORIAL_HINT_DURATION / TUTORIAL_HINT_FADE). */
  tutorialHintText = ''
  /** Counts down the current note's remaining hold time (meaningless while
   *  tutorialWaitingForInput — a frozen note doesn't tick); the render
   *  layer fades the note out over the last TUTORIAL_HINT_FADE seconds of
   *  this. */
  tutorialHintTimer = 0
  /** Queued note + duration that takes over automatically the instant the
   *  current one's hold time elapses — chains a "Nice!" into the next
   *  phase's instruction without freezing anything in between (until
   *  tutorialFreezeOnNext says otherwise). */
  private tutorialHintNextText = ''
  private tutorialHintNextDuration = 0

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  start(seed?: number, tutorialMode = false) {
    this.world.reset(seed, tutorialMode)
    this.particles.clear()
    this.tutorialActive = false
    this.tutorialWaitingForInput = false
    this.tutorialFreezeOnNext = false
    this.tutorialHintText = ''
    this.tutorialHintTimer = 0
    this.tutorialHintNextText = ''
    this.tutorialMonsters = []
    this.tutorialMushrooms = []
    this.tutorialHeart = null
    this.tutorialMushroomWaveActive = false
    this.tutorialStompLanded = false
    this.tutorialHitByMonster = false
    this.tutorialPendingPlacement = null

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
    this.distanceBaselineX = PLAYER_START_X
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

  /** Same run setup as start(), plus a fixed layout and a five-phase guided
   *  script — see TUTORIAL_PHASES and updateTutorial(). Every phase opens
   *  frozen (see tutorialWaitingForInput) for the player's own press
   *  before anything of it exists, so nothing shows up before it's
   *  relevant, and nothing shows up while the player hasn't even read what
   *  it's for. The world itself generates no ambient seeds/hearts/
   *  mushrooms/monsters at all while in tutorial mode (see
   *  world.setTutorialMode()), so nothing ever competes with it either —
   *  right up until the tutorial hands off to normal play (finishTutorial()). */
  startTutorial() {
    this.start(TUTORIAL_SEED, true)
    this.tutorialActive = true
    this.tutorialPhaseIndex = 0
    this.tutorialStepTimer = 0
    this.tutorialSwingReps = 0
    this.tutorialWasAttached = false
    this.tutorialSafeHearts = this.hearts
    this.tutorialMonsters = []
    this.tutorialMushrooms = []
    this.tutorialHeart = null
    this.tutorialMushroomWaveActive = false
    this.tutorialStompLanded = false
    this.tutorialHitByMonster = false
    this.tutorialWaitingForInput = true
    this.showTutorialHint(TUTORIAL_INSTRUCTIONS.swing)
    this.publishHud(true)
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  pressDown() {
    if (this.phase !== 'playing') return
    // A phase's opening note freezes everything until the player's own
    // next press — this is that press. It both lifts the freeze AND kicks
    // the phase off (spawning whatever it teaches) in the same call, so
    // dismissing the note feels like just... starting to play.
    if (this.tutorialActive && this.tutorialWaitingForInput) {
      this.tutorialWaitingForInput = false
      this.beginTutorialPhase()
    }
    this.pressed = true
    this.castHook()
  }

  pressUp() {
    if (!this.pressed) return
    this.pressed = false
    this.releaseHook()
  }

  /** The lantern castHook() would grab right now, if any. */
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

    // A phase's opening note freezes the whole simulation — physics,
    // gravity, everything — until the player's own next press lifts it
    // (see pressDown()). No timer for this: they get exactly as long as
    // they need to read, and nothing about the phase (including its
    // teaching object) exists until they do.
    if (this.tutorialActive && this.tutorialWaitingForInput) return

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
    const meters = Math.max(0, (p.x - this.distanceBaselineX) / PX_PER_METER)
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
            this.heartsFlashId++
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
    if (this.tutorialActive && TUTORIAL_PHASES[this.tutorialPhaseIndex] === 'stomp' && this.tutorialMonsters.includes(m)) {
      this.tutorialStompLanded = true
    }
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

    // A clean stomp heals one heart back — active in the tutorial too (the
    // player should feel the same reward there), it just doesn't disturb
    // the guided phases: tutorialSafeHearts/tutorialStompLanded are keyed
    // off this.hearts, and healing only ever moves hearts *up*, so the
    // "did we lose a heart?" checks those phases rely on stay exactly as
    // forgiving as before — this can only ever heal on top of that, never
    // interfere with it.
    if (this.hearts < MAX_HEARTS) {
      this.hearts++
      this.heartsFlashId++
      this.particles.popup(m.x, m.y - 56, '+1 HEART', '#ff8fa8', true, 28)
      this.particles.heartSparkle(m.x, m.y - 10, 14)
      audio.heart()
    }

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

    // The one signal tutorialRevive() trusts for "actually got hit" — see
    // its own comment on tutorialHitByMonster.
    if (this.tutorialActive && this.tutorialMonsters.includes(m)) this.tutorialHitByMonster = true

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
   *  instruction without ever freezing gameplay in between — unless
   *  `freezeOnNext` is set, in which case the moment that promotion
   *  happens is also the moment tutorialWaitingForInput goes up, freezing
   *  the sim right as the chained note takes over (see advanceTutorialPhase()). */
  private showTutorialHint(
    text: string,
    duration = TUTORIAL_HINT_DURATION,
    nextText = '',
    nextDuration = TUTORIAL_HINT_DURATION,
    freezeOnNext = false,
  ) {
    this.tutorialHintText = text
    this.tutorialHintTimer = duration
    this.tutorialHintNextText = nextText
    this.tutorialHintNextDuration = nextDuration
    this.tutorialFreezeOnNext = freezeOnNext
  }

  /** Checked every frame while tutorialActive and not frozen (a frozen
   *  phase-opening note never reaches this at all — see the freeze check
   *  at the top of update()). Every guided phase ends in success, never a
   *  forced rewind — a heart lost (a hit, or a hard fall triggering the
   *  normal ground-save) is quietly undone in place, a soft landing with
   *  nothing to hook gets a gentle nudge back into the air, and a missed
   *  fixed target hops forward into reach — the player is never sent
   *  backward to retry anything. */
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
          if (this.tutorialFreezeOnNext) {
            // A celebrate→instruction chain landed on the instruction —
            // that's this phase's real opening note, so it freezes here,
            // same as any other phase start (see beginTutorialPhase()).
            this.tutorialFreezeOnNext = false
            this.tutorialWaitingForInput = true
          }
        } else {
          this.tutorialHintText = ''
          // A non-blocking note (a retry, or the heart phase's post-intro
          // "now go grab one") has fully gone — only now does whatever it
          // was waiting on actually spawn, so the player can never reach
          // it before ever seeing what it's for.
          if (this.tutorialPendingPlacement) this.spawnPendingTutorialTarget()
        }
      }
    }

    if (phase === 'done') {
      this.tutorialStepTimer -= dt
      if (this.tutorialStepTimer <= 0) this.finishTutorial()
      return
    }

    // A stomp landing on the tutorial's own monster is credited immediately,
    // before anything else this frame gets a look — including an unrelated
    // heart loss below, which would otherwise read the exact same "m.dead"
    // flag a real hit leaves behind and revive the monster that was just
    // beaten (see tutorialStompLanded's own comment for why m.dead alone
    // can't tell the two apart). Any heart lost this same frame still gets
    // quietly undone — practice never costs a real heart, win or lose.
    if (this.tutorialStompLanded) {
      this.tutorialStompLanded = false
      if (this.hearts < this.tutorialSafeHearts) this.tutorialUndoHeartLoss()
      this.advanceTutorialPhase(2, 'Good job!')
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
        // A win is handled above via tutorialStompLanded — only "flew past
        // every one of them without landing it" is left to check here.
        const monsters = this.tutorialMonsters
        if (monsters.length > 0 && monsters.every((m) => (p.x - m.x) / PX_PER_METER > TUTORIAL_MISS_MARGIN_METERS)) {
          this.relocateTutorialTarget('monster')
        }
        break
      }
      case 'mushroom': {
        if (this.tutorialMushroomWaveActive) {
          // Landing/hit ambiguity doesn't apply here — while invincible,
          // every collision resolves through smashMonster(), never a real
          // hit, so a plain dead-count is unambiguous. Hand off once the
          // target's met OR invincibility simply runs out — whichever
          // comes first — so running low on time can never strand the
          // player mid-wave waiting for a count that won't arrive in time.
          const smashed = this.tutorialMonsters.reduce((n, m) => n + (m.dead ? 1 : 0), 0)
          if (smashed >= TUTORIAL_MUSHROOM_SMASH_TARGET || this.invincibleTime <= 0) {
            this.tutorialMushroomWaveActive = false
            this.advanceTutorialPhase(3, 'Awesome smashing!')
          }
          break
        }
        const mushrooms = this.tutorialMushrooms
        if (mushrooms.some((mu) => mu.taken)) {
          this.beginMushroomSmashWave()
        } else if (
          mushrooms.length > 0 &&
          mushrooms.every((mu) => (p.x - mu.x) / PX_PER_METER > TUTORIAL_MISS_MARGIN_METERS)
        ) {
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

  /** Moves the tutorial to its next phase. That phase's opening note
   *  freezes the sim immediately, waiting for the player's own next press
   *  (see tutorialWaitingForInput / pressDown() / beginTutorialPhase()) —
   *  nothing about the new phase exists until then. The one exception is
   *  'done', which just plays its closing note out live and hands off on
   *  its own (see finishTutorial()). When a celebrateText is given, that
   *  "Nice!" note plays out live first (TUTORIAL_CELEBRATE_DURATION,
   *  nothing frozen — it's just an acknowledgement) and only the
   *  instruction it chains into actually freezes. */
  private advanceTutorialPhase(next: number, celebrateText?: string) {
    this.tutorialPhaseIndex = next
    // New baseline for the "hearts dropped" check above — each phase only
    // ever undoes damage taken *during* itself.
    this.tutorialSafeHearts = this.hearts
    const phase = TUTORIAL_PHASES[next]

    this.tutorialMonsters = []
    this.tutorialMushrooms = []
    this.tutorialHeart = null
    this.tutorialMushroomWaveActive = false
    this.tutorialPendingPlacement = null
    // Always set explicitly below (true only in the plain-instruction
    // branch) — never left over from whatever it was before this call.
    this.tutorialWaitingForInput = false

    if (phase === 'done') {
      this.tutorialStepTimer = TUTORIAL_DONE_DURATION
      this.showTutorialHint(TUTORIAL_INSTRUCTIONS.done, TUTORIAL_DONE_DURATION)
    } else if (celebrateText) {
      this.showTutorialHint(celebrateText, TUTORIAL_CELEBRATE_DURATION, TUTORIAL_INSTRUCTIONS[phase], TUTORIAL_HINT_DURATION, true)
    } else {
      this.tutorialWaitingForInput = true
      this.showTutorialHint(TUTORIAL_INSTRUCTIONS[phase])
    }
    audio.comboUp(0)
    this.publishHud(true)
  }

  /** Kicks a phase off the instant the player's own press dismisses its
   *  opening freeze — spawns whatever it teaches, right where the player
   *  actually is now, through the world's placeXAt() helpers so it lands
   *  in the chunk that actually matches its position (see the note on
   *  relocateTutorialTarget() about why that matters). Stomp and mushroom
   *  each spawn a small cluster rather than one single target — landing
   *  or grabbing any one of them counts (see TUTORIAL_STOMP_MONSTER_COUNT /
   *  TUTORIAL_MUSHROOM_COUNT). The heart phase instead sets up its
   *  scripted fall — see the file header on tutorial.ts. */
  private beginTutorialPhase() {
    const phase = TUTORIAL_PHASES[this.tutorialPhaseIndex]
    const baseX = this.player.x + TUTORIAL_PLACE_AHEAD_METERS * PX_PER_METER
    const gap = TUTORIAL_CLUSTER_GAP_METERS * PX_PER_METER

    if (phase === 'stomp') {
      this.tutorialMonsters = []
      for (let i = 0; i < TUTORIAL_STOMP_MONSTER_COUNT; i++) {
        this.tutorialMonsters.push(this.world.placeMonsterAt(baseX + i * gap, 'bat'))
      }
    } else if (phase === 'mushroom') {
      this.tutorialMushrooms = []
      for (let i = 0; i < TUTORIAL_MUSHROOM_COUNT; i++) {
        this.tutorialMushrooms.push(this.world.placeMushroomAt(baseX + i * gap))
      }
    } else if (phase === 'heart') {
      // An instant, honest demonstration of "a hit costs one heart" —
      // docked right on the spot, no fall, nothing suppressed. The new
      // baseline reflects the deficit itself, so the general heart-loss
      // safety net (see updateTutorial()) doesn't immediately undo it —
      // the whole point is to leave something for the pickup to heal.
      if (this.hearts > 1) this.hearts -= 1
      this.tutorialSafeHearts = this.hearts
      this.flash = 0.35
      this.flashColor = '#ff7a6b'
      this.shake = Math.max(this.shake, 12)
      this.particles.popup(this.player.x, this.player.y - 60, '-1', '#ff8b8b', true, 32)
      audio.hurt()
      this.tutorialPendingPlacement = 'heart'
      this.showTutorialHint(TUTORIAL_HEART_FALL_TEXT, TUTORIAL_HINT_DURATION, TUTORIAL_HEART_COLLECT_TEXT, TUTORIAL_HINT_DURATION)
    }
    this.publishHud(true)
  }

  /** Once the mushroom's grabbed, tutorialMonsters is repurposed for a
   *  short run of monsters right on the path — free to smash through
   *  while invincible (see TUTORIAL_MUSHROOM_WAVE_COUNT). This note is
   *  non-blocking: invincibility is already ticking, so freezing here
   *  would just waste the window it's talking about. */
  private beginMushroomSmashWave() {
    this.tutorialMushrooms = []
    this.tutorialMushroomWaveActive = true
    const baseX = this.player.x + TUTORIAL_PLACE_AHEAD_METERS * PX_PER_METER
    const gap = TUTORIAL_MUSHROOM_WAVE_GAP_METERS * PX_PER_METER
    this.tutorialMonsters = []
    for (let i = 0; i < TUTORIAL_MUSHROOM_WAVE_COUNT; i++) {
      this.tutorialMonsters.push(this.world.placeMonsterAt(baseX + i * gap, 'bat'))
    }
    this.showTutorialHint(TUTORIAL_MUSHROOM_SMASH_TEXT)
  }

  /** Spawns whatever tutorialPendingPlacement is waiting on, right where
   *  the player actually is now that the (non-blocking) note introducing
   *  it has finished — a mid-phase miss-relocate (stomp/mushroom), or the
   *  heart phase's pickup, which only ever spawns once its own
   *  scripted-fall narrative has fully played out (see tutorialRevive()).
   *  A phase's very first spawn is never routed through here — that's
   *  press-driven, see beginTutorialPhase(). Always through the world's
   *  placeXAt() helpers, so the object lands in the chunk that actually
   *  matches its position (see the note on relocateTutorialTarget() about
   *  why that matters). */
  private spawnPendingTutorialTarget() {
    const phase = this.tutorialPendingPlacement
    this.tutorialPendingPlacement = null
    if (!phase) return

    const baseX = this.player.x + TUTORIAL_PLACE_AHEAD_METERS * PX_PER_METER
    const gap = TUTORIAL_CLUSTER_GAP_METERS * PX_PER_METER

    if (phase === 'stomp') {
      this.tutorialMonsters = []
      for (let i = 0; i < TUTORIAL_STOMP_MONSTER_COUNT; i++) {
        this.tutorialMonsters.push(this.world.placeMonsterAt(baseX + i * gap, 'bat'))
      }
    } else if (phase === 'mushroom') {
      this.tutorialMushrooms = []
      for (let i = 0; i < TUTORIAL_MUSHROOM_COUNT; i++) {
        this.tutorialMushrooms.push(this.world.placeMushroomAt(baseX + i * gap))
      }
    } else if (phase === 'heart') {
      this.tutorialHeart = this.world.placeHeartAt(baseX)
    }
  }

  /** Just the heart/iframe/combo side of undoing a cost — no monster
   *  involvement, no popup, no note. Shared by a genuine failure
   *  (tutorialRevive) and by a win that happened to coincide with an
   *  unrelated heart loss the same frame, where none of that drama
   *  belongs. */
  private tutorialUndoHeartLoss() {
    const p = this.player
    this.hearts = this.tutorialSafeHearts
    this.iframeTime = 0.6
    this.resetCombo()
    if (p.vy > -100) p.vy = -260 // pop back into the air if they were falling/settled
  }

  /** Quietly undoes whatever just cost a heart and lets the player keep
   *  going from exactly where they are — the "unlimited attempts, never
   *  sent back" behaviour for getting hit or hitting the ground hard. The
   *  "Ouch, that monster hit you" note (TUTORIAL_HIT_INSTRUCTIONS) only
   *  ever reappears when tutorialHitByMonster says this heart loss
   *  actually was a hit — an unrelated hard landing (or one that happens
   *  while a target is still mid-spawn, waiting on an earlier note to
   *  fade) undoes the heart just the same but stays quiet, so it can
   *  never masquerade as "the monster got you" and can never keep
   *  re-arming (and thus indefinitely postponing) a note that's simply
   *  waiting to finish its own hold time. */
  private tutorialRevive() {
    const p = this.player
    this.tutorialUndoHeartLoss()
    this.releaseHook()

    const hitByMonster = this.tutorialHitByMonster
    this.tutorialHitByMonster = false
    const phase = TUTORIAL_PHASES[this.tutorialPhaseIndex]

    // Only resurrect monsters while still actually on the stomp phase —
    // once it's been won (see tutorialStompLanded), any stale dead
    // reference left in the array is no longer anyone's business.
    if (phase === 'stomp') {
      for (const m of this.tutorialMonsters) {
        if (!m.dead) continue
        m.dead = false
        m.deadTime = 0
        m.squash = 0
        m.spin = 0
        m.x = m.homeX
        m.y = m.homeY
        m.vy = 0
      }
    }

    this.flash = 0.25
    this.flashColor = '#ffb347'
    this.shake = Math.max(this.shake, 6)
    this.particles.popup(p.x, p.y - 60, 'Try again!', '#ffb347', true, 26)
    audio.uiClick()

    if (hitByMonster) {
      const hitText = TUTORIAL_HIT_INSTRUCTIONS[phase]
      if (hitText) this.showTutorialHint(hitText)
    }

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
    // thing that note is teaching — bring it back if it had faded. Its own
    // wording (TUTORIAL_FALL_TEXT), never shared with a miss or a hit.
    if (TUTORIAL_PHASES[this.tutorialPhaseIndex] === 'swing') {
      this.showTutorialHint(TUTORIAL_FALL_TEXT)
    }
  }

  /** A fixed target the player overshot hops forward into reach instead of
   *  ever pulling the player back to retry it — via a brand-new object
   *  through the same placeXAt() helpers the initial spawn uses (never by
   *  mutating .x on the old one), because that old object still lives in
   *  whatever chunk it was originally generated into; just moving its x
   *  can walk it out of every chunk the camera will ever ask for again
   *  (or into one already pruned), silently stranding it — invisible,
   *  uncollidable, and the phase stuck forever waiting on it. The miss
   *  note (TUTORIAL_MISS_INSTRUCTIONS — never the hit one) shows
   *  immediately; the replacement itself waits for that note to fade,
   *  same as any other spawn (see spawnPendingTutorialTarget()). */
  private relocateTutorialTarget(kind: 'monster' | 'mushroom' | 'heart') {
    if (kind === 'monster') this.tutorialMonsters = []
    else if (kind === 'mushroom') this.tutorialMushrooms = []
    else this.tutorialHeart = null

    this.tutorialPendingPlacement = TUTORIAL_PHASES[this.tutorialPhaseIndex]

    const missText = TUTORIAL_MISS_INSTRUCTIONS[TUTORIAL_PHASES[this.tutorialPhaseIndex]]
    if (missText) this.showTutorialHint(missText)
  }

  /** Hands off to a normal, unscripted run: the world starts generating
   *  ambient seeds/hearts/mushrooms/monsters again from here on (see
   *  world.setTutorialMode()) — the player keeps their current position,
   *  score and hearts, they just keep going as a real run. */
  private finishTutorial() {
    this.tutorialActive = false
    this.tutorialWaitingForInput = false
    this.tutorialHintText = ''
    this.tutorialHintTimer = 0
    this.tutorialHintNextText = ''
    this.world.setTutorialMode(false, this.camX)

    // Practice shouldn't count toward the leaderboard or the player's own
    // best — zero every run stat right here, at the exact position the
    // player's already at, so normal play starts its scoring from a clean
    // slate without any visible rewind or hitch.
    this.distanceBaselineX = this.player.x
    this.score = 0
    this.distance = 0
    this.scoredMeters = 0
    this.seedsCollected = 0
    this.monstersStomped = 0
    this.combo = 1
    this.comboCount = 0
    this.comboTimer = 0
    this.bestCombo = 1

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
      heartsFlashId: this.heartsFlashId,
    })
  }
}
