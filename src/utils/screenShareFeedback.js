const SCREEN_SHARE_SOUNDS = Object.freeze({
  started: '/mixkit-select-click-1109.wav',
  joined: '/voicechannelnotification.wav',
});

/** Ekran paylaşımı eylemleri için kısa, tek seferlik sesli geri bildirim çalar. */
export function playScreenShareFeedback(type, outputVolume = 100) {
  const source = SCREEN_SHARE_SOUNDS[type];
  if (!source) return;

  try {
    const audio = new Audio(source);
    const normalizedVolume = Math.max(0, Math.min(Number(outputVolume) || 0, 100)) / 100;
    audio.volume = normalizedVolume * 0.4;
    audio.play().catch(() => {});
  } catch {
    // WebView kullanıcı etkileşimi politikasına göre sesi reddedebilir.
  }
}
