export class GameAudio {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.musicStep = 0;
    this.lastBeat = -1;
  }
  start() {
    this.context ??= new AudioContext();
    this.context.resume();
  }
  tone(frequency, duration = 0.15, level = 0.1, type = "sine") {
    const c = this.context;
    if (!c || !this.settings.volume) return;
    const osc = c.createOscillator(),
      gain = c.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(
      Math.max(0.001, this.settings.volume * level),
      c.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }
  cue(name) {
    const tones = {
      mote_picked: [880, 0.09],
      lantern_lit: [659, 0.6],
      pulse: [330, 0.3],
      player_hit: [147, 0.25],
      jump: [440, 0.12],
      dash: [1047, 0.1],
      won: [784, 0.7],
      lost: [196, 0.7],
      shade_spawned: [110, 0.35],
      countdown: [587, 0.12],
      wind: [220, 0.45],
      charm_picked: [1175, 0.35],
      drifter_steal: [233, 0.15],
      drifter_drop: [698, 0.2],
    };
    if (tones[name]) this.tone(...tones[name]);
  }
  music(simTick) {
    const beat = Math.floor(simTick / 90);
    if (beat === this.lastBeat) return;
    this.lastBeat = beat;
    const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    this.tone(melody[beat % 8] / 2, 1.8, 0.035);
    this.tone(melody[(beat + 2) % 8], 1.4, 0.018);
  }
}
