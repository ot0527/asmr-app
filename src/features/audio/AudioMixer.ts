/**
 * Minimal mixer for controlling global output gain.
 */
export class AudioMixer {
  private masterGainNode: GainNode | null = null;

  /**
   * Initializes and returns the master gain node.
   *
   * @param {AudioContext} context Audio context where the node is created.
   * @returns {GainNode} Master gain node connected to destination.
   * @throws {Error} Throws when the context cannot create gain nodes.
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
   * Updates the master output gain.
   *
   * @param {number} gainValue Linear gain value from 0.0 to 1.5.
   * @returns {void} This method does not return a value.
   * @throws {Error} Throws when the mixer was not initialized.
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
   * Releases all mixer resources.
   *
   * @returns {void} This method does not return a value.
   * @throws {Error} This method does not throw under normal operation.
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
