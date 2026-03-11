/**
 * SignalR bağlantı servisi - VoicePresenceHub entegrasyonu.
 *
 * Backend Hub metotları (Client → Server):
 *   - JoinVoiceChannel(clanId, voiceChannelId, userId, userName)
 *   - LeaveVoiceChannel(clanId, voiceChannelId, userId)
 *   - GetVoiceChannelParticipants(clanId)
 *
 * Sunucudan gelen olaylar (Server → Client):
 *   - UserJoinedVoice  → { clanId, voiceChannelId, userId, userName }
 *   - UserLeftVoice    → { clanId, voiceChannelId, userId }
 *   - VoiceChannelParticipants → { clanId, participants: [{ voiceChannelId, userId, userName }] }
 */

import * as signalR from '@microsoft/signalr';

const HUB_URL =
  import.meta.env.VITE_VOICE_PRESENCE_HUB_URL ||
  (import.meta.env.VITE_BASE_URL
    ? import.meta.env.VITE_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/voice-presence'
    : 'http://localhost:5074/hubs/voice-presence');

console.info('[VoicePresenceService] HUB_URL:', HUB_URL);

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
  console.info('[VoicePresenceService] Connected');
  return connection;
}

/**
 * SignalR bağlantısını durdur.
 */
export async function stopConnection() {
  if (connection) {
    await connection.stop().catch(() => {});
    connection = null;
    console.info('[VoicePresenceService] Disconnected');
  }
}

/** Kullanıcıyı ses kanalına kaydet. */
export async function joinVoiceChannel(clanId, voiceChannelId, userId, userName) {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('JoinVoiceChannel', clanId, voiceChannelId, userId, userName);
}

/** Kullanıcıyı ses kanalından çıkar. */
export async function leaveVoiceChannel(clanId, voiceChannelId, userId) {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('LeaveVoiceChannel', clanId, voiceChannelId, userId);
}

/** Klandaki mevcut ses kanalı katılımcılarını iste (sunucu VoiceChannelParticipants ile yanıt verir). */
export async function getParticipants(clanId) {
  if (connection?.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('GetVoiceChannelParticipants', clanId);
}

// ─── Event Registration ────────────────────────────────────────────────────

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
