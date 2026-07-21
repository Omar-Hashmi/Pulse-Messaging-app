# Real-Time Team Chat

MERN + Socket.IO + Redis + JWT real-time messaging app.

## Stack
- MongoDB (Mongoose) — persistence for users, conversations, messages, notifications
- Express — REST API (auth, history, uploads)
- React (Vite) — frontend
- Socket.IO — live messaging, typing indicators, presence, read receipts
- Redis — Socket.IO adapter (multi-instance scaling) + online-user tracking
- JWT — authentication (REST via Bearer token, sockets via handshake auth)

## Project Structure

```
realtime-chat/
├── backend/
│   ├── src/
│   │   ├── config/        # db.js, redis.js
│   │   ├── controllers/   # auth, user, conversation, message, upload
│   │   ├── middleware/    # authMiddleware, errorMiddleware, uploadMiddleware
│   │   ├── models/        # User, Conversation, Message, Notification
│   │   ├── routes/        # REST endpoints
│   │   ├── sockets/       # socketAuth, presence/typing/chat handlers, index.js
│   │   ├── utils/         # generateToken, redisKeys
│   │   ├── app.js         # express app + middleware wiring
│   │   └── server.js      # http server + socket.io bootstrap
│   ├── uploads/           # local file storage (swap for S3/Cloudinary in prod)
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/axios.js
│   │   ├── components/    # Sidebar, UserList, ChatWindow, MessageList,
│   │   │                  # MessageInput, TypingIndicator, NotificationBell, FileUpload
│   │   ├── context/       # AuthContext, SocketContext
│   │   ├── hooks/         # useAuth, useSocket
│   │   ├── pages/         # Login, Register, Chat
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml     # spins up Mongo + Redis locally
└── README.md
```

## Setup

1. **Infra** (Mongo + Redis) — from the project root:
   ```bash
   docker compose up -d
   ```

2. **Backend**:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run dev
   ```

3. **Frontend**:
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

4. Open two browser windows (or one normal + one incognito), register two users, and start chatting.

## How the real-time pieces fit together

- **Live messaging**: client emits `message:send` over the socket → server persists to MongoDB → server emits `message:new` to everyone in that conversation's Socket.IO room.
- **Typing indicator**: `typing:start` / `typing:stop` events, throttled client-side with a debounce timeout.
- **Online users**: on connect/disconnect, the server updates a Redis `SET` of online user IDs (`online_users`) and a Redis `HASH` counting sockets per user (`user_sockets`) so multi-tab/device users don't flicker offline. Broadcast via `presence:online-users`.
- **Read receipts**: `message:read` marks messages read in MongoDB and rebroadcasts to the room so senders see the "Read" state update live.
- **File uploads**: REST endpoint (`POST /api/upload`, multer) uploads the file, returns a URL, which is then sent as a message attachment over the socket.
- **Notifications**: when a message is sent, the server creates a `Notification` doc for other participants and pushes it live via each user's personal room (`socket.join(userId)`).
- **Redis adapter**: `@socket.io/redis-adapter` lets Socket.IO events fan out correctly once you run more than one backend instance (e.g. behind a load balancer) — required for horizontal scaling.

## Recent updates

- **Profile management**: change display name, change password, and delete account now work end-to-end (`PATCH /api/users`, `PATCH /api/users/password`, `DELETE /api/users`).
- **Blocking**: block a user from the chat window header, the sidebar conversation menu, or the friends list in the profile/sidebar. Blocked users can no longer message you (enforced both directions on `message:send`), and unblocking is available from the Profile page.
- **Notifications**: a real notifications API (`/api/notifications`) backs the bell icon — mark one/all as read, delete one, or clear read notifications. Friend requests and friend-request acceptances now generate notifications too, and each notification says who did what (e.g. "Alex sent you a message"). Clicking a notification jumps to the right conversation, or to the friend-requests panel for friend request notifications.
- **Read receipts**: a message you sent now only shows "Read" once the *other* participant has actually seen it — not just because you've seen your own message.
- **Reactions**: hover/tap the 🙂 icon on any message to react with an emoji; reactions are grouped and shown under the message, synced live to everyone in the conversation.
- **Sidebar conversation menu**: the "⋮" menu now opens beside the button (not clipped under the scrollable list) via a floating portal, and includes a "Block user" action.
- **File uploads**: selecting a file no longer sends it immediately — it shows a preview with an optional caption field, and only uploads/sends when you hit Send.
- **Responsive layout**: the whole app (nav, sidebar, chat window, profile) adapts down to mobile widths, with a collapsible nav drawer and a full-screen chat view with a back button on small screens.
- **Dark mode**: toggle light/dark from the navbar (🌙/☀️); the choice is remembered.

