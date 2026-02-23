import type { PlaybackRequest, SoundCategory, SoundDefinition } from '../../core/types';
import { AudioMixer } from './AudioMixer';

interface ActiveStrokeSession {
  soundId: string;
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode: PannerNode;
}

interface ActiveBgmSession {
  soundId: string;
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
}

/**
 * HRTF-based audio engine that spatializes ASMR sounds in 3D.
 */
export class SpatialAudioEngine {
  private audioContext: AudioContext | null = null;
  private readonly mixer: AudioMixer;
  private masterGainNode: GainNode | null = null;
  private readonly bufferCache: Map<string, AudioBuffer>;
  private activeStrokeSession: ActiveStrokeSession | null = null;
  private activeBgmSession: ActiveBgmSession | null = null;

  /**
   * Creates a new spatial engine instance.
   *
   * @returns {void} This constructor does not return a value.
   * @throws {Error} This constructor does not throw under normal operation.
   * @example
   * ```ts
   * const engine = new SpatialAudioEngine();
   * ```
   */
  public constructor() {
    this.mixer = new AudioMixer();
    this.bufferCache = new Map<string, AudioBuffer>();
  }

  /**
   * Ensures the AudioContext exists and is running.
   *
   * @returns {Promise<void>} Resolves when audio playback is available.
   * @throws {Error} Throws when the browser does not support Web Audio API.
   * @example
   * ```ts
   * await engine.resumeContext();
   * ```
   */
  public async resumeContext(): Promise<void> {
    const context = this.getOrCreateContext();

    if (context.state !== 'running') {
      await context.resume();
    }
  }

  /**
   * Checks whether the engine has an active running context.
   *
   * @returns {boolean} True when context is running, otherwise false.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const ready = engine.isReady();
   * ```
   */
  public isReady(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }

  /**
   * Updates the global output gain for all sounds.
   *
   * @param {number} gainValue Target gain from 0.0 to 1.5.
   * @returns {void} This method does not return a value.
   * @throws {Error} Throws when the audio context is not initialized.
   * @example
   * ```ts
   * engine.setMasterGain(0.8);
   * ```
   */
  public setMasterGain(gainValue: number): void {
    this.ensureMixerReady();
    this.mixer.setMasterGain(gainValue);
  }

  /**
   * Plays one spatialized ASMR sound as a one-shot event.
   *
   * @param {PlaybackRequest} request Playback request including sound and position.
   * @returns {void} This method does not return a value.
   * @throws {Error} Throws when audio context initialization fails.
   * @example
   * ```ts
   * engine.play({ sound, position: { x: -0.8, y: 0, z: 0.1 }, intensity: 1, gesture: 'tap', strokeSpeed: 0 });
   * ```
   */
  public play(request: PlaybackRequest): void {
    const context = this.getOrCreateContext();
    this.ensureContextRunning(context);

    const buffer = this.getOrCreateBuffer(context, request.sound);
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    const pannerNode = context.createPanner();

    sourceNode.buffer = buffer;
    sourceNode.loop = request.sound.loop;
    sourceNode.playbackRate.value = this.computePlaybackRate(
      request.sound.category,
      request.gesture,
      request.strokeSpeed
    );

    gainNode.gain.value = this.computeGain(
      request.sound.defaultGain,
      request.intensity,
      request.gesture,
      request.strokeSpeed
    );

    this.applyPannerValues(pannerNode, request.position, context.currentTime, 0.001);

    sourceNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.ensureMixerReady());

    const now = context.currentTime;
    sourceNode.start(now + 0.004);

    if (!sourceNode.loop) {
      sourceNode.stop(now + request.sound.defaultDurationSeconds);
    }
  }

  /**
   * Updates the active stroke playback and spatial position.
   *
   * @param {PlaybackRequest} request Playback request with drag metrics.
   * @returns {void} This method does not return a value.
   * @throws {Error} Throws when audio context initialization fails.
   * @example
   * ```ts
   * engine.updateStroke({ sound, position, intensity: 0.8, gesture: 'drag', strokeSpeed: 420 });
   * ```
   */
  public updateStroke(request: PlaybackRequest): void {
    const context = this.getOrCreateContext();
    this.ensureContextRunning(context);

    const strokeSession = this.getOrCreateStrokeSession(context, request.sound);
    const now = context.currentTime;
    const positionSmoothing = this.computePositionSmoothing(request.strokeSpeed);
    const targetGain = this.computeGain(
      request.sound.defaultGain,
      request.intensity,
      'drag',
      request.strokeSpeed
    );
    const targetRate = this.computePlaybackRate(request.sound.category, 'drag', request.strokeSpeed);

    this.applyPannerValues(strokeSession.pannerNode, request.position, now, positionSmoothing);
    strokeSession.gainNode.gain.setTargetAtTime(targetGain, now, 0.028);
    strokeSession.sourceNode.playbackRate.setTargetAtTime(targetRate, now, 0.04);
  }

  /**
   * Gracefully fades out and stops the active stroke session.
   *
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * engine.endStroke();
   * ```
   */
  public endStroke(): void {
    const strokeSession = this.activeStrokeSession;

    if (strokeSession === null || this.audioContext === null) {
      return;
    }

    const now = this.audioContext.currentTime;
    strokeSession.gainNode.gain.setTargetAtTime(0.0001, now, 0.05);
    strokeSession.sourceNode.stop(now + 0.22);
    strokeSession.sourceNode.onended = () => {
      strokeSession.sourceNode.disconnect();
      strokeSession.gainNode.disconnect();
      strokeSession.pannerNode.disconnect();
    };

    this.activeStrokeSession = null;
  }

  /**
   * Starts or updates ambient background playback.
   *
   * @param {SoundDefinition | null} sound Ambient sound or null to stop.
   * @param {number} gainValue Target ambient gain value.
   * @returns {void} This method does not return a value.
   * @throws {Error} Throws when audio context initialization fails.
   * @example
   * ```ts
   * engine.setAmbientTrack(ambientSound, 0.3);
   * ```
   */
  public setAmbientTrack(sound: SoundDefinition | null, gainValue: number): void {
    if (sound === null) {
      this.stopAmbientTrack();
      return;
    }

    const context = this.getOrCreateContext();
    this.ensureContextRunning(context);

    const safeGain = this.clamp(gainValue, 0, 1.2);

    if (this.activeBgmSession !== null && this.activeBgmSession.soundId === sound.id) {
      this.activeBgmSession.gainNode.gain.setTargetAtTime(safeGain, context.currentTime, 0.08);
      return;
    }

    this.stopAmbientTrack();

    const buffer = this.getOrCreateBuffer(context, sound);
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    const filterNode = context.createBiquadFilter();

    sourceNode.buffer = buffer;
    sourceNode.loop = true;
    sourceNode.playbackRate.value = 1;

    filterNode.type = 'lowpass';
    filterNode.frequency.value = 2800;
    filterNode.Q.value = 0.7;

    gainNode.gain.value = 0.0001;

    sourceNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.ensureMixerReady());

    const now = context.currentTime;
    sourceNode.start(now + 0.005);
    gainNode.gain.setTargetAtTime(safeGain, now, 0.15);

    this.activeBgmSession = {
      soundId: sound.id,
      sourceNode,
      gainNode,
      filterNode
    };
  }

  /**
   * Stops ambient background playback.
   *
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * engine.stopAmbientTrack();
   * ```
   */
  public stopAmbientTrack(): void {
    if (this.activeBgmSession === null || this.audioContext === null) {
      return;
    }

    const bgmSession = this.activeBgmSession;
    const now = this.audioContext.currentTime;
    bgmSession.gainNode.gain.setTargetAtTime(0.0001, now, 0.1);
    bgmSession.sourceNode.stop(now + 0.4);
    bgmSession.sourceNode.onended = () => {
      bgmSession.sourceNode.disconnect();
      bgmSession.gainNode.disconnect();
      bgmSession.filterNode.disconnect();
    };

    this.activeBgmSession = null;
  }

  /**
   * Releases audio resources owned by this engine.
   *
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * engine.dispose();
   * ```
   */
  public dispose(): void {
    this.endStroke();
    this.stopAmbientTrack();
    this.bufferCache.clear();

    if (this.audioContext !== null) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.mixer.dispose();
    this.masterGainNode = null;
  }

  /**
   * Ensures one stroke session exists for the active sound.
   *
   * @param {AudioContext} context Active audio context.
   * @param {SoundDefinition} sound Sound used for stroke playback.
   * @returns {ActiveStrokeSession} Active stroke session.
   * @throws {Error} Throws when audio buffer creation fails.
   * @example
   * ```ts
   * const session = engine['getOrCreateStrokeSession'](audioContext, sound);
   * ```
   */
  private getOrCreateStrokeSession(
    context: AudioContext,
    sound: SoundDefinition
  ): ActiveStrokeSession {
    if (this.activeStrokeSession !== null && this.activeStrokeSession.soundId === sound.id) {
      return this.activeStrokeSession;
    }

    this.endStroke();

    const buffer = this.getOrCreateBuffer(context, sound);
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    const pannerNode = context.createPanner();

    sourceNode.buffer = buffer;
    sourceNode.loop = true;
    sourceNode.playbackRate.value = 0.92;

    gainNode.gain.value = 0.0001;
    this.applyPannerValues(pannerNode, { x: 0, y: 0, z: 0 }, context.currentTime, 0.001);

    sourceNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.ensureMixerReady());
    sourceNode.start(context.currentTime + 0.003);

    this.activeStrokeSession = {
      soundId: sound.id,
      sourceNode,
      gainNode,
      pannerNode
    };

    return this.activeStrokeSession;
  }

  /**
   * Applies panner coordinates with smoothing.
   *
   * @param {PannerNode} pannerNode Target panner node.
   * @param {{ x: number; y: number; z: number }} position Requested audio-space position.
   * @param {number} currentTime Audio context current time.
   * @param {number} smoothingTime Smoothing time constant in seconds.
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * engine['applyPannerValues'](pannerNode, { x: 0.4, y: 0, z: -0.2 }, context.currentTime, 0.03);
   * ```
   */
  private applyPannerValues(
    pannerNode: PannerNode,
    position: { x: number; y: number; z: number },
    currentTime: number,
    smoothingTime: number
  ): void {
    pannerNode.panningModel = 'HRTF';
    pannerNode.distanceModel = 'inverse';
    pannerNode.refDistance = 1;
    pannerNode.maxDistance = 8;
    pannerNode.rolloffFactor = 1;
    pannerNode.positionX.setTargetAtTime(this.clamp(position.x, -2.5, 2.5), currentTime, smoothingTime);
    pannerNode.positionY.setTargetAtTime(this.clamp(position.y, -1.6, 1.6), currentTime, smoothingTime);
    pannerNode.positionZ.setTargetAtTime(this.clamp(position.z, -2.5, 2.5), currentTime, smoothingTime);
  }

  /**
   * Computes smoothing for stroke position updates from pointer speed.
   *
   * @param {number} strokeSpeed Pointer speed in pixels per second.
   * @returns {number} Time constant for `setTargetAtTime`.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const smoothing = engine['computePositionSmoothing'](420);
   * ```
   */
  private computePositionSmoothing(strokeSpeed: number): number {
    const normalized = this.clamp(strokeSpeed / 700, 0, 1.3);
    return this.clamp(0.072 - normalized * 0.04, 0.018, 0.072);
  }

  /**
   * Ensures the master chain exists and returns its node.
   *
   * @returns {GainNode} Ready-to-use master gain node.
   * @throws {Error} Throws when audio context initialization fails.
   * @example
   * ```ts
   * const master = engine['ensureMixerReady']();
   * ```
   */
  private ensureMixerReady(): GainNode {
    const context = this.getOrCreateContext();

    if (this.masterGainNode === null) {
      this.masterGainNode = this.mixer.initialize(context);
    }

    return this.masterGainNode;
  }

  /**
   * Creates the AudioContext on first use.
   *
   * @returns {AudioContext} Active audio context.
   * @throws {Error} Throws when Web Audio API is unavailable.
   * @example
   * ```ts
   * const context = engine['getOrCreateContext']();
   * ```
   */
  private getOrCreateContext(): AudioContext {
    if (this.audioContext !== null) {
      return this.audioContext;
    }

    const AudioContextConstructor = window.AudioContext;

    if (typeof AudioContextConstructor === 'undefined') {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    this.audioContext = new AudioContextConstructor();
    this.masterGainNode = this.mixer.initialize(this.audioContext);

    return this.audioContext;
  }

  /**
   * Starts/resumes context in autoplay-restricted environments.
   *
   * @param {AudioContext} context Active audio context.
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * engine['ensureContextRunning'](audioContext);
   * ```
   */
  private ensureContextRunning(context: AudioContext): void {
    if (context.state === 'suspended') {
      void context.resume();
    }
  }

  /**
   * Returns a cached buffer or synthesizes/uses a custom one.
   *
   * @param {AudioContext} context Active audio context.
   * @param {SoundDefinition} sound Sound definition to render.
   * @returns {AudioBuffer} Decoded/generated audio buffer.
   * @throws {Error} Throws when buffer rendering fails.
   * @example
   * ```ts
   * const buffer = engine['getOrCreateBuffer'](audioContext, sound);
   * ```
   */
  private getOrCreateBuffer(context: AudioContext, sound: SoundDefinition): AudioBuffer {
    if (sound.audioBuffer !== undefined) {
      return sound.audioBuffer;
    }

    const cachedBuffer = this.bufferCache.get(sound.id);

    if (cachedBuffer !== undefined) {
      return cachedBuffer;
    }

    const generatedBuffer = this.renderSynthBuffer(context, sound);
    this.bufferCache.set(sound.id, generatedBuffer);

    return generatedBuffer;
  }

  /**
   * Synthesizes a pseudo-ASMR buffer by category.
   *
   * @param {AudioContext} context Active audio context.
   * @param {SoundDefinition} sound Sound configuration.
   * @returns {AudioBuffer} Synthesized mono buffer.
   * @throws {Error} Throws when an unsupported category is passed.
   * @example
   * ```ts
   * const buffer = engine['renderSynthBuffer'](audioContext, sound);
   * ```
   */
  private renderSynthBuffer(context: AudioContext, sound: SoundDefinition): AudioBuffer {
    switch (sound.category) {
      case 'whisper':
        return this.renderWhisperBuffer(context, sound.defaultDurationSeconds, sound.seed);
      case 'tapping':
        return this.renderTapBuffer(context, sound.defaultDurationSeconds, sound.seed);
      case 'scratching':
        return this.renderScratchBuffer(context, sound.defaultDurationSeconds, sound.seed);
      case 'brushing':
        return this.renderBrushBuffer(context, sound.defaultDurationSeconds, sound.seed);
      case 'water':
        return this.renderWaterBuffer(context, sound.defaultDurationSeconds, sound.seed);
      case 'ear_cleaning':
        return this.renderEarCleaningBuffer(context, sound.defaultDurationSeconds, sound.seed);
      case 'ambient':
        return this.renderAmbientBuffer(context, sound);
      case 'user':
        return this.renderWhisperBuffer(context, sound.defaultDurationSeconds, sound.seed);
      default:
        throw new Error(`Unsupported sound category: ${String(sound.category)}`);
    }
  }

  /**
   * Generates a whisper-like soft broadband noise.
   *
   * @param {AudioContext} context Active audio context.
   * @param {number} durationSeconds Buffer duration in seconds.
   * @param {number} seed Seed for deterministic randomness.
   * @returns {AudioBuffer} Generated whisper buffer.
   * @throws {Error} Throws when invalid durations are passed.
   * @example
   * ```ts
   * const whisper = engine['renderWhisperBuffer'](audioContext, 1.8, 11);
   * ```
   */
  private renderWhisperBuffer(
    context: AudioContext,
    durationSeconds: number,
    seed: number
  ): AudioBuffer {
    const buffer = this.createBuffer(context, durationSeconds);
    const channel = buffer.getChannelData(0);
    const random = this.createRandom(seed);

    for (let index = 0; index < channel.length; index += 1) {
      const progress = index / channel.length;
      const envelope = Math.sin(Math.PI * progress) ** 0.7;
      const brightNoise = random() * 2 - 1;
      const filtered = brightNoise * 0.5 + Math.sin(index * 0.002) * 0.16;
      channel[index] = filtered * envelope * 0.32;
    }

    return buffer;
  }

  /**
   * Generates a short transient tapping sound.
   *
   * @param {AudioContext} context Active audio context.
   * @param {number} durationSeconds Buffer duration in seconds.
   * @param {number} seed Seed for deterministic randomness.
   * @returns {AudioBuffer} Generated tapping buffer.
   * @throws {Error} Throws when invalid durations are passed.
   * @example
   * ```ts
   * const tap = engine['renderTapBuffer'](audioContext, 0.25, 23);
   * ```
   */
  private renderTapBuffer(
    context: AudioContext,
    durationSeconds: number,
    seed: number
  ): AudioBuffer {
    const buffer = this.createBuffer(context, durationSeconds);
    const channel = buffer.getChannelData(0);
    const random = this.createRandom(seed);

    for (let index = 0; index < channel.length; index += 1) {
      const time = index / context.sampleRate;
      const decay = Math.exp(-time * 24);
      const click = Math.sin(time * 2 * Math.PI * 270) * decay;
      const noise = (random() * 2 - 1) * decay * 0.5;
      channel[index] = (click * 0.8 + noise * 0.4) * 0.75;
    }

    return buffer;
  }

  /**
   * Generates a rough scratching texture with repeated high-frequency bursts.
   *
   * @param {AudioContext} context Active audio context.
   * @param {number} durationSeconds Buffer duration in seconds.
   * @param {number} seed Seed for deterministic randomness.
   * @returns {AudioBuffer} Generated scratching buffer.
   * @throws {Error} Throws when invalid durations are passed.
   * @example
   * ```ts
   * const scratch = engine['renderScratchBuffer'](audioContext, 0.7, 37);
   * ```
   */
  private renderScratchBuffer(
    context: AudioContext,
    durationSeconds: number,
    seed: number
  ): AudioBuffer {
    const buffer = this.createBuffer(context, durationSeconds);
    const channel = buffer.getChannelData(0);
    const random = this.createRandom(seed);

    for (let index = 0; index < channel.length; index += 1) {
      const time = index / context.sampleRate;
      const gate = Math.sin(time * 2 * Math.PI * 18) > 0.35 ? 1 : 0.25;
      const bite = Math.sin(time * 2 * Math.PI * 820);
      const noise = (random() * 2 - 1) * 0.8;
      const body = (bite * 0.2 + noise * 0.8) * gate;
      const fade = 1 - index / channel.length;
      channel[index] = body * fade * 0.24;
    }

    return buffer;
  }

  /**
   * Generates a soft brushing texture with periodic sweeps.
   *
   * @param {AudioContext} context Active audio context.
   * @param {number} durationSeconds Buffer duration in seconds.
   * @param {number} seed Seed for deterministic randomness.
   * @returns {AudioBuffer} Generated brushing buffer.
   * @throws {Error} Throws when invalid durations are passed.
   * @example
   * ```ts
   * const brush = engine['renderBrushBuffer'](audioContext, 1.1, 51);
   * ```
   */
  private renderBrushBuffer(
    context: AudioContext,
    durationSeconds: number,
    seed: number
  ): AudioBuffer {
    const buffer = this.createBuffer(context, durationSeconds);
    const channel = buffer.getChannelData(0);
    const random = this.createRandom(seed);

    for (let index = 0; index < channel.length; index += 1) {
      const time = index / context.sampleRate;
      const sweep = (Math.sin(time * 2 * Math.PI * 3.5) + 1) * 0.5;
      const airyNoise = (random() * 2 - 1) * 0.5;
      const shimmer = Math.sin(time * 2 * Math.PI * 210) * 0.1;
      channel[index] = (airyNoise * (0.2 + sweep * 0.8) + shimmer) * 0.3;
    }

    return buffer;
  }

  /**
   * Generates a rounded water-drop style sound.
   *
   * @param {AudioContext} context Active audio context.
   * @param {number} durationSeconds Buffer duration in seconds.
   * @param {number} seed Seed for deterministic randomness.
   * @returns {AudioBuffer} Generated water-like buffer.
   * @throws {Error} Throws when invalid durations are passed.
   * @example
   * ```ts
   * const water = engine['renderWaterBuffer'](audioContext, 0.8, 67);
   * ```
   */
  private renderWaterBuffer(
    context: AudioContext,
    durationSeconds: number,
    seed: number
  ): AudioBuffer {
    const buffer = this.createBuffer(context, durationSeconds);
    const channel = buffer.getChannelData(0);
    const random = this.createRandom(seed);

    for (let index = 0; index < channel.length; index += 1) {
      const time = index / context.sampleRate;
      const dropTone = Math.sin(time * 2 * Math.PI * (190 - time * 90));
      const body = Math.exp(-time * 6.5);
      const sparkle = (random() * 2 - 1) * Math.exp(-time * 14) * 0.4;
      channel[index] = (dropTone * body + sparkle) * 0.44;
    }

    return buffer;
  }

  /**
   * Generates a subtle ear-cleaning texture with soft scraping details.
   *
   * @param {AudioContext} context Active audio context.
   * @param {number} durationSeconds Buffer duration in seconds.
   * @param {number} seed Seed for deterministic randomness.
   * @returns {AudioBuffer} Generated ear-cleaning buffer.
   * @throws {Error} Throws when invalid durations are passed.
   * @example
   * ```ts
   * const earCleaning = engine['renderEarCleaningBuffer'](audioContext, 1.0, 62);
   * ```
   */
  private renderEarCleaningBuffer(
    context: AudioContext,
    durationSeconds: number,
    seed: number
  ): AudioBuffer {
    const buffer = this.createBuffer(context, durationSeconds);
    const channel = buffer.getChannelData(0);
    const random = this.createRandom(seed);

    for (let index = 0; index < channel.length; index += 1) {
      const time = index / context.sampleRate;
      const microPattern = Math.sin(time * 2 * Math.PI * 36) * 0.28;
      const fuzzyNoise = (random() * 2 - 1) * 0.3;
      const body = Math.exp(-time * 1.4);
      const gate = Math.sin(time * 2 * Math.PI * 7) > 0 ? 1 : 0.55;
      channel[index] = (microPattern + fuzzyNoise) * body * gate * 0.24;
    }

    return buffer;
  }

  /**
   * Generates long-loop ambient textures for background playback.
   *
   * @param {AudioContext} context Active audio context.
   * @param {SoundDefinition} sound Ambient sound definition.
   * @returns {AudioBuffer} Generated ambient loop buffer.
   * @throws {Error} Throws when duration is invalid.
   * @example
   * ```ts
   * const ambient = engine['renderAmbientBuffer'](audioContext, ambientSound);
   * ```
   */
  private renderAmbientBuffer(context: AudioContext, sound: SoundDefinition): AudioBuffer {
    const buffer = this.createBuffer(context, sound.defaultDurationSeconds);
    const channel = buffer.getChannelData(0);
    const random = this.createRandom(sound.seed);

    for (let index = 0; index < channel.length; index += 1) {
      const time = index / context.sampleRate;
      const baseNoise = random() * 2 - 1;
      const lowDrift = Math.sin(time * 2 * Math.PI * 0.24) * 0.13;
      const midDrift = Math.sin(time * 2 * Math.PI * 0.53) * 0.09;

      let texture = baseNoise * 0.11 + lowDrift + midDrift;

      if (sound.id.includes('rain')) {
        texture += (Math.sin(time * 2 * Math.PI * 19) > 0.82 ? 0.28 : 0) * (random() * 0.6);
      }

      if (sound.id.includes('fire')) {
        texture += (Math.sin(time * 2 * Math.PI * 7.5) > 0.74 ? 1 : 0.42) * (random() * 0.16);
      }

      if (sound.id.includes('forest')) {
        texture += Math.sin(time * 2 * Math.PI * 2.6) * 0.07;
      }

      if (sound.id.includes('night')) {
        texture += Math.sin(time * 2 * Math.PI * 1.1) * 0.05;
      }

      channel[index] = texture * 0.34;
    }

    return buffer;
  }

  /**
   * Creates a mono buffer for synthesized content.
   *
   * @param {AudioContext} context Active audio context.
   * @param {number} durationSeconds Requested duration in seconds.
   * @returns {AudioBuffer} Empty mono buffer.
   * @throws {Error} Throws when duration is not positive.
   * @example
   * ```ts
   * const buffer = engine['createBuffer'](audioContext, 1.0);
   * ```
   */
  private createBuffer(context: AudioContext, durationSeconds: number): AudioBuffer {
    if (durationSeconds <= 0) {
      throw new Error('Duration must be greater than zero.');
    }

    const frameCount = Math.floor(context.sampleRate * durationSeconds);
    return context.createBuffer(1, frameCount, context.sampleRate);
  }

  /**
   * Computes dynamic gain using sound defaults, gestures, and stroke speed.
   *
   * @param {number} baseGain Sound-specific default gain.
   * @param {number} intensity Pointer intensity in range 0.0-2.0.
   * @param {'tap' | 'drag'} gesture Current gesture type.
   * @param {number} strokeSpeed Pointer speed in pixels per second.
   * @returns {number} Clamped gain value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const gain = engine['computeGain'](0.4, 1, 'drag', 420);
   * ```
   */
  private computeGain(
    baseGain: number,
    intensity: number,
    gesture: 'tap' | 'drag',
    strokeSpeed: number
  ): number {
    const gestureScale = gesture === 'drag' ? 0.7 : 1;
    const speedScale = gesture === 'drag' ? this.clamp(0.6 + strokeSpeed / 820, 0.6, 1.45) : 1;
    return this.clamp(baseGain * intensity * gestureScale * speedScale, 0.01, 1.2);
  }

  /**
   * Computes playback rate variation for subtle realism.
   *
   * @param {SoundCategory} category Sound category.
   * @param {'tap' | 'drag'} gesture Current gesture type.
   * @param {number} strokeSpeed Pointer speed in pixels per second.
   * @returns {number} Playback rate value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const rate = engine['computePlaybackRate']('water', 'drag', 380);
   * ```
   */
  private computePlaybackRate(
    category: SoundCategory,
    gesture: 'tap' | 'drag',
    strokeSpeed: number
  ): number {
    if (gesture === 'drag') {
      const speedTerm = this.clamp(strokeSpeed / 700, 0, 1.3);

      if (category === 'ear_cleaning') {
        return 0.82 + speedTerm * 0.22;
      }

      if (category === 'water') {
        return 0.88 + speedTerm * 0.2;
      }

      return 0.9 + speedTerm * 0.22;
    }

    if (category === 'tapping') {
      return 1.08;
    }

    return 1;
  }

  /**
   * Returns a deterministic pseudo-random generator.
   *
   * @param {number} seed Initial seed value.
   * @returns {() => number} Function returning values in [0, 1).
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const random = engine['createRandom'](123);
   * const value = random();
   * ```
   */
  private createRandom(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  /**
   * Clamps a number to a range.
   *
   * @param {number} value Value to clamp.
   * @param {number} min Minimum allowed value.
   * @param {number} max Maximum allowed value.
   * @returns {number} Clamped value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const safe = engine['clamp'](2, 0, 1);
   * ```
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
