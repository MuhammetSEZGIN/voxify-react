import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import ClanService from '../../services/ClanService';
import ChannelService from '../../services/ChannelService';
import ClanMembershipService from '../../services/ClanMembershipService';
import ServerList from '../clan/ServerList';
import ChannelSidebar from '../clan/ChannelSidebar';
import ChatArea from '../chat/ChatArea';
import CreateClanModal from '../clan/CreateClanModal';
import VoiceChannel from '../voicechannel/VoiceChannel';
import ScreenShareViewer from '../voicechannel/ScreenShareViewer';
import '../../styles/discord.css';
import MemberList from '../clan/MemberList';
import ClanSettings from '../clan/ClanSettings';
import * as PresenceService from '../../services/PresenceService';

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { clanId: urlClanId, channelId: urlChannelId } = useParams();

  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState(null);
  const [channels, setChannels] = useState([]);
  const [voiceChannels, setVoiceChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
  const [voiceState, setVoiceState] = useState(null);
  // { [voiceChannelId]: [{userId, userName}] } — populated by PresenceHub for all clan members
  const [voicePresence, setVoicePresence] = useState({});
  // Set of online user IDs — populated by PresenceHub
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  // Ekran paylaşımı izleme: { participantIdentity, name, track }
  const [watchingScreenShare, setWatchingScreenShare] = useState(null);
  // Refs for voice presence cleanup without stale closures
  const activeVoiceChannelRef = useRef(null);
  const voiceConnectedRef = useRef(false);
  const selectedClanRef = useRef(null);
  const selectedChannelRef = useRef(null);
  const [memeberShips, setMemberships] = useState([]);
  const [loadingClans, setLoadingClans] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClanSettings, setShowClanSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Global Audio Settings
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);

  // Kullanıcının seçili klandaki rolünü hesapla
  const userRole = useMemo(() => {
    if (!selectedClan || !memeberShips?.length || !user) return 'member';
    const userId = user.id || user.sub || '';
    const membership = memeberShips.find((m) => {
      const mUserId = m.userId || m.user?.id || '';
      return mUserId === userId;
    });
    return membership?.role?.toLowerCase() || 'member';
  }, [selectedClan, memeberShips, user]);

  const canManage = userRole === 'owner' || userRole === 'admin';

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Klanları yükle
  useEffect(() => {
    const fetchClans = async () => {
      try {
        setLoadingClans(true);
        const data = await ClanService.getClansByUserId(user?.id || user?.sub || '');
        console.log('Fetched clans:', data);
        setClans(data || []);
      } catch (error) {
        console.error('Failed to fetch clans', error);
      } finally {
        setLoadingClans(false);
      }
    };
    fetchClans();
  }, []);

  // URL'deki clanId değiştiğinde selectedClan'ı güncelle
  useEffect(() => {
    if (urlClanId && clans.length > 0) {
      const clan = clans.find((c) => c.clanId === urlClanId);
      if (clan) {
        setSelectedClan(clan);
      }
    }
  }, [urlClanId, clans]);

  // URL'deki channelId değiştiğinde selectedChannel'ı güncelle
  useEffect(() => {
    if (urlChannelId && channels.length > 0) {
      const channel = channels.find((c) => c.channelId === urlChannelId);
      if (channel) setSelectedChannel(channel);
    } else {
      setSelectedChannel(null);
    }
  }, [urlChannelId, channels]);

  // Seçilen klanın kanallarını yükle
  useEffect(() => {
    if (!selectedClan) {
      setChannels([]);
      setVoiceChannels([]);
      setSelectedChannel(null);
      setMemberships([]);
      return;
    }

    const fetchChannels = async () => {
      try {
        const data = await ClanService.getClanById(selectedClan.clanId);
        console.log('Fetched channels for clan', selectedClan.clanId, data);
        setChannels(data.channels || []);
        setVoiceChannels(data.voiceChannels || []);
        setMemberships(data.clanMemberships || []);
      } catch (error) {
        console.error('Failed to fetch channels', error);
      }
    };
    fetchChannels();
  }, [selectedClan]);

  const handleSelectClan = (clan) => {
    if (!clan) {
      setSelectedClan(null);
      setSelectedChannel(null);
      setChannels([]);
      setVoiceChannels([]);
      navigate('/app');
      return;
    }
    setSelectedClan(clan);
    setSelectedChannel(null);
    setChannels([]);
    setVoiceChannels([]);
    navigate('/app');
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    navigate(`/app/clans/${selectedClan.clanId}/channels/${channel.channelId}`);
  };

  const handleSelectVoiceChannel = (channel) => {
    setActiveVoiceChannel(channel);
  };

  const handleVoiceStateChange = useCallback((state) => {
    setVoiceState(state);
    // Ekran paylaşımı izleme: state null olduğunda (bağlantı kesildi) viewer'u kapat
    if (!state) setWatchingScreenShare(null);
  }, []);

  const handleWatchScreenShare = useCallback((identity) => {
    if (!voiceState?.remoteScreenShares) return;
    const share = voiceState.remoteScreenShares.find(
      (s) => s.participantIdentity === identity
    );
    if (share) setWatchingScreenShare(share);
  }, [voiceState]);

  const handleDisconnectVoice = useCallback(() => {
    // Report leaving to presence hub before clearing state
    const channel = activeVoiceChannelRef.current;
    if (channel && user) {
      const userId = user.id || user.sub || '';
      PresenceService.leaveVoiceChannel()
        .catch((err) => console.error('[Presence] leave voice failed', err));
      // Remove from local presence state immediately — server removes caller from the group
      // before broadcasting UserLeftVoice, so the local user never receives that event.
      setVoicePresence((prev) => ({
        ...prev,
        [channel.voiceChannelId]: (prev[channel.voiceChannelId] || []).filter(
          (u) => u.userId !== userId
        ),
      }));
    }
    activeVoiceChannelRef.current = null;
    voiceConnectedRef.current = false;
    setActiveVoiceChannel(null);
    setVoiceState(null);
  }, [user]);

  // Keep ref in sync so handleDisconnectVoice always sees the latest channel
  useEffect(() => {
    activeVoiceChannelRef.current = activeVoiceChannel;
  }, [activeVoiceChannel]);
  useEffect(() => { selectedClanRef.current = selectedClan; }, [selectedClan]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  // Report joining to presence hub once LiveKit room connects (voiceState null → non-null)
  useEffect(() => {
    if (voiceState && !voiceConnectedRef.current && activeVoiceChannel && selectedClan && user) {
      voiceConnectedRef.current = true;
      const userName = user.userName || user.name || user.email || 'User';
      PresenceService.joinVoiceChannel(
        selectedClan.clanId,
        activeVoiceChannel.voiceChannelId,
        userName
      ).catch((err) => console.error('[Presence] join voice failed', err));
    }
    if (!voiceState) {
      voiceConnectedRef.current = false;
    }
  }, [voiceState]);

  // Connect to PresenceHub once and manage subscriptions across clan changes
  useEffect(() => {
    if (!clans.length || loadingClans) return;

    const token = localStorage.getItem('token');
    const clanIds = clans.map((c) => c.clanId);

    // ── Voice presence handlers ─────────────────────────────────────────
    const handleUserJoined = ({ voiceChannelId, userId, userName }) => {
      setVoicePresence((prev) => {
        const existing = prev[voiceChannelId] || [];
        if (existing.find((u) => u.userId === userId)) return prev;
        return { ...prev, [voiceChannelId]: [...existing, { userId, userName }] };
      });
    };

    const handleUserLeft = ({ voiceChannelId, userId }) => {
      setVoicePresence((prev) => ({
        ...prev,
        [voiceChannelId]: (prev[voiceChannelId] || []).filter((u) => u.userId !== userId),
      }));
    };

    const handleSnapshot = ({ participants }) => {
      const grouped = {};
      for (const { voiceChannelId, userId, userName } of participants) {
        if (!grouped[voiceChannelId]) grouped[voiceChannelId] = [];
        grouped[voiceChannelId].push({ userId, userName });
      }
      setVoicePresence(grouped);
    };

    // ── Online presence handlers ────────────────────────────────────────
    const handleUserOnline = (userId) => {
      setOnlineUserIds((prev) => new Set([...prev, userId]));
    };

    const handleUserOffline = (userId) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    const handleOnlineUsers = (userIds) => {
      setOnlineUserIds(new Set(userIds));
    };

    // ── Deletion event handlers ────────────────────────────────────────────────────
    const handleChannelDeleted = (channelId) => {
      setChannels((prev) => prev.filter((ch) => ch.channelId !== channelId));
      if (selectedChannelRef.current?.channelId === channelId) {
        setSelectedChannel(null);
        const clanId = selectedClanRef.current?.clanId;
        navigate(clanId ? `/app/clans/${clanId}` : '/app');
      }
    };

    const handleVoiceChannelDeleted = (voiceChannelId) => {
      setVoiceChannels((prev) => prev.filter((vc) => vc.voiceChannelId !== voiceChannelId));
      if (activeVoiceChannelRef.current?.voiceChannelId === voiceChannelId) {
        handleDisconnectVoice();
      }
      showToast('Ses kanalı silindi.', 'info');
    };

    const handleClanDeleted = (clanId) => {
      if (selectedClanRef.current?.clanId === clanId) {
        handleDisconnectVoice();
        setSelectedClan(null);
        setSelectedChannel(null);
        setChannels([]);
        setVoiceChannels([]);
        navigate('/app');
      }
      setClans((prev) => prev.filter((c) => c.clanId !== clanId));
      showToast('Klan silindi.', 'info');
    };

    const handleReconnected = async () => {
      console.info('[Presence] Yeniden bağlandi — klan abonelikleri yenileniyor');
      await PresenceService.subscribeToClans(clanIds).catch(() => { });
    };

    const connect = async () => {
      try {
        await PresenceService.startConnection(token);

        // Register event listeners
        PresenceService.onUserJoinedVoice(handleUserJoined);
        PresenceService.onUserLeftVoice(handleUserLeft);
        PresenceService.onVoiceChannelParticipants(handleSnapshot);
        PresenceService.onUserOnline(handleUserOnline);
        PresenceService.onUserOffline(handleUserOffline);
        PresenceService.onOnlineUsers(handleOnlineUsers);
        PresenceService.onChannelDeleted(handleChannelDeleted);
        PresenceService.onVoiceChannelDeleted(handleVoiceChannelDeleted);
        PresenceService.onClanDeleted(handleClanDeleted);
        PresenceService.onReconnected(handleReconnected);

        // Subscribe to all user's clans for presence events
        await PresenceService.subscribeToClans(clanIds);
      } catch (err) {
        console.error('[Presence] connection failed', err);
      }
    };

    connect();

    return () => {
      PresenceService.offUserJoinedVoice(handleUserJoined);
      PresenceService.offUserLeftVoice(handleUserLeft);
      PresenceService.offVoiceChannelParticipants(handleSnapshot);
      PresenceService.offUserOnline(handleUserOnline);
      PresenceService.offUserOffline(handleUserOffline);
      PresenceService.offOnlineUsers(handleOnlineUsers);
      PresenceService.offChannelDeleted(handleChannelDeleted);
      PresenceService.offVoiceChannelDeleted(handleVoiceChannelDeleted);
      PresenceService.offClanDeleted(handleClanDeleted);
      PresenceService.stopConnection();
      setVoicePresence({});
      setOnlineUserIds(new Set());
    };
  }, [clans, loadingClans]);

  // When the selected clan changes, fetch voice channel participants & online members
  useEffect(() => {
    if (!selectedClan) {
      setVoicePresence({});
      return;
    }

    const clanId = selectedClan.clanId;

    // Fetch voice participants for this clan
    PresenceService.getParticipants(clanId)
      .catch((err) => console.error('[Presence] getParticipants failed', err));

    // Fetch online status for clan members
    if (memeberShips.length > 0) {
      const memberUserIds = memeberShips.map((m) => m.userId || m.user?.id || '').filter(Boolean);
      PresenceService.getOnlineUsers(memberUserIds)
        .catch((err) => console.error('[Presence] getOnlineUsers failed', err));
    }
  }, [selectedClan?.clanId, memeberShips]);

  const handleCreateClan = async ({ name, description }) => {
    const newClan = await ClanService.createClan({
      name,
      description,
      userId: user?.id || user?.sub || '',
    });
    setClans((prev) => [...prev, newClan]);
    setSelectedClan(newClan);
  };
  const handleCreateChannel = async (name) => {
    try {
      const newChannel = await ChannelService.createChannel({ name, clanId: selectedClan.clanId });
      setChannels((prev) => [...prev, newChannel]);
    } catch (error) {
      console.error('Failed to create channel', error);
    }
  };

  const handleCreateVoiceChannel = async (name) => {
    try {
      const newVoiceChannel = await ChannelService.createVoiceChannel({ name, clanId: selectedClan.clanId });
      setVoiceChannels((prev) => [...prev, newVoiceChannel]);
    } catch (error) {
      console.error('Failed to create voice channel', error);
    }
  };

  const handleUpdateVoiceChannel = async ({ voiceChannelId, name }) => {
    try {
      const updated = await ChannelService.updateVoiceChannel({ voiceChannelId, name });
      setVoiceChannels((prev) => prev.map((vc) => vc.voiceChannelId === voiceChannelId ? { ...vc, name: updated.name ?? name } : vc));
    } catch (error) {
      console.error('Failed to update voice channel', error);
    }
  };

  const handleDeleteVoiceChannel = async (voiceChannelId) => {
    try {
      await ChannelService.deleteVoiceChannel(voiceChannelId);
      setVoiceChannels((prev) => prev.filter((vc) => vc.voiceChannelId !== voiceChannelId));
      if (activeVoiceChannel?.voiceChannelId === voiceChannelId) {
        handleDisconnectVoice();
      }
    } catch (error) {
      console.error('Failed to delete voice channel', error);
    }
  };

  const handleUpdateChannel = async ({ channelId, name }) => {
    try {
      const updated = await ChannelService.updateChannel({ channelId, name });
      setChannels((prev) => prev.map((ch) => ch.channelId === channelId ? { ...ch, name: updated.name ?? name } : ch));
    } catch (error) {
      console.error('Failed to update channel', error);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    try {
      await ChannelService.deleteChannel(channelId);
      setChannels((prev) => prev.filter((ch) => ch.channelId !== channelId));
      if (selectedChannel?.channelId === channelId) {
        setSelectedChannel(null);
        navigate(`/app/clans/${selectedClan.clanId}`);
      }
    } catch (error) {
      console.error('Failed to delete channel', error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleLeaveClan = async () => {
    if (!selectedClan || !user) return;
    const userId = user.id || user.sub || '';
    try {
      await ClanMembershipService.removeUserFromClan(selectedClan.clanId, userId);
      setClans((prev) => prev.filter((c) => c.clanId !== selectedClan.clanId));
      setSelectedClan(null);
      setSelectedChannel(null);
      setChannels([]);
      setVoiceChannels([]);
      navigate('/app');
    } catch (error) {
      console.error('Failed to leave clan', error);
    }
  };

  const handleUpdateClan = async (data) => {
    try {
      const updated = await ClanService.updateClan(data);
      setClans((prev) => prev.map((c) => c.clanId === data.clanId ? { ...c, ...updated } : c));
      setSelectedClan((prev) => prev ? { ...prev, ...updated } : prev);
    } catch (error) {
      console.error('Failed to update clan', error);
    }
  };

  const handleDeleteClan = async () => {
    if (!selectedClan) return;
    try {
      await ClanService.deleteClan(selectedClan.clanId);
      setClans((prev) => prev.filter((c) => c.clanId !== selectedClan.clanId));
      setSelectedClan(null);
      setSelectedChannel(null);
      setChannels([]);
      setVoiceChannels([]);
      navigate('/app');
    } catch (error) {
      console.error('Failed to delete clan', error);
    }
  };

  const handleUpdateMemberRole = async (membershipId, roleName) => {
    try {
      await ClanMembershipService.updateMemberRole(membershipId, roleName);
      // Membership listesini yenile
      const data = await ClanService.getClanById(selectedClan.clanId);
      setMemberships(data.clanMemberships || []);
    } catch (error) {
      console.error('Failed to update member role', error);
    }
  };

  const handleKickMember = async (clanId, userId) => {
    try {
      await ClanMembershipService.removeUserFromClan(clanId, userId);
      setMemberships((prev) => prev.filter((m) => (m.userId || m.user?.id) !== userId));
    } catch (error) {
      console.error('Failed to kick member', error);
    }
  };

  if (loadingClans) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="discord-app">
      <ServerList
        clans={clans}
        selectedClanId={selectedClan?.clanId}
        onSelectClan={handleSelectClan}
        onCreateClan={() => setShowCreateModal(true)}
      />

      <ChannelSidebar
        clan={selectedClan}
        channels={channels}
        voiceChannels={voiceChannels}
        selectedChannelId={selectedChannel?.channelId}
        activeVoiceChannelId={activeVoiceChannel?.voiceChannelId}
        onSelectChannel={handleSelectChannel}
        onSelectVoiceChannel={handleSelectVoiceChannel}
        user={user}
        onLogout={handleLogout}
        onCreateChannel={handleCreateChannel}
        onCreateVoiceChannel={handleCreateVoiceChannel}
        onUpdateChannel={handleUpdateChannel}
        onDeleteChannel={handleDeleteChannel}
        onUpdateVoiceChannel={handleUpdateVoiceChannel}
        onDeleteVoiceChannel={handleDeleteVoiceChannel}
        voiceState={voiceState}
        activeVoiceChannel={activeVoiceChannel}
        onDisconnectVoice={handleDisconnectVoice}
        voicePresence={voicePresence}
        canManage={canManage}
        userRole={userRole}
        onLeaveClan={handleLeaveClan}
        onOpenClanSettings={() => setShowClanSettings(true)}
        inputVolume={inputVolume}
        setInputVolume={setInputVolume}
        outputVolume={outputVolume}
        setOutputVolume={setOutputVolume}
        onWatchScreenShare={handleWatchScreenShare}
      />

      <ChatArea
        clan={selectedClan}
        channel={selectedChannel}
      />

      {activeVoiceChannel && (
        <VoiceChannel
          roomId={activeVoiceChannel?.voiceChannelId || 'unknown-room'}
          userId={user?.id || user?.sub || user?.userId || 'unknown-user'}
          userName={user?.userName || user?.name || user?.email || 'User'}
          onLeaveRoom={handleDisconnectVoice}
          onVoiceStateChange={handleVoiceStateChange}
          inputVolume={inputVolume}
          outputVolume={outputVolume}
        />
      )}

      {showCreateModal && (
        <CreateClanModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateClan}
          onJoin={async () => {
            const data = await ClanService.getClansByUserId(user?.id || user?.sub || '');
            setClans(data || []);
          }}
        />
      )}

      <MemberList members={memeberShips} clanId={selectedClan?.clanId} onlineUserIds={onlineUserIds} />

      {showClanSettings && selectedClan && (
        <ClanSettings
          clan={selectedClan}
          members={memeberShips}
          userRole={userRole}
          user={user}
          onClose={() => setShowClanSettings(false)}
          onUpdateClan={handleUpdateClan}
          onDeleteClan={handleDeleteClan}
          onUpdateMemberRole={handleUpdateMemberRole}
          onKickMember={handleKickMember}
        />
      )}

      {toast && (
        <div className={`app-toast app-toast--${toast.type}`} role="alert">
          <span className="material-symbols-outlined">
            {toast.type === 'error' ? 'error' : 'info'}
          </span>
          <span>{toast.message}</span>
          <button
            type="button"
            className="app-toast__close"
            onClick={() => setToast(null)}
            aria-label="Kapat"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {/* Ekran Paylaşımı İzleme Penceresi */}
      {watchingScreenShare && (
        <ScreenShareViewer
          share={watchingScreenShare}
          onClose={() => setWatchingScreenShare(null)}
        />
      )}
    </div>
  );
}

export default MainLayout;