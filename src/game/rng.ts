/**
 * Small deterministic PRNG (mulberry32). Chunks are generated from a seed
 * derived from their index so the same run always rebuilds identically —
 * handy for debugging and it keeps decorations from flickering.
 */
export function makeRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    /** Float in [min, max). */
    range: (min: number, max: number) => min + next() * (max - min),
    /** Integer in [min, max]. */
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length) % items.length],
  }
}

export type Rng = ReturnType<typeof makeRng>

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Frame-rate independent exponential smoothing. */
export const damp = (a: number, b: number, rate: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-rate * dt))
export const TAU = Math.PI * 2
