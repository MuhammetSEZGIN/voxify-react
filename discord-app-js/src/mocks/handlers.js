import { http, HttpResponse } from 'msw';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const { email, password } = await request.json();
    
    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        token: 'mock-jwt-token-12345',
        user: {
          id: 1,
          email: 'test@example.com',
          username: 'testuser',
        },
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post(`${API_URL}/auth/register`, async ({ request }) => {
    const data = await request.json();
    
    return HttpResponse.json({
      token: 'mock-jwt-token-12345',
      user: {
        id: 2,
        email: data.email,
        username: data.username,
      },
    }, { status: 201 });
  }),

  http.get(`${API_URL}/auth/me`, ({ request }) => {
    const token = request.headers.get('Authorization');
    
    if (!token) {
      return HttpResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }
    
    return HttpResponse.json({
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
    });
  }),

  // Users endpoints
  http.get(`${API_URL}/users`, () => {
    return HttpResponse.json([
      { id: 1, username: 'user1', email: 'user1@example.com' },
      { id: 2, username: 'user2', email: 'user2@example.com' },
      { id: 3, username: 'user3', email: 'user3@example.com' },
    ]);
  }),

  http.get(`${API_URL}/users/:id`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      id: Number(id),
      username: `user${id}`,
      email: `user${id}@example.com`,
    });
  }),

  // Servers/Channels endpoints (Discord-like)
  http.get(`${API_URL}/servers`, () => {
    return HttpResponse.json([
      { id: 1, name: 'General Server', icon: '🏠' },
      { id: 2, name: 'Gaming Server', icon: '🎮' },
      { id: 3, name: 'Dev Server', icon: '💻' },
    ]);
  }),

  http.get(`${API_URL}/servers/:id/channels`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json([
      { id: 1, serverId: Number(id), name: 'general', type: 'text' },
      { id: 2, serverId: Number(id), name: 'random', type: 'text' },
      { id: 3, serverId: Number(id), name: 'voice-chat', type: 'voice' },
    ]);
  }),

  // Messages endpoints
  http.get(`${API_URL}/channels/:id/messages`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json([
      {
        id: 1,
        channelId: Number(id),
        content: 'Hello everyone!',
        author: { id: 1, username: 'user1' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        channelId: Number(id),
        content: 'Welcome to the channel',
        author: { id: 2, username: 'user2' },
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  http.post(`${API_URL}/channels/:id/messages`, async ({ request, params }) => {
    const { id } = params;
    const { content } = await request.json();
    
    return HttpResponse.json({
      id: Date.now(),
      channelId: Number(id),
      content,
      author: { id: 1, username: 'testuser' },
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),
];