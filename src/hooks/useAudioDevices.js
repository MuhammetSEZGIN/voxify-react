import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ses giriş/çıkış aygıtlarını enumerate eder ve `devicechange` olayını dinler.
 *
 * Mount'ta getUserMedia çağırmaz — sadece hâlihazırda erişilebilir etiketlerle
 * listeler. Kullanıcı mikrofon ayarlarını açtığında `requestPermission()`
 * çağrılıp etiketler doldurulur (izin verilmeden önce `label` boş gelir).
 *
 * Aygıt listesi tüm uygulamada tek bir yerden (UserBar) okunduğu için bu hook
 * her açılış/kapanışta yeniden enumerate etmez; referanslar stabil kalır.
 */
export default function useAudioDevices() {
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  // Aynı aygıt listesi için yeni dizi referansı üretmemek adına imzayı saklıyoruz;
  // aksi halde her `devicechange` gereksiz bir render zinciri tetikler.
  const signatureRef = useRef({ input: '', output: '' });

  const refresh = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      const outputs = devices.filter((d) => d.kind === 'audiooutput');

      const inputSig = inputs.map((d) => `${d.deviceId}:${d.label}`).join('|');
      const outputSig = outputs.map((d) => `${d.deviceId}:${d.label}`).join('|');

      if (inputSig !== signatureRef.current.input) {
        signatureRef.current.input = inputSig;
        setInputDevices(inputs);
      }
      if (outputSig !== signatureRef.current.output) {
        signatureRef.current.output = outputSig;
        setOutputDevices(outputs);
      }
    } catch {
      // Aygıt listeleme desteklenmiyor
    }
  }, []);

  /** Mikrofon izni ister, ardından etiketleri doldurmak için yeniden listeler. */
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // İzin reddedildi — yine de elde olan etiketlerle devam et
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return undefined;
    md.addEventListener('devicechange', refresh);
    return () => md.removeEventListener('devicechange', refresh);
  }, [refresh]);

  return { inputDevices, outputDevices, refresh, requestPermission };
}
