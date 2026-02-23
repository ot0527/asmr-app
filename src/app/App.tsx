import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  DEFAULT_BGM_GAIN,
  PALETTE_CATEGORY_ORDER,
  SOUND_DEFINITIONS
} from '../core/constants';
import type {
  BgmState,
  GestureType,
  HeadRegion,
  PlaybackRequest,
  SoundCategory,
  SoundDefinition,
  UserSoundAsset
} from '../core/types';
import { SoundBank } from '../features/audio/SoundBank';
import { SpatialAudioEngine } from '../features/audio/SpatialAudioEngine';
import { ExportManager } from '../features/recording/ExportManager';
import { Recorder } from '../features/recording/Recorder';
import { RecordingUI } from '../features/recording/RecordingUI';
import { SceneCanvas, type SceneTriggerPayload } from '../features/scene/SceneCanvas';
import { ControlPanel } from '../features/ui/ControlPanel';
import { SettingsDrawer } from '../features/ui/SettingsDrawer';
import { SoundPalette } from '../features/ui/SoundPalette';
import { lockLandscapeWhenNative } from '../platform/orientation';
import { resolveRuntimePlatform, type RuntimePlatform } from '../platform/runtime';

/**
 * サウンドがタッチ操作で再生可能かを返する。
 *
 * @param {SoundDefinition} sound サウンド定義。
 * @returns {boolean} 背景専用サウンドでない場合はtrue。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const interactive = isInteractionSound(sound);
 * ```
 */
function isInteractionSound(sound: SoundDefinition): boolean {
  return sound.triggerMode !== 'bgm';
}

/**
 * 操作ジェスチャーを再生強度へ変換する。
 *
 * @param {GestureType} gesture 現在の操作ジェスチャー。
 * @returns {number} 線形の強度倍率。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const intensity = gestureToIntensity('drag');
 * ```
 */
function gestureToIntensity(gesture: GestureType): number {
  return gesture === 'drag' ? 0.85 : 1;
}

/**
 * 新規録音したユーザー音源の表示名を生成する。
 *
 * @returns {string} 生成した録音名。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const name = toRecordingName();
 * ```
 */
function toRecordingName(): string {
  const now = new Date();
  const datePart = now.toISOString().replace('T', ' ').slice(0, 16);
  return `録音 ${datePart}`;
}

/**
 * ユーザーサウンド定義を既存一覧へマージする。
 *
 * @param {SoundDefinition[]} definitions 現在のサウンド定義一覧。
 * @param {SoundDefinition} definition 追加対象のサウンド定義。
 * @returns {SoundDefinition[]} 更新後のサウンド一覧。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const merged = mergeSoundDefinition(definitions, definition);
 * ```
 */
function mergeSoundDefinition(
  definitions: SoundDefinition[],
  definition: SoundDefinition
): SoundDefinition[] {
  const filteredDefinitions = definitions.filter((item) => item.id !== definition.id);
  return [...filteredDefinitions, definition];
}

/**
 * 1つのユーザー音源アセットから実行時サウンド定義を構築する。
 *
 * @param {UserSoundAsset} asset 保存済みのユーザー音源アセット。
 * @param {AudioBuffer} audioBuffer デコード済みのAudioBuffer。
 * @returns {SoundDefinition} アプリで使用するサウンド定義。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const definition = toUserSoundDefinition(asset, buffer);
 * ```
 */
function toUserSoundDefinition(asset: UserSoundAsset, audioBuffer: AudioBuffer): SoundDefinition {
  return {
    id: `user-${asset.id}`,
    label: asset.name,
    category: 'user',
    description: asset.kind === 'recording' ? '録音した音源' : 'インポートした音源',
    accentColor: asset.kind === 'recording' ? '#d59ced' : '#cf8cf1',
    defaultGain: 0.42,
    defaultDurationSeconds: Math.max(audioBuffer.duration, 0.8),
    loop: false,
    seed: asset.id.length * 13,
    triggerMode: 'both',
    sourceType: asset.kind === 'recording' ? 'user_recording' : 'user_imported',
    isUserGenerated: true,
    audioBuffer,
    userSoundId: asset.id
  };
}

/**
 * ランタイム種別をUI表示向けの短いラベルへ変換する。
 *
 * @param {RuntimePlatform} platform 実行中のランタイム種別。
 * @returns {string} UI表示向けのプラットフォーム名。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const label = toPlatformLabel('android');
 * ```
 */
function toPlatformLabel(platform: RuntimePlatform): string {
  switch (platform) {
    case 'android':
      return 'Android';
    case 'ios':
      return 'iOS';
    case 'web':
      return 'Web';
    default:
      return 'Unknown';
  }
}

/**
 * Phase2 ASMRプロトタイプのメインアプリシェル。
 *
 * @returns {JSX.Element} アプリケーションのルート表示。
 * @throws {Error} 操作用サウンド定義が存在しない場合にスローする。
 * @example
 * ```tsx
 * <App />
 * ```
 */
export function App(): ReactElement {
  const spatialAudioEngine = useMemo(() => new SpatialAudioEngine(), []);
  const recorder = useMemo(() => new Recorder(), []);
  const exportManager = useMemo(() => new ExportManager(), []);
  const runtimePlatform = useMemo(() => resolveRuntimePlatform(), []);

  const [soundDefinitions, setSoundDefinitions] = useState<SoundDefinition[]>(SOUND_DEFINITIONS);
  const [selectedCategory, setSelectedCategory] = useState<SoundCategory>('whisper');
  const [selectedSoundId, setSelectedSoundId] = useState<string>('whisper-soft');
  const [activeRegion, setActiveRegion] = useState<HeadRegion | null>(null);
  const [masterGain, setMasterGain] = useState<number>(0.82);
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [bgmState, setBgmState] = useState<BgmState>({
    soundId: null,
    gain: DEFAULT_BGM_GAIN
  });
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingLevel, setRecordingLevel] = useState<number>(0);
  const [recordingStatus, setRecordingStatus] = useState<string>('録音待機中');
  const [userAssets, setUserAssets] = useState<UserSoundAsset[]>([]);

  const soundBank = useMemo(() => new SoundBank(soundDefinitions), [soundDefinitions]);
  const allSounds = useMemo(() => soundBank.getAll(), [soundBank]);
  const bgmSounds = useMemo(
    () => allSounds.filter((sound) => sound.triggerMode === 'bgm'),
    [allSounds]
  );
  const interactionSounds = useMemo(
    () => allSounds.filter((sound) => isInteractionSound(sound)),
    [allSounds]
  );
  const categorySounds = useMemo(
    () =>
      soundBank
        .getByCategory(selectedCategory)
        .filter((sound) => isInteractionSound(sound)),
    [selectedCategory, soundBank]
  );

  const selectedSound =
    soundBank.getById(selectedSoundId) ??
    categorySounds[0] ??
    interactionSounds[0] ??
    SOUND_DEFINITIONS[0];

  if (interactionSounds.length === 0) {
    throw new Error('No interaction sounds are available.');
  }

  useEffect(() => {
    return () => {
      recorder.dispose();
      spatialAudioEngine.dispose();
    };
  }, [recorder, spatialAudioEngine]);

  useEffect(() => {
    void lockLandscapeWhenNative();
  }, []);

  /**
   * 永続化済みユーザー音源を読み込み、サウンドバンクへ追加する。
   *
   * @returns {Promise<void>} 読み込み完了時に解決する。
   * @throws {Error} IndexedDBまたは音声デコードに失敗した場合にスローする。
   * @example
   * ```ts
   * await loadUserSounds();
   * ```
   */
  const loadUserSounds = useCallback(async (): Promise<void> => {
    const assets = await exportManager.listSounds();
    const userDefinitions: SoundDefinition[] = [];

    for (const asset of assets) {
      try {
        const audioBuffer = await exportManager.decodeToAudioBuffer(asset.blob);
        userDefinitions.push(toUserSoundDefinition(asset, audioBuffer));
      } catch {
        continue;
      }
    }

    setUserAssets(assets);
    setSoundDefinitions([...SOUND_DEFINITIONS, ...userDefinitions]);

    if (assets.length > 0) {
      setRecordingStatus(`${assets.length}件のユーザー音源を読み込みました。`);
    }
  }, [exportManager]);

  useEffect(() => {
    let isActive = true;

    /**
     * マウント状態を確認しながらユーザー音源の非同期読み込みを実行する。
     *
     * @returns {Promise<void>} 読み込み試行後に解決する。
     * @throws {Error} 読み込み処理で予期しないエラーが発生した場合にスローする。
     * @example
     * ```ts
     * await bootstrapUserSounds();
     * ```
     */
    const bootstrapUserSounds = async (): Promise<void> => {
      try {
        await loadUserSounds();
      } catch {
        if (isActive) {
          setRecordingStatus('ユーザー音源の読み込みに失敗しました。');
        }
      }
    };

    void bootstrapUserSounds();

    return () => {
      isActive = false;
    };
  }, [loadUserSounds]);

  useEffect(() => {
    if (isAudioReady) {
      spatialAudioEngine.setMasterGain(masterGain);
    }
  }, [isAudioReady, masterGain, spatialAudioEngine]);

  useEffect(() => {
    if (!isAudioReady) {
      return;
    }

    if (bgmState.soundId === null) {
      spatialAudioEngine.stopAmbientTrack();
      return;
    }

    const bgmSound = soundBank.getById(bgmState.soundId);

    if (bgmSound !== null && bgmSound.triggerMode === 'bgm') {
      spatialAudioEngine.setAmbientTrack(bgmSound, bgmState.gain);
    }
  }, [bgmState, isAudioReady, soundBank, spatialAudioEngine]);

  useEffect(() => {
    if (categorySounds.length > 0) {
      const hasSelectedSound = categorySounds.some((sound) => sound.id === selectedSoundId);

      if (!hasSelectedSound) {
        setSelectedSoundId(categorySounds[0].id);
      }

      return;
    }

    for (const category of PALETTE_CATEGORY_ORDER) {
      const candidate = soundBank
        .getByCategory(category)
        .find((sound) => isInteractionSound(sound));

      if (candidate !== undefined) {
        setSelectedCategory(category);
        setSelectedSoundId(candidate.id);
        return;
      }
    }
  }, [categorySounds, selectedSoundId, soundBank]);

  /**
   * ユーザー明示操作によるAudioContext有効化を処理する。
   *
   * @returns {Promise<void>} 音声準備完了時に解決する。
   * @throws {Error} ブラウザがAudioContext生成をブロックした場合にスローする。
   * @example
   * ```ts
   * await handleEnableAudio();
   * ```
   */
  const handleEnableAudio = useCallback(async (): Promise<void> => {
    await spatialAudioEngine.resumeContext();
    spatialAudioEngine.setMasterGain(masterGain);
    setIsAudioReady(true);
  }, [masterGain, spatialAudioEngine]);

  /**
   * シーントリガーペイロードを再生リクエストに変換して再生する。
   *
   * @param {SceneTriggerPayload} payload 3Dシーンからのトリガーペイロード。
   * @returns {Promise<void>} 再生スケジューリング後に解決する。
   * @throws {Error} 音響エンジンの初期化に失敗した場合にスローする。
   * @example
   * ```ts
   * await playInteractionSound(payload);
   * ```
   */
  const playInteractionSound = useCallback(
    async (payload: SceneTriggerPayload): Promise<void> => {
      if (!spatialAudioEngine.isReady()) {
        await spatialAudioEngine.resumeContext();
        setIsAudioReady(true);
      }

      const isGestureAllowed =
        selectedSound.triggerMode === 'both' ||
        (selectedSound.triggerMode === 'tap' && payload.gesture === 'tap') ||
        (selectedSound.triggerMode === 'drag' && payload.gesture === 'drag');

      if (!isGestureAllowed) {
        return;
      }

      const request: PlaybackRequest = {
        sound: selectedSound,
        position: payload.position,
        intensity: gestureToIntensity(payload.gesture),
        gesture: payload.gesture,
        strokeSpeed: payload.gestureMetrics.speedPxPerSecond
      };

      if (payload.gesture === 'drag') {
        spatialAudioEngine.updateStroke(request);
      } else {
        spatialAudioEngine.play(request);
      }
    },
    [selectedSound, spatialAudioEngine]
  );

  /**
   * シーントリガーペイロードを処理して音声再生へ渡する。
   *
   * @param {SceneTriggerPayload} payload シーン操作で生成されたトリガーペイロード。
   * @returns {void} このコールバックは値を返しない。
   * @throws {Error} 通常運用ではこのコールバックは例外をスローしない。
   * @example
   * ```ts
   * handleSceneTrigger(payload);
   * ```
   */
  const handleSceneTrigger = useCallback(
    (payload: SceneTriggerPayload): void => {
      setActiveRegion(payload.region);
      void playInteractionSound(payload);
    },
    [playInteractionSound]
  );

  /**
   * ポインター操作由来のストローク終了イベントを処理する。
   *
   * @returns {void} このコールバックは値を返しない。
   * @throws {Error} 通常運用ではこのコールバックは例外をスローしない。
   * @example
   * ```ts
   * handleStrokeEnd();
   * ```
   */
  const handleStrokeEnd = useCallback((): void => {
    spatialAudioEngine.endStroke();
  }, [spatialAudioEngine]);

  /**
   * MediaRecorderセッションを開始し、レベル計測を開始する。
   *
   * @returns {Promise<void>} 録音開始時に解決する。
   * @throws {Error} 録音を開始できない場合にスローする。
   * @example
   * ```ts
   * await handleStartRecording();
   * ```
   */
  const handleStartRecording = useCallback(async (): Promise<void> => {
    try {
      await recorder.start({
        onLevel: setRecordingLevel
      });
      setIsRecording(true);
      setRecordingStatus('録音中...');
    } catch (error) {
      const message = error instanceof Error ? error.message : '録音開始に失敗しました。';
      setRecordingStatus(message);
    }
  }, [recorder]);

  /**
   * 録音を停止し、音源を保存してパレットへ追加する。
   *
   * @returns {Promise<void>} 保存完了時に解決する。
   * @throws {Error} 録音停止または保存に失敗した場合にスローする。
   * @example
   * ```ts
   * await handleStopRecording();
   * ```
   */
  const handleStopRecording = useCallback(async (): Promise<void> => {
    try {
      const blob = await recorder.stop();
      const asset = await exportManager.saveSound({
        name: toRecordingName(),
        kind: 'recording',
        blob
      });
      const audioBuffer = await exportManager.decodeToAudioBuffer(asset.blob);
      const soundDefinition = toUserSoundDefinition(asset, audioBuffer);

      setSoundDefinitions((previousDefinitions) =>
        mergeSoundDefinition(previousDefinitions, soundDefinition)
      );
      setUserAssets((previousAssets) => [asset, ...previousAssets.filter((item) => item.id !== asset.id)]);
      setSelectedCategory('user');
      setSelectedSoundId(soundDefinition.id);
      setRecordingStatus(`${asset.name} を保存しました。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '録音停止に失敗しました。';
      setRecordingStatus(message);
    } finally {
      setIsRecording(false);
      setRecordingLevel(0);
    }
  }, [exportManager, recorder]);

  /**
   * ユーザー選択の音声ファイルを1件取り込み、ユーザー音源として保存する。
   *
   * @param {File} file インポート対象のファイル。
   * @returns {Promise<void>} インポートとデコードの完了時に解決する。
   * @throws {Error} 保存またはデコードに失敗した場合にスローする。
   * @example
   * ```ts
   * await handleImportFile(file);
   * ```
   */
  const handleImportFile = useCallback(
    async (file: File): Promise<void> => {
      try {
        const asset = await exportManager.saveSound({
          name: file.name,
          kind: 'imported',
          blob: file
        });
        const audioBuffer = await exportManager.decodeToAudioBuffer(asset.blob);
        const soundDefinition = toUserSoundDefinition(asset, audioBuffer);

        setSoundDefinitions((previousDefinitions) =>
          mergeSoundDefinition(previousDefinitions, soundDefinition)
        );
        setUserAssets((previousAssets) => [asset, ...previousAssets.filter((item) => item.id !== asset.id)]);
        setSelectedCategory('user');
        setSelectedSoundId(soundDefinition.id);
        setRecordingStatus(`${file.name} をインポートしました。`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'インポートに失敗しました。';
        setRecordingStatus(message);
      }
    },
    [exportManager]
  );

  /**
   * 永続化済みユーザー音源を1件削除し、実行時状態から除去する。
   *
   * @param {string} assetId 対象アセットID。
   * @returns {Promise<void>} 削除完了時に解決する。
   * @throws {Error} IndexedDBの削除処理に失敗した場合にスローする。
   * @example
   * ```ts
   * await handleDeleteAsset(assetId);
   * ```
   */
  const handleDeleteAsset = useCallback(
    async (assetId: string): Promise<void> => {
      await exportManager.deleteSound(assetId);
      setUserAssets((previousAssets) => previousAssets.filter((asset) => asset.id !== assetId));
      setSoundDefinitions((previousDefinitions) =>
        previousDefinitions.filter((definition) => definition.userSoundId !== assetId)
      );
      setRecordingStatus('ユーザー音源を削除しました。');
    },
    [exportManager]
  );

  return (
    <div className="app-shell">
      <div className="background-glow" aria-hidden="true" />

      <header className="app-header">
        <h1>ASMR Tingles</h1>
        <p>Web + Android / Runtime: {toPlatformLabel(runtimePlatform)}</p>
      </header>

      <div className="workspace-grid">
        <SoundPalette
          sounds={allSounds}
          selectedCategory={selectedCategory}
          selectedSoundId={selectedSoundId}
          onSelectCategory={setSelectedCategory}
          onSelectSound={setSelectedSoundId}
        />

        <main className="stage" aria-label="3D stage">
          <SceneCanvas
            highlightedRegion={activeRegion}
            onRegionHover={setActiveRegion}
            onTrigger={handleSceneTrigger}
            onStrokeEnd={handleStrokeEnd}
          />
        </main>

        <div className="side-stack">
          <ControlPanel
            activeRegion={activeRegion}
            selectedSound={selectedSound}
            isAudioReady={isAudioReady}
            masterGain={masterGain}
            bgmGain={bgmState.gain}
            bgmSounds={bgmSounds}
            selectedBgmId={bgmState.soundId}
            onEnableAudio={handleEnableAudio}
            onMasterGainChange={setMasterGain}
            onBgmGainChange={(gain) => {
              setBgmState((previousState) => ({
                ...previousState,
                gain
              }));
            }}
            onSelectBgm={(bgmSoundId) => {
              setBgmState((previousState) => ({
                ...previousState,
                soundId: bgmSoundId
              }));
            }}
            onToggleSettings={() => {
              setIsSettingsOpen((previous) => !previous);
            }}
          />

          <RecordingUI
            isRecording={isRecording}
            recordingLevel={recordingLevel}
            statusMessage={recordingStatus}
            assets={userAssets}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onImportFile={handleImportFile}
            onDeleteAsset={handleDeleteAsset}
          />
        </div>
      </div>

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
        }}
      />

      <div className="portrait-overlay" aria-hidden="true">
        <p>横向きでの利用を推奨します。</p>
      </div>
    </div>
  );
}
