/**
 * Fully procedural audio for Hamster Swing — no sample files anywhere.
 *
 * Everything is synthesised with oscillators, a shared noise buffer and gain
 * envelopes. The music is a four-bar major-key loop driven by a lookahead
 * scheduler so it stays in time even when the render loop stutters.
 */

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.14
const BPM = 122
const STEPS_PER_BAR = 16
const SECONDS_PER_STEP = 60 / BPM / 4 // 16th notes

type Osc = OscillatorType

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

interface MelodyNote {
  /** 16th-note step within the bar. */
  s: number
  /** MIDI note number. */
  n: number
  /** Length in 16th-note steps. */
  d: number
}

/** Four-bar loop over I – V – vi – IV in C major. */
const BASS_LINE = [36, 31, 33, 29]
const CHORDS: number[][] = [
  [60, 64, 67],
  [59, 62, 67],
  [57, 60, 64],
  [53, 57, 60],
]
const MELODY: MelodyNote[][] = [
  [
    { s: 0, n: 76, d: 3 },
    { s: 4, n: 79, d: 3 },
    { s: 8, n: 76, d: 2 },
    { s: 10, n: 74, d: 2 },
    { s: 12, n: 72, d: 4 },
  ],
  [
    { s: 0, n: 74, d: 3 },
    { s: 4, n: 79, d: 3 },
    { s: 8, n: 77, d: 2 },
    { s: 10, n: 76, d: 2 },
    { s: 12, n: 74, d: 4 },
  ],
  [
    { s: 0, n: 72, d: 3 },
    { s: 4, n: 76, d: 3 },
    { s: 8, n: 81, d: 3 },
    { s: 12, n: 79, d: 4 },
  ],
  [
    { s: 0, n: 77, d: 3 },
    { s: 4, n: 76, d: 3 },
    { s: 8, n: 74, d: 6 },
    { s: 14, n: 67, d: 2 },
  ],
]

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private noise: AudioBuffer | null = null

  private timer: number | null = null
  private nextStepTime = 0
  private step = 0
  private musicRunning = false

  muted = false
  /** Lifts while a power-up is active so the loop feels more urgent. */
  private musicIntensity = 1

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Must be called from a user gesture the first time round. */
  unlock() {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const ctx = new Ctor()
      this.ctx = ctx

      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : 0.9
      master.connect(ctx.destination)

      const music = ctx.createGain()
      music.gain.value = 0.34
      music.connect(master)

      const sfx = ctx.createGain()
      sfx.gain.value = 0.85
      sfx.connect(master)

      this.master = master
      this.musicBus = music
      this.sfxBus = sfx
      this.noise = this.buildNoise(ctx)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private buildNoise(ctx: AudioContext) {
    const len = Math.floor(ctx.sampleRate * 1.2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, t, 0.05)
    }
  }

  setIntensity(v: number) {
    this.musicIntensity = v
  }

  dispose() {
    this.stopMusic()
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }

  // -------------------------------------------------------------------------
  // Synth primitives
  // -------------------------------------------------------------------------

  private tone(opts: {
    freq: number
    time: number
    dur: number
    type?: Osc
    gain?: number
    bus?: GainNode | null
    /** Target frequency for a glide. */
    slideTo?: number
    attack?: number
    detune?: number
    filter?: number
  }) {
    const ctx = this.ctx
    if (!ctx) return
    const bus = opts.bus ?? this.sfxBus
    if (!bus) return

    const t = Math.max(opts.time, ctx.currentTime)
    const dur = opts.dur
    const osc = ctx.createOscillator()
    osc.type = opts.type ?? 'triangle'
    osc.frequency.setValueAtTime(opts.freq, t)
    if (opts.slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t + dur)
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, t)

    const g = ctx.createGain()
    const peak = opts.gain ?? 0.2
    const atk = opts.attack ?? 0.008
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    let tail: AudioNode = g
    if (opts.filter) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(opts.filter, t)
      g.connect(f)
      tail = f
    }

    osc.connect(g)
    tail.connect(bus)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  private noiseBurst(opts: {
    time: number
    dur: number
    gain?: number
    type?: BiquadFilterType
    freq?: number
    q?: number
    sweepTo?: number
  }) {
    const ctx = this.ctx
    if (!ctx || !this.noise || !this.sfxBus) return
    const t = Math.max(opts.time, ctx.currentTime)

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.8 + Math.random() * 0.5

    const filter = ctx.createBiquadFilter()
    filter.type = opts.type ?? 'bandpass'
    filter.frequency.setValueAtTime(opts.freq ?? 1200, t)
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo), t + opts.dur)
    filter.Q.value = opts.q ?? 1.2

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.18, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)

    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxBus)
    src.start(t)
    src.stop(t + opts.dur + 0.05)
  }

  private get now() {
    return this.ctx?.currentTime ?? 0
  }

  // -------------------------------------------------------------------------
  // Sound effects
  // -------------------------------------------------------------------------

  /** Rope shooting out — a rising whip whoosh. */
  hookShoot() {
    const t = this.now
    this.noiseBurst({ time: t, dur: 0.22, gain: 0.13, type: 'bandpass', freq: 500, sweepTo: 2600, q: 0.9 })
    this.tone({ freq: 320, time: t, dur: 0.16, type: 'sine', gain: 0.1, slideTo: 880 })
  }

  /** Hook grabs a lantern — a satisfying little clunk. */
  hookAttach() {
    const t = this.now
    this.tone({ freq: 660, time: t, dur: 0.1, type: 'square', gain: 0.07, filter: 2200 })
    this.tone({ freq: 990, time: t + 0.02, dur: 0.14, type: 'sine', gain: 0.1 })
  }

  /** Release — a downward whoosh plus a launch thump. */
  hookRelease(speed01 = 0.5) {
    const t = this.now
    this.noiseBurst({ time: t, dur: 0.26, gain: 0.12, type: 'bandpass', freq: 2400, sweepTo: 420, q: 0.8 })
    this.tone({
      freq: 200 + speed01 * 180,
      time: t,
      dur: 0.2,
      type: 'triangle',
      gain: 0.16,
      slideTo: 520 + speed01 * 420,
    })
  }

  /** Sunflower seed pickup — pitch rises with the combo chain. */
  seed(chain = 0) {
    const t = this.now
    const base = midi(76 + Math.min(chain, 10))
    this.tone({ freq: base, time: t, dur: 0.11, type: 'triangle', gain: 0.17 })
    this.tone({ freq: base * 2, time: t + 0.03, dur: 0.12, type: 'sine', gain: 0.1 })
  }

  /** Heart pickup — soft sparkling chime. */
  heart() {
    const t = this.now
    const notes = [72, 76, 79, 84]
    notes.forEach((n, i) => {
      this.tone({ freq: midi(n), time: t + i * 0.055, dur: 0.34, type: 'sine', gain: 0.16 })
      this.tone({ freq: midi(n + 12), time: t + i * 0.055, dur: 0.24, type: 'triangle', gain: 0.05 })
    })
  }

  /** Magic mushroom — a bright ascending power-up jingle. */
  mushroom() {
    const t = this.now
    const run = [60, 64, 67, 72, 76, 79, 84]
    run.forEach((n, i) => {
      this.tone({ freq: midi(n), time: t + i * 0.052, dur: 0.2, type: 'square', gain: 0.1, filter: 3200 })
      this.tone({ freq: midi(n + 7), time: t + i * 0.052, dur: 0.22, type: 'sine', gain: 0.09 })
    })
    this.tone({ freq: midi(88), time: t + run.length * 0.052, dur: 0.6, type: 'sine', gain: 0.14 })
  }

  /** Cartoon squish when a monster gets flattened. */
  stomp() {
    const t = this.now
    this.noiseBurst({ time: t, dur: 0.16, gain: 0.2, type: 'lowpass', freq: 1600, sweepTo: 260 })
    this.tone({ freq: 420, time: t, dur: 0.17, type: 'sine', gain: 0.2, slideTo: 90 })
    this.tone({ freq: 880, time: t + 0.05, dur: 0.16, type: 'triangle', gain: 0.1, slideTo: 1500 })
  }

  /** Combo tier up — a quick bright flourish. */
  comboUp(level: number) {
    const t = this.now
    const root = 72 + Math.min(level, 6) * 2
    ;[0, 4, 7].forEach((iv, i) =>
      this.tone({ freq: midi(root + iv), time: t + i * 0.04, dur: 0.22, type: 'triangle', gain: 0.13 }),
    )
  }

  /** Taking damage — a grumpy descending thud. */
  hurt() {
    const t = this.now
    this.tone({ freq: 300, time: t, dur: 0.3, type: 'sawtooth', gain: 0.14, slideTo: 80, filter: 900 })
    this.tone({ freq: 150, time: t, dur: 0.34, type: 'square', gain: 0.1, slideTo: 60, filter: 600 })
    this.noiseBurst({ time: t, dur: 0.2, gain: 0.12, type: 'lowpass', freq: 800, sweepTo: 150 })
  }

  /** Emergency trampoline cushion — cartoon spring boing. */
  groundBounce() {
    const t = this.now
    this.tone({ freq: 140, time: t, dur: 0.38, type: 'triangle', gain: 0.2, slideTo: 620 })
    this.tone({ freq: 280, time: t + 0.04, dur: 0.3, type: 'sine', gain: 0.12, slideTo: 1100 })
    this.noiseBurst({ time: t, dur: 0.12, gain: 0.08, type: 'bandpass', freq: 900, q: 2 })
  }

  /** Bumping a monster while invincible — crunchy smash. */
  smash() {
    const t = this.now
    this.noiseBurst({ time: t, dur: 0.22, gain: 0.22, type: 'bandpass', freq: 2200, sweepTo: 500, q: 0.7 })
    this.tone({ freq: 520, time: t, dur: 0.2, type: 'sawtooth', gain: 0.14, slideTo: 140, filter: 1800 })
  }

  /** Crash tumble as the last heart goes. */
  crash() {
    const t = this.now
    for (let i = 0; i < 5; i++) {
      this.tone({
        freq: 400 - i * 55,
        time: t + i * 0.09,
        dur: 0.2,
        type: 'square',
        gain: 0.1,
        slideTo: 120 - i * 15,
        filter: 1200,
      })
    }
    this.noiseBurst({ time: t, dur: 0.6, gain: 0.14, type: 'lowpass', freq: 1400, sweepTo: 120 })
  }

  /** Settlement chime. */
  gameOver() {
    const t = this.now
    const fall = [72, 69, 65, 60]
    fall.forEach((n, i) =>
      this.tone({ freq: midi(n), time: t + i * 0.17, dur: 0.5, type: 'triangle', gain: 0.15 }),
    )
  }

  /** New best — a proper little fanfare. */
  highScoreFanfare() {
    const t = this.now
    const fan: Array<[number, number]> = [
      [67, 0],
      [72, 0.11],
      [76, 0.22],
      [79, 0.33],
      [84, 0.46],
    ]
    for (const [n, dt] of fan) {
      this.tone({ freq: midi(n), time: t + dt, dur: 0.42, type: 'square', gain: 0.1, filter: 3000 })
      this.tone({ freq: midi(n), time: t + dt, dur: 0.5, type: 'triangle', gain: 0.12 })
    }
    this.tone({ freq: midi(84), time: t + 0.6, dur: 1.1, type: 'sine', gain: 0.16 })
    this.tone({ freq: midi(88), time: t + 0.6, dur: 1.1, type: 'triangle', gain: 0.08 })
  }

  uiClick() {
    this.tone({ freq: 660, time: this.now, dur: 0.07, type: 'triangle', gain: 0.12 })
  }

  // -------------------------------------------------------------------------
  // Music loop
  // -------------------------------------------------------------------------

  startMusic() {
    if (!this.ctx || this.musicRunning) return
    this.musicRunning = true
    this.step = 0
    this.nextStepTime = this.ctx.currentTime + 0.08
    this.timer = window.setInterval(() => this.scheduler(), LOOKAHEAD_MS)
  }

  stopMusic() {
    this.musicRunning = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private scheduler() {
    const ctx = this.ctx
    if (!ctx || !this.musicRunning) return
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.step, this.nextStepTime)
      this.nextStepTime += SECONDS_PER_STEP
      this.step = (this.step + 1) % (STEPS_PER_BAR * 4)
    }
  }

  private scheduleStep(step: number, time: number) {
    const bus = this.musicBus
    if (!bus) return
    const bar = Math.floor(step / STEPS_PER_BAR)
    const beatStep = step % STEPS_PER_BAR
    const intensity = this.musicIntensity

    // Bass on the downbeat and the "and" of 3.
    if (beatStep === 0 || beatStep === 10) {
      this.tone({
        freq: midi(BASS_LINE[bar]),
        time,
        dur: beatStep === 0 ? 0.42 : 0.24,
        type: 'triangle',
        gain: 0.26,
        bus,
        filter: 700,
      })
    }

    // Chord pad on beats 1 and 3, quiet and round.
    if (beatStep === 0 || beatStep === 8) {
      for (const n of CHORDS[bar]) {
        this.tone({ freq: midi(n), time, dur: 0.7, type: 'sine', gain: 0.055, bus, attack: 0.05 })
      }
    }

    // Eighth-note arpeggio sparkle.
    if (beatStep % 2 === 0) {
      const chord = CHORDS[bar]
      const n = chord[(beatStep / 2) % chord.length] + 12
      this.tone({ freq: midi(n), time, dur: 0.16, type: 'triangle', gain: 0.05 * intensity, bus })
    }

    // Lead melody.
    for (const note of MELODY[bar]) {
      if (note.s === beatStep) {
        const dur = note.d * SECONDS_PER_STEP * 0.92
        this.tone({ freq: midi(note.n), time, dur, type: 'triangle', gain: 0.15, bus, attack: 0.015 })
        this.tone({ freq: midi(note.n), time, dur, type: 'square', gain: 0.035, bus, filter: 2400, detune: 6 })
      }
    }

    // Light percussion: soft kick on 1 and 3, shaker on every off-beat.
    if (beatStep === 0 || beatStep === 8) {
      this.tone({ freq: 150, time, dur: 0.16, type: 'sine', gain: 0.2, slideTo: 48, bus })
    }
    if (beatStep % 4 === 2) {
      const ctx = this.ctx
      if (ctx && this.noise) {
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        src.playbackRate.value = 1.6
        const f = ctx.createBiquadFilter()
        f.type = 'highpass'
        f.frequency.value = 6500
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, time)
        g.gain.exponentialRampToValueAtTime(0.045 * intensity, time + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.07)
        src.connect(f)
        f.connect(g)
        g.connect(bus)
        src.start(time)
        src.stop(time + 0.12)
      }
    }
  }
}

export const audio = new AudioEngine()
