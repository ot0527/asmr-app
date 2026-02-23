/**
 * 音声入力レベル更新用コールバックのシグネチャ。
 */
export type RecordingLevelListener = (level: number) => void;

/**
 * 録音セッション開始時のオプション。
 */
export interface StartRecordingOptions {
  onLevel?: RecordingLevelListener;
}

/**
 * ライブレベル計測を備えたブラウザMediaRecorderラッパー。
 */
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private meterContext: AudioContext | null = null;
  private meterAnalyser: AnalyserNode | null = null;
  private meterFrameHandle: number | null = null;
  private levelListener: RecordingLevelListener | null = null;

  /**
   * 録音が現在有効かどうかを返する。
   *
   * @returns {boolean} 録音セッションが有効な場合はtrue。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * if (recorder.isRecording()) {
   *   // ...
   * }
   * ```
   */
  public isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * 新しいマイク録音セッションを開始する。
   *
   * @param {StartRecordingOptions} options 録音オプション。
   * @returns {Promise<void>} 録音開始後に解決する。
   * @throws {Error} Media APIが利用できない、または権限が拒否された場合にスローする。
   * @example
   * ```ts
   * await recorder.start({ onLevel: setLevel });
   * ```
   */
  public async start(options: StartRecordingOptions = {}): Promise<void> {
    if (this.isRecording()) {
      throw new Error('Recording is already active.');
    }

    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      throw new Error('getUserMedia is not supported in this browser.');
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    this.levelListener = options.onLevel ?? null;
    this.recordedChunks = [];
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorderOptions = this.resolveRecorderOptions();
    this.mediaRecorder = new MediaRecorder(this.mediaStream, recorderOptions);
    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startLevelMeter(this.mediaStream);
    this.mediaRecorder.start(120);
  }

  /**
   * 録音を停止し、取得した音声Blobを返する。
   *
   * @returns {Promise<Blob>} 録音で取得した音声Blob。
   * @throws {Error} 有効な録音セッションがない場合にスローする。
   * @example
   * ```ts
   * const blob = await recorder.stop();
   * ```
   */
  public async stop(): Promise<Blob> {
    const activeRecorder = this.mediaRecorder;

    if (activeRecorder === null || activeRecorder.state !== 'recording') {
      throw new Error('No active recording to stop.');
    }

    const result = await new Promise<Blob>((resolve, reject) => {
      const handleStop = (): void => {
        const mimeType = activeRecorder.mimeType || 'audio/webm';
        resolve(new Blob(this.recordedChunks, { type: mimeType }));
      };

      const handleError = (event: Event): void => {
        reject(new Error(`Recorder error: ${event.type}`));
      };

      activeRecorder.addEventListener('stop', handleStop, { once: true });
      activeRecorder.addEventListener('error', handleError, { once: true });
      activeRecorder.stop();
    });

    this.cleanupMediaResources();
    return result;
  }

  /**
   * 録音をキャンセルし、取得済みチャンクを破棄する。
   *
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * recorder.cancel();
   * ```
   */
  public cancel(): void {
    if (this.mediaRecorder !== null && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    this.recordedChunks = [];
    this.cleanupMediaResources();
  }

  /**
   * 内部リソースをすべて解放する。
   *
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * recorder.dispose();
   * ```
   */
  public dispose(): void {
    this.cancel();
  }

  /**
   * 現在のブラウザでサポートされるRecorder設定を解決する。
   *
   * @returns {MediaRecorderOptions} サポートされるMediaRecorderオプション。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const options = recorder['resolveRecorderOptions']();
   * ```
   */
  private resolveRecorderOptions(): MediaRecorderOptions {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return { mimeType: 'audio/webm;codecs=opus' };
    }

    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return { mimeType: 'audio/mp4' };
    }

    return {};
  }

  /**
   * 有効ストリームに対してAnalyserベースの入力計測を開始する。
   *
   * @param {MediaStream} stream 現在有効なメディアストリーム。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * recorder['startLevelMeter'](stream);
   * ```
   */
  private startLevelMeter(stream: MediaStream): void {
    if (this.levelListener === null) {
      return;
    }

    const AudioContextConstructor = window.AudioContext;

    if (typeof AudioContextConstructor === 'undefined') {
      return;
    }

    this.meterContext = new AudioContextConstructor();
    const sourceNode = this.meterContext.createMediaStreamSource(stream);
    this.meterAnalyser = this.meterContext.createAnalyser();
    this.meterAnalyser.fftSize = 512;
    sourceNode.connect(this.meterAnalyser);

    const timeDomainData = new Float32Array(this.meterAnalyser.fftSize);

    /**
     * 波形振幅をサンプリングし、正規化RMSレベルを通知する。
     *
     * @returns {void} このコールバックは値を返しない。
     * @throws {Error} 通常運用ではこのコールバックは例外をスローしない。
     * @example
     * ```ts
     * sampleLevel();
     * ```
     */
    const sampleLevel = (): void => {
      if (this.meterAnalyser === null || this.levelListener === null) {
        return;
      }

      this.meterAnalyser.getFloatTimeDomainData(timeDomainData);

      let sumSquares = 0;

      for (let index = 0; index < timeDomainData.length; index += 1) {
        const value = timeDomainData[index];
        sumSquares += value * value;
      }

      const rms = Math.sqrt(sumSquares / timeDomainData.length);
      this.levelListener(Math.min(rms * 2.6, 1));
      this.meterFrameHandle = requestAnimationFrame(sampleLevel);
    };

    this.meterFrameHandle = requestAnimationFrame(sampleLevel);
  }

  /**
   * トラックを停止し、計測リソースを解放する。
   *
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * recorder['cleanupMediaResources']();
   * ```
   */
  private cleanupMediaResources(): void {
    if (this.meterFrameHandle !== null) {
      cancelAnimationFrame(this.meterFrameHandle);
      this.meterFrameHandle = null;
    }

    if (this.meterContext !== null) {
      void this.meterContext.close();
      this.meterContext = null;
    }

    this.meterAnalyser = null;
    this.levelListener = null;
    this.mediaRecorder = null;

    if (this.mediaStream !== null) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }

      this.mediaStream = null;
    }
  }
}
