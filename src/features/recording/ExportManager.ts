import type { UserSoundAsset } from '../../core/types';

const DATABASE_NAME = 'asmr-app-phase2';
const DATABASE_VERSION = 1;
const STORE_NAME = 'user_sounds';

/**
 * 1件のIndexedDBリクエストをPromise化する。
 *
 * @template T
 * @param {IDBRequest<T>} request IndexedDBリクエスト。
 * @returns {Promise<T>} 解決したリクエスト値。
 * @throws {Error} リクエストが失敗した場合にスローする。
 * @example
 * ```ts
 * const value = await requestToPromise(request);
 * ```
 */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result);
    });

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed.'));
    });
  });
}

/**
 * 新規ユーザー音源アセット用の安定したIDを生成する。
 *
 * @returns {string} 一意な識別子。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const id = generateAssetId();
 * ```
 */
function generateAssetId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * IndexedDBに保存したユーザー音源のリポジトリクラス。
 */
export class ExportManager {
  private openPromise: Promise<IDBDatabase> | null = null;

  /**
   * ユーザー音源Blobを1件保存し、保存レコードを返する。
   *
   * @param {{ name: string; kind: 'recording' | 'imported'; blob: Blob }} input 保存対象のサウンドペイロード。
   * @returns {Promise<UserSoundAsset>} 保存済みアセットレコード。
   * @throws {Error} IndexedDBが利用できない場合にスローする。
   * @example
   * ```ts
   * const asset = await exportManager.saveSound({ name: 'My Record', kind: 'recording', blob });
   * ```
   */
  public async saveSound(input: {
    name: string;
    kind: 'recording' | 'imported';
    blob: Blob;
  }): Promise<UserSoundAsset> {
    const database = await this.getDatabase();
    const now = Date.now();
    const asset: UserSoundAsset = {
      id: generateAssetId(),
      name: input.name,
      kind: input.kind,
      mimeType: input.blob.type || 'application/octet-stream',
      createdAt: now,
      updatedAt: now,
      blob: input.blob
    };

    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.put(asset));
    await this.awaitTransactionComplete(transaction);

    return asset;
  }

  /**
   * 保存済みユーザー音源アセットを新しい順で一覧取得する。
   *
   * @returns {Promise<UserSoundAsset[]>} 保存済みサウンドアセット一覧。
   * @throws {Error} IndexedDBへのアクセスに失敗した場合にスローする。
   * @example
   * ```ts
   * const assets = await exportManager.listSounds();
   * ```
   */
  public async listSounds(): Promise<UserSoundAsset[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const values = await requestToPromise(store.getAll());
    await this.awaitTransactionComplete(transaction);

    return values
      .slice()
      .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt);
  }

  /**
   * 保存済みユーザー音源アセットを1件削除する。
   *
   * @param {string} assetId 対象アセットID。
   * @returns {Promise<void>} 削除後に解決する。
   * @throws {Error} IndexedDBへのアクセスに失敗した場合にスローする。
   * @example
   * ```ts
   * await exportManager.deleteSound(assetId);
   * ```
   */
  public async deleteSound(assetId: string): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.delete(assetId));
    await this.awaitTransactionComplete(transaction);
  }

  /**
   * BlobをWeb Audio再生用AudioBufferへデコードする。
   *
   * @param {Blob} blob 入力の音声Blob。
   * @returns {Promise<AudioBuffer>} デコード済みAudioBuffer。
   * @throws {Error} Web Audio APIが利用できない、またはデコードに失敗した場合にスローする。
   * @example
   * ```ts
   * const buffer = await exportManager.decodeToAudioBuffer(blob);
   * ```
   */
  public async decodeToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
    const AudioContextConstructor = window.AudioContext;

    if (typeof AudioContextConstructor === 'undefined') {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    const arrayBuffer = await blob.arrayBuffer();
    const context = new AudioContextConstructor();

    try {
      return await context.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      await context.close();
    }
  }

  /**
   * オープン済みのIndexedDB接続を解決する。
   *
   * @returns {Promise<IDBDatabase>} オープン済みのデータベースインスタンス。
   * @throws {Error} IndexedDBが利用不可の場合にスローする。
   * @example
   * ```ts
   * const database = await exportManager['getDatabase']();
   * ```
   */
  private async getDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not supported in this browser.');
    }

    if (this.openPromise !== null) {
      return this.openPromise;
    }

    this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      openRequest.addEventListener('upgradeneeded', () => {
        const database = openRequest.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      });

      openRequest.addEventListener('success', () => {
        resolve(openRequest.result);
      });

      openRequest.addEventListener('error', () => {
        reject(openRequest.error ?? new Error('Failed to open IndexedDB.'));
      });
    });

    return this.openPromise;
  }

  /**
   * 1件のトランザクションが完了または失敗するまで待機する。
   *
   * @param {IDBTransaction} transaction 現在有効なIndexedDBトランザクション。
   * @returns {Promise<void>} トランザクション完了時に解決する。
   * @throws {Error} トランザクションが中断またはエラーになった場合にスローする。
   * @example
   * ```ts
   * await exportManager['awaitTransactionComplete'](transaction);
   * ```
   */
  private async awaitTransactionComplete(transaction: IDBTransaction): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener('complete', () => {
        resolve();
      });

      transaction.addEventListener('abort', () => {
        reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
      });

      transaction.addEventListener('error', () => {
        reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      });
    });
  }
}
