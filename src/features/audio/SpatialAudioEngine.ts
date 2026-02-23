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
 * ASMRサウンドを3D空間化するHRTFベース音響エンジン。
 */
export class SpatialAudioEngine {
  private audioContext: AudioContext | null = null;
  private readonly mixer: AudioMixer;
  private masterGainNode: GainNode | null = null;
  private readonly bufferCache: Map<string, AudioBuffer>;
  private activeStrokeSession: ActiveStrokeSession | null = null;
  private activeBgmSession: ActiveBgmSession | null = null;

  /**
   * 新しい空間音響エンジンインスタンスを作成する。
   *
   * @returns {void} このコンストラクターは値を返しない。
   * @throws {Error} 通常運用ではこのコンストラクターは例外をスローしない。
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
   * AudioContextが存在し実行中であることを保証する。
   *
   * @returns {Promise<void>} 音声再生が利用可能になった時点で解決する。
   * @throws {Error} ブラウザがWeb Audio APIをサポートしていない場合にスローする。
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
   * エンジンが有効な実行中コンテキストを持つか確認する。
   *
   * @returns {boolean} コンテキスト実行中はtrue、それ以外はfalse。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const ready = engine.isReady();
   * ```
   */
  public isReady(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }

  /**
   * 全サウンドのグローバル出力ゲインを更新する。
   *
   * @param {number} gainValue 目標ゲイン（0.0〜1.5）。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} AudioContextが未初期化の場合にスローする。
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
   * 空間化したASMRサウンドをワンショットで再生する。
   *
   * @param {PlaybackRequest} request サウンドと位置を含む再生リクエスト。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} AudioContextの初期化に失敗した場合にスローする。
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
   * 有効なストローク再生と空間位置を更新する。
   *
   * @param {PlaybackRequest} request ドラッグ計測値を含む再生リクエスト。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} AudioContextの初期化に失敗した場合にスローする。
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
   * 有効なストロークセッションを自然にフェードアウトして停止する。
   *
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * 環境音の背景再生を開始または更新する。
   *
   * @param {SoundDefinition | null} sound 環境音のサウンド定義。停止する場合はnull。
   * @param {number} gainValue 目標の環境音ゲイン値。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} AudioContextの初期化に失敗した場合にスローする。
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
   * 環境音の背景再生を停止する。
   *
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * このエンジンが保持する音響リソースを解放する。
   *
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * アクティブサウンド用のストロークセッションが存在することを保証する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {SoundDefinition} sound ストローク再生に使うサウンド。
   * @returns {ActiveStrokeSession} 有効なストロークセッション。
   * @throws {Error} AudioBufferの作成に失敗した場合にスローする。
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
   * スムージングを適用してpanner座標を反映する。
   *
   * @param {PannerNode} pannerNode 対象のPannerNode。
   * @param {{ x: number; y: number; z: number }} position 要求する音響空間座標。
   * @param {number} currentTime AudioContextの現在時刻。
   * @param {number} smoothingTime スムージング時定数（秒）。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * ポインター速度からストローク位置更新のスムージング値を計算する。
   *
   * @param {number} strokeSpeed ポインター速度（ピクセル/秒）。
   * @returns {number} `setTargetAtTime` に渡す時定数。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * マスターチェーンの存在を保証し、そのノードを返する。
   *
   * @returns {GainNode} そのまま利用できるマスターGainNode。
   * @throws {Error} AudioContextの初期化に失敗した場合にスローする。
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
   * 初回利用時にAudioContextを作成する。
   *
   * @returns {AudioContext} 現在有効なAudioContext。
   * @throws {Error} Web Audio APIが利用できない場合にスローする。
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
   * 自動再生制限環境でコンテキストを開始/再開する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * キャッシュ済みバッファを返すか、必要に応じて合成/カスタムバッファを使用する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {SoundDefinition} sound 描画対象のサウンド定義。
   * @returns {AudioBuffer} デコードまたは生成したAudioBuffer。
   * @throws {Error} バッファレンダリングに失敗した場合にスローする。
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
   * カテゴリ別に疑似ASMRバッファを合成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {SoundDefinition} sound サウンド設定。
   * @returns {AudioBuffer} 合成したモノラルバッファ。
   * @throws {Error} 未対応カテゴリが渡された場合にスローする。
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
   * ささやき風の柔らかい広帯域ノイズを生成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {number} durationSeconds バッファ長（秒）。
   * @param {number} seed 決定的乱数に使うシード。
   * @returns {AudioBuffer} 生成したささやき用バッファ。
   * @throws {Error} 不正なdurationが渡された場合にスローする。
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
   * 短いトランジェントのタッピング音を生成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {number} durationSeconds バッファ長（秒）。
   * @param {number} seed 決定的乱数に使うシード。
   * @returns {AudioBuffer} 生成したタッピング用バッファ。
   * @throws {Error} 不正なdurationが渡された場合にスローする。
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
   * 高周波バーストを繰り返す荒いスクラッチ音テクスチャを生成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {number} durationSeconds バッファ長（秒）。
   * @param {number} seed 決定的乱数に使うシード。
   * @returns {AudioBuffer} 生成したスクラッチ用バッファ。
   * @throws {Error} 不正なdurationが渡された場合にスローする。
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
   * 周期的な掃引を持つ柔らかいブラッシング音を生成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {number} durationSeconds バッファ長（秒）。
   * @param {number} seed 決定的乱数に使うシード。
   * @returns {AudioBuffer} 生成したブラッシング用バッファ。
   * @throws {Error} 不正なdurationが渡された場合にスローする。
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
   * 丸みのある水滴風サウンドを生成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {number} durationSeconds バッファ長（秒）。
   * @param {number} seed 決定的乱数に使うシード。
   * @returns {AudioBuffer} 生成した水音風バッファ。
   * @throws {Error} 不正なdurationが渡された場合にスローする。
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
   * 柔らかな擦過音を含む繊細な耳かき音テクスチャを生成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {number} durationSeconds バッファ長（秒）。
   * @param {number} seed 決定的乱数に使うシード。
   * @returns {AudioBuffer} 生成した耳かき用バッファ。
   * @throws {Error} 不正なdurationが渡された場合にスローする。
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
   * 背景再生向けの長尺環境音ループを生成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {SoundDefinition} sound 環境音のサウンド定義。
   * @returns {AudioBuffer} 生成した環境音ループバッファ。
   * @throws {Error} durationが不正な場合にスローする。
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
   * 合成音用のモノラルバッファを作成する。
   *
   * @param {AudioContext} context 現在有効なAudioContext。
   * @param {number} durationSeconds 要求する長さ（秒）。
   * @returns {AudioBuffer} 空のモノラルバッファ。
   * @throws {Error} durationが正の値でない場合にスローする。
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
   * サウンド既定値・ジェスチャー・ストローク速度から動的ゲインを計算する。
   *
   * @param {number} baseGain サウンド固有のデフォルトゲイン。
   * @param {number} intensity 0.0〜2.0のポインター強度。
   * @param {'tap' | 'drag'} gesture 現在のジェスチャー種別。
   * @param {number} strokeSpeed ポインター速度（ピクセル/秒）。
   * @returns {number} クランプ済みゲイン値。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * 自然さを高めるための再生レート変動を計算する。
   *
   * @param {SoundCategory} category サウンドカテゴリ。
   * @param {'tap' | 'drag'} gesture 現在のジェスチャー種別。
   * @param {number} strokeSpeed ポインター速度（ピクセル/秒）。
   * @returns {number} 再生レート値。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * 決定的な疑似乱数ジェネレーターを返する。
   *
   * @param {number} seed 初期シード値。
   * @returns {() => number} [0, 1) の値を返す関数。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
   * 数値を指定範囲にクランプする。
   *
   * @param {number} value クランプ対象の値。
   * @param {number} min 許容される最小値。
   * @param {number} max 許容される最大値。
   * @returns {number} クランプ済みの値。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const safe = engine['clamp'](2, 0, 1);
   * ```
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
