import { http, HttpResponse } from 'msw';

const API_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000/api';
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'http://localhost:5158/api';

// Mock data

const mockMessages = {
  'ch-1111-0001': [
    {
      messageId: 'msg-0001',
      content: 'Herkese merhaba! 👋',
      channelId: 'ch-1111-0001',
      userId: 'user-001',
      user: { id: 'user-001', username: 'testuser' },
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      isEdited: false,
    },
    {
      messageId: 'msg-0002',
      content: 'Merhaba, hoş geldin!',
      channelId: 'ch-1111-0001',
      userId: 'user-002',
      user: { id: 'user-002', username: 'user2' },
      createdAt: new Date(Date.now() - 3000000).toISOString(),
      isEdited: false,
    },
    {
      messageId: 'msg-0003',
      content: 'Bu sunucu harika görünüyor 🎉',
      channelId: 'ch-1111-0001',
      userId: 'user-001',
      user: { id: 'user-001', username: 'testuser' },
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      isEdited: false,
    },
  ],
  'ch-2222-0001': [
    {
      messageId: 'msg-0004',
      content: 'Bu akşam oyun oynayacak var mı?',
      channelId: 'ch-2222-0001',
      userId: 'user-002',
      user: { id: 'user-002', username: 'user2' },
      createdAt: new Date(Date.now() - 600000).toISOString(),
      isEdited: false,
    },
  ],
  'ch-3333-0001': [
    {
      messageId: 'msg-0005',
      content: 'React 19 çok iyi olmuş!',
      channelId: 'ch-3333-0001',
      userId: 'user-001',
      user: { id: 'user-001', username: 'testuser' },
      createdAt: new Date(Date.now() - 120000).toISOString(),
      isEdited: false,
    },
  ],
};
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
   
    // ===== Message endpoints =====

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

 
];