/**
 * SignalR bağlantı servisi - placeholder.
 * Backend hazır olunca @microsoft/signalr paketi eklenip burada implemente edilecek.
 *
 * Kullanım planı:
 *   - Kanal bazlı mesaj dinleme (ReceiveMessage)
 *   - Kullanıcı çevrimiçi durumu (UserOnline / UserOffline)
 *   - Yazıyor göstergesi (UserTyping)
 */

let connection = null;
const listeners = new Map();

/**
 * SignalR bağlantısını başlat
 * @param {string} token - JWT token
 */
export async function startConnection(token) {
  // TODO: @microsoft/signalr paketi eklenince implement edilecek
  // const signalR = await import('@microsoft/signalr');
  // connection = new signalR.HubConnectionBuilder()
  //   .withUrl('/hubs/chat', { accessTokenFactory: () => token })
  //   .withAutomaticReconnect()
  //   .build();
  // await connection.start();
  console.info('[SignalR] Connection placeholder - backend hazır olunca aktif edilecek');
}

/**
 * Bağlantıyı durdur
 */
export async function stopConnection() {
  if (connection) {
    await connection.stop();
    connection = null;
  }
}

/**
 * Bir kanala katıl (grup)
 * @param {string} channelId
 */
export async function joinChannel(channelId) {
  if (!connection) return;
  await connection.invoke('JoinChannel', channelId);
}

/**
 * Bir kanaldan ayrıl
 * @param {string} channelId
 */
export async function leaveChannel(channelId) {
  if (!connection) return;
  await connection.invoke('LeaveChannel', channelId);
}

/**
 * Mesaj dinleyici ekle
 * @param {string} event - örn: "ReceiveMessage"
 * @param {Function} callback
 */
export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event).push(callback);

  if (connection) {
    connection.on(event, callback);
  }
}

/**
 * Mesaj dinleyici kaldır
 * @param {string} event
 * @param {Function} callback
 */
export function off(event, callback) {
  if (connection) {
    connection.off(event, callback);
  }
  const eventListeners = listeners.get(event);
  if (eventListeners) {
    const index = eventListeners.indexOf(callback);
    if (index !== -1) eventListeners.splice(index, 1);
  }
}

const SignalRService = {
  startConnection,
  stopConnection,
  joinChannel,
  leaveChannel,
  on,
  off,
};

export default SignalRService;