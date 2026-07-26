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
import UserVolumeContextMenu from '../voicechannel/UserVolumeContextMenu';
import MemberContextMenu from '../clan/MemberContextMenu';
import UserProfilePopup from '../clan/UserProfilePopup';
import '../../styles/discord.css';
import MemberList from '../clan/MemberList';
import ClanSettings from '../clan/ClanSettings';
import AccountSettings from '../account/AccountSettings';
import FriendsMemberList from '../friends/FriendsMemberList';
import UserBar from './UserBar';
import DmService from '../../services/DmService';
import FriendService from '../../services/FriendService';
import VoiceService from '../../services/VoiceService';
import * as PresenceService from '../../services/PresenceService';
import { VOICE_JOIN_NOTIFICATION_SOUND } from '../../utils/constants';
import { directVoiceRoomId } from '../../utils/space';
import NotificationCenter from '../notifications/NotificationCenter';
import FriendsNotificationSidebar from '../notifications/FriendsNotificationSidebar';
import DmCallOverlay from '../calls/DmCallOverlay';
import useDmCall from '../../hooks/useDmCall';
import useNotifications from '../../hooks/useNotifications';
import {
  getMutedClanIds,
  getMutedUserIds,
  setClanMuted as persistClanMuted,
  setUserMuted as persistUserMuted,
} from '../../utils/messageNotifications';
import { getMemberAvatarUrl, getMemberId, getMemberName } from '../../utils/member';

function upsertById(items, incoming, idKey) {
  const incomingId = incoming?.[idKey];
  if (!incomingId) return items;
  const index = items.findIndex((item) => item?.[idKey] === incomingId);
  if (index < 0) return [...items, incoming];
  const next = [...items];
  next[index] = { ...items[index], ...incoming };
  return next;
}

function MainLayout() {
  const { user, token, logout, updateUser } = useAuth();
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
  const [isPresenceReady, setIsPresenceReady] = useState(false);
  // Ekran paylaşımı izleme: { participantIdentity, name, track }
  const [watchingScreenShare, setWatchingScreenShare] = useState(null);
  // Refs for voice presence cleanup without stale closures
  const activeVoiceChannelRef = useRef(null);
  const voiceConnectedRef = useRef(false);
  const selectedClanRef = useRef(null);
  const clansRef = useRef([]);
  // PresenceHub bağlantısı kurulduğu anda o anki arkadaş listesi için de
  // online-durum sorgusu atabilmek için (bkz. presence connect effect'i).
  const friendsRef = useRef([]);
  const friendIdsRef = useRef([]);
  const awaitingFriendSnapshotRef = useRef(false);

  /** Belirtilen ID'ler için sunucudan online durumu sorgular (ateşle-unut). */
  const queryOnlineStatus = useCallback((userIds) => {
    const ids = (userIds || []).filter(Boolean);
    if (ids.length === 0) return;
    PresenceService.getOnlineUsers(ids).catch((err) =>
      console.error('[Presence] getOnlineUsers failed', err)
    );
  }, []);

  /** Arkadaş listesinin tamamını push presence aboneliği olarak değiştirir. */
  const subscribeFriendPresence = useCallback(async (userIds) => {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    friendIdsRef.current = ids;
    awaitingFriendSnapshotRef.current = true;
    try {
      await PresenceService.subscribeToUsers(ids);
    } catch (error) {
      awaitingFriendSnapshotRef.current = false;
      throw error;
    }
  }, []);
  const selectedChannelRef = useRef(null);
  const [memeberShips, setMemberships] = useState([]);
  const [loadingClans, setLoadingClans] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClanSettings, setShowClanSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [accountSettingsTab, setAccountSettingsTab] = useState('profile');
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const [activeDmConversation, setActiveDmConversation] = useState(null);
  const [dmError, setDmError] = useState(null);
  const [isFriendsActive, setIsFriendsActive] = useState(false);
  // Arkadaş listesi ve bekleyen istekler — sağdaki FriendsMemberList okur.
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [mutedClanIds, setMutedClanIds] = useState(() => getMutedClanIds());
  const [mutedUserIds, setMutedUserIds] = useState(() => getMutedUserIds());

  // Global Audio Settings
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [selectedInputDevice, setSelectedInputDevice] = useState('');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState('');
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(true);
  // Deafen (sağırlaştırma) artık UserBar global olduğu için burada tutuluyor —
  // sayfa değiştirince durumun sıfırlanmaması gerekir.
  const [isDeafened, setIsDeafened] = useState(false);

  // Per-user volume overrides: { [identity]: number (0-100) }
  const [userVolumes, setUserVolumes] = useState({});
  // Context menu state for right-click user volume
  const [volumeCtxMenu, setVolumeCtxMenu] = useState({ visible: false, x: 0, y: 0, participant: null });
  const [kickingVoiceUserId, setKickingVoiceUserId] = useState(null);
  // Context menu state for right-click on a clan member (add friend / message)
  const [memberCtxMenu, setMemberCtxMenu] = useState({ visible: false, x: 0, y: 0, member: null, isSelf: false });
  // Profile popup state — small card shown above a clicked member
  const [profilePopup, setProfilePopup] = useState({ visible: false, anchorRect: null, member: null });

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

  // Klan ID'lerinin stabil bir anahtarı — sıralama/oluşturma/silme işlemlerinde
  // `clans` referansı değişse bile içerik aynıysa presence effect'i tetiklememeli.
  const clanIdsKey = useMemo(
    () => clans.map((c) => c.clanId).join(','),
    [clans]
  );

  const canManage = userRole === 'owner' || userRole === 'admin';

  // Klan servisi üyeleri düz veya iç içe kullanıcı alanlarıyla döndürebiliyor.
  // Eksik profil alanlarını IdentityService'ten zaten alınmış mevcut kullanıcı ve
  // arkadaş verisiyle tamamlayarak sağ panel, ayarlar ve profil kartını eşit tut.
  const displayMemberships = useMemo(() => {
    const friendProfiles = new Map(friends.map((friend) => [friend.id, friend]));
    const currentUserId = user?.id || user?.sub || user?.userId || '';

    return memeberShips.map((member) => {
      const memberId = getMemberId(member);
      const knownProfile = memberId === currentUserId ? user : friendProfiles.get(memberId);

      return {
        ...member,
        userId: memberId,
        userName: getMemberName(member) !== 'Unknown'
          ? getMemberName(member)
          : knownProfile?.userName || knownProfile?.username || 'Unknown',
        avatarUrl: getMemberAvatarUrl(member) || knownProfile?.avatarUrl || null,
      };
    });
  }, [friends, memeberShips, user]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleToggleClanMute = useCallback((clan) => {
    const clanId = clan?.clanId;
    if (!clanId) return;
    const shouldMute = !mutedClanIds.includes(clanId);
    setMutedClanIds(persistClanMuted(clanId, shouldMute));
    showToast(shouldMute ? `${clan.name} sessize alındı` : `${clan.name} bildirimleri açıldı`);
  }, [mutedClanIds, showToast]);

  const handleToggleUserMute = useCallback((targetUser) => {
    const targetUserId = targetUser?.userId || targetUser?.user?.id || targetUser?.id || '';
    if (!targetUserId) return;
    const shouldMute = !mutedUserIds.includes(targetUserId);
    setMutedUserIds(persistUserMuted(targetUserId, shouldMute));
    const name = targetUser?.userName || targetUser?.username || 'Kullanıcı';
    showToast(shouldMute ? `${name} sessize alındı` : `${name} bildirimleri açıldı`);
  }, [mutedUserIds, showToast]);

  const playVoicePresenceNotification = useCallback(() => {
    try {
      const audio = new Audio(VOICE_JOIN_NOTIFICATION_SOUND);
      audio.volume = Math.max(0, Math.min(outputVolume / 100, 1));
      audio.play().catch(() => {
        // Tarayıcı kısıtlaması nedeniyle çalmayabilir, sessizce geç
      });
    } catch (error) {
      console.warn('[Voice] presence notification could not play', error);
    }
  }, [outputVolume]);

  // Klanları yükle
  useEffect(() => {
    const fetchClans = async () => {
      try {
        setLoadingClans(true);
        const data = await ClanService.getMyClans();
        console.log('Fetched clans:', data);

        // Kaydedilmiş klan sırasını uygula
        let ordered = data || [];
        try {
          const savedOrder = JSON.parse(localStorage.getItem('clanOrder') || '[]');
          if (savedOrder.length > 0) {
            ordered = [...ordered].sort((a, b) => {
              const ai = savedOrder.indexOf(a.clanId);
              const bi = savedOrder.indexOf(b.clanId);
              return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
            });
          }
        } catch { /* localStorage okuma hatası */ }

        setClans(ordered);
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
    if (!urlClanId) {
      setSelectedClan(null);
      return;
    }

    if (urlClanId && clans.length > 0) {
      const clan = clans.find((c) => c.clanId === urlClanId);
      setSelectedClan(clan || null);
    }
  }, [urlClanId, clans]);

  // URL'deki channelId değiştiğinde selectedChannel'ı güncelle
  useEffect(() => {
    if (urlChannelId && channels.length > 0) {
      const channel = channels.find((c) => c.channelId === urlChannelId);
      setSelectedChannel(channel || null);
      return;
    }

    setSelectedChannel(null);
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

  const handleSelectClan = useCallback((clan) => {
    if (!clan) {
      setSelectedClan(null);
      setSelectedChannel(null);
      setChannels([]);
      setVoiceChannels([]);
      setIsFriendsActive(false);
      setActiveDmConversation(null);
      navigate('/app');
      return;
    }
    setSelectedClan(clan);
    setSelectedChannel(null);
    setChannels([]);
    setVoiceChannels([]);
    setIsFriendsActive(false);
    setActiveDmConversation(null);
    navigate(`/app/clans/${clan.clanId}`);
  }, [navigate]);

  const handleSelectFriends = useCallback(() => {
    setSelectedClan(null);
    setSelectedChannel(null);
    setChannels([]);
    setVoiceChannels([]);
    setIsFriendsActive(true);
    setActiveDmConversation(null);
    navigate('/app');
  }, [navigate]);

  const loadFriendsList = useCallback(async () => {
    try {
      const data = await FriendService.getFriends();
      setFriends(data || []);
      setFriendsError(null);
    } catch (err) {
      setFriendsError(err.message);
    }
  }, []);

  const loadFriendRequests = useCallback(async () => {
    try {
      const data = await FriendService.getRequests();
      setFriendRequests(data || []);
      setFriendsError(null);
    } catch (err) {
      setFriendsError(err.message);
    }
  }, []);

  // Arkadaş verisini giriş sonrası bir kez yükle — sadece Arkadaşlar sayfasına
  // gidince değil, çünkü sidebar rozet/durum göstergeleri her yerden görünür olmalı.
  useEffect(() => {
    if (!user) return;
    setFriendsLoading(true);
    Promise.all([loadFriendsList(), loadFriendRequests()]).finally(() => setFriendsLoading(false));
  }, [user, loadFriendsList, loadFriendRequests]);

  const handleRefreshFriends = useCallback(async () => {
    await Promise.all([loadFriendsList(), loadFriendRequests()]);
  }, [loadFriendsList, loadFriendRequests]);

  const handleNotificationReceived = useCallback((notification) => {
    if (['FriendRequestReceived', 'FriendRequestAccepted'].includes(notification?.type)) {
      handleRefreshFriends().catch((error) => {
        console.error('[Notification] Arkadaş verisi yenilenemedi', error);
      });
    }
  }, [handleRefreshFriends]);

  // Bildirim merkezi ile Arkadaşlar sidebar'ı aynı listeyi ve SignalR
  // bağlantısını paylaşır; okundu durumu iki yerde de anında eşleşir.
  const notifications = useNotifications(token, handleNotificationReceived, outputVolume);

  const handleOpenNotification = useCallback((notification) => {
    if (['FriendRequestReceived', 'FriendRequestAccepted'].includes(notification?.type)) {
      handleSelectFriends();
      return;
    }
    if (['DirectMessageReceived', 'MissedCall'].includes(notification?.type) && notification.targetId) {
      const actor = friendsRef.current.find((friend) => friend.id === notification.actorUserId);
      setSelectedClan(null);
      setSelectedChannel(null);
      setIsFriendsActive(true);
      setActiveDmConversation({
        conversationId: notification.targetId,
        otherUserId: notification.actorUserId || actor?.id || '',
        otherUserName: actor?.userName || notification.title || 'Doğrudan Mesaj',
        otherAvatarUrl: actor?.avatarUrl || null,
      });
      navigate('/app');
    }
  }, [handleSelectFriends, navigate]);

  const handleSendFriendRequest = useCallback(async (addresseeId) => {
    await FriendService.sendRequest(addresseeId);
    await loadFriendRequests();
  }, [loadFriendRequests]);

  const handleAcceptFriendRequest = useCallback(async (requestId) => {
    await FriendService.acceptRequest(requestId);
    await Promise.all([loadFriendsList(), loadFriendRequests()]);
  }, [loadFriendsList, loadFriendRequests]);

  const handleRejectFriendRequest = useCallback(async (requestId) => {
    await FriendService.rejectRequest(requestId);
    await loadFriendRequests();
  }, [loadFriendRequests]);

  const handleRemoveFriend = useCallback(async (friendUserId) => {
    await FriendService.removeFriend(friendUserId);
    await loadFriendsList();
  }, [loadFriendsList]);

  const handleOpenDm = useCallback(async (friend) => {
    setDmError(null);
    try {
      const conversation = await DmService.getOrCreateConversation(friend.id);
      setActiveDmConversation({
        conversationId: conversation.conversationId,
        otherUserId: friend.id,
        otherUserName: friend.userName,
      });
      // Sağ panelden bir arkadaşa tıklamak Arkadaşlar sekmesine geçirir —
      // klan görünümündeyken DM açılırsa sohbet alanı boş kalmasın.
      setIsFriendsActive(true);
    } catch (err) {
      setDmError(err.message);
    }
  }, []);

  const handleCloseDm = useCallback(() => setActiveDmConversation(null), []);

  const handleMemberContextMenu = useCallback((e, member, isSelf) => {
    e.preventDefault();
    e.stopPropagation();
    setMemberCtxMenu({ visible: true, x: e.clientX, y: e.clientY, member, isSelf });
  }, []);

  const handleCloseMemberCtx = useCallback(() => {
    setMemberCtxMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleMemberClick = useCallback((member, anchorRect) => {
    setProfilePopup({ visible: true, anchorRect, member });
  }, []);

  const handleCloseProfilePopup = useCallback(() => {
    setProfilePopup((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleAddFriendFromMember = async (member) => {
    try {
      await handleSendFriendRequest(getMemberId(member));
      showToast('Arkadaşlık isteği gönderildi', 'info');
    } catch (err) {
      showToast(err.message || 'Arkadaşlık isteği gönderilemedi', 'error');
    }
  };

  const handleSendMessageFromMember = (member) => {
    handleOpenDm({ id: getMemberId(member), userName: member.userName || member.username });
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    navigate(`/app/clans/${selectedClan.clanId}/channels/${channel.channelId}`);
  };

  const handleSelectVoiceChannel = (channel) => {
    if (activeVoiceChannelRef.current && activeVoiceChannelRef.current.voiceChannelId !== channel.voiceChannelId) {
      handleDisconnectVoice();
    }
    if (!activeVoiceChannelRef.current || activeVoiceChannelRef.current.voiceChannelId !== channel.voiceChannelId) {
      setActiveVoiceChannel({
        ...channel,
        clanId: channel.clanId || selectedClan?.clanId,
      });
    }
  };

  const handleVoiceStateChange = useCallback((state) => {
    setVoiceState(state);
    // İzlenen yayın sona ererse veya track nesnesi yenilenirse viewer'u aynı
    // state güncellemesinde kapat/güncelle; donmuş video penceresi bırakma.
    setWatchingScreenShare((current) => {
      if (!current || !state) return null;
      return state.remoteScreenShares?.find(
        (share) => share.participantIdentity === current.participantIdentity
      ) || null;
    });
  }, []);

  const handleWatchScreenShare = useCallback((identity) => {
    if (!voiceState?.remoteScreenShares) return;
    const share = voiceState.remoteScreenShares.find(
      (s) => s.participantIdentity === identity
    );
    if (share) setWatchingScreenShare(share);
  }, [voiceState]);

  // Right-click handler for voice participant volume adjustment
  const handleParticipantContextMenu = useCallback((e, participant) => {
    e.preventDefault();
    e.stopPropagation();
    setVolumeCtxMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      participant,
    });
  }, []);

  const handleUserVolumeChange = useCallback((identity, volume) => {
    setUserVolumes(prev => ({ ...prev, [identity]: volume }));
  }, []);

  const handleCloseVolumeCtx = useCallback(() => {
    setVolumeCtxMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleKickVoiceParticipant = useCallback(async (participant) => {
    const channel = activeVoiceChannelRef.current;
    const clanId = channel?.clanId || selectedClanRef.current?.clanId;
    const targetUserId = participant?.identity;

    if (!channel || channel.isDirect || !clanId || !targetUserId) return;
    if (!window.confirm(`${participant.name || 'Kullanıcı'} ses kanalından çıkarılsın mı?`)) return;

    setKickingVoiceUserId(targetUserId);
    try {
      await VoiceService.kickParticipant(channel.voiceChannelId, clanId, targetUserId);
      setVolumeCtxMenu((prev) => ({ ...prev, visible: false }));
      showToast(`${participant.name || 'Kullanıcı'} ses kanalından çıkarıldı.`, 'info');
    } catch (error) {
      showToast(error.message || 'Kullanıcı ses kanalından çıkarılamadı.', 'error');
    } finally {
      setKickingVoiceUserId(null);
    }
  }, [showToast]);

  // ── UserBar callback'leri ────────────────────────────────────────────────
  // Hepsi stabil referans: UserBar memo'lu, satır içi lambda geçersek her
  // MainLayout render'ında (mesaj geldi, presence değişti...) yeniden çizilir.
  const handleToggleMic = useCallback(() => setIsMicMuted((prev) => !prev), []);

  const handleMicrophoneUnavailable = useCallback((error) => {
    setIsMicMuted(true);
    const permissionDenied = ['NotAllowedError', 'PermissionDeniedError'].includes(error?.name);
    showToast(
      permissionDenied
        ? 'Mikrofon izni kapalı. Ses kanalına dinleyici olarak bağlandınız.'
        : 'Mikrofon açılamadı. Ses kanalına dinleyici olarak bağlandınız.',
      'info'
    );
    console.warn('[Voice] microphone unavailable; continuing in listen-only mode', error);
  }, [showToast]);

  const handleToggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      // Sayfadaki tüm ses/video elemanlarını sustur/aç
      document.querySelectorAll('audio, video').forEach((el) => {
        el.muted = next;
      });
      return next;
    });
  }, []);

  const handleOpenProfileSettings = useCallback(() => {
    setAccountSettingsTab('profile');
    setShowAccountSettings(true);
  }, []);

  /** Sağ paneldeki yenile tuşu — yalnızca üye listesi ve online durumlarını tazeler. */
  const handleRefreshMembers = useCallback(async () => {
    const clanId = selectedClanRef.current?.clanId;
    if (!clanId) return;
    try {
      const data = await ClanService.getClanById(clanId);
      const memberships = data.clanMemberships || [];
      setMemberships(memberships);

      const memberUserIds = memberships
        .map((m) => m.userId || m.user?.id || '')
        .filter(Boolean);
      await queryOnlineStatus(memberUserIds);
    } catch (error) {
      console.error('Failed to refresh members', error);
    }
  }, [queryOnlineStatus]);

  const handleDisconnectVoice = useCallback((skipCallSignal = false) => {
    // Report leaving to presence hub before clearing state.
    const channel = activeVoiceChannelRef.current;
    if (channel?.isDirect) {
      const joinedPresence = voiceConnectedRef.current;
      if (joinedPresence) {
        // PresenceHub LeaveVoiceChannel DM çağrısını da sonlandırır. Aynı
        // çağrı için ayrıca EndCall göndermek ikinci bir terminal geçiş üretir.
        PresenceService.leaveVoiceChannel()
          .catch((err) => console.error('[Presence] leave DM voice failed', err));
      } else if (!skipCallSignal && channel.callId) {
        // ICE kurulmadan ayrıldıysak Presence voice kaydı yoktur; bu durumda
        // çağrıyı doğrudan kapatmak gerekir.
        PresenceService.endCall(channel.callId)
          .catch((err) => console.error('[Presence] end call failed', err));
      }
      playVoicePresenceNotification();
      activeVoiceChannelRef.current = null;
      voiceConnectedRef.current = false;
      setActiveVoiceChannel(null);
      setVoiceState(null);
      return;
    }
    if (channel && user) {
      const userId = user.id || user.sub || '';
      playVoicePresenceNotification();
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
  }, [playVoicePresenceNotification, user]);

  const handleCallAccepted = useCallback((acceptedCall) => {
    if (!acceptedCall?.conversationId) return;
    const roomId = acceptedCall.roomId || directVoiceRoomId(acceptedCall.conversationId);
    const current = activeVoiceChannelRef.current;
    if (current?.voiceChannelId !== roomId && current) handleDisconnectVoice();

    const currentUserId = user?.id || user?.sub || user?.userId || '';
    const otherUserId = acceptedCall.callerUserId === currentUserId
      ? acceptedCall.calleeUserId
      : acceptedCall.callerUserId;
    const friend = friendsRef.current.find((item) => item.id === otherUserId);

    setActiveVoiceChannel({
      voiceChannelId: roomId,
      name: acceptedCall.otherUserName || friend?.userName || 'Doğrudan Görüşme',
      isDirect: true,
      conversationId: acceptedCall.conversationId,
      callId: acceptedCall.callId,
    });
  }, [handleDisconnectVoice, user]);

  const handleCallEnded = useCallback((endedCall) => {
    const active = activeVoiceChannelRef.current;
    if (active?.isDirect && (!endedCall?.callId || active.callId === endedCall.callId)) {
      handleDisconnectVoice(true);
    }
  }, [handleDisconnectVoice]);

  const {
    call: dmCallState,
    error: dmCallError,
    startCall,
    accept: acceptDmCall,
    reject: rejectDmCall,
    cancel: cancelDmCall,
    dismiss: dismissDmCall,
  } = useDmCall({
    onAccepted: handleCallAccepted,
    onEnded: handleCallEnded,
  });

  /** DM butonu odaya doğrudan girmez; backend durum makinesinde zil başlatır. */
  const handleToggleDmVoice = useCallback((conversation) => {
    if (!conversation?.conversationId) return;
    const currentCall = dmCallState;
    if (currentCall?.conversationId === conversation.conversationId) {
      if (currentCall.phase === 'accepted') {
        handleDisconnectVoice();
      } else if (['starting', 'ringing'].includes(currentCall.phase)) {
        cancelDmCall();
      }
      return;
    }
    startCall(conversation);
  }, [cancelDmCall, dmCallState, handleDisconnectVoice, startCall]);

  const handleEndActiveDmCall = useCallback(() => {
    handleDisconnectVoice();
  }, [handleDisconnectVoice]);

  const dmCallDisplayName = useMemo(() => {
    if (!dmCallState) return '';
    if (dmCallState.otherUserName) return dmCallState.otherUserName;
    const currentUserId = user?.id || user?.sub || user?.userId || '';
    const otherUserId = dmCallState.callerUserId === currentUserId
      ? dmCallState.calleeUserId
      : dmCallState.callerUserId;
    return friends.find((friend) => friend.id === otherUserId)?.userName || 'Bir kullanıcı';
  }, [dmCallState, friends, user]);

  // Keep ref in sync so handleDisconnectVoice always sees the latest channel
  useEffect(() => {
    activeVoiceChannelRef.current = activeVoiceChannel;
  }, [activeVoiceChannel]);
  useEffect(() => { clansRef.current = clans; }, [clans]);
  useEffect(() => { selectedClanRef.current = selectedClan; }, [selectedClan]);
  useEffect(() => { friendsRef.current = friends; }, [friends]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  // LiveKit bağlandığında Presence'a tek kez katılım bildir.
  useEffect(() => {
    if (!isPresenceReady) return;

    if (activeVoiceChannel?.isDirect) {
      if (voiceState && !voiceConnectedRef.current && user) {
        voiceConnectedRef.current = true;
        const userName = user.userName || user.name || user.email || 'User';
        PresenceService.subscribeToConversations([activeVoiceChannel.conversationId])
          .then(() => PresenceService.joinVoiceChannel(
            null,
            activeVoiceChannel.voiceChannelId,
            userName
          ))
          .then(playVoicePresenceNotification)
          .catch((err) => {
            voiceConnectedRef.current = false;
            console.error('[Presence] join DM voice failed', err);
          });
      }
      return;
    }
    if (voiceState && !voiceConnectedRef.current && activeVoiceChannel && selectedClan && user) {
      voiceConnectedRef.current = true;
      const userName = user.userName || user.name || user.email || 'User';
      PresenceService.joinVoiceChannel(
        selectedClan.clanId,
        activeVoiceChannel.voiceChannelId,
        userName
      )
        .then(() => {
          playVoicePresenceNotification();
        })
        .catch((err) => {
          voiceConnectedRef.current = false;
          console.error('[Presence] join voice failed', err);
        });
    }
  }, [
    voiceState,
    activeVoiceChannel,
    selectedClan,
    user,
    playVoicePresenceNotification,
    isPresenceReady,
  ]);

  // Connect to PresenceHub once and manage subscriptions across clan changes
  useEffect(() => {
    if (loadingClans || !token) return;

    const clanIds = clans.map((c) => c.clanId);
    let cancelled = false;

    // ── Voice presence handlers ─────────────────────────────────────────
    const handleUserJoined = ({ voiceChannelId, userId, userName }) => {
      setVoicePresence((prev) => {
        const existing = prev[voiceChannelId] || [];
        if (existing.find((u) => u.userId === userId)) return prev;
        return { ...prev, [voiceChannelId]: [...existing, { userId, userName }] };
      });

      const currentUserId = user?.id || user?.sub || user?.userId || '';
      const activeChannelId = activeVoiceChannelRef.current?.voiceChannelId;
      if (userId !== currentUserId && activeChannelId && activeChannelId === voiceChannelId) {
        playVoicePresenceNotification();
      }
    };

    const handleUserLeft = ({ voiceChannelId, userId }) => {
      setVoicePresence((prev) => ({
        ...prev,
        [voiceChannelId]: (prev[voiceChannelId] || []).filter((u) => u.userId !== userId),
      }));

      const activeChannelId = activeVoiceChannelRef.current?.voiceChannelId;
      if (activeChannelId && activeChannelId === voiceChannelId) {
        playVoicePresenceNotification();
      }
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
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (awaitingFriendSnapshotRef.current) {
          for (const friendId of friendIdsRef.current) next.delete(friendId);
          awaitingFriendSnapshotRef.current = false;
        }
        for (const userId of userIds) next.add(userId);
        return next;
      });
    };

    const handleSubscriptionFailed = (reason) => {
      awaitingFriendSnapshotRef.current = false;
      console.error('[Presence] Arkadaş aboneliği reddedildi:', reason);
    };

    const isSelectedClan = (clanId) => (
      !!clanId
      && selectedClanRef.current?.clanId?.toLowerCase() === clanId.toLowerCase()
    );

    const handleChannelUpserted = (channel) => {
      if (!isSelectedClan(channel?.clanId) || !channel?.channelId) return;
      setChannels((prev) => upsertById(prev, channel, 'channelId'));
    };

    const handleVoiceChannelUpserted = (channel) => {
      if (!isSelectedClan(channel?.clanId) || !channel?.voiceChannelId) return;
      setVoiceChannels((prev) => upsertById(prev, channel, 'voiceChannelId'));
    };

    const handleClanMembershipChanged = (change) => {
      const clanId = change?.clanId;
      const changedUserId = change?.userId;
      if (!clanId || !changedUserId) return;

      const changeType = change.changeType?.toLowerCase();
      const currentUserId = user?.id || user?.sub || user?.userId || '';
      const isCurrentUser = changedUserId === currentUserId;

      if (changeType === 'removed') {
        if (isSelectedClan(clanId)) {
          setMemberships((prev) => prev.filter((member) => getMemberId(member) !== changedUserId));
        }

        if (isCurrentUser) {
          setClans((prev) => prev.filter((clan) => clan.clanId !== clanId));
          if (isSelectedClan(clanId)) {
            const active = activeVoiceChannelRef.current;
            if (active && !active.isDirect && active.clanId === clanId) handleDisconnectVoice();
            setSelectedClan(null);
            setSelectedChannel(null);
            setChannels([]);
            setVoiceChannels([]);
            setMemberships([]);
            navigate('/app');
          }
        }
        return;
      }

      if (isSelectedClan(clanId)) {
        setMemberships((prev) => {
          const index = prev.findIndex((member) => (
            member.id === change.membershipId || getMemberId(member) === changedUserId
          ));
          const existing = index >= 0 ? prev[index] : {};
          const incoming = {
            ...existing,
            id: change.membershipId || existing.id,
            clanId,
            userId: changedUserId,
            role: change.role || existing.role || 'MEMBER',
            ...(change.userName ? { userName: change.userName, username: change.userName } : {}),
            ...(change.avatarUrl ? { avatarUrl: change.avatarUrl } : {}),
          };
          if (index < 0) return [...prev, incoming];
          const next = [...prev];
          next[index] = incoming;
          return next;
        });
      }

      // Davetle katılma işlemi başka bir açık sekmede tamamlandıysa o sekmenin
      // sunucu listesi de event üzerinden tetiklenen tek seferlik snapshot ile güncellenir.
      if (isCurrentUser && !clansRef.current.some((clan) => clan.clanId === clanId)) {
        ClanService.getMyClans()
          .then((data) => setClans(data || []))
          .catch((error) => console.error('[Presence] clan list refresh failed', error));
      }
    };

    // ── Clan/channel lifecycle event handlers ──────────────────────────────────────
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
      console.info('[Presence] Yeniden bağlandı — abonelikler yenileniyor');
      await Promise.all([
        PresenceService.subscribeToClans(clanIds),
        subscribeFriendPresence(friendIdsRef.current),
      ]).catch((error) => console.error('[Presence] resubscribe failed', error));
      const active = activeVoiceChannelRef.current;
      if (active?.isDirect) {
        PresenceService.subscribeToConversations([active.conversationId]).catch(() => {});
      }
    };

    const connect = async () => {
      try {
        await PresenceService.startConnection(token);
        if (cancelled) return;

        // Register event listeners
        PresenceService.onUserJoinedVoice(handleUserJoined);
        PresenceService.onUserLeftVoice(handleUserLeft);
        PresenceService.onVoiceChannelParticipants(handleSnapshot);
        PresenceService.onUserOnline(handleUserOnline);
        PresenceService.onUserOffline(handleUserOffline);
        PresenceService.onOnlineUsers(handleOnlineUsers);
        PresenceService.onSubscriptionFailed(handleSubscriptionFailed);
        PresenceService.onChannelUpserted(handleChannelUpserted);
        PresenceService.onVoiceChannelUpserted(handleVoiceChannelUpserted);
        PresenceService.onChannelDeleted(handleChannelDeleted);
        PresenceService.onVoiceChannelDeleted(handleVoiceChannelDeleted);
        PresenceService.onClanMembershipChanged(handleClanMembershipChanged);
        PresenceService.onClanDeleted(handleClanDeleted);
        PresenceService.onReconnected(handleReconnected);

        await PresenceService.subscribeToClans(clanIds);
        if (!cancelled) setIsPresenceReady(true);
      } catch (err) {
        if (!cancelled) console.error('[Presence] connection failed', err);
      }
    };

    connect();

    return () => {
      cancelled = true;
      setIsPresenceReady(false);
      PresenceService.offUserJoinedVoice(handleUserJoined);
      PresenceService.offUserLeftVoice(handleUserLeft);
      PresenceService.offVoiceChannelParticipants(handleSnapshot);
      PresenceService.offUserOnline(handleUserOnline);
      PresenceService.offUserOffline(handleUserOffline);
      PresenceService.offOnlineUsers(handleOnlineUsers);
      PresenceService.offSubscriptionFailed(handleSubscriptionFailed);
      PresenceService.offChannelUpserted(handleChannelUpserted);
      PresenceService.offVoiceChannelUpserted(handleVoiceChannelUpserted);
      PresenceService.offChannelDeleted(handleChannelDeleted);
      PresenceService.offVoiceChannelDeleted(handleVoiceChannelDeleted);
      PresenceService.offClanMembershipChanged(handleClanMembershipChanged);
      PresenceService.offClanDeleted(handleClanDeleted);
      PresenceService.offReconnected(handleReconnected);
      PresenceService.stopConnection();
      setVoicePresence({});
      setOnlineUserIds(new Set());
    };
    // clans içeriği aynı kalırken referansı değişmesi bu effect'i tetiklememeli;
    // bu yüzden clans yerine stabil clanIdsKey kullanılıyor (bkz. güncelleme planı #6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clanIdsKey, loadingClans, queryOnlineStatus, subscribeFriendPresence, token]);

  // When the selected clan changes, fetch voice channel participants & online members
  useEffect(() => {
    if (!selectedClan || !isPresenceReady) {
      setVoicePresence({});
      return;
    }

    const clanId = selectedClan.clanId;

    // Fetch voice participants for this clan
    PresenceService.getParticipants(clanId)
      .catch((err) => {
        // Vite HMR/unmount devam eden SignalR negotiation'ını bilinçli olarak
        // durdurabilir. Bu, sunucu veya yetkilendirme hatası değildir.
        if (!PresenceService.isExpectedConnectionStop(err)) {
          console.error('[Presence] getParticipants failed', err);
        }
      });

    // Fetch online status for clan members
    if (memeberShips.length > 0) {
      const memberUserIds = memeberShips.map((m) => m.userId || m.user?.id || '').filter(Boolean);
      queryOnlineStatus(memberUserIds);
    }
  }, [selectedClan, memeberShips, queryOnlineStatus, isPresenceReady]);

  useEffect(() => {
    if (!isPresenceReady || friendsLoading) return;

    const friendIds = friends.map((f) => f.id).filter(Boolean);
    subscribeFriendPresence(friendIds)
      .catch((err) => console.error('[Presence] subscribe friends failed', err));
  }, [friends, friendsLoading, isPresenceReady, subscribeFriendPresence]);

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
      setChannels((prev) => upsertById(prev, newChannel, 'channelId'));
    } catch (error) {
      console.error('Failed to create channel', error);
    }
  };

  const handleCreateVoiceChannel = async (name) => {
    try {
      const newVoiceChannel = await ChannelService.createVoiceChannel({ name, clanId: selectedClan.clanId });
      setVoiceChannels((prev) => upsertById(prev, newVoiceChannel, 'voiceChannelId'));
    } catch (error) {
      console.error('Failed to create voice channel', error);
    }
  };

  const handleUpdateVoiceChannel = async ({ voiceChannelId, clanId, name }) => {
    try {
      const updated = await ChannelService.updateVoiceChannel({ voiceChannelId, clanId, name });
      setVoiceChannels((prev) => prev.map((vc) => vc.voiceChannelId === voiceChannelId ? { ...vc, name: updated.name ?? name } : vc));
    } catch (error) {
      console.error('Failed to update voice channel', error);
    }
  };

  const handleDeleteVoiceChannel = async (voiceChannelId, clanId) => {
    try {
      await ChannelService.deleteVoiceChannel(voiceChannelId, clanId || selectedClan?.clanId);
      setVoiceChannels((prev) => prev.filter((vc) => vc.voiceChannelId !== voiceChannelId));
      if (activeVoiceChannel?.voiceChannelId === voiceChannelId) {
        handleDisconnectVoice();
      }
    } catch (error) {
      console.error('Failed to delete voice channel', error);
    }
  };

  const handleUpdateChannel = async ({ channelId, clanId, name }) => {
    try {
      const updated = await ChannelService.updateChannel({ channelId, clanId, name });
      setChannels((prev) => prev.map((ch) => ch.channelId === channelId ? { ...ch, name: updated.name ?? name } : ch));
    } catch (error) {
      console.error('Failed to update channel', error);
    }
  };

  const handleDeleteChannel = async (channelId, clanId) => {
    try {
      await ChannelService.deleteChannel(channelId, clanId);
      setChannels((prev) => prev.filter((ch) => ch.channelId !== channelId));
      if (selectedChannel?.channelId === channelId) {
        setSelectedChannel(null);
        navigate(`/app/clans/${selectedClan.clanId}`);
      }
    } catch (error) {
      console.error('Failed to delete channel', error);
    }
  };

  const handleReorderClans = useCallback((reorderedClans) => {
    setClans(reorderedClans);
    localStorage.setItem('clanOrder', JSON.stringify(reorderedClans.map((c) => c.clanId)));
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleLeaveClan = async () => {
    if (!selectedClan || !user) return;
    try {
      await ClanMembershipService.leaveClan(selectedClan.clanId);
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

  const handleUpdateMemberRole = async (membershipId, roleName, clanId = selectedClan?.clanId) => {
    try {
      await ClanMembershipService.updateMemberRole(membershipId, roleName, clanId);
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

  const dmCallPanel = (
    <DmCallOverlay
      call={dmCallState}
      error={dmCallError}
      displayName={dmCallDisplayName}
      outputVolume={outputVolume}
      voiceState={activeVoiceChannel?.isDirect ? voiceState : null}
      onWatchScreenShare={handleWatchScreenShare}
      onAccept={acceptDmCall}
      onReject={rejectDmCall}
      onCancel={cancelDmCall}
      onEnd={handleEndActiveDmCall}
      onDismiss={dismissDmCall}
      compact
    />
  );

  return (
    <div className="discord-app">
      {user && user.emailConfirmed === false && !emailBannerDismissed && (
        <div className="email-verify-banner">
          <span className="material-symbols-outlined">mail</span>
          <p className="email-verify-banner__text">
            E-posta adresiniz henüz doğrulanmadı.
          </p>
          <button
            className="email-verify-banner__action"
            onClick={() => { setAccountSettingsTab('email'); setShowAccountSettings(true); }}
          >
            Doğrula
          </button>
          <button
            className="email-verify-banner__dismiss"
            onClick={() => setEmailBannerDismissed(true)}
            aria-label="Kapat"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
      <ServerList
        clans={clans}
        selectedClanId={selectedClan?.clanId}
        onSelectClan={handleSelectClan}
        onCreateClan={() => setShowCreateModal(true)}
        onReorder={handleReorderClans}
        isFriendsActive={isFriendsActive}
        onSelectFriends={handleSelectFriends}
      />

      {/* Sol panel — Arkadaşlar görünümünde sohbet bildirimleri, klan
          görünümünde metin/ses kanalları gösterilir. */}
      {isFriendsActive ? (
        <FriendsNotificationSidebar
          notifications={notifications}
          activeConversationId={activeDmConversation?.conversationId}
          onOpenNotification={handleOpenNotification}
          activeVoiceChannel={activeVoiceChannel}
          voiceState={voiceState}
          onDisconnectVoice={handleDisconnectVoice}
          onWatchScreenShare={handleWatchScreenShare}
          callPanel={dmCallPanel}
          headerAccessory={(
            <NotificationCenter
              notifications={notifications}
              onOpen={handleOpenNotification}
            />
          )}
        />
      ) : (
        <ChannelSidebar
          clan={selectedClan}
          channels={channels}
          voiceChannels={voiceChannels}
          selectedChannelId={selectedChannel?.channelId}
          activeVoiceChannelId={activeVoiceChannel?.voiceChannelId}
          onSelectChannel={handleSelectChannel}
          onSelectVoiceChannel={handleSelectVoiceChannel}
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
          headerAccessory={(
            <NotificationCenter
              notifications={notifications}
              onOpen={handleOpenNotification}
            />
          )}
          onWatchScreenShare={handleWatchScreenShare}
          onParticipantContextMenu={handleParticipantContextMenu}
          isClanMuted={mutedClanIds.includes(selectedClan?.clanId)}
          onToggleClanMute={() => handleToggleClanMute(selectedClan)}
          callPanel={dmCallPanel}
        />
      )}

      {/* Orta alan — Arkadaşlar sekmesinde de klanlarda da aynı ChatArea.
          DM modunda sohbet seçili değilse ChatArea kendi boş durumunu gösterir. */}
      {isFriendsActive ? (
        <ChatArea
          variant="dm"
          conversation={activeDmConversation}
          onBack={activeDmConversation ? handleCloseDm : undefined}
          onToggleVoiceCall={handleToggleDmVoice}
          isVoiceCallActive={
            !!activeDmConversation &&
            activeVoiceChannel?.voiceChannelId ===
              directVoiceRoomId(activeDmConversation.conversationId)
          }
          voiceCallPhase={
            dmCallState &&
            activeDmConversation &&
            dmCallState.conversationId === activeDmConversation.conversationId
              ? dmCallState.phase
              : null
          }
          notificationVolume={outputVolume}
        />
      ) : (
        <ChatArea
          clan={selectedClan}
          channel={selectedChannel}
          notificationVolume={outputVolume}
        />
      )}
      {dmError && (
        <div className="app-toast app-toast--error" role="alert">
          <span className="material-symbols-outlined">error</span>
          <span>{dmError}</span>
        </div>
      )}

      {activeVoiceChannel && (
        <VoiceChannel
          key={activeVoiceChannel?.voiceChannelId}
          roomId={activeVoiceChannel?.voiceChannelId || 'unknown-room'}
          clanId={activeVoiceChannel?.isDirect ? null : activeVoiceChannel?.clanId}
          userId={user?.id || user?.sub || user?.userId || 'unknown-user'}
          userName={user?.userName || user?.name || user?.email || 'User'}
          onLeaveRoom={handleDisconnectVoice}
          onVoiceStateChange={handleVoiceStateChange}
          onMicrophoneUnavailable={handleMicrophoneUnavailable}
          inputDevice={selectedInputDevice}
          outputDevice={selectedOutputDevice}
          inputVolume={inputVolume}
          outputVolume={outputVolume}
          isMicMuted={isMicMuted}
          userVolumes={userVolumes}
          noiseSuppressionEnabled={noiseSuppressionEnabled}
        />
      )}

      {showCreateModal && (
        <CreateClanModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateClan}
          onJoin={async () => {
            const data = await ClanService.getMyClans();
            setClans(data || []);
          }}
        />
      )}

      {/* Sağ panel — Arkadaşlar sekmesinde arkadaş listesi, klanda üye listesi */}
      {isFriendsActive ? (
        <FriendsMemberList
          friends={friends}
          friendRequests={friendRequests}
          onlineUserIds={onlineUserIds}
          activeConversationUserId={activeDmConversation?.otherUserId}
          currentUserId={user?.id || user?.sub || ''}
          loading={friendsLoading}
          error={friendsError}
          onOpenDm={handleOpenDm}
          onRemoveFriend={handleRemoveFriend}
          onRefresh={handleRefreshFriends}
          onSendRequest={handleSendFriendRequest}
          onAcceptRequest={handleAcceptFriendRequest}
          onRejectRequest={handleRejectFriendRequest}
          mutedUserIds={mutedUserIds}
          onToggleUserMute={handleToggleUserMute}
        />
      ) : (
        <MemberList
          members={displayMemberships}
          clanId={selectedClan?.clanId}
          onlineUserIds={onlineUserIds}
          currentUserId={user?.id || user?.sub || ''}
          onMemberContextMenu={handleMemberContextMenu}
          onMemberClick={handleMemberClick}
          onRefresh={handleRefreshMembers}
        />
      )}

      {showClanSettings && selectedClan && (
        <ClanSettings
          clan={selectedClan}
          members={displayMemberships}
          userRole={userRole}
          user={user}
          onClose={() => setShowClanSettings(false)}
          onUpdateClan={handleUpdateClan}
          onDeleteClan={handleDeleteClan}
          onUpdateMemberRole={handleUpdateMemberRole}
          onKickMember={handleKickMember}
        />
      )}

      {showAccountSettings && (
        <AccountSettings
          user={user}
          initialTab={accountSettingsTab}
          onClose={() => setShowAccountSettings(false)}
          onProfileUpdated={updateUser}
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
          isMicMuted={isMicMuted}
          onToggleMic={handleToggleMic}
        />
      )}

      {/* Kullanıcı Sesi Ayar Menüsü */}
      <UserVolumeContextMenu
        visible={volumeCtxMenu.visible}
        x={volumeCtxMenu.x}
        y={volumeCtxMenu.y}
        participant={volumeCtxMenu.participant}
        currentVolume={volumeCtxMenu.participant ? (userVolumes[volumeCtxMenu.participant.identity] ?? 100) : 100}
        canKick={
          canManage
          && !activeVoiceChannel?.isDirect
          && activeVoiceChannel?.clanId?.toLowerCase() === selectedClan?.clanId?.toLowerCase()
          && !volumeCtxMenu.participant?.isLocal
        }
        isKicking={kickingVoiceUserId === volumeCtxMenu.participant?.identity}
        onKick={handleKickVoiceParticipant}
        onVolumeChange={handleUserVolumeChange}
        onClose={handleCloseVolumeCtx}
      />

      {/* Klan Üyesi Bağlam Menüsü */}
      <MemberContextMenu
        visible={memberCtxMenu.visible}
        x={memberCtxMenu.x}
        y={memberCtxMenu.y}
        member={memberCtxMenu.member}
        isSelf={memberCtxMenu.isSelf}
        isMuted={mutedUserIds.includes(getMemberId(memberCtxMenu.member || {}))}
        onAddFriend={handleAddFriendFromMember}
        onSendMessage={handleSendMessageFromMember}
        onToggleMute={handleToggleUserMute}
        onClose={handleCloseMemberCtx}
      />

      {/* Floating kullanıcı çubuğu — her sayfada sol altta aynı, tek örnek */}
      <UserBar
        user={user}
        onLogout={handleLogout}
        onOpenAccountSettings={handleOpenProfileSettings}
        inputVolume={inputVolume}
        setInputVolume={setInputVolume}
        outputVolume={outputVolume}
        setOutputVolume={setOutputVolume}
        selectedInputDevice={selectedInputDevice}
        setSelectedInputDevice={setSelectedInputDevice}
        selectedOutputDevice={selectedOutputDevice}
        setSelectedOutputDevice={setSelectedOutputDevice}
        isMicMuted={isMicMuted}
        onToggleMic={handleToggleMic}
        isDeafened={isDeafened}
        onToggleDeafen={handleToggleDeafen}
        noiseSuppressionEnabled={noiseSuppressionEnabled}
        setNoiseSuppressionEnabled={setNoiseSuppressionEnabled}
      />

      {/* Kullanıcı Profil Popup'ı */}
      <UserProfilePopup
        visible={profilePopup.visible}
        anchorRect={profilePopup.anchorRect}
        member={profilePopup.member}
        isOnline={onlineUserIds.has(getMemberId(profilePopup.member))}
        onClose={handleCloseProfilePopup}
      />
    </div>
  );
}

export default MainLayout;
