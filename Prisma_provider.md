generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================================
// USERS
// =============================================
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String
  phone                 String?
  license_status        String   @default("UNLICENSED") // UNLICENSED | LICENSED
  status                String   @default("ACTIVE")     // ACTIVE | SUSPENDED | READ-ONLY
  role                  String   @default("user")       // admin | user
  profile_image         String?
  fcm_token             String?

  // Additional fields from rules
  first_name            String?
  last_name             String?
  address               String?
  two_factor_enabled    Boolean  @default(false)
  locationSharingEnabled Boolean @default(false)
  emergencyLocationOptIn Boolean @default(false)
  deleted               Boolean  @default(false)
  deleted_at            DateTime?

  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt

  // Relations
  communities           CommunityMember[]
  businesses            UserBusiness[]
  posts                 Post[]
  messages              Message[]
  reports               Report[]                @relation("Reporter")
  ownedCommunities      Community[]             @relation("CommunityOwner")
  sessions              UserSession[]
  notifications         Notification[]

  @@map("users")
}

// =============================================
// COMMUNITIES
// =============================================
model Community {
  id                String   @id @default(cuid())
  name              String
  description       String?
  owner_id          String
  type              String   // TRIAL | LICENSED
  status            String   @default("ACTIVE") // ACTIVE | READ-ONLY | Alert
  trial_end_date    DateTime?
  license_id        String?
  is_public         Boolean  @default(true)

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  owner             User     @relation("CommunityOwner", fields: [owner_id], references: [id])
  members           CommunityMember[]
  posts             Post[]
  messages          Message[]
  charities         Charity[]
  reports           Report[]
  invitations       CommunityInvitation[]

  @@map("communities")
}

// =============================================
// COMMUNITY MEMBERS
// =============================================
model CommunityMember {
  community_id      String
  user_id           String
  role              String   // ADMIN | MODERATOR | MEMBER
  joined_at         DateTime @default(now())
  license_expiry    DateTime?
  status            String   @default("ACTIVE")

  // Extra fields
  isSecurityMember  Boolean  @default(false)
  locationSharingEnabled Boolean @default(true)

  community         Community @relation(fields: [community_id], references: [id], onDelete: Cascade)
  user              User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([community_id, user_id])
  @@map("community_members")
}

// =============================================
// MESSAGES (Chat)
// =============================================
model Message {
  id              String   @id @default(cuid())
  community_id    String
  user_id         String
  content         String?
  image_url       String?
  message_type    String   @default("text") // text | image | system
  reply_to_id     String?
  created_at      DateTime @default(now())

  community       Community @relation(fields: [community_id], references: [id], onDelete: Cascade)
  user            User      @relation(fields: [user_id], references: [id])
  reply_to        Message?  @relation("MessageReplies", fields: [reply_to_id], references: [id])
  replies         Message[] @relation("MessageReplies")

  @@index([community_id, created_at])
  @@map("messages")
}

// =============================================
// POSTS / LISTINGS / NOTICES
// =============================================
model Post {
  id                String   @id @default(cuid())
  community_id      String
  author_id         String
  type              String   // listing | notice | emergency
  title             String
  description       String
  category          String
  price             Float?
  isPublic          Boolean  @default(false)
  status            String   @default("active")
  created_at        DateTime @default(now())

  community         Community @relation(fields: [community_id], references: [id], onDelete: Cascade)
  author            User      @relation(fields: [author_id], references: [id])

  @@index([community_id, created_at])
  @@map("posts")
}

// =============================================
// CHARITIES & SUGGESTIONS
// =============================================
model Charity {
  id                String   @id @default(cuid())
  community_id      String
  name              String
  description       String
  category          String
  percentage        Float
  status            String   @default("Active")

  community         Community @relation(fields: [community_id], references: [id], onDelete: Cascade)

  @@map("charities")
}

// =============================================
// OTHER IMPORTANT MODELS
// =============================================
model UserBusiness {
  id            String   @id @default(cuid())
  owner_id      String
  name          String
  category      String
  description   String
  latitude      Float
  longitude     Float
  address       String
  status        String   @default("ACTIVE")

  owner         User     @relation(fields: [owner_id], references: [id])

  @@map("user_businesses")
}

model Report {
  id            String   @id @default(cuid())
  community_id  String
  reporter_id   String
  target_id     String
  target_type   String   // post | user
  reason        String
  status        String   @default("pending")
  created_at    DateTime @default(now())

  community     Community @relation(fields: [community_id], references: [id])
  reporter      User      @relation("Reporter", fields: [reporter_id], references: [id])

  @@map("reports")
}

model CommunityInvitation {
  id                  String   @id @default(cuid())
  community_id        String
  invited_user_id     String
  invited_by_admin_id String
  role                String
  status              String   @default("pending") // pending | accepted | declined
  created_at          DateTime @default(now())

  community           Community @relation(fields: [community_id], references: [id])

  @@map("community_invitations")
}

// Add more models as needed (Notification, UserSession, etc.)

model Notification {
  id          String   @id @default(cuid())
  user_id     String
  title       String
  message     String
  type        String
  read        Boolean  @default(false)
  created_at  DateTime @default(now())

  user        User     @relation(fields: [user_id], references: [id])

  @@map("notifications")
}
