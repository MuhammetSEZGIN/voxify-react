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
import * as PresenceService from '../../services/PresenceService';
import { VOICE_JOIN_NOTIFICATION_SOUND } from '../../utils/constants';
import { directVoiceRoomId } from '../../utils/space';

function MainLayout() {
  const { user, logout, updateUser } = useAuth();
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
  // PresenceHub bağlantısı kurulduğu anda o anki arkadaş listesi için de
  // online-durum sorgusu atabilmek için (bkz. presence connect effect'i).
  const friendsRef = useRef([]);

  /** Belirtilen ID'ler için sunucudan online durumu sorgular (ateşle-unut). */
  const queryOnlineStatus = useCallback((userIds) => {
    const ids = (userIds || []).filter(Boolean);
    if (ids.length === 0) return;
    PresenceService.getOnlineUsers(ids).catch((err) =>
      console.error('[Presence] getOnlineUsers failed', err)
    );
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

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

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

        // URL'de klan seçili değilse ilk klanı otomatik seç
        if (!urlClanId && ordered.length > 0) {
          setSelectedClan(ordered[0]);
        }
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
      if (channel) {
        setSelectedChannel(channel);
        return;
      }
    }

    if (selectedClan && channels.length > 0) {
      const firstChannel = channels[0];
      setSelectedChannel(firstChannel);
      navigate(`/app/clans/${selectedClan.clanId}/channels/${firstChannel.channelId}`);
      return;
    }

    setSelectedChannel(null);
  }, [urlChannelId, channels, navigate, selectedClan]);

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

        // URL'de kanal seçili değilse ilk metin kanalını otomatik seç
        if (!urlChannelId && data.channels?.length > 0) {
          const first = data.channels[0];
          setSelectedChannel(first);
          navigate(`/app/clans/${selectedClan.clanId}/channels/${first.channelId}`);
        }
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
    navigate('/app');
  };

  const handleSelectFriends = () => {
    setSelectedClan(null);
    setSelectedChannel(null);
    setChannels([]);
    setVoiceChannels([]);
    setIsFriendsActive(true);
    setActiveDmConversation(null);
    navigate('/app');
  };

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

  const getMemberId = (m) => m.userId || m.user?.id || m.id || '';

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
      setActiveVoiceChannel(channel);
    }
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

  // ── UserBar callback'leri ────────────────────────────────────────────────
  // Hepsi stabil referans: UserBar memo'lu, satır içi lambda geçersek her
  // MainLayout render'ında (mesaj geldi, presence değişti...) yeniden çizilir.
  const handleToggleMic = useCallback(() => setIsMicMuted((prev) => !prev), []);

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

  const handleDisconnectVoice = useCallback(() => {
    // Report leaving to presence hub before clearing state.
    // DM odalarında presence'a hiç katılmadığımız için ayrılma da bildirilmez.
    const channel = activeVoiceChannelRef.current;
    if (channel?.isDirect) {
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

  /**
   * DM sesli görüşmesini başlatır/kapatır.
   *
   * Klan ses kanallarıyla aynı `activeVoiceChannel` state'ini kullanır — sadece
   * `voiceChannelId` olarak `dm-{conversationId}` geçer. Böylece VoiceChannel,
   * ekran paylaşımı, ses ayarları ve UserBar hiç değişmeden çalışır.
   *
   * DM'de kanal oluşturma/silme yoktur: konuşma başına tek kalıcı oda.
   */
  const handleToggleDmVoice = useCallback((conversation) => {
    if (!conversation?.conversationId) return;
    const roomId = directVoiceRoomId(conversation.conversationId);
    const current = activeVoiceChannelRef.current;

    // Aynı odadaysak → ayrıl (toggle)
    if (current?.voiceChannelId === roomId) {
      handleDisconnectVoice();
      return;
    }
    // Başka bir odadaysak önce oradan çık
    if (current) handleDisconnectVoice();

    setActiveVoiceChannel({
      voiceChannelId: roomId,
      name: conversation.otherUserName || 'Doğrudan Görüşme',
      isDirect: true,
      conversationId: conversation.conversationId,
    });
  }, [handleDisconnectVoice]);

  // Keep ref in sync so handleDisconnectVoice always sees the latest channel
  useEffect(() => {
    activeVoiceChannelRef.current = activeVoiceChannel;
  }, [activeVoiceChannel]);
  useEffect(() => { selectedClanRef.current = selectedClan; }, [selectedClan]);
  useEffect(() => { friendsRef.current = friends; }, [friends]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  // Report joining to presence hub once LiveKit room connects (voiceState null → non-null)
  //
  // DM ses odaları (activeVoiceChannel.isDirect) presence'a bildirilmez:
  // PresenceHub'ın tüm imzaları clanId merkezli ve DM karşılığı backend'de
  // henüz yok (bkz. backend-gereksinimleri-dm.md madde 3.2). Bu bloklayıcı
  // değil — LiveKit'in kendi katılımcı listesi odaya girildikten sonra zaten
  // kimin bağlı olduğunu veriyor; eksik olan sadece "girmeden önce karşı taraf
  // seste mi?" göstergesi.
  useEffect(() => {
    if (activeVoiceChannel?.isDirect) {
      if (voiceState) voiceConnectedRef.current = true;
      else voiceConnectedRef.current = false;
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
        .catch((err) => console.error('[Presence] join voice failed', err));
    }
    if (!voiceState) {
      voiceConnectedRef.current = false;
    }
  }, [voiceState, activeVoiceChannel, selectedClan, user, playVoicePresenceNotification]);

  // Connect to PresenceHub once and manage subscriptions across clan changes
  useEffect(() => {
    if (!clanIdsKey || loadingClans) return;

    const token = localStorage.getItem('token');
    const clanIds = clans.map((c) => c.clanId);

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

    // GetOnlineUsers hem klan üyeleri hem arkadaşlar için ayrı ayrı çağrılıyor
    // (bkz. aşağıdaki friends effect'i), ama sunucudan gelen `OnlineUsers`
    // cevabı hangi sorguya ait olduğunu belirtmiyor. Eskiden `new Set(userIds)`
    // ile TÜM listeyi DEĞİŞTİRİYORDUK — bu yüzden ikinci sorgunun (örn. klan
    // üyeleri) cevabı, ilk sorgunun (arkadaşlar) sonucunu siliyordu ve
    // arkadaşlar sekmesinde herkes hep çevrimdışı görünüyordu.
    //
    // Düzeltme: `OnlineUsers` SADECE birleştirir (ekler), asla silmez.
    // Çevrimdışı olma bilgisi zaten ayrı ve güvenilir bir kaynaktan geliyor:
    // `UserOffline` tekil olayı (handleUserOffline). Bu, "hangi sorgunun
    // cevabı bu?" belirsizliğini bir reconcile/sıralama hilesi olmadan çözer.
    const handleOnlineUsers = (userIds) => {
      setOnlineUserIds((prev) => new Set([...prev, ...userIds]));
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

        // Arkadaşların online durumunu bağlantı kurulur kurulmaz sorgula.
        //
        // ÖNEMLİ DÜZELTME: `friends` state'i, klanlar yüklenmeden hemen
        // (uygulama açılışında) API'den geliyor — ama bu PresenceHub
        // bağlantı effect'i `clanIdsKey && !loadingClans` şartına bağlı,
        // yani klanlar yüklenene kadar bağlantı kurulmuyor. Önceki
        // düzeltmede "friends değişince sorgula" effect'i eklenmişti, ama
        // `friends` zaten bağlantıdan ÖNCE set edildiği için o effect hiç
        // yeniden tetiklenmiyordu — `getOnlineUsers` sessizce no-op oluyordu
        // (PresenceService.js: bağlantı yoksa hiçbir şey yapmadan döner).
        // Bu yüzden bağlantı kurulur kurulmaz o anki listeyi burada da
        // sorguluyoruz; `friends` state'i sonradan değişirse ayrı effect
        // (aşağıda) zaten devreye giriyor.
        queryOnlineStatus(friendsRef.current.map((f) => f.id));
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
    // clans içeriği aynı kalırken referansı değişmesi bu effect'i tetiklememeli;
    // bu yüzden clans yerine stabil clanIdsKey kullanılıyor (bkz. güncelleme planı #6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clanIdsKey, loadingClans, queryOnlineStatus]);

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
      queryOnlineStatus(memberUserIds);
    }
  }, [selectedClan?.clanId, memeberShips, queryOnlineStatus]);

  // Arkadaş listesi yüklendiğinde/değiştiğinde online durumlarını sorgula.
  //
  // ÖNEMLİ DÜZELTME: Bu sorgu daha önce HİÇ YAPILMIYORDU — sadece klan
  // üyelerinin ID'leri PresenceHub'a soruluyordu. Bir arkadaş ortak klanınız
  // yoksa (DM'in doğası gereği sık rastlanan durum) online durumu asla
  // sorgulanmıyor, `onlineUserIds` setine hiç girmiyor ve arkadaşlar
  // sekmesinde her zaman "çevrimdışı" görünüyordu.
  useEffect(() => {
    if (friends.length === 0) return;
    const friendIds = friends.map((f) => f.id).filter(Boolean);
    queryOnlineStatus(friendIds);
  }, [friends, queryOnlineStatus]);

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
    const userId = user.id || user.sub || '';
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

      {/* Sol panel — Arkadaşlar sekmesinde de kanal listesi kalır. Arkadaş
          listesi artık yalnızca sağdaki FriendsMemberList'te (eskiden burada
          FriendsSidebar olarak ikinci bir kopya vardı, kaldırıldı). */}
      <ChannelSidebar
        clan={isFriendsActive ? null : selectedClan}
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
        onWatchScreenShare={handleWatchScreenShare}
        onParticipantContextMenu={handleParticipantContextMenu}
      />

      {/* Orta alan — Arkadaşlar sekmesinde de klanlarda da aynı ChatArea.
          DM modunda sohbet seçili değilse ChatArea kendi boş durumunu gösterir. */}
      {isFriendsActive ? (
        <ChatArea
          variant="dm"
          conversation={activeDmConversation}
          onBack={activeDmConversation ? () => setActiveDmConversation(null) : undefined}
          onToggleVoiceCall={handleToggleDmVoice}
          isVoiceCallActive={
            !!activeDmConversation &&
            activeVoiceChannel?.voiceChannelId ===
              directVoiceRoomId(activeDmConversation.conversationId)
          }
        />
      ) : (
        <ChatArea
          clan={selectedClan}
          channel={selectedChannel}
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
          userId={user?.id || user?.sub || user?.userId || 'unknown-user'}
          userName={user?.userName || user?.name || user?.email || 'User'}
          onLeaveRoom={handleDisconnectVoice}
          onVoiceStateChange={handleVoiceStateChange}
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
        />
      ) : (
        <MemberList
          members={memeberShips}
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
        onAddFriend={handleAddFriendFromMember}
        onSendMessage={handleSendMessageFromMember}
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
        onClose={handleCloseProfilePopup}
      />
    </div>
  );
}

export default MainLayout;
