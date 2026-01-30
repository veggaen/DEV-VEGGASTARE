# Social Features Implementation Plan

## 1. Profile Editing (Settings)
Move all profile editing to `/settings` with proper UX:

### Features:
- **Avatar Upload**: Drag-drop or click, instant preview, crop option
- **Banner Upload**: Drag-drop or click, instant preview
- **Bio/Description**: Rich text or plain text (max 500 chars)
- **Save/Cancel buttons** with unsaved changes warning

### Implementation:
- Add new "Profile" section in settings sidebar
- Use EdgeStore for image uploads (already configured)
- Preview images locally before upload
- Single save button to update all profile fields

---

## 2. Friends & Followers System

### Database Schema:
```prisma
model Follow {
  id          String   @id @default(cuid())
  followerId  String   // User who is following
  followingId String   // User being followed
  createdAt   DateTime @default(now())
  
  follower    User     @relation("UserFollowers", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("UserFollowing", fields: [followingId], references: [id], onDelete: Cascade)
  
  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
}

model FriendRequest {
  id         String              @id @default(cuid())
  senderId   String
  receiverId String
  status     FriendRequestStatus @default(PENDING)
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
  
  sender     User                @relation("SentFriendRequests", fields: [senderId], references: [id], onDelete: Cascade)
  receiver   User                @relation("ReceivedFriendRequests", fields: [receiverId], references: [id], onDelete: Cascade)
  
  @@unique([senderId, receiverId])
  @@index([receiverId, status])
}

model Friendship {
  id        String   @id @default(cuid())
  userAId   String   // Always the smaller ID (for uniqueness)
  userBId   String   // Always the larger ID
  createdAt DateTime @default(now())
  
  userA     User     @relation("FriendshipsA", fields: [userAId], references: [id], onDelete: Cascade)
  userB     User     @relation("FriendshipsB", fields: [userBId], references: [id], onDelete: Cascade)
  
  @@unique([userAId, userBId])
  @@index([userAId])
  @@index([userBId])
}

enum FriendRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

### Features:
- **Follow**: One-way relationship (like Twitter)
- **Friend Request**: Two-way mutual relationship (like Facebook)
- Users can follow anyone publicly
- Friend requests require acceptance
- Friends automatically follow each other

### API Endpoints:
- `POST /api/users/[userId]/follow` - Follow/unfollow a user
- `POST /api/users/[userId]/friend-request` - Send friend request
- `GET /api/friend-requests` - List pending requests
- `PATCH /api/friend-requests/[id]` - Accept/decline request
- `GET /api/users/[userId]/friends` - List user's friends
- `GET /api/users/[userId]/followers` - List followers
- `GET /api/users/[userId]/following` - List following

---

## 3. User Search at Pulse/Feed

### Features:
- Search bar at top of Pulse page
- Search by name or username
- See user profiles, their public posts
- Follow/add friend buttons on search results
- "People you may know" suggestions based on:
  - Mutual friends
  - Same companies
  - Similar interests (tags they engage with)

### Implementation:
- Add search input to Pulse page header
- New `/api/users/search` endpoint (already exists, enhance it)
- Add "Discover People" section to Pulse sidebar

---

## 4. Friend Suggestions in New Conversation

### Features:
- When creating new DM/group, show suggestions before typing
- Priority order:
  1. **Recent chats**: Users you've messaged recently
  2. **Friends**: Mutual friend connections
  3. **Following**: People you follow
  4. **Colleagues**: Same company employees

### Implementation:
- New `/api/users/suggestions` endpoint
- Query based on:
  - Recent conversation participants
  - Friendship table
  - Follow table
  - Employee relationships

---

## 5. Company Customer Chat (Live Support)

### Database Schema:
```prisma
model CompanyChat {
  id            String           @id @default(cuid())
  companyId     String
  visitorId     String?          // Nullable for anonymous visitors
  visitorName   String?          // For anonymous: "Guest-1234"
  visitorEmail  String?          // Optional email for follow-up
  status        CompanyChatStatus @default(ACTIVE)
  assignedToId  String?          // Employee handling the chat
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  closedAt      DateTime?
  
  company       Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  visitor       User?            @relation("VisitorChats", fields: [visitorId], references: [id])
  assignedTo    Employee?        @relation(fields: [assignedToId], references: [id])
  messages      CompanyChatMessage[]
  
  @@index([companyId, status])
  @@index([assignedToId])
}

model CompanyChatMessage {
  id          String      @id @default(cuid())
  chatId      String
  content     String
  senderId    String?     // Null for visitor messages
  senderType  SenderType  // VISITOR, EMPLOYEE, SYSTEM
  senderName  String      // Display name
  createdAt   DateTime    @default(now())
  
  chat        CompanyChat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  sender      User?       @relation(fields: [senderId], references: [id])
  
  @@index([chatId, createdAt])
}

enum CompanyChatStatus {
  ACTIVE
  WAITING     // Waiting for employee response
  RESOLVED
  CLOSED
}

enum SenderType {
  VISITOR
  EMPLOYEE
  SYSTEM
}
```

### Employee Permission:
Add to Employee permissions JSON:
```json
{
  "canHandleCustomerChat": true,
  "canViewAllChats": false  // Only owner/admin can see all
}
```

### Features:
- **Chat Widget**: Floating button on company public profile
- **Real-time**: WebSocket or Pusher for instant messaging
- **Employee Dashboard**: See incoming chats, claim/assign chats
- **Notifications**: Notify available employees of new chats
- **Canned Responses**: Common replies for efficiency
- **Chat History**: Visitors can see their chat history if logged in

### UI Components:
1. `CompanyChatWidget` - Floating chat bubble for visitors
2. `CompanyChatPanel` - Full chat interface when opened
3. `EmployeeChatDashboard` - For employees to manage chats
4. `ChatNotification` - Real-time notification for new chats

---

## 6. Employee Group Messaging / Broadcasts

### Features:
- **Owner Broadcasts**: Send message to all employees
- **Department Groups**: Chat groups by role/department
- **Announcement Channel**: Read-only for important updates
- **Employee Directory**: Quick access to message colleagues

### Implementation:
Extend existing Conversation system:
- Add `companyId` to conversations (already exists)
- Add conversation type: `COMPANY_BROADCAST`, `COMPANY_GROUP`
- Special permissions for company conversations

### New Conversation Types:
```prisma
enum ConversationType {
  PRIVATE_DM
  GROUP
  PUBLIC_POST
  COMPANY_ANNOUNCEMENT  // Owner only can post
  COMPANY_GROUP         // Employee group chat
  COMPANY_SUPPORT       // Customer support thread
}
```

---

## Implementation Priority

### Phase 1: Profile & Basic Social (This session)
1. ✅ Profile editing in settings (banner, avatar, bio)
2. Follow/followers system (simpler than friends)
3. User search enhancement at Pulse

### Phase 2: Friends System
1. Friend requests
2. Friendship model
3. Friend suggestions in conversations

### Phase 3: Company Chat
1. CompanyChat schema
2. Chat widget on company profiles
3. Employee chat dashboard

### Phase 4: Employee Communication
1. Company announcements
2. Employee group chats
3. Internal messaging enhancements

---

## File Structure

```
frontend/
├── app/
│   ├── (protected)/
│   │   ├── settings/
│   │   │   └── page.tsx          # Add Profile section
│   │   └── conversations/
│   │       └── new/
│   │           └── page.tsx      # Add friend suggestions
│   ├── api/
│   │   ├── users/
│   │   │   ├── [userId]/
│   │   │   │   ├── follow/route.ts
│   │   │   │   ├── friends/route.ts
│   │   │   │   └── followers/route.ts
│   │   │   └── suggestions/route.ts
│   │   ├── friend-requests/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── company-chat/
│   │       ├── route.ts
│   │       └── [chatId]/
│   │           └── messages/route.ts
│   └── companies/
│       └── [id]/
│           └── _components/
│               └── ChatWidget.tsx
├── components/
│   └── chat/
│       ├── CompanyChatWidget.tsx
│       ├── CompanyChatPanel.tsx
│       └── EmployeeChatDashboard.tsx
└── prisma/
    └── schema.prisma             # Add new models
```
