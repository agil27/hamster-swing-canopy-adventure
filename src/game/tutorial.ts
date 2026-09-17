/**
 * Tutorial script v4 — five hands-on phases (swing / stomp / mushroom /
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
 * A phase never ends in failure, only success, and never rewinds the
 * player: a heart lost mid-phase (a hit, or a hard fall) is quietly undone
 * in place, and an overshot fixed target hops forward into reach — a
 * fresh spawn, never the player pulled backward.
 *
 * Stomp and mushroom each spawn a small forgiving cluster (not just one
 * target) so a miss on the first still leaves another right behind it.
 * Landing the mushroom on top of that opens a short "smash wave" — a
 * run of monsters right on the path, free to punch through while
 * invincible, so the payoff is something to actually do, not just watch a
 * timer. The heart phase opens with a scripted fall (hook-casting is
 * briefly suppressed so the player can't dodge it) so "a hit costs one
 * heart" is something they just felt, not just read, before the pickup
 * that heals it back ever appears.
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

/** Shown instead of TUTORIAL_INSTRUCTIONS when the note reappears after a
 *  failed attempt at the same phase. The stomp one is only ever shown for
 *  an actual hit from the monster (see tutorialHitByMonster) — never for
 *  an unrelated heart loss, like a hard ground landing, that just happens
 *  to land during the same phase. The swing one is shown only for an
 *  actual fall to the ground (see tutorialGroundBounce) — the one place a
 *  ground touch itself is the thing being taught. */
export const TUTORIAL_RETRY_INSTRUCTIONS: Readonly<Partial<Record<TutorialPhase, string>>> = {
  swing: 'Oops, you touched the ground! Hold again to hook the next lantern.',
  stomp: 'Ouch! You got hit by the monster. Try again to stomp on the monster!',
  mushroom: 'Missed it — grab the next mushroom!',
  heart: 'Missed it — grab the next heart to heal up!',
}

/** Shown once, right after the mushroom is grabbed — invincibility is
 *  already running, so this note just sits and fades on its own rather
 *  than freezing anything (that would waste the window it's talking
 *  about). */
export const TUTORIAL_MUSHROOM_SMASH_TEXT = "You're invincible — smash through them all!"

/** The heart phase's scripted intro: a note shown the instant the guided
 *  fall costs (and immediately un-costs) its one heart, pointing the
 *  player at the HUD before any pickup exists to distract from it. Chains
 *  automatically into TUTORIAL_HEART_COLLECT_TEXT once it's had its say
 *  (see TUTORIAL_HINT_DURATION) — the pickup itself only spawns once that
 *  whole sequence has faded. */
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
 *  hands off to the heart phase. */
export const TUTORIAL_MUSHROOM_SMASH_TARGET = 7

/** Spacing (metres) between consecutive members of the smash wave — tight
 *  enough that a straight run through the invincibility window reaches
 *  the target count comfortably. */
export const TUTORIAL_MUSHROOM_WAVE_GAP_METERS = 5

/** How long hook-casting is suppressed at the very start of the heart
 *  phase, forcing the scripted fall (see the file header) rather than
 *  leaving it to chance that the player happens to touch the ground on
 *  their own. Comfortably longer than a real fall takes from a standing
 *  jump, so it never lingers once the fall's already happened. */
export const TUTORIAL_HEART_FALL_SUPPRESS_CAST = 2.5

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
