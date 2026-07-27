import * as signalR from '@microsoft/signalr';
import { resolveHubUrl } from '../utils/hubUrl';

const HUB_URL = resolveHubUrl({
  explicitUrl: import.meta.env.VITE_NOTIFICATION_HUB_URL,
  baseUrl: import.meta.env.VITE_BASE_URL,
  localPort: 5160,
  path: '/hubs/notification',
});

let connection = null;
let connectionPromise = null;
const listeners = new Map();

function attachListeners(target) {
  for (const [event, callbacks] of listeners) {
    for (const callback of callbacks) target.on(event, callback);
  }
}

export async function startConnection(token) {
  if (connection?.state === signalR.HubConnectionState.Connected) return connection;
  if (connectionPromise) return connectionPromise;

  const startPromise = (async () => {
    const next = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    attachListeners(next);
    next.onclose(() => {
      if (connection === next) {
        connection = null;
        connectionPromise = null;
      }
    });
    connection = next;
    try {
      await next.start();
      return next;
    } catch (error) {
      if (connection === next) connection = null;
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

export function off(event, callback) {
  connection?.off(event, callback);
  const callbacks = listeners.get(event);
  callbacks?.delete(callback);
  if (callbacks?.size === 0) listeners.delete(event);
}

export default { startConnection, stopConnection, on, off };
