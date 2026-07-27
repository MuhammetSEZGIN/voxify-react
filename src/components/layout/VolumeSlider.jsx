import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sürükleme sırasında yerel state kullanan ses kaydırıcısı.
 *
 * Ham `onChange` doğrudan MainLayout'a bağlanırsa, sürükleme başına onlarca
 * render tüm ağacı (ChatArea, MemberList, VoiceChannel...) yeniden çizer.
 * Burada değer sürüklerken lokal tutulur, üst state'e `requestAnimationFrame`
 * ile en fazla kare başına bir kez yazılır — böylece LiveKit'e giden gerçek
 * ses seviyesi yine anlık takip edilir ama render sayısı sınırlanır.
 */
function VolumeSlider({ value, onChange, min = 0, max = 100 }) {
  const [localValue, setLocalValue] = useState(value);
  const draggingRef = useRef(false);
  const frameRef = useRef(null);
  const pendingRef = useRef(null);

  // Dışarıdan gelen değişiklikleri yansıt — ama kullanıcı sürüklerken değil,
  // aksi halde parmak altındaki tutamaç geri sıçrar.
  useEffect(() => {
    if (!draggingRef.current) setLocalValue(value);
  }, [value]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  const flush = useCallback(() => {
    frameRef.current = null;
    if (pendingRef.current !== null) {
      onChange(pendingRef.current);
      pendingRef.current = null;
    }
  }, [onChange]);

  const handleChange = useCallback((e) => {
    const next = Number(e.target.value);
    draggingRef.current = true;
    setLocalValue(next);
    pendingRef.current = next;
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  const handleCommit = useCallback(() => {
    draggingRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pendingRef.current !== null) {
      onChange(pendingRef.current);
      pendingRef.current = null;
    }
  }, [onChange]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={localValue}
      onChange={handleChange}
      onPointerUp={handleCommit}
      onBlur={handleCommit}
      className="audio-settings-menu__slider"
    />
  );
}

export default memo(VolumeSlider);
