/**
 * Callback signature for audio input level updates.
 */
export type RecordingLevelListener = (level: number) => void;

/**
 * Options for starting a recording session.
 */
export interface StartRecordingOptions {
  onLevel?: RecordingLevelListener;
}

/**
 * Browser MediaRecorder wrapper with live level metering.
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
   * Returns whether recording is currently active.
   *
   * @returns {boolean} True when a recording session is active.
   * @throws {Error} This method does not throw under normal operation.
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
   * Starts a new microphone recording session.
   *
   * @param {StartRecordingOptions} options Recording options.
   * @returns {Promise<void>} Resolves when recording has started.
   * @throws {Error} Throws when media APIs are unavailable or permission is denied.
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
   * Stops recording and returns the captured audio blob.
   *
   * @returns {Promise<Blob>} Captured audio blob.
   * @throws {Error} Throws when no active recording exists.
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
   * Cancels recording and discards captured chunks.
   *
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
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
   * Releases all internal resources.
   *
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * recorder.dispose();
   * ```
   */
  public dispose(): void {
    this.cancel();
  }

  /**
   * Resolves a recorder configuration supported by the current browser.
   *
   * @returns {MediaRecorderOptions} Supported MediaRecorder options.
   * @throws {Error} This method does not throw under normal operation.
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
   * Starts analyzer-based input metering for the active stream.
   *
   * @param {MediaStream} stream Active media stream.
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
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
     * Samples waveform amplitude and emits normalized RMS level.
     *
     * @returns {void} This callback does not return a value.
     * @throws {Error} This callback does not throw under normal operation.
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
   * Stops tracks and clears metering resources.
   *
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
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
