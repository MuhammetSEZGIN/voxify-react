import { useCallback, useEffect, useRef, useState } from 'react';
import * as PresenceService from '../services/PresenceService';

const TERMINAL_PHASES = {
  CallRejected: 'rejected',
  CallCancelled: 'cancelled',
  CallTimedOut: 'timed-out',
  CallBusy: 'busy',
  CallEnded: 'ended',
  CallFailed: 'failed',
};

function normalizeCall(payload, fallback = {}) {
  const raw = typeof payload === 'object' && payload !== null ? payload : {};
  return {
    ...fallback,
    ...raw,
    callId: raw.callId || raw.id || fallback.callId || null,
    conversationId: raw.conversationId || fallback.conversationId || null,
    callerUserId: raw.callerUserId || raw.callerId || fallback.callerUserId || null,
    calleeUserId: raw.calleeUserId || raw.calleeId || fallback.calleeUserId || null,
    roomId: raw.roomId || fallback.roomId || null,
    serverMessage: typeof payload === 'string' ? payload : raw.message || null,
  };
}

export default function useDmCall({ onAccepted, onEnded } = {}) {
  const [call, setCall] = useState(null);
  const [error, setError] = useState(null);
  const callRef = useRef(null);
  const pendingRef = useRef(null);
  const acceptedIdsRef = useRef(new Set());
  const callbacksRef = useRef({ onAccepted, onEnded });

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  // Sunucu süpürmesi gecikse veya timeout eventi yalnızca arayana gitse bile
  // gelen arama zili payload'daki son kullanma zamanında mutlaka durur.
  useEffect(() => {
    if (call?.phase !== 'incoming') return undefined;
    const expiresAt = new Date(call.expiresAt || Date.now() + 31000).getTime();
    const delay = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => {
      setCall((current) =>
        current?.callId === call.callId && current.phase === 'incoming'
          ? { ...current, phase: 'timed-out' }
          : current
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [call?.callId, call?.expiresAt, call?.phase]);

  useEffect(() => {
    callbacksRef.current = { onAccepted, onEnded };
  }, [onAccepted, onEnded]);

  useEffect(() => {
    const handleIncoming = (payload) => {
      setError(null);
      setCall({ ...normalizeCall(payload), direction: 'incoming', phase: 'incoming' });
    };
    const handleRinging = (payload) => {
      setError(null);
      const next = normalizeCall(payload, pendingRef.current || {});
      setCall({ ...next, direction: 'outgoing', phase: 'ringing' });
    };
    const handleAccepted = (payload) => {
      const next = normalizeCall(payload, callRef.current || pendingRef.current || {});
      setError(null);
      setCall((current) => ({ ...current, ...next, phase: 'accepted' }));
      if (!next.callId || !acceptedIdsRef.current.has(next.callId)) {
        if (next.callId) acceptedIdsRef.current.add(next.callId);
        callbacksRef.current.onAccepted?.(next);
      }
    };
    const handleTerminal = (event) => (payload) => {
      const current = callRef.current || pendingRef.current || {};
      const next = normalizeCall(payload, current);
      pendingRef.current = null;
      if (next.callId) acceptedIdsRef.current.delete(next.callId);
      setCall({ ...current, ...next, phase: TERMINAL_PHASES[event] });
      if (event === 'CallFailed') {
        setError(next.serverMessage || 'Çağrı başlatılamadı.');
      }
      if (event === 'CallEnded') callbacksRef.current.onEnded?.(next);
    };

    PresenceService.onIncomingCall(handleIncoming);
    PresenceService.onCallRinging(handleRinging);
    PresenceService.onCallAccepted(handleAccepted);
    const terminalHandlers = Object.keys(TERMINAL_PHASES).map((event) => {
      const handler = handleTerminal(event);
      const method = `on${event}`;
      PresenceService[method](handler);
      return [event, handler];
    });

    return () => {
      PresenceService.offIncomingCall(handleIncoming);
      PresenceService.offCallRinging(handleRinging);
      PresenceService.offCallAccepted(handleAccepted);
      for (const [event, handler] of terminalHandlers) {
        PresenceService[`off${event}`](handler);
      }
    };
  }, []);

  const startCall = useCallback(async (conversation) => {
    if (!conversation?.conversationId) return;
    const pending = {
      conversationId: conversation.conversationId,
      otherUserId: conversation.otherUserId,
      otherUserName: conversation.otherUserName,
      direction: 'outgoing',
      phase: 'starting',
    };
    pendingRef.current = pending;
    setCall(pending);
    setError(null);
    try {
      await PresenceService.callUser(conversation.conversationId);
    } catch (err) {
      pendingRef.current = null;
      setCall({ ...pending, phase: 'failed' });
      setError(err.message || 'Çağrı başlatılamadı.');
    }
  }, []);

  const run = useCallback(async (action, failureMessage) => {
    const current = callRef.current;
    if (!current?.callId) return;
    setError(null);
    try {
      await action(current.callId);
    } catch (err) {
      setError(err.message || failureMessage);
    }
  }, []);

  const accept = useCallback(() => run(PresenceService.acceptCall, 'Çağrı kabul edilemedi.'), [run]);
  const reject = useCallback(() => run(PresenceService.rejectCall, 'Çağrı reddedilemedi.'), [run]);
  const cancel = useCallback(() => run(PresenceService.cancelCall, 'Çağrı iptal edilemedi.'), [run]);
  const end = useCallback(() => run(PresenceService.endCall, 'Çağrı sonlandırılamadı.'), [run]);
  const dismiss = useCallback(() => {
    if (callRef.current?.phase !== 'accepted') setCall(null);
    setError(null);
  }, []);

  return { call, error, startCall, accept, reject, cancel, end, dismiss };
}
