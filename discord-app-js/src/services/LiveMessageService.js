/**
 * SignalR bağlantı servisi - MessageHub entegrasyonu.
 *
 * Backend Hub metotları:
 *   - SendMessage(channelId, clanId, message) — senderId/userName JWT'den (Context.UserIdentifier) türetilir
 *   - UpdateMessage(messageId, clanId, newContent)
 *   - JoinChannel(channelId, clanId)
 *   - LeaveChannel(channelId)
 *
 * Sunucudan gelen olaylar:
 *   - ReceiveMessage  → MessageDto
 *   - MessageUpdated  → MessageDto
 *   - MessageUpdateFailed → messageId
 */

import * as signalR from '@microsoft/signalr';
import { resolveHubUrl } from '../utils/hubUrl';

const HUB_BASE_URL = resolveHubUrl({
  explicitUrl: import.meta.env.VITE_HUB_URL,
  baseUrl: import.meta.env.VITE_BASE_URL,
  localPort: 5000,
  path: '/messagehub',
});

console.info('[LiveMessageService] HUB_BASE_URL:', HUB_BASE_URL);
let connection = null;
let connectionPromise = null;
let connectionScope = null;
let pendingScope = null;
let currentToken = null;
let rejoinPromise = null;
let rejoinError = null;
const joinedChannels = new Map();
const intentionalStops = new WeakSet();
// Dinleyiciler bağlantıdan bağımsız tutulur. Böylece bağlantı kurulurken
// kaydedilen callback'ler iki kez eklenmez ve yeni bağlantıya otomatik taşınır.
const listeners = new Map();

function attachListeners(target) {
  for (const [event, callbacks] of listeners) {
    for (const callback of callbacks) target.on(event, callback);
  }
}

/**
 * Mevcut bağlantıyı döndürür (veya null).
 */
export function getConnection() {
  return connection;
}

function normalizeClanId(clanId) {
  return clanId ? String(clanId).toLowerCase() : null;
}

function getScope(clanId) {
  const normalizedClanId = normalizeClanId(clanId);
  return normalizedClanId ? `clan:${normalizedClanId}` : 'dm';
}

function getHubUrl(clanId) {
  const normalizedClanId = normalizeClanId(clanId);
  return normalizedClanId
    ? `${HUB_BASE_URL.replace(/\/+$/, '')}/clanId/${encodeURIComponent(normalizedClanId)}`
    : HUB_BASE_URL;
}

function channelSubscriptionKey(channelId, clanId) {
  return `${getScope(clanId)}:${channelId}`;
}

async function restoreJoinedChannels(target, scope) {
  const subscriptions = [...joinedChannels.values()].filter(
    (subscription) => subscription.scope === scope
  );
  for (const subscription of subscriptions) {
    await target.invoke('JoinChannel', subscription.channelId, subscription.clanId);
  }
}

function scheduleChannelRestore(target, scope) {
  rejoinError = null;
  const pending = restoreJoinedChannels(target, scope).catch((error) => {
    rejoinError = error;
    throw error;
  });
  rejoinPromise = pending;
  pending.catch(() => {}).finally(() => {
    if (rejoinPromise === pending) rejoinPromise = null;
  });
  return pending;
}

async function stopActiveConnection() {
  const current = connection;
  connection = null;
  connectionScope = null;
  if (!current) return;

  try {
    intentionalStops.add(current);
    await current.stop();
  } catch (error) {
    console.error('[SignalR] Bağlantı durdurma hatası:', error);
  }
}

async function getReadyConnection(clanId) {
  while (connectionPromise) {
    await connectionPromise;
  }
  if (rejoinPromise) await rejoinPromise;
  if (rejoinError) {
    throw new Error('SignalR kanal aboneliği yeniden kurulamadı.');
  }

  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    throw new Error('SignalR bağlantısı yok');
  }
  if (connectionScope !== getScope(clanId)) {
    throw new Error('SignalR bağlantısı farklı bir klana ait');
  }

  return connection;
}

/**
 * SignalR bağlantısını başlat.
 * Aynı anda birden fazla çağrıda yalnızca tek bağlantı kurulur.
 * @param {string} token - JWT token
 * @param {string|null} clanId - Klan sohbetinde clanId, DM bağlantısında null
 * @returns {Promise<signalR.HubConnection>}
 */
export async function startConnection(token, clanId = null) {
  if (!token) throw new Error('SignalR bağlantısı için token gerekli');

  currentToken = token;
  const desiredScope = getScope(clanId);
  rejoinError = null;

  if (
    connection?.state === signalR.HubConnectionState.Connected
    && connectionScope === desiredScope
  ) {
    return connection;
  }

  if (connectionPromise) {
    if (pendingScope === desiredScope) return connectionPromise;

    try {
      await connectionPromise;
    } catch {
      // Yeni scope kendi bağlantı hatasını ayrıca raporlayacak.
    }
    return startConnection(token, clanId);
  }

  const startPromise = (async () => {
    let nextConnection;
    try {
      await stopActiveConnection();

      nextConnection = new signalR.HubConnectionBuilder()
        .withUrl(getHubUrl(clanId), {
          accessTokenFactory: () => currentToken,
          transport: signalR.HttpTransportType.WebSockets,
          skipNegotiation: true,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      connection = nextConnection;
      connectionScope = desiredScope;
      attachListeners(nextConnection);

      // Bağlantı durumu loglama
      nextConnection.onreconnecting((error) => {
        console.warn('[SignalR] Yeniden bağlanılıyor...', error);
      });

      nextConnection.onreconnected((connectionId) => {
        if (connection !== nextConnection) return;
        scheduleChannelRestore(nextConnection, desiredScope)
          .then(() => console.info('[SignalR] Yeniden bağlandı ve kanal abonelikleri yenilendi:', connectionId))
          .catch((error) => console.error('[SignalR] Kanal abonelikleri yenilenemedi:', error));
      });

      nextConnection.onclose((error) => {
        if (intentionalStops.has(nextConnection)) {
          intentionalStops.delete(nextConnection);
          console.info('[SignalR] Bağlantı kapsam değişikliği için kapatıldı');
        } else {
          console.warn('[SignalR] Bağlantı kapandı', error);
        }
        if (connection === nextConnection) {
          connection = null;
          connectionScope = null;
        }
      });

      await nextConnection.start();
      await scheduleChannelRestore(nextConnection, desiredScope);
      console.info('[SignalR] Bağlantı kuruldu');

      return nextConnection;
    } catch (error) {
      console.error('[SignalR] Bağlantı hatası:', error);
      if (connection === nextConnection) {
        connection = null;
        connectionScope = null;
      }
      throw error;
    } finally {
      if (connectionPromise === startPromise) {
        connectionPromise = null;
        pendingScope = null;
      }
    }
  })();

  connectionPromise = startPromise;
  pendingScope = desiredScope;

  return startPromise;
}

/**
 * Bağlantıyı durdur.
 */
export async function stopConnection() {
  if (connectionPromise) {
    try {
      await connectionPromise;
    } catch {
      // Başlatma başarısızsa durdurulacak aktif bağlantı yoktur.
    }
  }
  await stopActiveConnection();
  joinedChannels.clear();
  rejoinPromise = null;
  rejoinError = null;
}

/**
 * Bir kanala katıl (SignalR grubuna eklenme).
 * @param {string} channelId
 * @param {string|null} clanId
 */
export async function joinChannel(channelId, clanId = null) {
  const readyConnection = await getReadyConnection(clanId);
  const normalizedClanId = normalizeClanId(clanId);
  await readyConnection.invoke('JoinChannel', channelId, normalizedClanId);
  joinedChannels.set(channelSubscriptionKey(channelId, normalizedClanId), {
    channelId,
    clanId: normalizedClanId,
    scope: getScope(normalizedClanId),
  });
  rejoinError = null;
}

/**
 * Bir kanaldan ayrıl.
 * @param {string} channelId
 */
export async function leaveChannel(channelId) {
  for (const [key, subscription] of joinedChannels) {
    if (subscription.channelId === channelId) joinedChannels.delete(key);
  }
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    return;
  }
  try {
    await connection.invoke('LeaveChannel', channelId);
  } catch (error) {
    console.warn('[SignalR] leaveChannel hatası:', error);
  }
}

/**
 * Mesaj gönder (Hub üzerinden).
 * senderId/userName artık backend'de JWT'den türetiliyor, client'tan alınmıyor.
 * @param {string} channelId
 * @param {string} clanId
 * @param {string} message
 */
export async function sendMessage(channelId, clanId, message) {
  const readyConnection = await getReadyConnection(clanId);
  await readyConnection.invoke('SendMessage', channelId, normalizeClanId(clanId), message);
}

/**
 * Mesajı güncelle (Hub üzerinden).
 * @param {string} messageId
 * @param {string|null} clanId
 * @param {string} newContent
 */
export async function updateMessage(messageId, clanId, newContent) {
  const readyConnection = await getReadyConnection(clanId);
  await readyConnection.invoke('UpdateMessage', messageId, normalizeClanId(clanId), newContent);
}

/**
 * Mesajı sil (Hub üzerinden).
 * @param {string} messageId
 * @param {string} channelId
 * @param {string|null} clanId
 */
export async function deleteMessage(messageId, channelId, clanId) {
  const readyConnection = await getReadyConnection(clanId);
  await readyConnection.invoke('DeleteMessage', messageId, channelId, normalizeClanId(clanId));
}

/**
 * Bir olaya dinleyici ekle.
 * @param {string} event - örn: "ReceiveMessage", "MessageUpdated", "MessageUpdateFailed"
 * @param {Function} callback
 */
export function on(event, callback) {
  let callbacks = listeners.get(event);
  if (!callbacks) {
    callbacks = new Set();
    listeners.set(event, callbacks);
  }
  if (callbacks.has(callback)) return;
  callbacks.add(callback);
  connection?.on(event, callback);
}

/**
 * Dinleyiciyi kaldır.
 * @param {string} event
 * @param {Function} callback
 */
export function off(event, callback) {
  connection?.off(event, callback);
  const callbacks = listeners.get(event);
  callbacks?.delete(callback);
  if (callbacks?.size === 0) listeners.delete(event);
}

const SignalRService = {
  getConnection,
  startConnection,
  stopConnection,
  joinChannel,
  leaveChannel,
  sendMessage,
  updateMessage,
  deleteMessage,
  on,
  off,
};

export default SignalRService;
