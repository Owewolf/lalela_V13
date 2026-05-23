import React from 'react';

export type UserRole = 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'LIAISON';

export interface CommunityNotice {
  id: string;
  communityId?: string;
  type: 'listing' | 'notice';
  category: string;
  title: string;
  description: string;
  authorName: string;
  authorId?: string;
  authorRole: string;
  authorImage: string;
  timestamp: string;
  isLarge?: boolean;
  isCommunityPick?: boolean;
  // Charity integration
  charityId?: string;
  charityPercentage?: number;
  isPublic?: boolean;
  price?: number;
  communityPrice?: number;
  status?: 'Active' | 'Pinned' | 'deleted' | 'Archived' | 'PendingPublic' | 'Rejected' | 'ChangesRequested';
  deletedAt?: string;
  expiresAt?: string;
  expiredAt?: string;
  rejectionReason?: string;
  changesRequestedNote?: string;
  publicPrice?: number;
  charityAmount?: number;
  urgency?: 'low' | 'normal' | 'high' | 'emergency';
  urgencyLevel?: 'emergency' | 'warning' | 'info' | 'general';
  priority?: 'normal' | 'emergency';
  postSubtype?: 'emergency' | 'warning' | 'normal' | 'information' | 'listing';
  latitude?: number;
  longitude?: number;
  locationName?: string;
  source?: 'profile_default' | 'user_selected' | 'current_location';
  locationSharingEnabled?: boolean;
  isSecurityMember?: boolean;
  liveLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  postsImage?: string;
}

export interface EmergencyAlert {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface CoverageArea {
  latitude: number;
  longitude: number;
  radius: number; // in km
  locationName: string;
}

export interface Business {
  id: string;
  name: string;
  distance?: string;
  category: string;
  subcategory?: string;
  status: 'Open' | 'Closed';
  image?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  label?: string;
  labelType?: 'top-rated' | 'new';
  neighbors?: number;
  closingTime?: string;
  hasCall?: boolean;
  latitude?: number;
  longitude?: number;
  isVerified?: boolean;
  isFeatured?: boolean;
  isExternal?: boolean; // From Google Places
  rating?: number;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
}

export interface Message {
  id: string;
  userId: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  isListingIntro?: boolean;
  attachmentUrl?: string;
  fileName?: string;
  createdAt: string;
  readBy: string[];
  status: 'sent' | 'delivered' | 'read';
  // UI helper fields
  senderName?: string;
  senderImage?: string;
  senderRole?: UserRole;
}

export interface Conversation {
  id: string;
  participants: string[];
  type: 'direct' | 'listing' | 'notice' | 'community' | 'emergency';
  communityId?: string;
  listingId?: string;
  noticeId?: string;
  emergencyId?: string;
  lastMessage: string;
  lastMessageAt: string;
  priority: 'normal' | 'high';
  /** Unread message count for the current viewer (server-derived from ConversationParticipant.unreadCount). */
  unreadCount: number;
  metadata?: {
    type?: 'listing' | 'notice' | 'emergency';
    title?: string;
    image?: string;
    price?: string;
    author?: string;
    authorImage?: string;
    location?: string;
    description?: string;
    urgency?: string;
    urgencyLevel?: string;
    [key: string]: any;
  };
  // UI helper fields
  otherParticipant?: UserProfile;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: UserRole;
  senderImage: string;
  text: string;
  timestamp: string;
  isUnread?: boolean;
  badge?: {
    text: string;
    type: 'listing' | 'post' | 'system';
  };
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'individual' | 'group';
  members: {
    name: string;
    role: UserRole;
    image: string;
  }[];
  lastMessage: ChatMessage;
  unreadCount?: number;
  linkedItem?: {
    type: 'listing' | 'notice';
    title: string;
    description?: string;
    price?: string;
    image?: string;
    author: string;
    authorRole: string;
    timestamp: string;
    priority?: 'High' | 'Medium' | 'Low' | 'Emergency';
  };
}

export interface UserProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string | null;
  phone?: string;
  phoneVerified?: boolean;
  mobileNumber?: string;
  address?: string;
  profileImage?: string;
  agreedToTerms?: boolean;
  marketingConsent?: boolean;
  licenseStatus: 'UNLICENSED' | 'LICENSED' | 'TRIAL' | 'EXPIRED' | 'ACTIVE';
  status: 'ACTIVE' | 'READ-ONLY';
  twoFactorEnabled?: boolean;
  twoFactorMethod?: 'SMS' | 'App';
  loginAlertsEnabled?: boolean;
  lastPasswordChanged?: any;
  securityScore?: 'Low' | 'Medium' | 'High';
  accessType?: 'Trial' | '1-Year Member' | 'Lifetime Access';
  expiryDate?: any;
  createdAt?: any;
  locationSharingEnabled?: boolean;
  isSecurityMember?: boolean;
  emergencyLocationOptIn?: boolean;
  liveLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  defaultLocation?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  lastCommunityId?: string;
  // Onboarding state flags
  profileCompleted?: boolean;
  onboardingCompleted?: boolean;
  communityCreated?: boolean;
  memberExpiryDate?: any;
  licenseType?: 'SELF' | 'COMMUNITY_GRANTED';
  fcmToken?: string;
  notificationPreferences?: any;
  // Trial & subscription dates
  trialExpiresAt?: string;
  subscriptionRenewalDate?: string;
  subscriptionActive?: boolean;
}

export interface UserSession {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface TwoFASetupResponse {
  secret: string;
  qrCode: string;
}

export interface LicensingInfo {
  status: 'UNLICENSED' | 'LICENSED';
  type: string;
  expiryDate: string;
  autoRenew: boolean;
  paymentMethod: string;
}

export interface Community {
  id: string;
  name: string;
  ownerId: string;
  type: 'TRIAL' | 'LICENSED' | 'ACTIVE';
  createdAt?: any;
  licenseId?: string;
  trialEndDate: any;
  trialExpiresAt?: string;
  status: 'ACTIVE' | 'READ-ONLY' | 'Live' | 'Maintenance' | 'Alert';
  isEmergencyMode?: boolean;
  activeEmergencyId?: string;
  userRole?: UserRole;
  isSecurityMember?: boolean;
  notices?: CommunityNotice[];
  alerts?: EmergencyAlert[];
  businesses?: Business[];
  chats?: ChatRoom[];
  coverageArea?: CoverageArea;
  enabledCategories?: string[];
  onboardingStepsCompleted?: string[];
  guidedSetupRequired?: boolean;
  activatedAt?: string;
  isPaid?: boolean;
}

export interface UserBusiness {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  image?: string;
  ownerId: string;
  communityIds: string[];
  latitude: number;
  longitude: number;
  address: string;
  contactPhone?: string;
  contactEmail?: string;
  charityId?: string;
  charityPercentage?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  source?: 'MEMBER' | 'IMPORT';
  isMarketplaceOnly?: boolean;
}

export type CharityCategory = 'Community Support' | 'Education' | 'Health' | 'Animal Welfare' | 'Disaster Relief';
export type CharityUrgency = 'Normal' | 'High' | 'Critical';
export type CharityStatus = 'Active' | 'Pending' | 'Flagged' | 'Archived';

export interface Charity {
  id: string;
  communityId: string;
  name: string;
  description: string;
  category: CharityCategory;
  percentage: number;
  latitude: number;
  longitude: number;
  locationName: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  tags: string[];
  isVerified: boolean;
  isFeatured: boolean;
  urgency: CharityUrgency;
  status: CharityStatus;
  linkedBusinessIds?: string[];
  raisedAmount?: number;
  fundraisingGoal?: number;
  campaignCompleted?: boolean;
  createdAt: any;
  isApprovedSuggestion?: boolean;
  suggestedById?: string;
}

export interface CharitySuggestion {
  id: string;
  communityId: string;
  suggestedById: string;
  suggestedByName: string;
  name: string;
  description: string;
  suggestedDonationAmount?: number;
  reason: string;
  website?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminFeedback?: string;
  createdAt: any;
  processedAt?: any;
  processedById?: string;
}

export interface ModerationLog {
  id: string;
  communityId: string;
  moderatorId: string;
  action: 'approve' | 'reject' | 'delete' | 'warn' | 'ban' | 'create' | 'promote' | 'demote' | 'remove' | 'deactivate';
  targetId: string;
  targetType: 'post' | 'user' | 'report' | 'suggestion' | 'business';
  reason?: string;
  timestamp: any;
}

export interface CommunityMember {
  userId: string;
  communityId: string;
  role: UserRole;
  joinedAt: any;
  licenseExpiry: any;
  status: 'ACTIVE' | 'READ-ONLY' | 'UNLICENSED';
  name?: string;
  image?: string;
  email?: string;
  isSecurityMember?: boolean;
  locationSharingEnabled?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface CommunityInvitation {
  id: string;
  communityId: string;
  communityName: string;
  invitedUserId: string;
  invitedByAdminId: string;
  role: 'MEMBER' | 'MODERATOR';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
}

export interface CommunityInviteLink {
  id: string;
  communityId: string;
  communityName: string;
  createdBy: string;
  code: string;
  role: string;
  uses: number;
  maxUses?: number | null;
  active: boolean;
  expiresAt: any;
  createdAt: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'invitation' | 'system' | 'alert' | 'trial_expiry' | 'payment_reminder';
  link?: string;
  read: boolean;
  createdAt: any;
  metadata?: any;
}

export interface CommunityNotificationOverride {
  generalNotices?: boolean;
  listingUpdates?: boolean;
  communityActivity?: boolean;
  businessActivity?: boolean;
}

export interface NotificationPreferences {
  globalEnabled: boolean;
  generalNotices: boolean;
  listingUpdates: boolean;
  communityActivity: boolean;
  businessActivity: boolean;
  priorityCommunityIds: string[];
  communityOverrides?: Record<string, CommunityNotificationOverride>;
}

export interface ChatUnreadTotals {
  direct: number;
  listing: number;
  notice: number;
  marketplace: number;
  community: number;
  emergency: number;
  totalMessages: number;
  unreadFilterTotal: number;
}

export interface CommunityContextType {
  currentCommunity: Community;
  communities: Community[];
  setCurrentCommunity: (id: string) => void;
  createCommunity: (name: string) => Promise<string>;
  licenseCommunity: (communityId: string) => Promise<void>;
  updateCommunityCoverage: (communityId: string, coverage: CoverageArea) => Promise<void>;
  updateCommunityCategories: (communityId: string, categories: string[]) => Promise<void>;
  addCommunityBusiness: (communityId: string, business: Business) => Promise<void>;
  updateCommunityBusiness: (communityId: string, business: Business) => Promise<void>;
  removeCommunityBusiness: (communityId: string, businessId: string) => Promise<void>;
  bulkAddCommunityBusinesses: (communityId: string, businesses: Business[]) => Promise<void>;
  userBusinesses: UserBusiness[];
  addUserBusiness: (business: Omit<UserBusiness, 'id'>) => Promise<void>;
  updateUserBusiness: (business: UserBusiness) => Promise<void>;
  removeUserBusiness: (id: string) => Promise<void>;
  charities: Charity[];
  addCharity: (charity: Omit<Charity, 'id' | 'createdAt'>) => Promise<void>;
  updateCharity: (charity: Charity) => Promise<void>;
  removeCharity: (id: string) => Promise<void>;
  deleteCharity: (id: string) => Promise<void>;
  posts: CommunityNotice[];
  addPost: (post: Omit<CommunityNotice, 'id' | 'timestamp'>) => Promise<string | null>;
  removePost: (id: string) => Promise<void>;
  updatePost: (post: CommunityNotice) => Promise<void>;
  members: CommunityMember[];
  addMember: (userId: string, role: UserRole, email?: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  deleteMember: (userId: string) => Promise<void>;
  updateMemberRole: (userId: string, role: UserRole) => Promise<void>;
  addNotification: (userId: string, notification: Omit<AppNotification, 'id' | 'userId' | 'read' | 'createdAt'>) => Promise<void>;
  searchUsers: (query: string) => Promise<UserProfile[]>;
  communityBusinesses: UserBusiness[];
  toggleEmergencyMode: (communityId: string, alertId?: string) => Promise<void>;
  toggleCommunityResponder: (communityId: string, isResponder: boolean) => Promise<void>;
  updateLiveLocation: (latitude: number, longitude: number) => Promise<void>;
  securityResponders: {
    userId: string;
    name: string;
    image: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  }[];
  // Chat Integration
  conversations: Conversation[];
  chatUnreadTotals: ChatUnreadTotals;
  activeConversation: Conversation | null;
  messages: Message[];
  setActiveConversation: (conversationId: string | null) => void;
  sendMessage: (text: string, type?: 'text' | 'image' | 'file' | 'system', attachmentUrl?: string, fileName?: string) => Promise<void>;
  startConversation: (params: {
    participants: string[];
    type: 'direct' | 'listing' | 'notice' | 'community' | 'emergency';
    communityId?: string;
    listingId?: string;
    noticeId?: string;
    emergencyId?: string;
    metadata?: any;
  }) => Promise<string>;
  markAsRead: (conversationId: string) => Promise<void>;
  isTyping: boolean;
  setTypingStatus: (conversationId: string, isTyping: boolean) => Promise<void>;
  deleteUserBusiness: (id: string) => Promise<void>;
  deleteReport: (communityId: string, reportId: string) => Promise<void>;
  charitySuggestions: CharitySuggestion[];
  addCharitySuggestion: (suggestion: Omit<CharitySuggestion, 'id' | 'status' | 'createdAt'> & { suggestedDonationAmount: number }) => Promise<void>;
  approveCharitySuggestion: (suggestionId: string, feedback: string, charityData: Omit<Charity, 'id' | 'createdAt'>) => Promise<void>;
  rejectCharitySuggestion: (suggestionId: string, feedback: string) => Promise<void>;
  syncAllUsersToSearch: () => Promise<void>;
  // Invitation & Notification Integration
  userInvitations: CommunityInvitation[];
  communityInvitations: CommunityInvitation[];
  notifications: AppNotification[];
  inviteMember: (userId: string, role: 'MEMBER' | 'MODERATOR') => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<void>;
  // Invite Link
  activeCommunityLink: CommunityInviteLink | null;
  generateInviteLink: () => Promise<string>;
  joinViaInviteLink: (linkCode: string) => Promise<string>;
  refreshCommunities: () => Promise<void>;
}

// --- Public API Types (for unauthenticated landing page map) ---

export interface PublicCommunity {
  id: string;
  name: string;
  coverageArea: CoverageArea;
}
