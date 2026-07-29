import { useCallback, useEffect, useState } from 'react';

const VOICE_PREFERENCES_KEY = 'voxify.voicePreferences';

function getStoredPreference(key, fallback) {
  try {
    const preferences = JSON.parse(localStorage.getItem(VOICE_PREFERENCES_KEY) || '{}');
    return preferences[key] ?? fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_VOLUME_MENU = {
  visible: false,
  x: 0,
  y: 0,
  participant: null,
};

/**
 * Uygulama genelindeki ses tercihlerini ve kullanıcı ses menüsünü yönetir.
 */
export default function useVoicePreferences(showToast) {
  const [inputVolume, setInputVolume] = useState(() => getStoredPreference('inputVolume', 100));
  const [outputVolume, setOutputVolume] = useState(() => getStoredPreference('outputVolume', 100));
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [selectedInputDevice, setSelectedInputDevice] = useState(
    () => getStoredPreference('selectedInputDevice', '')
  );
  const [selectedOutputDevice, setSelectedOutputDevice] = useState(
    () => getStoredPreference('selectedOutputDevice', '')
  );
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(
    () => getStoredPreference('noiseSuppressionEnabled', true)
  );
  const [isDeafened, setIsDeafened] = useState(false);
  const [userVolumes, setUserVolumes] = useState({});
  const [volumeMenu, setVolumeMenu] = useState(EMPTY_VOLUME_MENU);

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_PREFERENCES_KEY, JSON.stringify({
        inputVolume,
        outputVolume,
        selectedInputDevice,
        selectedOutputDevice,
        noiseSuppressionEnabled,
      }));
    } catch {
      // Depolama kapalıysa tercihler geçerli oturum boyunca çalışmaya devam eder.
    }
  }, [
    inputVolume,
    outputVolume,
    selectedInputDevice,
    selectedOutputDevice,
    noiseSuppressionEnabled,
  ]);

  const toggleMic = useCallback(() => setIsMicMuted((current) => !current), []);

  const handleMicrophoneUnavailable = useCallback((error) => {
    setIsMicMuted(true);
    const permissionDenied = ['NotAllowedError', 'PermissionDeniedError'].includes(error?.name);
    showToast(
      permissionDenied
        ? 'Mikrofon izni kapalı. Ses kanalına dinleyici olarak bağlandınız.'
        : 'Mikrofon açılamadı. Ses kanalına dinleyici olarak bağlandınız.',
      'info'
    );
    console.warn('[Voice] microphone unavailable; continuing in listen-only mode', error);
  }, [showToast]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((current) => !current);
  }, []);

  const openVolumeMenu = useCallback((event, participant) => {
    event.preventDefault();
    event.stopPropagation();
    const anchorRect = event.currentTarget?.getBoundingClientRect?.();
    setVolumeMenu({
      visible: true,
      x: event.clientX || anchorRect?.right || 0,
      y: event.clientY || anchorRect?.bottom || 0,
      participant,
    });
  }, []);

  const setUserVolume = useCallback((identity, volume) => {
    setUserVolumes((current) => ({ ...current, [identity]: volume }));
  }, []);

  const closeVolumeMenu = useCallback(() => {
    setVolumeMenu((current) => ({ ...current, visible: false }));
  }, []);

  return {
    inputVolume,
    setInputVolume,
    outputVolume,
    setOutputVolume,
    isMicMuted,
    selectedInputDevice,
    setSelectedInputDevice,
    selectedOutputDevice,
    setSelectedOutputDevice,
    noiseSuppressionEnabled,
    setNoiseSuppressionEnabled,
    isDeafened,
    userVolumes,
    volumeMenu,
    setVolumeMenu,
    toggleMic,
    toggleDeafen,
    handleMicrophoneUnavailable,
    openVolumeMenu,
    setUserVolume,
    closeVolumeMenu,
  };
}
