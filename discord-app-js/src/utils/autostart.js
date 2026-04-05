import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

/**
 * Uygulamanın başlangıçta açılmasını sağlar veya kaldırır.
 * @param {boolean} shouldEnable 
 */
export async function setAutostart(shouldEnable) {
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
  try {
    return await isEnabled();
  } catch (error) {
    console.error('Autostart durumu kontrol edilemedi:', error);
    return false;
  }
}
