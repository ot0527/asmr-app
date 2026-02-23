import type { UserSoundAsset } from '../../core/types';

const DATABASE_NAME = 'asmr-app-phase2';
const DATABASE_VERSION = 1;
const STORE_NAME = 'user_sounds';

/**
 * Creates a promise around one IndexedDB request.
 *
 * @template T
 * @param {IDBRequest<T>} request IndexedDB request.
 * @returns {Promise<T>} Resolved request value.
 * @throws {Error} Throws when the request fails.
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
 * Generates a stable id for a new user sound asset.
 *
 * @returns {string} Unique identifier.
 * @throws {Error} This function does not throw under normal operation.
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
 * Repository class for user sounds stored in IndexedDB.
 */
export class ExportManager {
  private openPromise: Promise<IDBDatabase> | null = null;

  /**
   * Saves one user sound blob and returns the stored record.
   *
   * @param {{ name: string; kind: 'recording' | 'imported'; blob: Blob }} input Sound payload.
   * @returns {Promise<UserSoundAsset>} Stored asset record.
   * @throws {Error} Throws when IndexedDB is not available.
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
   * Lists all stored user sound assets sorted by recency.
   *
   * @returns {Promise<UserSoundAsset[]>} Stored sound assets.
   * @throws {Error} Throws when IndexedDB access fails.
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
   * Deletes one stored user sound asset.
   *
   * @param {string} assetId Target asset id.
   * @returns {Promise<void>} Resolves after deletion.
   * @throws {Error} Throws when IndexedDB access fails.
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
   * Decodes a blob into an AudioBuffer for Web Audio playback.
   *
   * @param {Blob} blob Source audio blob.
   * @returns {Promise<AudioBuffer>} Decoded audio buffer.
   * @throws {Error} Throws when Web Audio API is unavailable or decoding fails.
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
   * Resolves an open IndexedDB connection.
   *
   * @returns {Promise<IDBDatabase>} Open database instance.
   * @throws {Error} Throws when IndexedDB is unavailable.
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
   * Waits for one transaction to complete or fail.
   *
   * @param {IDBTransaction} transaction Active IndexedDB transaction.
   * @returns {Promise<void>} Resolves when the transaction completes.
   * @throws {Error} Throws when the transaction aborts or errors.
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
