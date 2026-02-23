import type { SoundCategory, SoundDefinition, TriggerMode } from '../../core/types';

/**
 * UIと再生ロジックで使う可変サウンドメタデータストア。
 */
export class SoundBank {
  private readonly soundMap: Map<string, SoundDefinition>;

  /**
   * 静的・動的定義から新しいサウンドバンクを作成する。
   *
   * @param {SoundDefinition[]} sounds 元となるサウンド定義一覧。
   * @returns {void} このコンストラクターは値を返しない。
   * @throws {Error} 重複するサウンドIDが渡された場合にスローする。
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
   * 挿入順のまま全サウンド定義を返する。
   *
   * @returns {SoundDefinition[]} 利用可能なサウンド一覧（順序保持）。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const sounds = bank.getAll();
   * ```
   */
  public getAll(): SoundDefinition[] {
    return Array.from(this.soundMap.values());
  }

  /**
   * 指定カテゴリに属するサウンドを返する。
   *
   * @param {SoundCategory} category カテゴリキー。
   * @returns {SoundDefinition[]} カテゴリで絞り込んだサウンド一覧。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const taps = bank.getByCategory('tapping');
   * ```
   */
  public getByCategory(category: SoundCategory): SoundDefinition[] {
    return this.getAll().filter((sound) => sound.category === category);
  }

  /**
   * 指定トリガーモードに一致するサウンドを返する。
   *
   * @param {TriggerMode} triggerMode トリガーモード。
   * @returns {SoundDefinition[]} トリガーモードで絞り込んだサウンド一覧。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const dragSounds = bank.getByTriggerMode('drag');
   * ```
   */
  public getByTriggerMode(triggerMode: TriggerMode): SoundDefinition[] {
    return this.getAll().filter((sound) => sound.triggerMode === triggerMode);
  }

  /**
   * IDでサウンドを検索する。
   *
   * @param {string} soundId パレット上の識別子。
   * @returns {SoundDefinition | null} 一致したサウンド。未検出時はnull。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const sound = bank.getById('tap-wood');
   * ```
   */
  public getById(soundId: string): SoundDefinition | null {
    return this.soundMap.get(soundId) ?? null;
  }

  /**
   * サウンド定義を1件追加または置換する。
   *
   * @param {SoundDefinition} sound 追加または更新するサウンド定義。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} IDが空の場合にスローする。
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
   * 複数サウンド定義を順序を保って追加または置換する。
   *
   * @param {SoundDefinition[]} sounds 追加または更新するサウンド定義一覧。
   * @returns {void} このメソッドは値を返しない。
   * @throws {Error} 渡された一覧内に重複IDがある場合にスローする。
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
   * ID指定でサウンド定義を1件削除する。
   *
   * @param {string} soundId 削除対象のサウンドID。
   * @returns {boolean} 対象サウンドが存在して削除された場合はtrue。
   * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
   * @example
   * ```ts
   * const removed = bank.removeById('user-sound-id');
   * ```
   */
  public removeById(soundId: string): boolean {
    return this.soundMap.delete(soundId);
  }
}
