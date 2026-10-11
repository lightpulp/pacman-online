export const SOUND_NAMES = [
  'game_start',
  'pacman_eating',
  'power_pellet',
  'ghost_eaten',
  'pacman_dying',
  'game_end',
  'game_win',
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

// Fallback beeps used when /public/sounds/<name>.mp3 does not exist: [frequency Hz, seconds]
const SYNTH: Record<SoundName, { type: OscillatorType; notes: [number, number][] }> = {
  game_start: { type: 'square', notes: [[262, 0.12], [330, 0.12], [392, 0.12], [523, 0.2], [392, 0.12], [523, 0.3]] },
  pacman_eating: { type: 'triangle', notes: [[440, 0.05], [330, 0.05]] },
  power_pellet: { type: 'sawtooth', notes: [[200, 0.08], [300, 0.08], [400, 0.08], [600, 0.12]] },
  ghost_eaten: { type: 'square', notes: [[400, 0.06], [600, 0.06], [800, 0.06], [1000, 0.1]] },
  pacman_dying: { type: 'sawtooth', notes: [[700, 0.12], [600, 0.12], [500, 0.12], [400, 0.12], [300, 0.12], [200, 0.12], [120, 0.25]] },
  game_end: { type: 'square', notes: [[330, 0.25], [262, 0.25], [196, 0.25], [131, 0.5]] },
  game_win: { type: 'square', notes: [[392, 0.12], [523, 0.12], [659, 0.12], [784, 0.2], [659, 0.12], [784, 0.4]] },
};

class SoundManager {
  muted = false;
  private ready = false;
  private ctx: AudioContext | null = null;
  private audio: Partial<Record<SoundName, HTMLAudioElement>> = {};
  private failed = new Set<SoundName>();
  private last: Partial<Record<SoundName, number>> = {};

  private init() {
    if (this.ready || typeof window === 'undefined') return;
    this.ready = true;
    for (const n of SOUND_NAMES) {
      const a = new Audio(`/sounds/${n}.mp3`);
      a.preload = 'auto';
      a.addEventListener('error', () => this.failed.add(n));
      this.audio[n] = a;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) this.ctx = new AC();
  }

  /** Call from a tap/click handler. Mobile browsers block audio until then. */
  unlock() {
    this.init();
    void this.ctx?.resume();
    for (const n of SOUND_NAMES) {
      const a = this.audio[n];
      if (!a || this.failed.has(n)) continue;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        })
        .catch(() => {
          a.muted = false;
        });
    }
  }

  play(name: SoundName) {
    if (this.muted) return;
    this.init();
    const now = performance.now();
    const minGap = name === 'pacman_eating' ? 90 : 0;
    if (now - (this.last[name] ?? 0) < minGap) return;
    this.last[name] = now;

    const a = this.audio[name];
    if (a && !this.failed.has(name)) {
      a.currentTime = 0;
      a.play().catch(() => this.synth(name));
      return;
    }
    this.synth(name);
  }

  private synth(name: SoundName) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { type, notes } = SYNTH[name];
    let t = ctx.currentTime;
    for (const [freq, dur] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  }
}

export const sound = new SoundManager();
