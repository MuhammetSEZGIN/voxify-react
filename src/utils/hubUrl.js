/**
 * Prod'da hub'lar REST ile aynı origin'de, local'de ise gateway'i bypass eden
 * ayrı portlardadır. Tüm SignalR servisleri için bu farkı tek yerde çözer.
 */
export function resolveHubUrl({ explicitUrl, baseUrl, localPort, path }) {
  if (explicitUrl) return explicitUrl;

  const rawBase = baseUrl || `http://localhost:${localPort}`;
  try {
    const parsed = new URL(rawBase);
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      return `${parsed.protocol}//${parsed.hostname}:${localPort}${path}`;
    }
  } catch {
    // Aşağıdaki normalize edilmiş fallback daha anlamlı bir URL üretir.
  }

  return `${rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '')}${path}`;
}
