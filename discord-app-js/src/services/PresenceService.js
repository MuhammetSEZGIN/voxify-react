/**
 * SignalR bağlantı servisi - PresenceHub entegrasyonu.
 * Hem online durum hem de ses kanalı katılım bilgisini tek hub üzerinden yönetir.
 *
 * Backend Hub metotları (Client → Server):
 *   - SubscribeToClans(clanIds: string[])
 *   - GetOnlineUsers(userIds: string[])
 *   - JoinVoiceChannel(clanId, voiceChannelId, userName)
 *   - LeaveVoiceChannel()
 *   - GetVoiceChannelParticipants(clanId)
 *
 * Sunucudan gelen olaylar (Server → Client):
 *   - UserOnline       → userId
 *   - UserOffline      → userId
 *   - OnlineUsers      → string[]
 *   - UserJoinedVoice  → { clanId, voiceChannelId, userId, userName }
 *   - UserLeftVoice    → { clanId, voiceChannelId, userId }
 *   - VoiceChannelParticipants → { clanId, participants: [{ voiceChannelId, userId, userName }] }
 */

import * as signalR from '@microsoft/signalr';

const HUB_URL =
  import.meta.env.VITE_PRESENCE_HUB_URL ||
  (import.meta.env.VITE_BASE_URL
    ? import.meta.env.VITE_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/presence'
    : 'http://localhost:5074/hubs/presence');

console.info('[PresenceService] HUB_URL:', HUB_URL);

let connection = null;

/**
 * SignalR bağlantısını başlat.
 * @param {string} token - JWT token
 * @returns {Promise<signalR.HubConnection>}
 */
export async function startConnection(token) {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  if (connection) {
    await connection.stop().catch(() => {});
    connection = null;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  await connection.start();
  console.info('[PresenceService] Connected');
  return connection;
}

/**
 * SignalR bağlantısını durdur.
 */
export async function stopConnection() {
  if (connection) {
    await connection.stop().catch(() => {});
    connection = null;
    console.info('[PresenceService] Disconnected');
  }
}

// ─── Online Presence ───────────────────────────────────────────────────────

/** Klanlara abone ol (online/offline eventlerini almak için). */
export async function subscribeToClans(clanIds) {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('SubscribeToClans', clanIds);
}

/** Verilen userId listesinden hangilerinin online olduğunu iste (sunucu OnlineUsers ile yanıt verir). */
export async function getOnlineUsers(userIds) {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('GetOnlineUsers', userIds);
}

// ─── Voice Channel Presence ────────────────────────────────────────────────

/** Kullanıcıyı ses kanalına kaydet. userId sunucu tarafından token'dan alınır. */
export async function joinVoiceChannel(clanId, voiceChannelId, userName) {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('JoinVoiceChannel', clanId, voiceChannelId, userName);
}

/** Kullanıcıyı ses kanalından çıkar. Sunucu connection üzerinden tespit eder. */
export async function leaveVoiceChannel() {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('LeaveVoiceChannel');
}

/** Klandaki mevcut ses kanalı katılımcılarını iste. */
export async function getParticipants(clanId) {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('GetVoiceChannelParticipants', clanId);
}

// ─── Event Registration ────────────────────────────────────────────────────

// Online presence events
export function onUserOnline(callback) {
  connection?.on('UserOnline', callback);
}
export function onUserOffline(callback) {
  connection?.on('UserOffline', callback);
}
export function onOnlineUsers(callback) {
  connection?.on('OnlineUsers', callback);
}

export function offUserOnline(callback) {
  connection?.off('UserOnline', callback);
}
export function offUserOffline(callback) {
  connection?.off('UserOffline', callback);
}
export function offOnlineUsers(callback) {
  connection?.off('OnlineUsers', callback);
}

// Voice presence events
export function onUserJoinedVoice(callback) {
  connection?.on('UserJoinedVoice', callback);
}
export function onUserLeftVoice(callback) {
  connection?.on('UserLeftVoice', callback);
}
export function onVoiceChannelParticipants(callback) {
  connection?.on('VoiceChannelParticipants', callback);
}

export function offUserJoinedVoice(callback) {
  connection?.off('UserJoinedVoice', callback);
}
export function offUserLeftVoice(callback) {
  connection?.off('UserLeftVoice', callback);
}
export function offVoiceChannelParticipants(callback) {
  connection?.off('VoiceChannelParticipants', callback);
}
