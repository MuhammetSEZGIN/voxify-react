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
    ? import.meta.env.VITE_BASE_URL.replace(/\/api\/?$/, '') + '/messagehub'
    : 'http://localhost:5074/hubs/message');

console.info('[LiveMessageService] HUB_URL:', HUB_URL);
let connection = null;
let connectionPromise = null;
// Bağlantı kurulmadan önce eklenen dinleyicileri saklayacak kuyruk
const pendingListeners = [];

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

      // Bağlantı kurulmadan önce kuyrukta bekleyen dinleyicileri kaydet
      pendingListeners.forEach(({ event, callback }) => {
        connection.on(event, callback);
      });
      // Kuyruğu temizleme — off ile eşleştirme gerekebilir

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
    if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
      console.info('[SignalR] Bağlantı güvenle kapatıldı.');
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
 * @param {string} channelId
 * @param {string} clanId
 * @param {string} senderId
 * @param {string} userName
 * @param {string} message
 */
export async function sendMessage(channelId, clanId, senderId, userName, message) {
  // Bağlantı kuruluyorsa bekle
  if (connectionPromise) {
    await connectionPromise;
  }
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    throw new Error('SignalR bağlantısı yok');
  }
  await connection.invoke('SendMessage', channelId, clanId, senderId, userName, message);
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
  if (connection) {
    connection.on(event, callback);
  }
  // Bağlantı henüz kurulmamışsa kuyruğa ekle
  pendingListeners.push({ event, callback });
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
  // Kuyruktan da kaldır
  const idx = pendingListeners.findIndex((l) => l.event === event && l.callback === callback);
  if (idx !== -1) pendingListeners.splice(idx, 1);
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