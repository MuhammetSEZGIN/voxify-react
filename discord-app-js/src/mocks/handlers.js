import { http, HttpResponse } from 'msw';

const API_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000/api';
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'http://localhost:5158/api';

// Mock data

const mockFriends = [
  { id: 'user-002', userName: 'user2', avatarUrl: null },
];

const mockFriendRequests = [
  {
    id: 'req-001',
    userId: 'user-003',
    userName: 'gamer_ali',
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    respondedAt: null,
    status: 'Pending',
  },
];

// DM konuşmaları — stateful: aynı kullanıcı için tekrar istenirse aynı
// conversationId döner (backend'in idempotent davranışını taklit eder).
const mockConversations = [];

// { [conversationId]: MessageDto[] } — DM mesaj geçmişi
const mockDmMessages = {};

function getOrCreateMockConversation(otherUserId) {
  const existing = mockConversations.find((c) => c.otherUserId === otherUserId);
  if (existing) return existing;

  const friend = mockFriends.find((f) => f.id === otherUserId);
  const conversation = {
    // Gerçek backend'de conversationId'nin channelId ile aynı olduğu
    // varsayılıyor (bkz. backend-gereksinimleri-dm.md madde 1.2).
    conversationId: `dm-${otherUserId}`,
    otherUserId,
    otherUserName: friend?.userName || 'Bilinmeyen kullanıcı',
    otherAvatarUrl: friend?.avatarUrl || null,
    lastMessage: '',
    lastMessageAt: null,
  };
  mockConversations.push(conversation);
  mockDmMessages[conversation.conversationId] = [
    {
      id: `dm-msg-${Date.now()}`,
      clanId: null,
      channelId: conversation.conversationId,
      userName: conversation.otherUserName,
      senderId: otherUserId,
      avatarUrl: conversation.otherAvatarUrl,
      text: 'Selam! (mock DM mesajı)',
      createdAt: new Date().toISOString(),
    },
  ];
  return conversation;
}

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

  // ===== Şifre değiştirme / e-posta doğrulama =====
  http.post(`${API_URL}/identity/user/change-password`, async ({ request }) => {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return HttpResponse.json(
        { isSuccessfull: false, message: 'Mevcut ve yeni şifre gereklidir' },
        { status: 400 }
      );
    }
    if (currentPassword !== 'password123') {
      return HttpResponse.json(
        { isSuccessfull: false, message: 'Mevcut şifre yanlış' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      isSuccessfull: true,
      message: 'Şifre başarıyla değiştirildi',
      data: { message: 'Şifre başarıyla değiştirildi' },
    });
  }),

  http.post(`${API_URL}/identity/auth/resend-confirmation-email`, async ({ request }) => {
    const { userId } = await request.json();

    if (!userId) {
      return HttpResponse.json(
        { isSuccessfull: false, message: 'userId gereklidir' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      isSuccessfull: true,
      message: 'Doğrulama e-postası gönderildi',
      data: { message: 'Doğrulama e-postası gönderildi' },
    });
  }),

  http.get(`${API_URL}/identity/auth/confirm-email`, ({ request }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('userId');

    if (!token || !userId) {
      return HttpResponse.json(
        { isSuccessfull: false, message: 'Doğrulama bağlantısı eksik bilgi içeriyor' },
        { status: 400 }
      );
    }
    if (token === 'invalid-token') {
      return HttpResponse.json(
        { isSuccessfull: false, message: 'Doğrulama bağlantısının süresi dolmuş veya geçersiz' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      isSuccessfull: true,
      message: 'E-posta başarıyla doğrulandı',
      data: { message: 'E-posta başarıyla doğrulandı', emailConfirmed: true },
    });
  }),

  // ===== Kullanıcı profili =====
  http.get(`${API_URL}/identity/user/me`, ({ request }) => {
    const token = request.headers.get('Authorization');
    if (!token) {
      return HttpResponse.json({ isSuccessfull: false, message: 'Yetkisiz' }, { status: 401 });
    }

    return HttpResponse.json({
      isSuccessfull: true,
      data: {
        id: 'user-001',
        userName: 'testuser',
        email: 'test@example.com',
        emailConfirmed: false,
        avatarUrl: null,
        bio: '',
      },
    });
  }),

  http.put(`${API_URL}/identity/user`, async ({ request }) => {
    const updates = await request.json();

    return HttpResponse.json({
      isSuccessfull: true,
      data: {
        id: 'user-001',
        userName: updates.userName ?? 'testuser',
        email: 'test@example.com',
        emailConfirmed: false,
        avatarUrl: updates.avatarUrl ?? null,
        bio: updates.bio ?? '',
      },
    });
  }),

  // ===== Kullanıcı arama (arkadaş ekleme akışında da kullanılır) =====
  http.get(`${API_URL}/identity/user/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();

    const allUsers = [
      { id: 'user-001', userName: 'testuser', avatarUrl: null },
      { id: 'user-002', userName: 'user2', avatarUrl: null },
      { id: 'user-003', userName: 'gamer_ali', avatarUrl: null },
    ];

    const results = q
      ? allUsers.filter((u) => u.userName.toLowerCase().includes(q))
      : [];

    return HttpResponse.json({ isSuccessfull: true, data: results });
  }),

  // ===== Arkadaşlık (stateful mock — accept/reject listeleri gerçekten günceller) =====
  http.get(`${API_URL}/identity/friendship`, () => {
    return HttpResponse.json({ isSuccessfull: true, data: mockFriends });
  }),

  http.get(`${API_URL}/identity/friendship/requests`, () => {
    return HttpResponse.json({ isSuccessfull: true, data: mockFriendRequests });
  }),

  http.post(`${API_URL}/identity/friendship/requests`, async ({ request }) => {
    const { addresseeId } = await request.json();
    if (!addresseeId) {
      return HttpResponse.json({ isSuccessfull: false, message: 'addresseeId gereklidir' }, { status: 400 });
    }
    return HttpResponse.json({
      isSuccessfull: true,
      data: { id: `req-${Date.now()}`, addresseeId, status: 'Pending' },
    });
  }),

  http.post(`${API_URL}/identity/friendship/requests/:id/accept`, ({ params }) => {
    const idx = mockFriendRequests.findIndex((r) => r.id === params.id);
    if (idx !== -1) {
      const [accepted] = mockFriendRequests.splice(idx, 1);
      mockFriends.push({ id: accepted.userId, userName: accepted.userName, avatarUrl: accepted.avatarUrl });
    }
    return HttpResponse.json({ isSuccessfull: true, data: { id: params.id, status: 'Accepted' } });
  }),

  http.post(`${API_URL}/identity/friendship/requests/:id/reject`, ({ params }) => {
    const idx = mockFriendRequests.findIndex((r) => r.id === params.id);
    if (idx !== -1) mockFriendRequests.splice(idx, 1);
    return HttpResponse.json({ isSuccessfull: true, data: { id: params.id, status: 'Rejected' } });
  }),

  http.delete(`${API_URL}/identity/friendship/:friendUserId`, ({ params }) => {
    const idx = mockFriends.findIndex((f) => f.id === params.friendUserId);
    if (idx !== -1) mockFriends.splice(idx, 1);
    return HttpResponse.json({ isSuccessfull: true, data: { removed: params.friendUserId } });
  }),

  // ===== DM konuşmaları =====
  // Gerçek backend route'u `/message/api/Dm/conversations` (swagger'dan
  // doğrulandı). Ocelot'un prefix'i soyup soymadığı kesinleşmediği için
  // servisler iki biçimi de deniyor; mock da ikisini de karşılıyor.
  ...['api/Dm', 'dm'].flatMap((seg) => [
    http.post(`${API_URL}/message/${seg}/conversations`, async ({ request }) => {
      const { otherUserId } = await request.json();
      if (!otherUserId) {
        return HttpResponse.json({ message: 'otherUserId gereklidir' }, { status: 400 });
      }
      return HttpResponse.json(getOrCreateMockConversation(otherUserId));
    }),

    http.get(`${API_URL}/message/${seg}/conversations`, () => {
      return HttpResponse.json(mockConversations);
    }),
  ]),

  // ===== DM mesaj geçmişi =====
  // clanId'siz genel route: GET /api/Message?channelId=…
  ...['api/Message', ''].map((seg) =>
    http.get(`${API_URL}/message${seg ? `/${seg}` : ''}`, ({ request }) => {
      const url = new URL(request.url);
      const channelId = url.searchParams.get('channelId');
      if (!channelId) {
        return HttpResponse.json({ message: 'channelId gereklidir' }, { status: 400 });
      }
      return HttpResponse.json(mockDmMessages[channelId] || []);
    })
  ),
];