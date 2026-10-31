# Chat App Backend (simple version)

Node + Express + MongoDB + Socket.io + Cloudinary

## Chalane ke steps
1. `npm install`
2. `.env.example` ko copy karke `.env` banao aur values bharo
3. `npm run dev`

Frontend me socket: `io(API_URL, { withCredentials: true })` (userId bhejne ki zarurat nahi, server cookie se pehchanta hai).

## API

**Auth** `/api/auth`
- POST `/signup`, POST `/login`, GET `/logout`
- POST `/forgot-password` `{ email }` -> OTP mail aata hai
- POST `/reset-password` `{ email, otp, newPassword }`
- PUT `/change-password` `{ currentPassword, newPassword }` (login chahiye)

**User** `/api/user`
- GET `/current`, PUT `/profile`, GET `/others`, GET `/search?query=`
- GET `/blocked`, POST `/block/:userId`, DELETE `/block/:userId`

**Chat** `/api/chat`
- GET `/` : chat list (lastMessage + unreadCount)
- POST `/direct/:userId` : 1-1 chat kholo
- POST `/group` `{ name, members: [ids] }`
- POST `/group/:id/members` `{ userId }` (admin)
- DELETE `/group/:id/members/:userId` (admin)
- POST `/group/:id/leave`

**Message** `/api/message`
- POST `/send/:conversationId` (`text` aur/ya `image`)
- GET `/:conversationId?before=<messageId>&limit=30` -> `{ messages, hasMore }`
- PUT `/read/:conversationId`

## Socket events
Server se: `newMessage`, `messagesRead`, `newChat`, `chatUpdated`, `removedFromChat`, `onlineUsers`, `lastSeen`, `typing`, `stopTyping`

Client se: `typing` / `stopTyping` `{ conversationId, to: [userIds] }`

Call: `call:invite`, `call:accept`, `call:reject`, `call:end`, `call:offer`, `call:answer`, `call:ice`
(frontend ke liye `frontend-snippets/useCall.js` aur `CallUI.jsx` dekho)

## Seen / unread kaise kaam karta hai
- Har message me `readBy` array hai. Chat kholte hi `PUT /read/:conversationId` call karo.
- 1-1 chat: `readBy` me samne wale ki id hai to blue tick.
- Group: `readBy.length === participants.length` ho to sabne dekh liya.

## Block
- Block karne par dono taraf se message, nayi chat aur call band ho jaati hai.
- Frontend `GET /api/user/blocked` se list leke chat me input disable kar sakta hai.

## Limits (jaanbujhkar simple rakha hai)
- Call me missed-call history nahi hai, aur sirf 1-1 call hai.
- Mobile data pe call ke liye TURN server chahiye (`useCall(socket, iceServers)` me do).
- Offline user ko call nahi lagti ("User offline hai" error).
- "Delivered" tick nahi hai, sirf "read".
- Rate limiting nahi hai (production me `express-rate-limit` lagana).
