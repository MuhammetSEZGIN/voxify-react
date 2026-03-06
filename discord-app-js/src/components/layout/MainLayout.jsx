import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import ClanService from '../../services/ClanService';
import ChannelService from '../../services/ChannelService';
import ServerList from '../clan/ServerList';
import ChannelSidebar from '../clan/ChannelSidebar';
import ChatArea from '../chat/ChatArea';
import CreateClanModal from '../clan/CreateClanModal';
import '../../styles/discord.css';
import MemberList from '../clan/MemberList';

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { clanId: urlClanId, channelId: urlChannelId } = useParams();

  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState(null);
  const [channels, setChannels] = useState([]);
  const [voiceChannels, setVoiceChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [memeberShips, setMemberships] = useState([]);
  const [loadingClans, setLoadingClans] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        onSelectChannel={handleSelectChannel}
        user={user}
        onLogout={handleLogout}
        onCreateChannel={handleCreateChannel}
        onCreateVoiceChannel={handleCreateVoiceChannel}
        onUpdateChannel={handleUpdateChannel}
        onDeleteChannel={handleDeleteChannel}
      />

      <ChatArea
        clan={selectedClan}
        channel={selectedChannel}
      />
      {showCreateModal && (
        <CreateClanModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateClan}
        />
      )}

      <MemberList members={memeberShips} clanId={selectedClan?.clanId} />
    </div>
  );
}

export default MainLayout;