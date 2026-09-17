/**
 * Tutorial script v3 — four hands-on phases, each with a canvas-drawn
 * handwritten instruction (no arrow, no modal — just a note).
 *
 * Gameplay is never frozen: an instruction note appears, sits for a few
 * seconds, then fades on its own so it never sits in the way of actually
 * playing. It only comes back if the player fails the thing it was
 * teaching — a miss, a hit, a fumbled swing — so repeat readers see it as
 * many times as they need and everyone else just gets on with it. A
 * success shows a brief "Nice!" note in the same spot before the next
 * phase's instruction (also auto-fading) takes over.
 *
 * Pacing is otherwise entirely forgiving: a failure inside a phase just
 * revives the player in place (undoing the hit, no rewind) and lets them
 * keep going — the target itself hops back into reach if they overshoot
 * it, rather than the player ever being sent backward.
 *
 * Each phase's teaching object (monster/mushroom/heart) is placed only the
 * instant that phase begins — never upfront — so nothing shows up before
 * it's actually relevant.
 */
export type TutorialPhase = 'swing' | 'stomp' | 'mushroom' | 'heart' | 'done'

export const TUTORIAL_PHASES: readonly TutorialPhase[] = ['swing', 'stomp', 'mushroom', 'heart', 'done']

export const TUTORIAL_INSTRUCTIONS: Readonly<Record<TutorialPhase, string>> = {
  swing: 'Hold to hook the lantern, then let go to swing!',
  stomp: 'Land ON TOP of it for a STOMP!',
  mushroom: 'Grab the mushroom — invincible for a few seconds!',
  heart: 'These are your hearts — hits cost one, floating hearts heal you!',
  done: "You've got it — good luck out there!",
}

/** Shown instead of TUTORIAL_INSTRUCTIONS when the note reappears after a
 *  failed attempt at the same phase. */
export const TUTORIAL_RETRY_INSTRUCTIONS: Readonly<Partial<Record<TutorialPhase, string>>> = {
  swing: "Don't worry — hold again to hook the next lantern!",
  stomp: 'Ouch! Line up above it and land on TOP this time.',
  mushroom: 'Missed it — grab the next mushroom!',
  heart: 'Missed it — grab the next heart to heal up!',
}

/** How many clean release-and-launch cycles count as "practiced" before
 *  the swing phase moves on. */
export const TUTORIAL_SWING_REPS = 3

/** How far ahead (metres) a phase's teaching object is placed, relative to
 *  the player's position the instant that phase begins. */
export const TUTORIAL_PLACE_AHEAD_METERS = 10

/** How far ahead (metres) a missed target hops forward to stay reachable,
 *  rather than ever pulling the player backward to retry. */
export const TUTORIAL_RELOCATE_METERS = 16
/** How far past a target (metres) counts as "missed it, relocate". */
export const TUTORIAL_MISS_MARGIN_METERS = 3

/** Fixed so every tutorial run opens with the same forgiving lantern ladder. */
export const TUTORIAL_SEED = 8675309

/** How long an instruction (or retry) note stays up before it fades. */
export const TUTORIAL_HINT_DURATION = 4.2

/** How long the note takes to fade out once its hold time elapses. */
export const TUTORIAL_HINT_FADE = 0.6

/** How long a "Nice!" acknowledgement shows before the note switches over
 *  to the next phase's instruction. */
export const TUTORIAL_CELEBRATE_DURATION = 1.3

/** How long the closing "you're ready" note lingers before handing off to
 *  normal play. */
export const TUTORIAL_DONE_DURATION = 2.4
