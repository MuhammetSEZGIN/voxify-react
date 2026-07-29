import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ses giriş/çıkış aygıtlarını enumerate eder ve `devicechange` olayını dinler.
 *
 * Mount'ta getUserMedia çağırmaz — sadece hâlihazırda erişilebilir etiketlerle
 * listeler. Kullanıcı izin düğmesine bastığında `requestPermission()` çağrılıp
 * etiketler doldurulur (izin verilmeden önce `label` boş gelebilir).
 *
 * Aynı aygıt listesi için gereksiz state güncellemelerini imza karşılaştırması
 * ile engeller; UserBar ve ayarlar ekranı güvenle ayrı örnek kullanabilir.
 */
export default function useAudioDevices() {
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [microphonePermission, setMicrophonePermission] = useState('unknown');
  const [permissionError, setPermissionError] = useState(null);
  // Aynı aygıt listesi için yeni dizi referansı üretmemek adına imzayı saklıyoruz;
  // aksi halde her `devicechange` gereksiz bir render zinciri tetikler.
  const signatureRef = useRef({ input: '', output: '' });

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
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

  const refreshPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermission('unsupported');
      return 'unsupported';
    }

    if (!navigator.permissions?.query) return 'unknown';
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      setMicrophonePermission(status.state);
      return status.state;
    } catch {
      // Firefox ve bazı Safari sürümleri microphone sorgusunu desteklemez.
      return 'unknown';
    }
  }, []);

  /** Mikrofon izni ister, ardından etiketleri doldurmak için yeniden listeler. */
  const requestPermission = useCallback(async () => {
    setPermissionError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermission('unsupported');
      setPermissionError('Bu tarayıcı mikrofon erişimini desteklemiyor.');
      return 'unsupported';
    }

    let requestedState;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      requestedState = 'granted';
      setMicrophonePermission('granted');
    } catch (error) {
      const denied = ['NotAllowedError', 'PermissionDeniedError'].includes(error?.name);
      requestedState = denied ? 'denied' : 'unknown';
      setMicrophonePermission(requestedState);
      setPermissionError(
        denied
          ? 'Mikrofon izni kapalı. Adres çubuğundaki site ayarlarından Mikrofon iznini açabilirsin.'
          : 'Mikrofon bu cihazda başlatılamadı. Başka bir uygulamanın mikrofonu kullanmadığını kontrol et.'
      );
    }
    await refresh();
    const queriedState = await refreshPermission();
    return queriedState === 'unknown' ? requestedState : queriedState;
  }, [refresh, refreshPermission]);

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => {
      refresh();
      refreshPermission();
    }, 0);
    let permissionStatus;
    const handlePermissionChange = () => {
      refreshPermission();
      refresh();
    };
    const subscribePermission = async () => {
      if (!navigator.permissions?.query) return;
      try {
        permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        permissionStatus.addEventListener?.('change', handlePermissionChange);
      } catch {
        // Permissions API bu izin türünü desteklemiyorsa odaklanma olayı yeterli.
      }
    };
    subscribePermission();
    const md = navigator.mediaDevices;
    md?.addEventListener?.('devicechange', refresh);
    window.addEventListener('focus', handlePermissionChange);
    return () => {
      window.clearTimeout(initializeTimer);
      md?.removeEventListener?.('devicechange', refresh);
      window.removeEventListener('focus', handlePermissionChange);
      permissionStatus?.removeEventListener?.('change', handlePermissionChange);
    };
  }, [refresh, refreshPermission]);

  return {
    inputDevices,
    outputDevices,
    microphonePermission,
    permissionError,
    refresh,
    refreshPermission,
    requestPermission,
  };
}
