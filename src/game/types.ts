export type GamePhase = 'menu' | 'playing' | 'crashing' | 'gameover'

export type MonsterKind = 'slime' | 'bat' | 'hedgehog'

export interface Anchor {
  x: number
  y: number
  /** Lantern sway phase so each one bobs on its own schedule. */
  phase: number
  hue: number
  /** Set while this lantern is the one being swung from. */
  active: boolean
  /** Decays after release — drives the little "ding" flash. */
  flash: number
}

export interface Seed {
  x: number
  y: number
  phase: number
  taken: boolean
  /** Seeds in the same parabolic arc share an id so we can reward full arcs. */
  arcId: number
}

export interface HeartPickup {
  x: number
  y: number
  phase: number
  taken: boolean
}

export interface Mushroom {
  x: number
  y: number
  phase: number
  taken: boolean
}

export interface Monster {
  id: number
  kind: MonsterKind
  x: number
  y: number
  /** Ground/patrol origin, used as the centre of the patrol path. */
  homeX: number
  homeY: number
  vx: number
  vy: number
  radius: number
  dir: 1 | -1
  phase: number
  /** 0 = alive. Counts up while the defeat animation plays. */
  deadTime: number
  dead: boolean
  /** Squash amount while being stomped. */
  squash: number
  spin: number
}

export interface Chunk {
  index: number
  startX: number
  endX: number
  anchors: Anchor[]
  seeds: Seed[]
  hearts: HeartPickup[]
  mushrooms: Mushroom[]
  monsters: Monster[]
  /** Decorative props baked once so they do not shimmer between frames. */
  grass: GrassProp[]
  vines: VineProp[]
}

export interface GrassProp {
  x: number
  kind: 'buttercup' | 'clover' | 'dandelion' | 'blade'
  scale: number
  hue: number
  phase: number
}

export interface VineProp {
  x: number
  length: number
  phase: number
  leaves: number
  hue: number
}

/** Snapshot pushed to React for the HUD. Kept small and cheap to diff. */
export interface HudState {
  phase: GamePhase
  score: number
  distance: number
  hearts: number
  combo: number
  comboTimer: number
  comboCount: number
  speedKmh: number
  speedRating: string
  tierName: string
  tierAccent: string
  tierId: number
  highScore: number
  isNewHighScore: boolean
  invincibleTime: number
  seedsCollected: number
  monstersStomped: number
  bestCombo: number
  swinging: boolean
  /** Set while a guided tutorial run is in progress — the instruction text
   *  itself is drawn directly on the canvas (see render/tutorial.ts), so
   *  the DOM layer only needs to know whether to show the skip button. */
  tutorialActive: boolean
  /** Bumped every time a heart pickup actually heals a lost heart — the
   *  HUD watches this to play a one-shot glow/pop on the heart row (see
   *  Hud.tsx), since `hearts` alone can't tell "just healed" from
   *  "rendered the same value again". */
  heartsFlashId: number
}
