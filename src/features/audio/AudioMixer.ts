/**
 * 全体出力ゲイン制御用の最小構成ミキサー。
 */
export class AudioMixer {
  private masterGainNode: GainNode | null = null;

  /**
   * マスターGainNodeを初期化して返する。
   *
   * @param {AudioContext} context ノードを生成するAudioContext。
   * @returns {GainNode} destinationに接続済みのマスターGainNode。
   * @throws {Error} コンテキストでGainNodeを生成できない場合にスローする。
   * @example
   * ```ts
   * const mixer = new AudioMixer();
   * const master = mixer.initialize(audioContext);
   * ```
   */
  public initialize(context: AudioContext): GainNode {
    if (this.masterGainNode !== null) {
      return this.masterGainNode;
    }

    const gainNode = context.createGain();
    gainNode.gain.value = 0.85;
    gainNode.connect(context.destination);
    this.masterGainNode = gainNode;

    return gainNode;
  }

  /**
   * マスター出力ゲインを更新する。
   *
   * @param {number} gainValue 0.0〜1.5の線形ゲイン値。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} ミキサーが初期化されていない場合にスローする。
   * @example
   * ```ts
   * mixer.setMasterGain(0.7);
   * ```
   */
  public setMasterGain(gainValue: number): void {
    if (this.masterGainNode === null) {
      throw new Error('AudioMixer.initialize must be called first.');
    }

    const clampedGain = Math.min(Math.max(gainValue, 0), 1.5);
    this.masterGainNode.gain.setTargetAtTime(
      clampedGain,
      this.masterGainNode.context.currentTime,
      0.02
    );
  }

  /**
   * ミキサー関連リソースをすべて解放する。
   *
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * mixer.dispose();
   * ```
   */
  public dispose(): void {
    if (this.masterGainNode !== null) {
      this.masterGainNode.disconnect();
      this.masterGainNode = null;
    }
  }
}
