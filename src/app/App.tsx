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

/**
 * Returns whether one sound can be triggered by touch interactions.
 *
 * @param {SoundDefinition} sound Sound definition.
 * @returns {boolean} True when the sound is not background-only.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * const interactive = isInteractionSound(sound);
 * ```
 */
function isInteractionSound(sound: SoundDefinition): boolean {
  return sound.triggerMode !== 'bgm';
}

/**
 * Converts interaction gesture into playback intensity.
 *
 * @param {GestureType} gesture Current interaction gesture.
 * @returns {number} Linear intensity multiplier.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * const intensity = gestureToIntensity('drag');
 * ```
 */
function gestureToIntensity(gesture: GestureType): number {
  return gesture === 'drag' ? 0.85 : 1;
}

/**
 * Builds a display name for newly recorded user audio.
 *
 * @returns {string} Generated recording name.
 * @throws {Error} This function does not throw under normal operation.
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
 * Merges one user sound definition into an existing list.
 *
 * @param {SoundDefinition[]} definitions Current sound definitions.
 * @param {SoundDefinition} definition Incoming sound definition.
 * @returns {SoundDefinition[]} Updated sound list.
 * @throws {Error} This function does not throw under normal operation.
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
 * Builds a runtime sound definition from one user sound asset.
 *
 * @param {UserSoundAsset} asset Stored user sound asset.
 * @param {AudioBuffer} audioBuffer Decoded audio buffer.
 * @returns {SoundDefinition} Sound definition used by the app.
 * @throws {Error} This function does not throw under normal operation.
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
 * Main app shell for the Phase2 ASMR prototype.
 *
 * @returns {JSX.Element} Root application view.
 * @throws {Error} Throws when no interaction sound definitions exist.
 * @example
 * ```tsx
 * <App />
 * ```
 */
export function App(): ReactElement {
  const spatialAudioEngine = useMemo(() => new SpatialAudioEngine(), []);
  const recorder = useMemo(() => new Recorder(), []);
  const exportManager = useMemo(() => new ExportManager(), []);

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

  /**
   * Loads persisted user sounds and appends them to the sound bank.
   *
   * @returns {Promise<void>} Resolves when loading is complete.
   * @throws {Error} Throws when IndexedDB or audio decoding fails.
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
     * Executes asynchronous user sound loading with mounted checks.
     *
     * @returns {Promise<void>} Resolves after attempting load.
     * @throws {Error} Throws when load logic raises an unexpected error.
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
   * Handles explicit user activation of the audio context.
   *
   * @returns {Promise<void>} Resolves when audio is ready.
   * @throws {Error} Throws when browser blocks audio context creation.
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
   * Converts scene trigger payload to a playback request and plays it.
   *
   * @param {SceneTriggerPayload} payload Trigger payload from the 3D scene.
   * @returns {Promise<void>} Resolves after scheduling playback.
   * @throws {Error} Throws when the audio engine fails to initialize.
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
   * Handles scene trigger payloads and forwards them to audio playback.
   *
   * @param {SceneTriggerPayload} payload Trigger payload from scene interaction.
   * @returns {void} This callback does not return a value.
   * @throws {Error} This callback does not throw under normal operation.
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
   * Handles stroke-end events from pointer interactions.
   *
   * @returns {void} This callback does not return a value.
   * @throws {Error} This callback does not throw under normal operation.
   * @example
   * ```ts
   * handleStrokeEnd();
   * ```
   */
  const handleStrokeEnd = useCallback((): void => {
    spatialAudioEngine.endStroke();
  }, [spatialAudioEngine]);

  /**
   * Starts a MediaRecorder session and begins level metering.
   *
   * @returns {Promise<void>} Resolves when recording starts.
   * @throws {Error} Throws when recording cannot start.
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
   * Stops recording, stores the sound, and adds it to the palette.
   *
   * @returns {Promise<void>} Resolves when storage is complete.
   * @throws {Error} Throws when recording stop or storage fails.
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
   * Imports one user-selected audio file and stores it as a user sound.
   *
   * @param {File} file Imported file.
   * @returns {Promise<void>} Resolves when import and decode complete.
   * @throws {Error} Throws when storage or decoding fails.
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
   * Deletes one persisted user sound and removes it from runtime state.
   *
   * @param {string} assetId Target asset id.
   * @returns {Promise<void>} Resolves when deletion completes.
   * @throws {Error} Throws when IndexedDB deletion fails.
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
        <p>Web Prototype / Phase2</p>
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
