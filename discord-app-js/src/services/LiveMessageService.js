/**
 * SignalR bağlantı servisi - MessageHub entegrasyonu.
 *
 * Backend Hub metotları:
 *   - SendMessage(channelId, clanId, message) — senderId/userName JWT'den (Context.UserIdentifier) türetilir
 *   - UpdateMessage(messageId, newContent)
 *   - JoinChannel(channelId)
 *   - LeaveChannel(channelId)
 *
 * Sunucudan gelen olaylar:
 *   - ReceiveMessage  → MessageDto
 *   - MessageUpdated  → MessageDto
 *   - MessageUpdateFailed → messageId
 */

import * as signalR from '@microsoft/signalr';
import { resolveHubUrl } from '../utils/hubUrl';

const HUB_URL = resolveHubUrl({
  explicitUrl: import.meta.env.VITE_HUB_URL,
  baseUrl: import.meta.env.VITE_BASE_URL,
  localPort: 5107,
  path: '/messagehub',
});

console.info('[LiveMessageService] HUB_URL:', HUB_URL);
let connection = null;
let connectionPromise = null;
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

/**
 * SignalR bağlantısını başlat.
 * Aynı anda birden fazla çağrıda yalnızca tek bağlantı kurulur.
 * @param {string} token - JWT token
 * @returns {Promise<signalR.HubConnection>}
 */
export async function startConnection(token) {
  // Zaten bağlıysa tekrar kurma
  if (connection?.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  // Devam eden bir bağlantı girişimi varsa onu bekle
  if (connectionPromise) {
    return connectionPromise;
  }

  const startPromise = (async () => {
    let nextConnection;
    try {
      nextConnection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build();

      connection = nextConnection;
      attachListeners(nextConnection);

      // Bağlantı durumu loglama
      nextConnection.onreconnecting((error) => {
        console.warn('[SignalR] Yeniden bağlanılıyor...', error);
      });

      nextConnection.onreconnected((connectionId) => {
        console.info('[SignalR] Yeniden bağlandı:', connectionId);
      });

      nextConnection.onclose((error) => {
        console.warn('[SignalR] Bağlantı kapandı', error);
        if (connection === nextConnection) connection = null;
      });

      await nextConnection.start();
      console.info('[SignalR] Bağlantı kuruldu');

      return nextConnection;
    } catch (error) {
      console.error('[SignalR] Bağlantı hatası:', error);
      if (connection === nextConnection) connection = null;
      throw error;
    } finally {
      if (connectionPromise === startPromise) connectionPromise = null;
    }
  })();

  connectionPromise = startPromise;

  return startPromise;
}

/**
 * Bağlantıyı durdur.
 */
export async function stopConnection() {
  const current = connection;
  connection = null;
  connectionPromise = null;
  if (!current) return;
  try {
    await current.stop();
  } catch (error) {
    console.error('[SignalR] Bağlantı durdurma hatası:', error);
  }
}

/**
 * Bir kanala katıl (SignalR grubuna eklenme).
 * @param {string} channelId
 */
export async function joinChannel(channelId) {
  // Bağlantı kuruluyorsa bekle
  if (connectionPromise) {
    await connectionPromise;
  }
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    console.warn('[SignalR] joinChannel çağrıldı ama bağlantı yok');
    return;
  }
  await connection.invoke('JoinChannel', channelId);
}

/**
 * Bir kanaldan ayrıl.
 * @param {string} channelId
 */
export async function leaveChannel(channelId) {
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
  // Bağlantı kuruluyorsa bekle
  if (connectionPromise) {
    await connectionPromise;
  }
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    throw new Error('SignalR bağlantısı yok');
  }

  await connection.invoke('SendMessage', channelId, clanId, message);
}

/**
 * Mesajı güncelle (Hub üzerinden).
 * @param {string} messageId
 * @param {string} newContent
 */
export async function updateMessage(messageId, newContent) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    throw new Error('SignalR bağlantısı yok');
  }
  await connection.invoke('UpdateMessage', messageId, newContent);
}

/**
 * Mesajı sil (Hub üzerinden).
 * @param {string} messageId
 * @param {string} channelId
 */
export async function deleteMessage(messageId, channelId) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    throw new Error('SignalR bağlantısı yok');
  }
  await connection.invoke('DeleteMessage', messageId, channelId);
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
