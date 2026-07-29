# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Voxify** is a Discord-like web chat and voice communication app built with React + Vite. This branch is browser-only. Users form "clans" (server communities), join text and voice channels, and communicate via real-time messaging (SignalR) and WebRTC voice (LiveKit).

## Development Commands

```bash
npm run dev          # Vite dev server at localhost:5173
npm run build        # Production Vite build → dist/
npm run lint         # ESLint
npm run preview      # Preview built app
npm run audit:prod   # Audit production dependencies
```

## Environment Variables

All are prefixed `VITE_` and defined in `.env`:

| Variable | Purpose |
|---|---|
| `VITE_BASE_URL` | REST API base URL |
| `VITE_HUB_URL` | SignalR MessageHub URL |
| `VITE_PRESENCE_HUB_URL` | SignalR PresenceHub URL |
| `VITE_LIVEKIT_URL` | LiveKit WebSocket URL (wss://) |
| `VITE_VOICE_SERVER_URL` | Voice token endpoint base |
| `VITE_TENOR_API_KEY` / `VITE_TENOR_CLIENT_KEY` | GIF search |
| `VITE_MOCKING` | `true` to activate MSW mock handlers |

## Architecture

### State Orchestration

[src/components/layout/MainLayout.jsx](src/components/layout/MainLayout.jsx) is the central hub — it holds selected clan/channel, voice presence maps, and online user IDs, and passes them down as props. It is the correct place to add any cross-cutting UI state.

[src/contexts/AuthContext.jsx](src/contexts/AuthContext.jsx) provides JWT auth state globally (`user`, `token`, `isAuthenticated`). Access it via the `useAuth` hook. Tokens are stored in tab-scoped `sessionStorage` through [src/utils/authStorage.js](src/utils/authStorage.js); refresh happens automatically on 401. Never move auth tokens back to `localStorage`.

### Service Layer

All API and real-time logic lives in [src/services/](src/services/):

- **[api.js](src/services/api.js)** — Axios instance with auth interceptor (attaches Bearer token, handles 401 refresh).
- **[LiveMessageService.js](src/services/LiveMessageService.js)** — SignalR `MessageHub` for real-time chat. Key client-invokable methods: `SendMessage`, `UpdateMessage`, `DeleteMessage`, `JoinChannel`, `LeaveChannel`.
- **[PresenceService.js](src/services/PresenceService.js)** — SignalR `PresenceHub` for online/voice presence. Methods: `SubscribeToClans`, `JoinVoiceChannel`, `LeaveVoiceChannel`, `GetOnlineUsers`, `GetParticipants`. Events: `UserOnline`, `UserOffline`, `UserJoinedVoice`, `UserLeftVoice`.
- **[VoiceService.js](src/services/VoiceService.js)** — Fetches a LiveKit room token; used by VoiceChannel component to connect.

### Voice Channel Flow

1. User clicks a voice channel → `MainLayout` calls `VoiceService.getToken(roomId)`
2. [VoiceChannel.jsx](src/components/voicechannel/VoiceChannel.jsx) connects to LiveKit and renders `VoiceAudioRenderer` for each participant
3. `PresenceService` receives `JoinVoiceChannel` / `LeaveVoiceChannel` calls to broadcast presence
4. Per-user volume is managed in [VoiceAudioRenderer.jsx](src/components/voicechannel/VoiceAudioRenderer.jsx) via right-click context menu

### Routing & Auth Guard

[src/App.jsx](src/App.jsx) defines routes. `/app/*` routes are wrapped by [ProtectedRoute.jsx](src/components/routes/ProtectedRoute.jsx), which redirects unauthenticated users to `/login`.

### Browser Integration

- Notifications use the Web Notifications API and require a user gesture for permission.
- Voice and screen sharing require a secure context (`https://`) outside localhost.
- Do not import Tauri APIs or packages in this branch. The dormant `src-tauri/` directory is not part of the web build.

### Permissions

Member roles (`OWNER`, `ADMIN`, `MEMBER`) are defined in [src/utils/constants.js](src/utils/constants.js). Permission checks use the `memberRole` state passed from `MainLayout` — modify [src/utils/permissions.js](src/utils/permissions.js) for role-based logic.

## Key Patterns

- **Stale closure avoidance**: SignalR event handlers in `MainLayout` use `useRef` to hold current state values before registering callbacks.
- **Image uploads**: Use [ImgBBService.js](src/services/ImgBBService.js) for user-uploaded images; returns a hosted URL stored in message/clan data.
- **Mock API**: Handlers in [src/mocks/handlers.js](src/mocks/handlers.js) mirror real endpoints — update them when adding new service calls and `VITE_MOCKING=true`.
