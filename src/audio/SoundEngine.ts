/**
 * Procedural audio engine using Web Audio API.
 * Generates ambient ocean sounds, impact effects, and atmospheric audio.
 */

export class SoundEngine {
    private audioContext: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private ambientGain: GainNode | null = null;
    private isInitialized = false;

    // Ambient oscillators and nodes
    private ambientNodes: AudioNode[] = [];
    private depthFilter: BiquadFilterNode | null = null;

    // Current depth for audio modulation
    private currentDepth = 0;
    private maxDepth = 10000;

    /**
     * Initialize the audio context (must be called after user interaction).
     */
    async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.audioContext = new AudioContext();

            // Master gain - LOUDER
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.7;
            this.masterGain.connect(this.audioContext.destination);

            // Ambient gain - LOUDER
            this.ambientGain = this.audioContext.createGain();
            this.ambientGain.gain.value = 0.4;
            this.ambientGain.connect(this.masterGain);

            // Depth-responsive lowpass filter (deeper = more muffled)
            this.depthFilter = this.audioContext.createBiquadFilter();
            this.depthFilter.type = 'lowpass';
            this.depthFilter.frequency.value = 2000;
            this.depthFilter.Q.value = 1;
            this.depthFilter.connect(this.ambientGain);

            // Start ambient sounds
            this.createAmbientSounds();

            this.isInitialized = true;
        } catch (e) {
            console.warn('Audio initialization failed:', e);
        }
    }

    /**
     * Create the ambient underwater soundscape.
     */
    private createAmbientSounds(): void {
        if (!this.audioContext || !this.depthFilter) return;

        // Deep rumble - low frequency oscillator
        const rumbleOsc = this.audioContext.createOscillator();
        rumbleOsc.type = 'sine';
        rumbleOsc.frequency.value = 40;

        const rumbleGain = this.audioContext.createGain();
        rumbleGain.gain.value = 0.3;

        // LFO to modulate the rumble
        const rumbleLFO = this.audioContext.createOscillator();
        rumbleLFO.type = 'sine';
        rumbleLFO.frequency.value = 0.1;
        const rumbleLFOGain = this.audioContext.createGain();
        rumbleLFOGain.gain.value = 10;
        rumbleLFO.connect(rumbleLFOGain);
        rumbleLFOGain.connect(rumbleOsc.frequency);

        rumbleOsc.connect(rumbleGain);
        rumbleGain.connect(this.depthFilter);
        rumbleOsc.start();
        rumbleLFO.start();

        this.ambientNodes.push(rumbleOsc, rumbleLFO);

        // Water movement - filtered noise
        const noiseBuffer = this.createNoiseBuffer(2);
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const noiseFilter = this.audioContext.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 400;
        noiseFilter.Q.value = 0.5;

        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.value = 0.08;

        // LFO for noise panning/movement
        const noiseLFO = this.audioContext.createOscillator();
        noiseLFO.type = 'sine';
        noiseLFO.frequency.value = 0.05;
        const noiseLFOGain = this.audioContext.createGain();
        noiseLFOGain.gain.value = 200;
        noiseLFO.connect(noiseLFOGain);
        noiseLFOGain.connect(noiseFilter.frequency);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.depthFilter);
        noiseSource.start();
        noiseLFO.start();

        // Occasional bubbles/clicks
        this.scheduleBubbles();

        // Whale-like sounds (very occasional)
        this.scheduleWhale();
    }

    /**
     * Create a buffer of white noise.
     */
    private createNoiseBuffer(duration: number): AudioBuffer {
        if (!this.audioContext) throw new Error('No audio context');

        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        return buffer;
    }

    /**
     * Schedule random bubble sounds.
     */
    private scheduleBubbles(): void {
        if (!this.audioContext || !this.isInitialized) return;

        const delay = 2000 + Math.random() * 5000;

        setTimeout(() => {
            this.playBubble();
            this.scheduleBubbles();
        }, delay);
    }

    /**
     * Play a bubble sound.
     */
    private playBubble(): void {
        if (!this.audioContext || !this.ambientGain) return;

        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 800 + Math.random() * 1200;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.02 + Math.random() * 0.03;

        osc.connect(gain);
        gain.connect(this.ambientGain);

        const now = this.audioContext.currentTime;
        osc.frequency.exponentialRampToValueAtTime(osc.frequency.value * 1.5, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * Schedule whale-like ambient sounds.
     */
    private scheduleWhale(): void {
        if (!this.audioContext || !this.isInitialized) return;

        const delay = 15000 + Math.random() * 30000;

        setTimeout(() => {
            if (this.currentDepth > 1000) {
                this.playWhale();
            }
            this.scheduleWhale();
        }, delay);
    }

    /**
     * Play a whale-like sound.
     */
    private playWhale(): void {
        if (!this.audioContext || !this.ambientGain) return;

        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';

        const startFreq = 100 + Math.random() * 100;
        osc.frequency.value = startFreq;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);

        const now = this.audioContext.currentTime;
        const duration = 2 + Math.random() * 2;

        // Whale call envelope
        gain.gain.linearRampToValueAtTime(0.05, now + 0.3);
        gain.gain.linearRampToValueAtTime(0.03, now + duration * 0.5);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        // Frequency modulation
        osc.frequency.linearRampToValueAtTime(startFreq * 1.5, now + duration * 0.3);
        osc.frequency.linearRampToValueAtTime(startFreq * 0.8, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Update audio based on current depth.
     */
    updateDepth(depth: number): void {
        this.currentDepth = depth;

        if (!this.depthFilter || !this.audioContext) return;

        // Lower filter frequency as we go deeper (more muffled)
        const normalizedDepth = Math.min(depth / this.maxDepth, 1);
        const filterFreq = 2000 - normalizedDepth * 1500; // 2000Hz -> 500Hz

        this.depthFilter.frequency.linearRampToValueAtTime(
            filterFreq,
            this.audioContext.currentTime + 0.1
        );
    }

    /**
     * Play collision/impact sound.
     */
    playImpact(intensity: 'light' | 'heavy' = 'light'): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // Impact thump
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = intensity === 'heavy' ? 60 : 100;

        const gain = this.audioContext.createGain();
        gain.gain.value = intensity === 'heavy' ? 0.4 : 0.25;

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);

        // Metal creak/stress sound
        const creakOsc = this.audioContext.createOscillator();
        creakOsc.type = 'sawtooth';
        creakOsc.frequency.value = 200 + Math.random() * 300;

        const creakGain = this.audioContext.createGain();
        creakGain.gain.value = 0.08;

        const creakFilter = this.audioContext.createBiquadFilter();
        creakFilter.type = 'bandpass';
        creakFilter.frequency.value = 800;
        creakFilter.Q.value = 5;

        creakOsc.connect(creakFilter);
        creakFilter.connect(creakGain);
        creakGain.connect(this.masterGain);

        creakOsc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        creakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        creakOsc.start(now + 0.05);
        creakOsc.stop(now + 0.4);

        // Echo after delay
        setTimeout(() => this.playEcho(), 300 + Math.random() * 200);
    }

    /**
     * Play echo effect.
     */
    private playEcho(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // Muffled echo
        const noiseBuffer = this.createNoiseBuffer(0.1);
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.05;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        noise.start(now);
        noise.stop(now + 0.3);
    }

    /**
     * Play ascent/escape sound.
     */
    playAscent(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // Rushing water/bubbles
        const noiseBuffer = this.createNoiseBuffer(1);
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 500;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.15;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        filter.frequency.linearRampToValueAtTime(2000, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1);

        noise.start(now);
        noise.stop(now + 1);

        // Alarm-like beep
        const beep = this.audioContext.createOscillator();
        beep.type = 'square';
        beep.frequency.value = 800;

        const beepGain = this.audioContext.createGain();
        beepGain.gain.value = 0.1;

        beep.connect(beepGain);
        beepGain.connect(this.masterGain);

        beepGain.gain.setValueAtTime(0.1, now);
        beepGain.gain.setValueAtTime(0, now + 0.1);
        beepGain.gain.setValueAtTime(0.1, now + 0.2);
        beepGain.gain.setValueAtTime(0, now + 0.3);
        beepGain.gain.setValueAtTime(0.1, now + 0.4);
        beepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        beep.start(now);
        beep.stop(now + 0.6);
    }

    /**
     * Play death/implosion sound.
     */
    playDeath(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // Deep implosion boom
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 80;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.5;

        const distortion = this.audioContext.createWaveShaper();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        distortion.curve = this.makeDistortionCurve(50) as any;

        osc.connect(distortion);
        distortion.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.start(now);
        osc.stop(now + 0.8);

        // Metal crunching
        const crunchBuffer = this.createNoiseBuffer(0.5);
        const crunch = this.audioContext.createBufferSource();
        crunch.buffer = crunchBuffer;

        const crunchFilter = this.audioContext.createBiquadFilter();
        crunchFilter.type = 'bandpass';
        crunchFilter.frequency.value = 200;
        crunchFilter.Q.value = 2;

        const crunchGain = this.audioContext.createGain();
        crunchGain.gain.value = 0.2;

        crunch.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.masterGain);

        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        crunch.start(now);
        crunch.stop(now + 0.5);
    }

    /**
     * Play victory/escape sound.
     */
    playVictory(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // Rising tone
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 400;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.2;

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.2, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.start(now);
        osc.stop(now + 0.8);

        // Second tone (harmony)
        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 500;

        const gain2 = this.audioContext.createGain();
        gain2.gain.value = 0.15;

        osc2.connect(gain2);
        gain2.connect(this.masterGain);

        osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
        gain2.gain.setValueAtTime(0.15, now + 0.3);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc2.start(now + 0.1);
        osc2.stop(now + 0.8);
    }

    /**
     * Create a distortion curve.
     */
    private makeDistortionCurve(amount: number): Float32Array {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }

        return curve as Float32Array<ArrayBuffer>;
    }

    /**
     * Set master volume.
     */
    setVolume(volume: number): void {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Stop all audio.
     */
    stop(): void {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
    }
}

// Singleton instance
export const soundEngine = new SoundEngine();
