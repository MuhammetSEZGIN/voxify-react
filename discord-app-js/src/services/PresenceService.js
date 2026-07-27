import * as signalR from '@microsoft/signalr';
import { resolveHubUrl } from '../utils/hubUrl';

const HUB_URL = resolveHubUrl({
  explicitUrl: import.meta.env.VITE_PRESENCE_HUB_URL,
  baseUrl: import.meta.env.VITE_BASE_URL,
  localPort: 5241,
  path: '/hubs/presence',
});

let connection = null;
let connectionPromise = null;
const listeners = new Map();
const reconnectedListeners = new Set();

export function isExpectedConnectionStop(error) {
  return error?.name === 'AbortError'
    || /stopped during negotiation|connection (?:was )?stopped/i.test(error?.message || '');
}

function registerListeners(target) {
  for (const [event, callbacks] of listeners) {
    for (const callback of callbacks) target.on(event, callback);
  }
}

function addListener(event, callback) {
  let callbacks = listeners.get(event);
  if (!callbacks) {
    callbacks = new Set();
    listeners.set(event, callbacks);
  }
  if (callbacks.has(callback)) return;
  callbacks.add(callback);
  connection?.on(event, callback);
}

function removeListener(event, callback) {
  connection?.off(event, callback);
  const callbacks = listeners.get(event);
  callbacks?.delete(callback);
  if (callbacks?.size === 0) listeners.delete(event);
}

async function invoke(method, ...args) {
  if (connectionPromise) await connectionPromise;
  if (connection?.state !== signalR.HubConnectionState.Connected) {
    throw new Error('Presence bağlantısı hazır değil.');
  }
  return connection.invoke(method, ...args);
}

export async function startConnection(token) {
  if (connection?.state === signalR.HubConnectionState.Connected) return connection;
  if (connectionPromise) return connectionPromise;

  const startPromise = (async () => {
    const nextConnection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    registerListeners(nextConnection);
    nextConnection.onreconnected((connectionId) => {
      for (const callback of reconnectedListeners) callback(connectionId);
    });
    nextConnection.onclose(() => {
      if (connection === nextConnection) {
        connection = null;
        connectionPromise = null;
      }
    });

    connection = nextConnection;
    try {
      await nextConnection.start();
      return nextConnection;
    } catch (error) {
      if (connection === nextConnection) connection = null;
      throw error;
    } finally {
      if (connectionPromise === startPromise) connectionPromise = null;
    }
  })();

  connectionPromise = startPromise;

  return startPromise;
}

export async function stopConnection() {
  const current = connection;
  connection = null;
  connectionPromise = null;
  if (current) await current.stop().catch(() => {});
}

// Online ve abonelik metotları
export const subscribeToClans = (clanIds) => invoke('SubscribeToClans', clanIds);
export const subscribeToConversations = (conversationIds) =>
  invoke('SubscribeToConversations', conversationIds);
export const subscribeToUsers = (userIds) => invoke('SubscribeToUsers', userIds);
export const getOnlineUsers = (userIds) => invoke('GetOnlineUsers', userIds);

// Ses presence metotları
export const joinVoiceChannel = (clanId, voiceChannelId, userName) =>
  invoke('JoinVoiceChannel', clanId, voiceChannelId, userName);
export const leaveVoiceChannel = () => invoke('LeaveVoiceChannel');
export const getParticipants = (clanId) => invoke('GetVoiceChannelParticipants', clanId);

// DM arama durum makinesi
export const callUser = (conversationId) => invoke('CallUser', conversationId);
export const acceptCall = (callId) => invoke('AcceptCall', callId);
export const rejectCall = (callId) => invoke('RejectCall', callId);
export const cancelCall = (callId) => invoke('CancelCall', callId);
export const endCall = (callId) => invoke('EndCall', callId);

const eventAccessors = {
  UserOnline: ['onUserOnline', 'offUserOnline'],
  UserOffline: ['onUserOffline', 'offUserOffline'],
  OnlineUsers: ['onOnlineUsers', 'offOnlineUsers'],
  SubscriptionFailed: ['onSubscriptionFailed', 'offSubscriptionFailed'],
  UserJoinedVoice: ['onUserJoinedVoice', 'offUserJoinedVoice'],
  UserLeftVoice: ['onUserLeftVoice', 'offUserLeftVoice'],
  VoiceChannelParticipants: ['onVoiceChannelParticipants', 'offVoiceChannelParticipants'],
  OnChannelUpserted: ['onChannelUpserted', 'offChannelUpserted'],
  OnVoiceChannelUpserted: ['onVoiceChannelUpserted', 'offVoiceChannelUpserted'],
  OnChannelDeleted: ['onChannelDeleted', 'offChannelDeleted'],
  OnVoiceChannelDeleted: ['onVoiceChannelDeleted', 'offVoiceChannelDeleted'],
  OnClanMembershipChanged: ['onClanMembershipChanged', 'offClanMembershipChanged'],
  OnClanDeleted: ['onClanDeleted', 'offClanDeleted'],
  IncomingCall: ['onIncomingCall', 'offIncomingCall'],
  CallRinging: ['onCallRinging', 'offCallRinging'],
  CallAccepted: ['onCallAccepted', 'offCallAccepted'],
  CallRejected: ['onCallRejected', 'offCallRejected'],
  CallCancelled: ['onCallCancelled', 'offCallCancelled'],
  CallTimedOut: ['onCallTimedOut', 'offCallTimedOut'],
  CallBusy: ['onCallBusy', 'offCallBusy'],
  CallEnded: ['onCallEnded', 'offCallEnded'],
  CallAnsweredElsewhere: ['onCallAnsweredElsewhere', 'offCallAnsweredElsewhere'],
  CallFailed: ['onCallFailed', 'offCallFailed'],
};

const exportedAccessors = {};
for (const [event, [onName, offName]] of Object.entries(eventAccessors)) {
  exportedAccessors[onName] = (callback) => addListener(event, callback);
  exportedAccessors[offName] = (callback) => removeListener(event, callback);
}

export const {
  onUserOnline, offUserOnline, onUserOffline, offUserOffline, onOnlineUsers, offOnlineUsers,
  onSubscriptionFailed, offSubscriptionFailed,
  onUserJoinedVoice, offUserJoinedVoice, onUserLeftVoice, offUserLeftVoice,
  onVoiceChannelParticipants, offVoiceChannelParticipants,
  onChannelUpserted, offChannelUpserted,
  onVoiceChannelUpserted, offVoiceChannelUpserted,
  onChannelDeleted, offChannelDeleted, onVoiceChannelDeleted, offVoiceChannelDeleted,
  onClanMembershipChanged, offClanMembershipChanged,
  onClanDeleted, offClanDeleted, onIncomingCall, offIncomingCall,
  onCallRinging, offCallRinging, onCallAccepted, offCallAccepted,
  onCallRejected, offCallRejected, onCallCancelled, offCallCancelled,
  onCallTimedOut, offCallTimedOut, onCallBusy, offCallBusy,
  onCallEnded, offCallEnded, onCallFailed, offCallFailed,
  onCallAnsweredElsewhere, offCallAnsweredElsewhere,
} = exportedAccessors;

export function onReconnected(callback) {
  reconnectedListeners.add(callback);
}

export function offReconnected(callback) {
  reconnectedListeners.delete(callback);
}
