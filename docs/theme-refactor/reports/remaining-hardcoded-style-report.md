# Remaining Hardcoded Style Report

Date: 2026-05-26
Mode: Strict final migration validation

## Objective
Identify remaining non-color hardcoded style debt relevant to strict global-theme sign-off requirements.

## Scope
- `app/**/*.{ts,tsx}`
- `src/**/*.{ts,tsx}`
- Color literals excluded here (already covered by theme guard and color inventory artifacts).

## Finding Totals
- Typography literals: 0
- Spacing literals: 0
- Radius literals: 0
- Shadow/gradient/elevation related literals: 0
- Interaction-state references found: 242

Evidence files:
- `docs/theme-refactor/reports/noncolor-typography-literals.raw.txt`
- `docs/theme-refactor/reports/noncolor-spacing-literals.raw.txt`
- `docs/theme-refactor/reports/noncolor-radius-literals.raw.txt`
- `docs/theme-refactor/reports/noncolor-shadow-gradient-literals.raw.txt`
- `docs/theme-refactor/reports/interaction-state-coverage.raw.txt`

## Highest-Density Files (Priority)
### Typography
- None (0 remaining)

### Spacing
- None (0 remaining)

### Radius
- None (0 remaining)

### Shadow/Gradient
- None (0 remaining).

## Risk Classification
- P1: Interaction-state strict validation evidence still requires full manual matrix completion.

## Recommendation
1. Keep non-color tokenization at zero for typography/spacing/radius as a release invariant.
2. Keep shadow/gradient/elevation findings at zero as a release invariant.
3. Complete strict interaction-state manual matrix and attach evidence for final PASS readiness.

## Latest Shadow Normalization Batch Progress Note
- This remediation batch centralized shadows and refactored remaining hotspots:
	- `src/theme/shadows.ts`
	- `src/components/admin/AdminDashboard.tsx`
	- `src/components/admin/BenefitsPricingPage.tsx`
	- `src/components/admin/ModerationCenter.tsx`
	- `src/components/shared/NotificationCenter.tsx`
	- `src/components/admin/MockStripeCheckout.tsx`
	- `src/components/admin/BusinessImportTool.tsx`
	- `src/components/admin/CommunityInsightPanels.tsx`
	- `src/components/shared/MobileSidebar.tsx`
	- `src/components/shared/PostConfirmationModal.tsx`
	- `src/components/shared/LocationPickerSection.tsx`
	- `src/components/posts/PostsPage.tsx`
	- `src/components/market/BusinessCard.tsx`
	- `src/components/auth/OnboardingCreate.tsx`
	- `src/components/emergency/EmergencyMap.tsx`
- Global findings dropped from shadow=110 to shadow=0 while keeping typography/spacing/radius at 0/0/0.

## Batch Progress Note
- This remediation batch targeted the top 3 P0 files directly:
	- `src/components/admin/ModerationCenter.tsx`
	- `src/components/admin/AdminDashboard.tsx`
	- `src/components/security/SecuritySection.tsx`
- Combined findings in these three files (typography+spacing+radius) dropped from 527 to 232.

## Latest Batch Progress Note
- This remediation batch targeted the next top-density trio:
	- `src/components/shared/MobileSidebar.tsx`
	- `src/components/admin/BenefitsPricingPage.tsx`
	- `src/components/settings/ManageCommunityCharity.tsx`
- Combined findings in these three files (typography+spacing+radius) dropped from 304 to 97.

## Current Batch Progress Note
- This remediation batch targeted business ingestion and profile creation flows:
	- `src/components/admin/BusinessImportTool.tsx`
	- `src/components/settings/CreateBusinessForm.tsx`
- `BusinessImportTool` findings dropped from 69 to 17 (typography+spacing+radius).
- `CreateBusinessForm` spacing/radius findings dropped from 38 to 0; remaining findings are typography-focused.

## Newest Batch Progress Note
- This remediation batch targeted profile/settings/security hotspots:
	- `src/components/settings/SettingsPage.tsx`
	- `src/components/settings/NotificationSettingsPage.tsx`
	- `src/components/security/DangerZoneSection.tsx`
	- `src/components/settings/ManageUserBusinesses.tsx`
- Global findings dropped from typography=512, spacing=471, radius=177 to typography=498, spacing=336, radius=116.

## Latest Validation Batch Progress Note
- This remediation batch targeted notification/licensing/phone reset hotspots:
	- `src/components/shared/NotificationCenter.tsx`
	- `src/components/security/LicensingSection.tsx`
	- `app/phone-reset.tsx`
- Global findings dropped from typography=498, spacing=336, radius=116 to typography=481, spacing=238, radius=86.

## Current Validation Batch Progress Note
- This remediation batch targeted shared header and emergency incident surfaces:
	- `src/components/shared/Header.tsx`
	- `app/emergency/index.tsx`
- Global findings dropped from typography=481, spacing=238, radius=86 to typography=473, spacing=203, radius=72.

## Newest Validation Batch Progress Note
- This remediation batch targeted admin checkout styling:
	- `src/components/admin/MockStripeCheckout.tsx`
- Global findings dropped from typography=473, spacing=203, radius=72 to typography=462, spacing=189, radius=68.

## Current Security Batch Progress Note
- This remediation batch targeted a security hotspot:
	- `src/components/security/SecuritySection.tsx`
- Global findings dropped from typography=462, spacing=189, radius=68 to typography=460, spacing=179, radius=64.

## Newest Shared Navigation Batch Progress Note
- This remediation batch targeted the mobile sidebar hotspot:
	- `src/components/shared/MobileSidebar.tsx`
- Global findings dropped from typography=460, spacing=179, radius=64 to typography=455, spacing=177, radius=64.

## Current Charity Management Batch Progress Note
- This remediation batch targeted the charity management hotspot:
	- `src/components/settings/ManageCommunityCharity.tsx`
- Global findings dropped from typography=455, spacing=177, radius=64 to typography=450, spacing=166, radius=63.

## Newest Business Import Batch Progress Note
- This remediation batch targeted business ingestion tooling:
	- `src/components/admin/BusinessImportTool.tsx`
- Global findings dropped from typography=450, spacing=166, radius=63 to typography=449, spacing=163, radius=63.

## Current Pricing Batch Progress Note
- This remediation batch targeted pricing and licensing surfaces:
	- `src/components/admin/BenefitsPricingPage.tsx`
- Global findings dropped from typography=449, spacing=163, radius=63 to typography=440, spacing=161, radius=63.

## Newest Shared Modal Batch Progress Note
- This remediation batch targeted confirmation modal styling:
	- `src/components/shared/PostConfirmationModal.tsx`
- Global findings dropped from typography=440, spacing=161, radius=63 to typography=432, spacing=149, radius=58.

## Current Create Business Batch Progress Note
- This remediation batch targeted business creation form cleanup:
	- `src/components/settings/CreateBusinessForm.tsx`
- Global findings dropped from typography=432, spacing=149, radius=58 to typography=431, spacing=149, radius=58.

## Newest Insight Panels Batch Progress Note
- This remediation batch targeted insight dashboard cards:
	- `src/components/admin/CommunityInsightPanels.tsx`
- Global findings dropped from typography=431, spacing=149, radius=58 to typography=422, spacing=138, radius=54.

## Current Settings Batch Progress Note
- This remediation batch targeted settings profile shell cleanup:
	- `src/components/settings/SettingsPage.tsx`
- Global findings dropped from typography=422, spacing=138, radius=54 to typography=421, spacing=138, radius=54.

## Newest Security + Notifications Batch Progress Note
- This remediation batch targeted licensing and notification surfaces:
	- `src/components/security/LicensingSection.tsx`
	- `src/components/shared/NotificationCenter.tsx`
- Global findings dropped from typography=421, spacing=138, radius=54 to typography=414, spacing=138, radius=54.

## Current Sessions Batch Progress Note
- This remediation batch targeted session-management UI styling:
	- `src/components/security/SessionsSection.tsx`
- Global findings dropped from typography=414, spacing=138, radius=54 to typography=410, spacing=125, radius=46.

## Newest Danger Zone Batch Progress Note
- This remediation batch targeted account-danger interactions:
	- `src/components/security/DangerZoneSection.tsx`
- Global findings dropped from typography=410, spacing=125, radius=46 to typography=407, spacing=125, radius=46.

## Current Emergency + Header Batch Progress Note
- This remediation batch targeted emergency hub and top navigation polish:
	- `app/emergency/index.tsx`
	- `src/components/shared/Header.tsx`
- Global findings dropped from typography=407, spacing=125, radius=46 to typography=403, spacing=124, radius=46.

## Newest Manage Businesses Batch Progress Note
- This remediation batch targeted member business management UI:
	- `src/components/settings/ManageUserBusinesses.tsx`
- Global findings dropped from typography=403, spacing=124, radius=46 to typography=401, spacing=124, radius=46.

## Current Call Experience Batch Progress Note
- This remediation batch targeted active call surface styling:
	- `src/components/call/CallScreen.tsx`
- Global findings dropped from typography=401, spacing=124, radius=46 to typography=394, spacing=117, radius=41.

## Newest Incoming Call Overlay Batch Progress Note
- This remediation batch targeted incoming-call overlay styling:
	- `src/components/call/IncomingCallOverlay.tsx`
- Global findings dropped from typography=394, spacing=117, radius=41 to typography=390, spacing=109, radius=39.

## Current Auth Shell Batch Progress Note
- This remediation batch targeted authentication shell styling:
	- `src/components/auth/PhoneAuth.tsx`
	- `src/components/auth/LandingPage.tsx`
- Global findings dropped from typography=390, spacing=109, radius=39 to typography=390, spacing=104, radius=35.

## Newest Location + Audit Batch Progress Note
- This remediation batch targeted shared location picker and security audit logs:
	- `src/components/shared/LocationPickerSection.tsx`
	- `src/components/security/AuditLogsSection.tsx`
- Global findings dropped from typography=390, spacing=104, radius=35 to typography=381, spacing=80, radius=25.

## Current Marketplace Batch Progress Note
- This remediation batch targeted market listing detail and list container styling:
	- `src/components/market/MarketPage.tsx`
- Global findings dropped from typography=381, spacing=80, radius=25 to typography=377, spacing=63, radius=17.

## Newest Onboarding Create Batch Progress Note
- This remediation batch targeted onboarding coverage and category selection styling:
	- `src/components/auth/OnboardingCreate.tsx`
- Global findings dropped from typography=377, spacing=63, radius=17 to typography=370, spacing=50, radius=9.

## Current Security Access Batch Progress Note
- This remediation batch targeted account shell and community access cards:
	- `src/components/security/CommunityAccessSection.tsx`
	- `src/components/security/AccountSecurityPage.tsx`
- Global findings dropped from typography=370, spacing=50, radius=9 to typography=370, spacing=37, radius=3.

## Newest Radius Micro-Batch Progress Note
- This remediation batch targeted final radius literals in chat/settings surfaces:
	- `src/components/settings/ManageUserBusinesses.tsx`
	- `src/components/chat/ChatPage.tsx`
- Global findings dropped from typography=370, spacing=37, radius=3 to typography=370, spacing=37, radius=1.

## Current Radius Closeout Progress Note
- This remediation batch targeted default theme radius fallback value:
	- `src/context/ThemeContext.tsx`
- Global findings dropped from typography=370, spacing=37, radius=1 to typography=370, spacing=37, radius=0.

## Newest Chat Spacing Batch Progress Note
- This remediation batch targeted chat message layout spacing:
	- `src/components/chat/MessageBubble.tsx`
	- `src/components/chat/ChatWindow.tsx`
- Global findings dropped from typography=370, spacing=37, radius=0 to typography=368, spacing=25, radius=0.

## Current Low-Count Spacing Batch Progress Note
- This remediation batch targeted low-count residual spacing files:
	- `src/components/chat/ChatComposer.tsx`
	- `src/components/posts/CreatePostPage.tsx`
	- `src/components/auth/Onboarding.tsx`
	- `app/(tabs)/_layout.tsx`
	- `src/components/posts/PostsPage.tsx`
	- `src/components/chat/ChatPage.tsx`
	- `src/components/posts/CreateNoticeForm.tsx`
- Global findings dropped from typography=368, spacing=25, radius=0 to typography=368, spacing=16, radius=0.

## Newest Spacing Closeout Batch Progress Note
- This remediation batch targeted final spacing hotspots:
	- `src/components/admin/ModerationCenter.tsx`
	- `src/components/admin/AdminDashboard.tsx`
	- `src/components/home/HomePage.tsx`
	- `src/components/shared/PostConfirmationModal.tsx`
- Global findings dropped from typography=368, spacing=16, radius=0 to typography=368, spacing=0, radius=0.
