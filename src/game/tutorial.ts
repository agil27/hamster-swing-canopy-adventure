/**
 * Tutorial script v5 — five hands-on phases (swing / stomp / mushroom /
 * heart / done), each with a canvas-drawn handwritten instruction (no
 * arrow, no modal — just a note).
 *
 * Every phase opens frozen: the instruction note appears, gameplay stops
 * completely, and a small pulsing "(tap to begin)" cue waits for the
 * player's own next press — never a timer — before that phase's teaching
 * object(s) spawn and physics resumes. That's deliberate: reading and
 * doing never compete for the same moment, and the player decides when
 * they're ready. Once a phase is under way, though, nothing freezes again
 * for it — a miss or a hit just shows a brief, auto-fading retry note and
 * lets the player keep going without ever blocking them.
 *
 * Every failure mode gets its OWN note, not a shared one: missing a
 * target entirely (flying past it) reads differently from actually being
 * hit by a monster, and both are worded for exactly what happened — see
 * TUTORIAL_MISS_INSTRUCTIONS / TUTORIAL_HIT_INSTRUCTIONS / TUTORIAL_FALL_TEXT.
 *
 * A phase never ends in failure, only success, and never rewinds the
 * player: a heart lost mid-phase (a hit, or a hard fall) is quietly undone
 * in place, and an overshot fixed target hops forward into reach — a
 * fresh spawn, never the player pulled backward.
 *
 * Stomp and mushroom each spawn a small forgiving cluster (not just one
 * target) so a miss on the first still leaves another right behind it.
 * Landing the mushroom opens a short "smash wave" — a run of monsters
 * right on the path, free to punch through while invincible — so the
 * payoff is something to actually do; it hands off to the heart phase
 * once either the smash target is met OR invincibility simply runs out,
 * so it can never strand the player mid-wave. The heart phase opens by
 * docking one heart on the spot (no fall, no suppressed input — just an
 * instant, honest "here's what a hit costs") before the pickup that heals
 * it back ever appears.
 */
export type TutorialPhase = 'swing' | 'stomp' | 'mushroom' | 'heart' | 'done'

export const TUTORIAL_PHASES: readonly TutorialPhase[] = ['swing', 'stomp', 'mushroom', 'heart', 'done']

export const TUTORIAL_INSTRUCTIONS: Readonly<Record<TutorialPhase, string>> = {
  swing: 'Hold to hook the lantern, then let go to swing!',
  stomp: "Stomp on the monster's head to gain extra points!",
  mushroom: 'Grab the mushroom — invincible for a few seconds!',
  heart: 'These are your hearts — hits cost one, floating hearts heal you!',
  done: "You've got it — good luck out there!",
}

/** Shown only for the swing phase's own ground-fumble (see
 *  tutorialGroundBounce()) — the one place a plain ground touch is itself
 *  the thing being taught, so it gets its own wording rather than sharing
 *  either of the two below. */
export const TUTORIAL_FALL_TEXT = 'Oops, you touched the ground! Hold again to hook the next lantern.'

/** Shown when a fixed target (stomp cluster / mushroom cluster / heart
 *  pickup) gets flown straight past without ever being reached — a MISS,
 *  not a hit, so it reads as "you overshot it," never "ouch." */
export const TUTORIAL_MISS_INSTRUCTIONS: Readonly<Partial<Record<TutorialPhase, string>>> = {
  stomp: 'You flew right past it! Line up above the next one and land on top.',
  mushroom: 'Missed it — grab the next mushroom!',
  heart: 'Missed it — grab the next heart to heal up!',
}

/** Shown only when tutorialHitByMonster confirms a real hit actually
 *  landed on the player — never for an unrelated heart loss (a hard
 *  ground landing, say) that just happens to land during the same phase,
 *  and never for a plain miss either (see TUTORIAL_MISS_INSTRUCTIONS). */
export const TUTORIAL_HIT_INSTRUCTIONS: Readonly<Partial<Record<TutorialPhase, string>>> = {
  stomp: 'Ouch! That monster hit you. Land on TOP of the next one to stomp it instead.',
  mushroom: "Ouch! That one got you — smash through the rest while you're still invincible.",
}

/** Shown once, right after the mushroom is grabbed — invincibility is
 *  already running, so this note just sits and fades on its own rather
 *  than freezing anything (that would waste the window it's talking
 *  about). */
export const TUTORIAL_MUSHROOM_SMASH_TEXT = "You're invincible — smash through them all!"

/** The heart phase's scripted intro: shown the instant beginTutorialPhase()
 *  docks one heart on the spot — no fall, nothing suppressed, just an
 *  honest "here's what that costs" before pointing at the HUD. Chains
 *  automatically into TUTORIAL_HEART_COLLECT_TEXT once it's had its say
 *  (see TUTORIAL_HINT_DURATION) — the healing pickup itself only spawns
 *  once that whole sequence has faded. */
export const TUTORIAL_HEART_FALL_TEXT = 'Ouch! A hit costs one heart — look at your hearts up top!'
export const TUTORIAL_HEART_COLLECT_TEXT = 'Now grab the floating heart to heal it back!'

/** How many clean release-and-launch cycles count as "practiced" before
 *  the swing phase moves on. */
export const TUTORIAL_SWING_REPS = 3

/** How far ahead (metres) a phase's teaching object is placed, relative to
 *  the player's position the instant the player's own press starts that
 *  phase (see the file header). */
export const TUTORIAL_PLACE_AHEAD_METERS = 10

/** How many monsters the stomp phase spawns together (a small cluster
 *  rather than one single target) — landing a stomp on any one of them
 *  advances the phase, so a miss on the first still leaves another right
 *  behind it instead of forcing a full relocate-and-wait. Kept modest on
 *  purpose — this is "a bit more forgiving," not "a wall of monsters." */
export const TUTORIAL_STOMP_MONSTER_COUNT = 2

/** Same idea for the mushroom phase's own pickup. */
export const TUTORIAL_MUSHROOM_COUNT = 2

/** Spacing (metres) between consecutive members of a stomp/mushroom
 *  cluster. */
export const TUTORIAL_CLUSTER_GAP_METERS = 7

/** How many monsters line the path once the mushroom's invincibility
 *  kicks in — more than the smash target itself, so there's real slack
 *  even if a few are missed or run past. */
export const TUTORIAL_MUSHROOM_WAVE_COUNT = 9

/** How many of the wave actually need smashing before the mushroom phase
 *  hands off to the heart phase — though running out of invincibility
 *  hands off regardless of the count reached (see updateTutorial()), so
 *  this is a target to aim for, never something that can strand the
 *  player mid-wave. */
export const TUTORIAL_MUSHROOM_SMASH_TARGET = 7

/** Spacing (metres) between consecutive members of the smash wave — tight
 *  enough that a straight run through the invincibility window reaches
 *  the target count comfortably. */
export const TUTORIAL_MUSHROOM_WAVE_GAP_METERS = 5

/** How far past a target (metres) counts as "missed it, relocate" — for a
 *  cluster, this means past every member of it. A missed cluster's
 *  replacement spawns the same TUTORIAL_PLACE_AHEAD_METERS ahead of
 *  wherever the player actually is once the retry note fades — never
 *  behind them, since it's a fresh spawn, not the old one dragged
 *  forward. */
export const TUTORIAL_MISS_MARGIN_METERS = 3

/** Fixed so every tutorial run opens with the same forgiving lantern ladder. */
export const TUTORIAL_SEED = 8675309

/** How long a retry (or the heart phase's scripted-intro) note stays up
 *  before it fades on its own — phase-opening notes don't use this at
 *  all, since those freeze indefinitely for the player's own press. */
export const TUTORIAL_HINT_DURATION = 4.2

/** How long the note takes to fade out once its hold time elapses. */
export const TUTORIAL_HINT_FADE = 0.6

/** How long a "Nice!" acknowledgement shows before the note switches over
 *  to the next phase's (frozen) instruction. */
export const TUTORIAL_CELEBRATE_DURATION = 1.3

/** How long the closing "you're ready" note lingers before handing off to
 *  normal play. */
export const TUTORIAL_DONE_DURATION = 2.4
