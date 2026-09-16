# 🐹 Hamster Swing: Canopy Adventure

A Disney/Pixar-inspired 2D side-scrolling physics game. A fluffy hamster rides a
crystalline ball through an enchanted storybook forest, hooking glowing canopy
lanterns with an elastic rope and launching itself from the bottom of each swing.

Built with **React + TypeScript + Tailwind CSS + HTML5 Canvas**. No image or
audio assets — every pixel is drawn procedurally and every sound is synthesised
live with the Web Audio API.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle into dist/
npm run preview  # serve the production build
```

## Controls

| Input | Action |
| --- | --- |
| Hold click / touch / `Space` | Cast the rope at the nearest lantern ahead and swing |
| Release | Launch forward and upward |

Speed peaks at the bottom of the arc — that is the moment to let go. The golden
sunflower seeds are laid out along the parabola a good release actually
produces, so following the seeds teaches the correct release angle.

## Mechanics

- **Pendulum swing** — a positional rope constraint with velocity projection,
  run at 4 physics sub-steps. The rope reels in while held, which is what
  converts a swing into speed. Squash & stretch responds to real G-forces
  (`v²/r`), stretching along the tangent under load.
- **Stomping** — landing on a monster while falling (`vy >= -40`) squishes it
  for a `-420` bounce and +250 × combo. Three monster types: bouncing forest
  slimes, sinusoidal patrolling bats and fast ground-running hedgehogs.
- **Combo** — seeds and stomps chain within a 2.6s window, stepping the
  multiplier 1.0 → 1.5 → … → 4.0 with a countdown ring and flame effects.
  Sweeping every seed in one arc pays a "Perfect Arc" bonus.
- **Three hearts** — a monster hit costs one heart, knocks you back (`vy = -260`)
  and grants 1.6s of i-frames with blinking and an amber shield. Touching the
  grass with hearts to spare triggers an emergency spring cushion (`vy = -450`)
  and costs a heart instead of ending the run. At zero hearts a 2-second cartoon
  tumble plays before the settlement modal.
- **Pickups** — floating hearts heal +1 (or +500 when already full); magic
  mushrooms grant 6 seconds of invincibility with a rainbow trail and let you
  smash straight through monsters.
- **Difficulty tiers** — Novice Runway (0–40 m) → Forest Edge (40 m) →
  Dark Canopy (150 m) → Extreme Rush (350 m), varying anchor spacing, monster
  density and canopy gloom.

## Layout

```
src/
  game/
    constants.ts     tunable physics / scoring / tier values
    types.ts         entity + HUD state shapes
    rng.ts           deterministic PRNG and math helpers
    audio.ts         procedural Web Audio synth (music loop + all SFX)
    particles.ts     sparkles, impact stars, dust, hearts, rainbow, popups
    world.ts         chunked procedural generation
    engine.ts        simulation, collision, scoring, state machine
    render/
      background.ts  parallax sky, forest depth layers, canopy, meadow
      entities.ts    hamster, monsters, collectibles, lanterns, rope
      index.ts       frame compositor, shake, flash, speed lines, vignette
  components/        canvas host, HUD, start screen, modals
```

React never touches the simulation: the engine publishes a small `HudState`
snapshot ~16×/second and the canvas host re-renders zero times.

## Notes

- The world is authored at a fixed 1280×720 and letterboxed, so gameplay is
  identical on every screen size. Device pixel ratio is capped at 2.
- High score and the mute preference persist to `localStorage`; both accesses
  are guarded so private-mode browsers still play fine.
- Audio only initialises on the first user gesture, as browsers require.
