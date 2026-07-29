const AUTH_KEYS = ['token', 'refreshToken', 'user']
const memoryFallback = new Map()

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function getAuthItem(key) {
  try {
    const stored = getSessionStorage()?.getItem(key)
    return stored ?? memoryFallback.get(key) ?? null
  } catch {
    return memoryFallback.get(key) ?? null
  }
}

export function setAuthItem(key, value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  memoryFallback.set(key, serialized)
  try {
    getSessionStorage()?.setItem(key, serialized)
  } catch {
    // Depolama kapalıysa oturum sekme açık kaldığı sürece bellekte devam eder.
  }
}

export function removeAuthItem(key) {
  memoryFallback.delete(key)
  try {
    getSessionStorage()?.removeItem(key)
  } catch {
    // Bellek kopyası zaten temizlendi.
  }
}

export function clearAuthSession() {
  for (const key of AUTH_KEYS) removeAuthItem(key)
}

// Eski masaüstü/web sürümleri tokenları kalıcı localStorage'a yazıyordu.
// Bir kez mevcut sekme oturumuna taşıyıp kalıcı kopyaları hemen sileriz.
export function migrateLegacyAuthStorage() {
  if (typeof window === 'undefined') return

  for (const key of AUTH_KEYS) {
    try {
      const legacyValue = window.localStorage.getItem(key)
      if (legacyValue !== null && getAuthItem(key) === null) {
        setAuthItem(key, legacyValue)
      }
      window.localStorage.removeItem(key)
    } catch {
      // localStorage kapalı/erişilemez olabilir; güvenli sekme deposu kullanılmaya devam eder.
    }
  }
}
