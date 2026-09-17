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
 * Each phase's teaching object (monster/mushroom/heart) is placed only once
 * that phase's own instruction note has had its say and faded away — never
 * upfront, and never while the note is still on screen — so reading and
 * doing never compete for the same moment, and the player can never reach
 * (or stomp) something before ever seeing what it was for. A miss follows
 * the same rule: the retry note shows first, and the target only reappears
 * once that fades too.
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
 *  to land during the same phase. */
export const TUTORIAL_RETRY_INSTRUCTIONS: Readonly<Partial<Record<TutorialPhase, string>>> = {
  swing: "Don't worry — hold again to hook the next lantern!",
  stomp: 'Ouch! You got hit by the monster. Try again to stomp on the monster!',
  mushroom: 'Missed it — grab the next mushroom!',
  heart: 'Missed it — grab the next heart to heal up!',
}

/** How many clean release-and-launch cycles count as "practiced" before
 *  the swing phase moves on. */
export const TUTORIAL_SWING_REPS = 3

/** How far ahead (metres) a phase's teaching object is placed, relative to
 *  the player's position the instant it actually spawns (once that phase's
 *  note has finished showing — see the file header). */
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

/** How much further ahead (metres), beyond the mushroom cluster's last
 *  member, the mushroom phase's bonus monster spawns — close enough to
 *  reach well within the mushroom's invincibility window, so the player
 *  can smash straight through it and actually see what the mushroom
 *  does. */
export const TUTORIAL_MUSHROOM_MONSTER_GAP_METERS = 9

/** How far past a target (metres) counts as "missed it, relocate" — for a
 *  cluster, this means past every member of it. A missed cluster's
 *  replacement spawns the same TUTORIAL_PLACE_AHEAD_METERS ahead of
 *  wherever the player actually is once the retry note fades — never
 *  behind them, since it's a fresh spawn, not the old one dragged
 *  forward. */
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
