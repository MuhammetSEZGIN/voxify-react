import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
};

/**
 * Uygulamanın başlangıçta açılmasını sağlar veya kaldırır.
 * @param {boolean} shouldEnable 
 */
export async function setAutostart(shouldEnable) {
  if (!isTauriRuntime()) return;

  try {
    if (shouldEnable) {
      await enable();
    } else {
      await disable();
    }
  } catch (error) {
    console.error('Autostart ayarı değiştirilemedi:', error);
  }
}

/**
 * Başlangıçta açılma ayarını kontrol eder.
 * @returns {Promise<boolean>}
 */
export async function getAutostartStatus() {
  if (!isTauriRuntime()) return false;

  try {
    return await isEnabled();
  } catch (error) {
    console.error('Autostart durumu kontrol edilemedi:', error);
    return false;
  }
}
