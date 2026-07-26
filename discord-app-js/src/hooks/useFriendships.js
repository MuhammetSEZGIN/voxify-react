import { useCallback, useEffect, useState } from 'react';
import FriendService from '../services/FriendService';

/**
 * Arkadaş listesini, bekleyen istekleri ve bunlara ait mutation işlemlerini yönetir.
 */
export default function useFriendships(user) {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFriends = useCallback(async () => {
    try {
      const data = await FriendService.getFriends();
      setFriends(data || []);
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await FriendService.getRequests();
      setFriendRequests(data || []);
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadFriends(), loadRequests()]);
  }, [loadFriends, loadRequests]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh, user]);

  const handleNotificationReceived = useCallback((notification) => {
    if (!['FriendRequestReceived', 'FriendRequestAccepted'].includes(notification?.type)) {
      return;
    }

    refresh().catch((refreshError) => {
      console.error('[Notification] Arkadaş verisi yenilenemedi', refreshError);
    });
  }, [refresh]);

  const sendRequest = useCallback(async (addresseeId) => {
    await FriendService.sendRequest(addresseeId);
    await loadRequests();
  }, [loadRequests]);

  const acceptRequest = useCallback(async (requestId) => {
    await FriendService.acceptRequest(requestId);
    await refresh();
  }, [refresh]);

  const rejectRequest = useCallback(async (requestId) => {
    await FriendService.rejectRequest(requestId);
    await loadRequests();
  }, [loadRequests]);

  const removeFriend = useCallback(async (friendUserId) => {
    await FriendService.removeFriend(friendUserId);
    await loadFriends();
  }, [loadFriends]);

  return {
    friends,
    friendRequests,
    loading,
    error,
    refresh,
    handleNotificationReceived,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
  };
}
