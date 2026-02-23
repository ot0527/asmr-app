import type { SoundDefinition } from '../../core/types';

/**
 * Immutable sound metadata store used by UI and playback logic.
 */
export class SoundBank {
  private readonly soundMap: Map<string, SoundDefinition>;

  /**
   * Creates a new sound bank from static definitions.
   *
   * @param {SoundDefinition[]} sounds Source sound definitions.
   * @returns {void} This constructor does not return a value.
   * @throws {Error} Throws when duplicate sound ids are provided.
   * @example
   * ```ts
   * const bank = new SoundBank(SOUND_DEFINITIONS);
   * ```
   */
  public constructor(sounds: SoundDefinition[]) {
    this.soundMap = new Map<string, SoundDefinition>();

    for (const sound of sounds) {
      if (this.soundMap.has(sound.id)) {
        throw new Error(`Duplicate sound id: ${sound.id}`);
      }

      this.soundMap.set(sound.id, sound);
    }
  }

  /**
   * Returns all sound definitions in insertion order.
   *
   * @returns {SoundDefinition[]} Ordered list of available sounds.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const sounds = bank.getAll();
   * ```
   */
  public getAll(): SoundDefinition[] {
    return Array.from(this.soundMap.values());
  }

  /**
   * Finds a sound by its id.
   *
   * @param {string} soundId Identifier from the palette.
   * @returns {SoundDefinition | null} Matching sound or null when not found.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const sound = bank.getById('tap-wood');
   * ```
   */
  public getById(soundId: string): SoundDefinition | null {
    return this.soundMap.get(soundId) ?? null;
  }
}
