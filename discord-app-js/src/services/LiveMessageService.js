/**
 * SignalR bağlantı servisi - MessageHub entegrasyonu.
 *
 * Backend Hub metotları:
 *   - SendMessage(channelId, senderId, userName, message)
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

const HUB_URL =
  import.meta.env.VITE_HUB_URL ||
  (import.meta.env.VITE_BASE_URL
    ? import.meta.env.VITE_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/message'
    : 'http://localhost:5074/hubs/message');

let connection = null;
let connectionPromise = null;

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

  connectionPromise = (async () => {
    try {
      connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Bağlantı durumu loglama
      connection.onreconnecting((error) => {
        console.warn('[SignalR] Yeniden bağlanılıyor...', error);
      });

      connection.onreconnected((connectionId) => {
        console.info('[SignalR] Yeniden bağlandı:', connectionId);
      });

      connection.onclose((error) => {
        console.warn('[SignalR] Bağlantı kapandı', error);
        connection = null;
        connectionPromise = null;
      });

      await connection.start();
      console.info('[SignalR] Bağlantı kuruldu');
      return connection;
    } catch (error) {
      console.error('[SignalR] Bağlantı hatası:', error);
      connection = null;
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

/**
 * Bağlantıyı durdur.
 */
export async function stopConnection() {
  if (connection) {
    try {
      await connection.stop();
    } catch (error) {
      console.error('[SignalR] Bağlantı durdurma hatası:', error);
    }
    connection = null;
    connectionPromise = null;
  }
}

/**
 * Bir kanala katıl (SignalR grubuna eklenme).
 * @param {string} channelId
 */
export async function joinChannel(channelId) {
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
 * @param {string} channelId
 * @param {string} senderId
 * @param {string} userName
 * @param {string} message
 */
export async function sendMessage(channelId, senderId, userName, message) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    throw new Error('SignalR bağlantısı yok');
  }
  await connection.invoke('SendMessage', channelId, senderId, userName, message);
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
 * Bir olaya dinleyici ekle.
 * @param {string} event - örn: "ReceiveMessage", "MessageUpdated", "MessageUpdateFailed"
 * @param {Function} callback
 */
export function on(event, callback) {
  if (connection) {
    connection.on(event, callback);
  }
}

/**
 * Dinleyiciyi kaldır.
 * @param {string} event
 * @param {Function} callback
 */
export function off(event, callback) {
  if (connection) {
    connection.off(event, callback);
  }
}

const SignalRService = {
  getConnection,
  startConnection,
  stopConnection,
  joinChannel,
  leaveChannel,
  sendMessage,
  updateMessage,
  on,
  off,
};

export default SignalRService;