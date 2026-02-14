import { http, HttpResponse } from 'msw';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Mock data
const mockClans = [
  {
    clanId: 'c1a1a1a1-1111-1111-1111-111111111111',
    name: 'Genel Sunucu',
    imagePath: null,
    description: 'Herkesin katılabileceği genel sunucu',
    isPublic: true,
    channels: [],
    voiceChannels: [],
  },
  {
    clanId: 'c2b2b2b2-2222-2222-2222-222222222222',
    name: 'Oyun Klanı',
    imagePath: null,
    description: 'Oyun severler için',
    isPublic: false,
    channels: [],
    voiceChannels: [],
  },
  {
    clanId: 'c3c3c3c3-3333-3333-3333-333333333333',
    name: 'Yazılım Dev',
    imagePath: null,
    description: 'Yazılımcılar burada',
    isPublic: true,
    channels: [],
    voiceChannels: [],
  },
];

const mockChannels = {
  'c1a1a1a1-1111-1111-1111-111111111111': [
    { channelId: 'ch-1111-0001', name: 'genel', clanId: 'c1a1a1a1-1111-1111-1111-111111111111' },
    { channelId: 'ch-1111-0002', name: 'duyurular', clanId: 'c1a1a1a1-1111-1111-1111-111111111111' },
  ],
  'c2b2b2b2-2222-2222-2222-222222222222': [
    { channelId: 'ch-2222-0001', name: 'oyun-sohbet', clanId: 'c2b2b2b2-2222-2222-2222-222222222222' },
    { channelId: 'ch-2222-0002', name: 'strateji', clanId: 'c2b2b2b2-2222-2222-2222-222222222222' },
  ],
  'c3c3c3c3-3333-3333-3333-333333333333': [
    { channelId: 'ch-3333-0001', name: 'javascript', clanId: 'c3c3c3c3-3333-3333-3333-333333333333' },
    { channelId: 'ch-3333-0002', name: 'react', clanId: 'c3c3c3c3-3333-3333-3333-333333333333' },
    { channelId: 'ch-3333-0003', name: 'backend', clanId: 'c3c3c3c3-3333-3333-3333-333333333333' },
  ],
};

const mockVoiceChannels = {
  'c1a1a1a1-1111-1111-1111-111111111111': [
    { voiceChannelId: 'vc-1111-0001', name: 'Sohbet 1', clanId: 'c1a1a1a1-1111-1111-1111-111111111111', isActive: true, maxParticipants: 10 },
  ],
  'c2b2b2b2-2222-2222-2222-222222222222': [
    { voiceChannelId: 'vc-2222-0001', name: 'Oyun Odası', clanId: 'c2b2b2b2-2222-2222-2222-222222222222', isActive: true, maxParticipants: 5 },
    { voiceChannelId: 'vc-2222-0002', name: 'AFK', clanId: 'c2b2b2b2-2222-2222-2222-222222222222', isActive: false, maxParticipants: 10 },
  ],
  'c3c3c3c3-3333-3333-3333-333333333333': [
    { voiceChannelId: 'vc-3333-0001', name: 'Pair Programming', clanId: 'c3c3c3c3-3333-3333-3333-333333333333', isActive: true, maxParticipants: 2 },
  ],
};

export const handlers = [
  // ===== Auth endpoints =====
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const { email, password } = await request.json();

    if (email === 'test@example.com' && password === 'password123') {
      console.log('mock login girişimi');
      return HttpResponse.json({
        token: 'mock-jwt-token-12345',
        user: {
          id: 'user-001',
          email: 'test@example.com',
          username: 'testuser',
        },
      });
    }

    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  http.post(`${API_URL}/auth/register`, async ({ request }) => {
    const data = await request.json();

    return HttpResponse.json(
      {
        token: 'mock-jwt-token-12345',
        user: {
          id: 'user-002',
          email: data.email,
          username: data.userName,
        },
      },
      { status: 201 }
    );
  }),

  http.get(`${API_URL}/auth/me`, ({ request }) => {
    const token = request.headers.get('Authorization');

    if (!token) {
      return HttpResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    return HttpResponse.json({
      id: 'user-001',
      email: 'test@example.com',
      username: 'testuser',
    });
  }),

  // ===== Clan endpoints =====

  // GET /api/Clan - Get all clans (for current user)
  http.get(`${API_URL}/Clan`, () => {
    return HttpResponse.json(mockClans);
  }),

  // GET /api/Clan/:clanId - Get clan by ID
  http.get(`${API_URL}/Clan/:clanId`, ({ params }) => {
    const clan = mockClans.find((c) => c.clanId === params.clanId);
    if (!clan) {
      return HttpResponse.json({ error: 'Clan not found' }, { status: 404 });
    }
    return HttpResponse.json(clan);
  }),

  // GET /api/Clan/user/:userId - Get clans by user ID
  http.get(`${API_URL}/Clan/user/:userId`, () => {
    return HttpResponse.json(mockClans);
  }),

  // POST /api/Clan - Create clan
  http.post(`${API_URL}/Clan`, async ({ request }) => {
    const data = await request.json();
    const newClan = {
      clanId: crypto.randomUUID(),
      name: data.name,
      imagePath: data.imagePath || null,
      description: data.description || null,
      isPublic: true,
      channels: [],
      voiceChannels: [],
    };
    mockClans.push(newClan);
    return HttpResponse.json(newClan, { status: 201 });
  }),

  // PUT /api/Clan - Update clan
  http.put(`${API_URL}/Clan`, async ({ request }) => {
    const data = await request.json();
    const clan = mockClans.find((c) => c.clanId === data.clanId);
    if (!clan) {
      return HttpResponse.json({ error: 'Clan not found' }, { status: 404 });
    }
    clan.name = data.name;
    if (data.imagePath !== undefined) clan.imagePath = data.imagePath;
    return HttpResponse.json(clan);
  }),

  // DELETE /api/Clan/:clanId
  http.delete(`${API_URL}/Clan/:clanId`, ({ params }) => {
    const index = mockClans.findIndex((c) => c.clanId === params.clanId);
    if (index === -1) {
      return HttpResponse.json({ error: 'Clan not found' }, { status: 404 });
    }
    mockClans.splice(index, 1);
    return HttpResponse.json({ message: 'Deleted' });
  }),

  // ===== Channel endpoints =====

  // GET /api/Channel/clan/:clanId
  http.get(`${API_URL}/Channel/clan/:clanId`, ({ params }) => {
    const channels = mockChannels[params.clanId] || [];
    return HttpResponse.json(channels);
  }),

  // GET /api/Channel/:channelId
  http.get(`${API_URL}/Channel/:channelId`, ({ params }) => {
    for (const channels of Object.values(mockChannels)) {
      const ch = channels.find((c) => c.channelId === params.channelId);
      if (ch) return HttpResponse.json(ch);
    }
    return HttpResponse.json({ error: 'Channel not found' }, { status: 404 });
  }),

  // POST /api/Channel
  http.post(`${API_URL}/Channel`, async ({ request }) => {
    const data = await request.json();
    const newChannel = {
      channelId: crypto.randomUUID(),
      name: data.name,
      clanId: data.clanId,
    };
    if (!mockChannels[data.clanId]) mockChannels[data.clanId] = [];
    mockChannels[data.clanId].push(newChannel);
    return HttpResponse.json(newChannel, { status: 201 });
  }),

  // PUT /api/Channel
  http.put(`${API_URL}/Channel`, async ({ request }) => {
    const data = await request.json();
    for (const channels of Object.values(mockChannels)) {
      const ch = channels.find((c) => c.channelId === data.channelId);
      if (ch) {
        ch.name = data.name;
        return HttpResponse.json(ch);
      }
    }
    return HttpResponse.json({ error: 'Channel not found' }, { status: 404 });
  }),

  // DELETE /api/Channel/:channelId
  http.delete(`${API_URL}/Channel/:channelId`, ({ params }) => {
    for (const [clanId, channels] of Object.entries(mockChannels)) {
      const index = channels.findIndex((c) => c.channelId === params.channelId);
      if (index !== -1) {
        mockChannels[clanId].splice(index, 1);
        return HttpResponse.json({ message: 'Deleted' });
      }
    }
    return HttpResponse.json({ error: 'Channel not found' }, { status: 404 });
  }),

  // ===== VoiceChannel endpoints =====

  // GET /api/VoiceChannel/clan/:clanId
  http.get(`${API_URL}/VoiceChannel/clan/:clanId`, ({ params }) => {
    const voiceChannels = mockVoiceChannels[params.clanId] || [];
    return HttpResponse.json(voiceChannels);
  }),

  // GET /api/VoiceChannel/:voiceChannelId
  http.get(`${API_URL}/VoiceChannel/:voiceChannelId`, ({ params }) => {
    for (const vcs of Object.values(mockVoiceChannels)) {
      const vc = vcs.find((v) => v.voiceChannelId === params.voiceChannelId);
      if (vc) return HttpResponse.json(vc);
    }
    return HttpResponse.json({ error: 'Voice channel not found' }, { status: 404 });
  }),

  // POST /api/VoiceChannel
  http.post(`${API_URL}/VoiceChannel`, async ({ request }) => {
    const data = await request.json();
    const newVc = {
      voiceChannelId: crypto.randomUUID(),
      name: data.name,
      clanId: data.clanId,
      isActive: true,
      maxParticipants: 10,
    };
    if (!mockVoiceChannels[data.clanId]) mockVoiceChannels[data.clanId] = [];
    mockVoiceChannels[data.clanId].push(newVc);
    return HttpResponse.json(newVc, { status: 201 });
  }),

  // ===== ClanMembership endpoints =====

  // GET /api/ClanMembership/clan/:clanId
  http.get(`${API_URL}/ClanMembership/clan/:clanId`, ({ params }) => {
    return HttpResponse.json([
      { id: crypto.randomUUID(), clanId: params.clanId, userId: 'user-001', role: 'owner', user: { id: 'user-001', username: 'testuser' } },
      { id: crypto.randomUUID(), clanId: params.clanId, userId: 'user-002', role: 'member', user: { id: 'user-002', username: 'user2' } },
    ]);
  }),

  // POST /api/ClanMembership/:clanId/invitations
  http.post(`${API_URL}/ClanMembership/:clanId/invitations`, ({ params }) => {
    return HttpResponse.json({
      inviteId: crypto.randomUUID(),
      clanId: params.clanId,
      inviteCode: 'MOCK-INVITE-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      maxUses: 100,
      usedCount: 0,
    });
  }),

  // POST /api/ClanMembership/join
  http.post(`${API_URL}/ClanMembership/join`, async ({ request }) => {
    const data = await request.json();
    return HttpResponse.json({
      id: crypto.randomUUID(),
      clanId: 'c1a1a1a1-1111-1111-1111-111111111111',
      userId: data.userId,
      role: 'member',
    });
  }),
];