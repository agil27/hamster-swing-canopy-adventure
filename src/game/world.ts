import {
  CEILING_Y,
  CHUNKS_AHEAD,
  CHUNK_WIDTH,
  GROUND_Y,
  HORIZONTAL_SCALE,
  MONSTER_RAMP_METERS,
  PX_PER_METER,
  TIERS,
  tierForDistance,
} from './constants'
import { makeRng, clamp, lerp } from './rng'
import type { Anchor, Chunk, GrassProp, HeartPickup, Monster, MonsterKind, Mushroom, Seed, VineProp } from './types'

let monsterId = 1
let arcId = 1

const GRASS_KINDS: GrassProp['kind'][] = ['buttercup', 'clover', 'dandelion', 'blade', 'blade', 'clover']

/**
 * Monster density eases in smoothly rather than jumping the moment a new
 * tier's distance threshold is crossed — that hard cliff is what made
 * monsters feel like they "suddenly" showed up. Each tier ramps linearly
 * from the previous tier's density up to its own over MONSTER_RAMP_METERS.
 */
function monsterDensityAt(meters: number): number {
  let density = 0
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i]
    if (meters < tier.from) break
    const prevDensity = i === 0 ? 0 : TIERS[i - 1].monsterDensity
    const frac = clamp((meters - tier.from) / MONSTER_RAMP_METERS, 0, 1)
    density = lerp(prevDensity, tier.monsterDensity, frac)
  }
  return density
}

/**
 * Builds and recycles the endless forest. Chunks are generated on demand from
 * a deterministic seed and dropped once the camera has left them well behind.
 */
/** Chunks are only ever pruned this far behind the furthest point the camera
 *  has reached — see the high-water-mark note in World.update(). */
const RETAIN_CHUNKS_BEHIND = 3

export class World {
  chunks = new Map<number, Chunk>()
  /** Global run seed — re-rolled every restart so no two runs match. */
  private runSeed = 1
  /** Furthest chunk index the camera has ever reached (see update()). */
  private maxChunkReached = -1

  reset(seed = Math.floor(Math.random() * 0xffffff)) {
    this.chunks.clear()
    this.runSeed = seed >>> 0
    this.maxChunkReached = -1
    monsterId = 1
    arcId = 1
    for (let i = 0; i < CHUNKS_AHEAD + 1; i++) this.ensureChunk(i)
  }

  /** Generate everything the camera can reach and prune what it cannot. */
  update(camX: number) {
    const first = Math.floor(camX / CHUNK_WIDTH)
    for (let i = first - 1; i <= first + CHUNKS_AHEAD; i++) {
      if (i >= 0) this.ensureChunk(i)
    }

    // camX is not strictly monotonic — a swing can grab an anchor slightly
    // behind the player (HOOK_RANGE_BEHIND) and briefly carry them backward,
    // and a knockback can do the same. Pruning against the *instantaneous*
    // camera position used to delete a chunk still on screen during one of
    // those wobbles; regenerating it from its seed put back the same layout
    // but reset every mutation — seeds un-collected, monsters un-stomped.
    // Tracking the furthest point ever reached and pruning behind *that*
    // instead makes chunks immune to any backward wobble far larger than a
    // swing could ever produce.
    this.maxChunkReached = Math.max(this.maxChunkReached, first)
    for (const key of this.chunks.keys()) {
      if (key < this.maxChunkReached - RETAIN_CHUNKS_BEHIND) this.chunks.delete(key)
    }
  }

  /** Chunks overlapping [x0, x1], in ascending order. */
  visibleChunks(x0: number, x1: number): Chunk[] {
    const out: Chunk[] = []
    const a = Math.floor(x0 / CHUNK_WIDTH) - 1
    const b = Math.floor(x1 / CHUNK_WIDTH) + 1
    for (let i = a; i <= b; i++) {
      const c = this.chunks.get(i)
      if (c) out.push(c)
    }
    return out
  }

  /** All live anchors near an x position — used by the hook search. */
  anchorsNear(x: number, reach: number): Anchor[] {
    const out: Anchor[] = []
    for (const c of this.visibleChunks(x - reach, x + reach)) {
      for (const a of c.anchors) {
        if (a.x >= x - reach && a.x <= x + reach) out.push(a)
      }
    }
    return out
  }

  private ensureChunk(index: number) {
    if (this.chunks.has(index)) return
    this.chunks.set(index, this.generate(index))
  }

  // -------------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------------

  private generate(index: number): Chunk {
    const rng = makeRng(this.runSeed * 92821 + index * 6971 + 17)
    const startX = index * CHUNK_WIDTH
    const endX = startX + CHUNK_WIDTH
    const meters = startX / PX_PER_METER
    const tier = tierForDistance(meters)

    const anchors: Anchor[] = []
    const seeds: Seed[] = []
    const hearts: HeartPickup[] = []
    const mushrooms: Mushroom[] = []
    const monsters: Monster[] = []

    // --- Canopy lanterns -----------------------------------------------------
    // The runway opens with a tight, forgiving ladder of anchors. Gaps scale
    // with the horizontal focus region so lanterns feel just as densely
    // spaced, relative to what's visible, in the narrower portrait frame.
    const gapMin = tier.anchorGap[0] * HORIZONTAL_SCALE
    const gapMax = tier.anchorGap[1] * HORIZONTAL_SCALE
    let x = startX + (index === 0 ? 150 : rng.range(40, 120))
    while (x < endX) {
      const wobble = tier.id === 0 ? rng.range(10, 46) : rng.range(8, 120)
      anchors.push({
        x,
        y: CEILING_Y + wobble,
        phase: rng.range(0, Math.PI * 2),
        hue: rng.range(38, 56),
        active: false,
        flash: 0,
      })
      x += rng.range(gapMin, gapMax)
    }

    // --- Golden seed arcs ----------------------------------------------------
    // Each arc traces the parabola a good release produces between two
    // lanterns, so following the seeds teaches the right release angle.
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i]
      const b = anchors[i + 1]
      const span = b.x - a.x
      if (span < 90) continue

      const id = arcId++
      const x0 = a.x + span * 0.16
      const x1 = b.x - span * 0.1
      // Swing bottoms out below the anchor, then the launch lifts the arc.
      const yStart = clamp(a.y + rng.range(210, 300), CEILING_Y + 140, GROUND_Y - 120)
      const yEnd = clamp(b.y + rng.range(190, 280), CEILING_Y + 140, GROUND_Y - 120)
      const arcHeight = rng.range(90, 190)
      const count = Math.max(4, Math.min(8, Math.round(span / 58)))

      for (let k = 0; k < count; k++) {
        const t = count === 1 ? 0.5 : k / (count - 1)
        const px = x0 + (x1 - x0) * t
        // Straight line interpolation minus a parabolic lift = flight path.
        const py = yStart + (yEnd - yStart) * t - arcHeight * 4 * t * (1 - t)
        seeds.push({
          x: px,
          y: clamp(py, CEILING_Y + 70, GROUND_Y - 60),
          phase: rng.range(0, Math.PI * 2),
          taken: false,
          arcId: id,
        })
      }

      // Occasionally crown the apex of an arc with a bonus pickup.
      const apexX = (x0 + x1) / 2
      const apexY = clamp((yStart + yEnd) / 2 - arcHeight, CEILING_Y + 80, GROUND_Y - 140)
      if (index > 0 && rng.chance(0.13)) {
        hearts.push({ x: apexX, y: apexY - 46, phase: rng.range(0, Math.PI * 2), taken: false })
      } else if (tier.id >= 1 && rng.chance(0.1)) {
        mushrooms.push({ x: apexX, y: apexY - 40, phase: rng.range(0, Math.PI * 2), taken: false })
      }
    }

    // A guaranteed heart every so often keeps long runs survivable.
    if (index > 0 && index % 5 === 0 && anchors.length > 1) {
      const a = rng.pick(anchors)
      hearts.push({ x: a.x + 60, y: clamp(a.y + 260, CEILING_Y + 120, GROUND_Y - 120), phase: 0, taken: false })
    }

    // --- Monsters ------------------------------------------------------------
    // Density ramps smoothly across the tier boundary — see monsterDensityAt.
    const density = monsterDensityAt(meters)
    const monsterCount = Math.floor(density) + (rng.chance(density % 1) ? 1 : 0)
    for (let i = 0; i < monsterCount; i++) {
      const kind =
        tier.id >= 2
          ? rng.pick<MonsterKind>(['slime', 'bat', 'hedgehog', 'bat'])
          : rng.pick<MonsterKind>(['slime', 'bat'])
      const mx = rng.range(startX + 120, endX - 120)
      monsters.push(this.makeMonster(kind, mx, rng.range(0, Math.PI * 2), tier.id))
    }

    // --- Decoration ----------------------------------------------------------
    const grass: GrassProp[] = []
    const grassCount = 26
    for (let i = 0; i < grassCount; i++) {
      grass.push({
        x: startX + (i / grassCount) * CHUNK_WIDTH + rng.range(-16, 16),
        kind: rng.pick(GRASS_KINDS),
        scale: rng.range(0.72, 1.35),
        hue: rng.range(88, 132),
        phase: rng.range(0, Math.PI * 2),
      })
    }

    const vines: VineProp[] = []
    const vineCount = rng.int(5, 8)
    for (let i = 0; i < vineCount; i++) {
      vines.push({
        x: startX + (i / vineCount) * CHUNK_WIDTH + rng.range(-30, 30),
        length: rng.range(70, 240),
        phase: rng.range(0, Math.PI * 2),
        leaves: rng.int(3, 7),
        hue: rng.range(96, 136),
      })
    }

    return { index, startX, endX, anchors, seeds, hearts, mushrooms, monsters, grass, vines }
  }

  private makeMonster(kind: MonsterKind, x: number, phase: number, tierId: number): Monster {
    const speedScale = (1 + tierId * 0.16) * HORIZONTAL_SCALE
    switch (kind) {
      case 'slime':
        return {
          id: monsterId++,
          kind,
          x,
          y: GROUND_Y - 26,
          homeX: x,
          homeY: GROUND_Y - 26,
          vx: 46 * speedScale,
          vy: 0,
          radius: 26,
          dir: 1,
          phase,
          deadTime: 0,
          dead: false,
          squash: 0,
          spin: 0,
        }
      case 'bat':
        return {
          id: monsterId++,
          kind,
          x,
          y: 250 + ((x * 7919) % 180),
          homeX: x,
          homeY: 250 + ((x * 7919) % 180),
          vx: -70 * speedScale,
          vy: 0,
          radius: 24,
          dir: -1,
          phase,
          deadTime: 0,
          dead: false,
          squash: 0,
          spin: 0,
        }
      case 'hedgehog':
        return {
          id: monsterId++,
          kind,
          x,
          y: GROUND_Y - 24,
          homeX: x,
          homeY: GROUND_Y - 24,
          vx: 165 * speedScale,
          vy: 0,
          radius: 24,
          dir: 1,
          phase,
          deadTime: 0,
          dead: false,
          squash: 0,
          spin: 0,
        }
    }
  }
}
