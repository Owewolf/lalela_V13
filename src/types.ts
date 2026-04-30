import React from 'react';

export type UserRole = 'Member' | 'Moderator' | 'Admin' | 'Liaison';

export interface CommunityNotice {
  id: string;
  community_id?: string;
  type: 'listing' | 'notice';
  category: string;
  title: string;
  description: string;
  authorName: string;
  author_id?: string;
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
  community_price?: number;
  status?: 'Active' | 'Pinned' | 'deleted' | 'Archived' | 'PendingPublic' | 'Rejected' | 'ChangesRequested';
  deleted_at?: string;
  expires_at?: string;
  expired_at?: string;
  rejection_reason?: string;
  changes_requested_note?: string;
  public_price?: number;
  charity_amount?: number;
  urgency?: 'low' | 'normal' | 'high' | 'emergency';
  urgency_level?: 'emergency' | 'warning' | 'info' | 'general';
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
  posts_image?: string;
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
  location_name: string;
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
  senderId: string;
  text: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  isListingIntro?: boolean;
  attachment_url?: string;
  file_name?: string;
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
  unreadCount: Record<string, number>;
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
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  mobile_number?: string;
  address?: string;
  profile_image?: string;
  agreed_to_terms?: boolean;
  marketing_consent?: boolean;
  license_status: 'UNLICENSED' | 'LICENSED';
  status: 'ACTIVE' | 'READ-ONLY';
  two_factor_enabled?: boolean;
  two_factor_method?: 'SMS' | 'App';
  login_alerts_enabled?: boolean;
  last_password_changed?: any;
  security_score?: 'Low' | 'Medium' | 'High';
  access_type?: 'Trial' | '1-Year Member' | 'Lifetime Access';
  expiry_date?: any;
  created_at?: any;
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
  last_community_id?: string;
  // Onboarding state flags
  profile_completed?: boolean;
  onboarding_completed?: boolean;
  community_created?: boolean;
  member_expiry_date?: any;
  license_type?: 'SELF' | 'COMMUNITY_GRANTED';
  fcm_token?: string;
}

export interface UserSession {
  id: string;
  device: string;
  ip: string;
  location: string;
  last_active: string;
  is_current: boolean;
}

export interface TwoFASetupResponse {
  secret: string;
  qr_code: string;
}

export interface LicensingInfo {
  status: 'UNLICENSED' | 'LICENSED';
  type: string;
  expiry_date: string;
  auto_renew: boolean;
  payment_method: string;
}

export interface Community {
  id: string;
  name: string;
  owner_id: string;
  type: 'TRIAL' | 'LICENSED';
  createdAt?: any;
  license_id?: string;
  trial_end_date: any;
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
  enabledCategories?: string[]; // IDs of enabled categories
  onboarding_steps_completed?: string[]; // Admin setup steps: coverage, categories, businesses, invitations, notifications
  guided_setup_required?: boolean;
}

export interface UserBusiness {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  image?: string;
  owner_id: string;
  communityIds: string[]; // Communities where this business is active
  latitude: number;
  longitude: number;
  address: string;
  contactPhone?: string;
  contactEmail?: string;
  charityId?: string; // Linked charity
  charityPercentage?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export type CharityCategory = 'Community Support' | 'Education' | 'Health' | 'Animal Welfare' | 'Disaster Relief';
export type CharityUrgency = 'Normal' | 'High' | 'Critical';
export type CharityStatus = 'Active' | 'Pending' | 'Flagged' | 'Archived';

export interface Charity {
  id: string;
  community_id: string;
  name: string;
  description: string;
  category: CharityCategory;
  percentage: number; // Percentage added to the the listing price when listed as public
  latitude: number;
  longitude: number;
  location_name: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  tags: string[]; // "Urgent", "Ongoing", "Verified"
  isVerified: boolean;
  isFeatured: boolean;
  urgency: CharityUrgency;
  status: CharityStatus;
  linkedBusinessIds?: string[]; // IDs of businesses that support this charity
  totalRaised?: number; // Total funds raised for this charity
  fundraisingGoal?: number;
  campaignCompleted?: boolean;
  createdAt: any;
  isApprovedSuggestion?: boolean;
  suggestedBy?: string;
}

export interface CharitySuggestion {
  id: string;
  community_id: string;
  suggested_by_id: string;
  suggested_by_name: string;
  name: string;
  description: string;
  suggested_donation_amount?: number; // Suggested community donation percentage (1-100). Optional for legacy records.
  reason: string;
  website?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_feedback?: string;
  created_at: any;
  processed_at?: any;
  processed_by_id?: string;
}

export interface ModerationLog {
  id: string;
  community_id: string;
  moderator_id: string;
  action: 'approve' | 'reject' | 'delete' | 'warn' | 'ban' | 'create' | 'promote' | 'demote' | 'remove' | 'deactivate';
  target_id: string;
  target_type: 'post' | 'user' | 'report' | 'suggestion' | 'business';
  reason?: string;
  timestamp: any;
}

export interface CommunityMember {
  user_id: string;
  community_id: string;
  role: UserRole;
  joined_at: any;
  license_expiry: any;
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
  community_id: string;
  community_name: string;
  invited_user_id: string;
  invited_by_admin_id: string;
  role: 'MEMBER' | 'MODERATOR';
  status: 'pending' | 'accepted' | 'declined';
  created_at: any;
}

export interface CommunityInviteLink {
  id: string;
  community_id: string;
  community_name: string;
  created_by: string;
  created_at: any;
  expires_at: any;
  uses: number;
  active: boolean;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'invitation' | 'system' | 'alert';
  link?: string;
  read: boolean;
  created_at: any;
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
  addNotification: (userId: string, notification: Omit<AppNotification, 'id' | 'user_id' | 'read' | 'created_at'>) => Promise<void>;
  searchUsers: (query: string) => Promise<UserProfile[]>;
  communityBusinesses: UserBusiness[];
  toggleEmergencyMode: (communityId: string, alertId?: string) => Promise<void>;
  toggleCommunityResponder: (communityId: string, isResponder: boolean) => Promise<void>;
  updateLiveLocation: (latitude: number, longitude: number) => Promise<void>;
  securityResponders: {
    user_id: string;
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
  addCharitySuggestion: (suggestion: Omit<CharitySuggestion, 'id' | 'status' | 'created_at'> & { suggested_donation_amount: number }) => Promise<void>;
  approveCharitySuggestion: (suggestionId: string, feedback: string, charityData: Omit<Charity, 'id' | 'createdAt'>) => Promise<void>;
  rejectCharitySuggestion: (suggestionId: string, feedback: string) => Promise<void>;
  syncAllUsersToSearch: () => Promise<void>;
  // Invitation & Notification Integration
  userInvitations: CommunityInvitation[];
  communityInvitations: CommunityInvitation[];
  notifications: AppNotification[];
  inviteMember: (userId: string, role: 'Member' | 'Moderator') => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<void>;
  // Invite Link
  activeCommunityLink: CommunityInviteLink | null;
  generateInviteLink: () => Promise<string>;
  joinViaInviteLink: (linkCode: string) => Promise<string>;
}

// --- Public API Types (for unauthenticated landing page map) ---

export interface PublicCommunity {
  id: string;
  name: string;
  coverageArea: CoverageArea;
}
