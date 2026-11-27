import { PowerZone } from '../types/raffle';

/**
 * Pure Web Audio API synthesizer for the smart trainer sprint, tension drumroll,
 * electric Z6 surge, and winner victory fanfare (no external audio files).
 */
class RaffleSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private noiseBuffer: AudioBuffer | null = null;

  // Active sprint synth nodes
  private sprintRunning = false;
  private motorOsc1: OscillatorNode | null = null;
  private motorOsc2: OscillatorNode | null = null;
  private motorFilter: BiquadFilterNode | null = null;
  private motorGain: GainNode | null = null;
  private pulseLfo: OscillatorNode | null = null;
  private pulseDepth: GainNode | null = null;

  private lastDrumTime = 0;
  private lastSparkTime = 0;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopSprintAudio();
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.noiseBuffer && this.ctx) {
      const length = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    return this.ctx;
  }

  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.055);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playSlotTick(progress: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const safeP = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = 420 + safeP * 420;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.032);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playSlotLock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [
      { freq: 783.99, delay: 0, dur: 0.14, vol: 0.13 }, // G5
      { freq: 1046.5, delay: 0.08, dur: 0.34, vol: 0.16 }, // C6
      { freq: 1567.98, delay: 0.12, dur: 0.28, vol: 0.08 }, // G6 sparkle
    ];

    for (const n of notes) {
      const start = now + n.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(n.vol, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.03);
    }
  }

  public startSprintAudio(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.stopSprintAudio();
    const now = ctx.currentTime;

    const motorOsc1 = ctx.createOscillator();
    const motorOsc2 = ctx.createOscillator();
    const motorFilter = ctx.createBiquadFilter();
    const motorGain = ctx.createGain();
    const pulseLfo = ctx.createOscillator();
    const pulseDepth = ctx.createGain();

    motorOsc1.type = 'sawtooth';
    motorOsc2.type = 'triangle';
    motorOsc1.frequency.setValueAtTime(88, now);
    motorOsc2.frequency.setValueAtTime(132, now);

    motorFilter.type = 'lowpass';
    motorFilter.frequency.setValueAtTime(260, now);
    motorFilter.Q.setValueAtTime(4.5, now);

    // Cadence pulse LFO modulates the filter cutoff for pedaling rhythm
    pulseLfo.type = 'sine';
    pulseLfo.frequency.setValueAtTime(2.4, now);
    pulseDepth.gain.setValueAtTime(95, now);
    pulseLfo.connect(pulseDepth);
    pulseDepth.connect(motorFilter.frequency);

    motorGain.gain.setValueAtTime(0.001, now);
    motorGain.gain.linearRampToValueAtTime(0.11, now + 0.25);

    motorOsc1.connect(motorFilter);
    motorOsc2.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(ctx.destination);

    motorOsc1.start(now);
    motorOsc2.start(now);
    pulseLfo.start(now);

    this.motorOsc1 = motorOsc1;
    this.motorOsc2 = motorOsc2;
    this.motorFilter = motorFilter;
    this.motorGain = motorGain;
    this.pulseLfo = pulseLfo;
    this.pulseDepth = pulseDepth;
    this.sprintRunning = true;
    this.lastDrumTime = 0;
    this.lastSparkTime = 0;
  }

  public updateSprintTelemetry(
    watts: number,
    rpm: number,
    zone: PowerZone,
    progress: number
  ): void {
    if (!this.sprintRunning || !this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (!Number.isFinite(now)) return;

    const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    const safeWatts = Number.isFinite(watts) ? Math.max(0, Math.min(2000, watts)) : 120;
    const safeRpm = Number.isFinite(rpm) ? Math.max(30, Math.min(200, rpm)) : 70;

    // Smoothly raise trainer turbine pitch with watts & progress
    const baseFreq = 85 + Math.pow(safeProgress, 1.55) * 430 + (safeWatts / 1100) * 140;
    const filterFreq = 260 + Math.pow(safeProgress, 1.45) * 2600;
    const cadenceHz = Math.max(1.8, (safeRpm / 60) * 2);
    const pulseDepthVal = 90 + safeProgress * 420;
    const targetGain = 0.09 + safeProgress * 0.11;

    if (Number.isFinite(baseFreq)) {
      this.motorOsc1?.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.motorOsc2?.frequency.setTargetAtTime(baseFreq * 1.498, now, 0.04);
    }
    if (Number.isFinite(filterFreq)) {
      this.motorFilter?.frequency.setTargetAtTime(filterFreq, now, 0.05);
    }
    if (Number.isFinite(cadenceHz)) {
      this.pulseLfo?.frequency.setTargetAtTime(cadenceHz, now, 0.05);
    }
    if (Number.isFinite(pulseDepthVal)) {
      this.pulseDepth?.gain.setTargetAtTime(pulseDepthVal, now, 0.05);
    }
    if (Number.isFinite(targetGain)) {
      this.motorGain?.gain.setTargetAtTime(targetGain, now, 0.05);
    }

    // Escalating tension drumroll from Z3 onward
    if (safeProgress >= 0.22) {
      const drumInterval = Math.max(0.052, 0.23 - safeProgress * 0.185);
      if (now - this.lastDrumTime >= drumInterval) {
        this.lastDrumTime = now;
        this.triggerSnareHit(0.05 + safeProgress * 0.14, 950 + safeProgress * 1500);
      }
    }

    // Electric plasma crackle ticks during Z6 MAX sprint
    if (zone === 6 && now - this.lastSparkTime >= 0.085) {
      this.lastSparkTime = now;
      this.triggerElectricZap();
    }
  }

  private triggerSnareHit(volume: number, bandFreq: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(bandFreq, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    // Subtle snare body thump
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(185, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(90, now + 0.04);
    bodyGain.gain.setValueAtTime(volume * 0.65, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.ctx.destination);

    src.start(now, Math.random() * 0.6, 0.06);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.05);
  }

  private triggerElectricZap(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const startFreq = 1200 + Math.random() * 1400;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public stopSprintAudio(): void {
    this.sprintRunning = false;
    const now = this.ctx?.currentTime ?? 0;

    const osc1 = this.motorOsc1;
    const osc2 = this.motorOsc2;
    const lfo = this.pulseLfo;
    const gain = this.motorGain;
    const filter = this.motorFilter;
    const depth = this.pulseDepth;

    this.motorOsc1 = null;
    this.motorOsc2 = null;
    this.motorFilter = null;
    this.motorGain = null;
    this.pulseLfo = null;
    this.pulseDepth = null;

    if (!osc1 && !osc2 && !lfo && !gain) return;

    try {
      if (gain && this.ctx) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      }
      const stopAt = now + 0.06;
      osc1?.stop(stopAt);
      osc2?.stop(stopAt);
      lfo?.stop(stopAt);

      window.setTimeout(() => {
        try {
          osc1?.disconnect();
          osc2?.disconnect();
          lfo?.disconnect();
          depth?.disconnect();
          filter?.disconnect();
          gain?.disconnect();
        } catch {
          // ignore disconnect errors
        }
      }, 100);
    } catch {
      try {
        osc1?.disconnect();
        osc2?.disconnect();
        lfo?.disconnect();
        gain?.disconnect();
      } catch {
        // ignore fallback disconnect errors
      }
    }
  }

  public playVictoryFanfare(): void {
    this.stopSprintAudio();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. FTP Explosion sub-bass impact + noise burst
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(160, now);
    boomOsc.frequency.exponentialRampToValueAtTime(34, now + 0.42);
    boomGain.gain.setValueAtTime(0.36, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(now);
    boomOsc.stop(now + 0.5);

    if (this.noiseBuffer) {
      const crashSrc = ctx.createBufferSource();
      crashSrc.buffer = this.noiseBuffer;
      const crashFilter = ctx.createBiquadFilter();
      crashFilter.type = 'highpass';
      crashFilter.frequency.setValueAtTime(1400, now);
      const crashGain = ctx.createGain();
      crashGain.gain.setValueAtTime(0.22, now);
      crashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      crashSrc.connect(crashFilter);
      crashFilter.connect(crashGain);
      crashGain.connect(ctx.destination);
      crashSrc.start(now, 0, 0.8);
    }

    // 2. Triumphant brass-like fanfare melody (C5 -> E5 -> G5 -> C6) + celebratory chord
    const melody: { freq: number; delay: number; dur: number; vol: number }[] = [
      { freq: 523.25, delay: 0.04, dur: 0.16, vol: 0.16 }, // C5
      { freq: 659.25, delay: 0.16, dur: 0.16, vol: 0.16 }, // E5
      { freq: 783.99, delay: 0.28, dur: 0.18, vol: 0.17 }, // G5
      { freq: 1046.5, delay: 0.42, dur: 0.95, vol: 0.2 }, // C6 hero note
      // Supporting triumph chord at 0.42s
      { freq: 523.25, delay: 0.42, dur: 0.9, vol: 0.12 }, // C5
      { freq: 659.25, delay: 0.42, dur: 0.9, vol: 0.12 }, // E5
      { freq: 783.99, delay: 0.42, dur: 0.9, vol: 0.12 }, // G5
      // Sparkle top chime
      { freq: 1567.98, delay: 0.52, dur: 0.55, vol: 0.07 }, // G6
      { freq: 2093.0, delay: 0.62, dur: 0.65, vol: 0.06 }, // C7
    ];

    for (const note of melody) {
      const start = now + note.delay;
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      subOsc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, start);
      subOsc.frequency.setValueAtTime(note.freq * 0.5, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(note.freq * 3.8, start);
      filter.frequency.exponentialRampToValueAtTime(note.freq * 1.6, start + note.dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(note.vol, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.dur);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      subOsc.start(start);
      osc.stop(start + note.dur + 0.04);
      subOsc.stop(start + note.dur + 0.04);
    }
  }
}

export const soundEngine = new RaffleSoundEngine();
