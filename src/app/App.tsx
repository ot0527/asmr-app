import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { SOUND_DEFINITIONS } from '../core/constants';
import type { GestureType, HeadRegion, PlaybackRequest } from '../core/types';
import { SoundBank } from '../features/audio/SoundBank';
import { SpatialAudioEngine } from '../features/audio/SpatialAudioEngine';
import { SceneCanvas, type SceneTriggerPayload } from '../features/scene/SceneCanvas';
import { ControlPanel } from '../features/ui/ControlPanel';
import { SettingsDrawer } from '../features/ui/SettingsDrawer';
import { SoundPalette } from '../features/ui/SoundPalette';

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
  return gesture === 'drag' ? 0.75 : 1;
}

/**
 * Main app shell for the Phase1 ASMR prototype.
 *
 * @returns {JSX.Element} Root application view.
 * @throws {Error} Throws when sound definitions are empty.
 * @example
 * ```tsx
 * <App />
 * ```
 */
export function App(): ReactElement {
  const soundBank = useMemo(() => new SoundBank(SOUND_DEFINITIONS), []);
  const sounds = useMemo(() => soundBank.getAll(), [soundBank]);

  if (sounds.length === 0) {
    throw new Error('Sound palette is empty. At least one sound definition is required.');
  }

  const [selectedSoundId, setSelectedSoundId] = useState<string>(sounds[0].id);
  const [activeRegion, setActiveRegion] = useState<HeadRegion | null>(null);
  const [masterGain, setMasterGain] = useState<number>(0.82);
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const selectedSound = soundBank.getById(selectedSoundId) ?? sounds[0];
  const spatialAudioEngine = useMemo(() => new SpatialAudioEngine(), []);

  useEffect(() => {
    return () => {
      spatialAudioEngine.dispose();
    };
  }, [spatialAudioEngine]);

  /**
   * Applies the current master gain when audio is initialized.
   *
   * @returns {void} This hook callback does not return a value.
   * @throws {Error} Throws if gain updates fail unexpectedly.
   * @example
   * ```ts
   * useEffect(() => { ... }, [isAudioReady, masterGain]);
   * ```
   */
  useEffect(() => {
    if (!isAudioReady) {
      return;
    }

    spatialAudioEngine.setMasterGain(masterGain);
  }, [isAudioReady, masterGain, spatialAudioEngine]);

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
   * Plays spatial audio for a scene interaction payload.
   *
   * @param {SceneTriggerPayload} payload Trigger payload from the 3D scene.
   * @returns {Promise<void>} Resolves after scheduling playback.
   * @throws {Error} Throws when the audio engine fails to resume.
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

      const request: PlaybackRequest = {
        sound: selectedSound,
        position: payload.position,
        intensity: gestureToIntensity(payload.gesture),
        gesture: payload.gesture
      };

      spatialAudioEngine.play(request);
    },
    [selectedSound, spatialAudioEngine]
  );

  /**
   * Handles scene triggers and forwards them to audio playback.
   *
   * @param {SceneTriggerPayload} payload Trigger payload from the 3D scene.
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

  return (
    <div className="app-shell">
      <div className="background-glow" aria-hidden="true" />

      <header className="app-header">
        <h1>ASMR Tingles</h1>
        <p>3D Head Interaction Prototype / Phase1</p>
      </header>

      <div className="workspace-grid">
        <SoundPalette
          sounds={sounds}
          selectedSoundId={selectedSoundId}
          onSelectSound={setSelectedSoundId}
        />

        <main className="stage" aria-label="3D stage">
          <SceneCanvas
            highlightedRegion={activeRegion}
            onRegionHover={setActiveRegion}
            onTrigger={handleSceneTrigger}
          />
        </main>

        <ControlPanel
          activeRegion={activeRegion}
          selectedSound={selectedSound}
          isAudioReady={isAudioReady}
          masterGain={masterGain}
          onEnableAudio={handleEnableAudio}
          onMasterGainChange={setMasterGain}
          onToggleSettings={() => {
            setIsSettingsOpen((previous) => !previous);
          }}
        />
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
