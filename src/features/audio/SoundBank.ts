import type { SoundCategory, SoundDefinition, TriggerMode } from '../../core/types';

/**
 * Mutable sound metadata store used by UI and playback logic.
 */
export class SoundBank {
  private readonly soundMap: Map<string, SoundDefinition>;

  /**
   * Creates a new sound bank from static and dynamic definitions.
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
    this.upsertMany(sounds);
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
   * Returns sounds belonging to one category.
   *
   * @param {SoundCategory} category Category key.
   * @returns {SoundDefinition[]} Category-filtered sounds.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const taps = bank.getByCategory('tapping');
   * ```
   */
  public getByCategory(category: SoundCategory): SoundDefinition[] {
    return this.getAll().filter((sound) => sound.category === category);
  }

  /**
   * Returns sounds matching one trigger mode.
   *
   * @param {TriggerMode} triggerMode Trigger mode.
   * @returns {SoundDefinition[]} Trigger-mode filtered sounds.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const dragSounds = bank.getByTriggerMode('drag');
   * ```
   */
  public getByTriggerMode(triggerMode: TriggerMode): SoundDefinition[] {
    return this.getAll().filter((sound) => sound.triggerMode === triggerMode);
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

  /**
   * Inserts or replaces one sound definition.
   *
   * @param {SoundDefinition} sound Sound definition to upsert.
   * @returns {void} This method does not return a value.
   * @throws {Error} Throws when the id is empty.
   * @example
   * ```ts
   * bank.upsert(soundDefinition);
   * ```
   */
  public upsert(sound: SoundDefinition): void {
    if (sound.id.trim().length === 0) {
      throw new Error('Sound id must not be empty.');
    }

    this.soundMap.set(sound.id, sound);
  }

  /**
   * Inserts or replaces many sound definitions in order.
   *
   * @param {SoundDefinition[]} sounds Sound definitions to upsert.
   * @returns {void} This method does not return a value.
   * @throws {Error} Throws when duplicate ids exist inside the provided list.
   * @example
   * ```ts
   * bank.upsertMany(soundList);
   * ```
   */
  public upsertMany(sounds: SoundDefinition[]): void {
    const seenIds = new Set<string>();

    for (const sound of sounds) {
      if (seenIds.has(sound.id)) {
        throw new Error(`Duplicate sound id in batch: ${sound.id}`);
      }

      seenIds.add(sound.id);
      this.upsert(sound);
    }
  }

  /**
   * Removes one sound definition by id.
   *
   * @param {string} soundId Sound id to remove.
   * @returns {boolean} True when the sound existed and was removed.
   * @throws {Error} This method does not throw under normal operation.
   * @example
   * ```ts
   * const removed = bank.removeById('user-sound-id');
   * ```
   */
  public removeById(soundId: string): boolean {
    return this.soundMap.delete(soundId);
  }
}
