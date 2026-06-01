# Business Import Image Capture Enhancement

## Objective

Enhance the existing Business Import workflow to automatically retrieve, store, and display a business photograph when a business is approved through the Moderation Center.

The current implementation already imports business information from Google Places API (New). This enhancement extends that process by retrieving a business image, storing it permanently in MinIO, and linking it to the business record in the database.

This is **not a Gemini AI feature**.

The implementation must use the existing Google Places API integration already used by:

* OnboardingCreate.tsx
* BusinessImportTool.tsx
* Existing `/places-search` backend route

---

# Current State

The platform currently:

1. Searches for businesses using Google Places API (New).
2. Returns business metadata.
3. Allows moderators to import businesses.
4. Stores business records in PostgreSQL through Prisma.

The platform currently does **not**:

* Retrieve Google Place photos.
* Store business images.
* Persist imported images in MinIO.
* Display imported business images consistently across the application.

---

# Required Enhancement

## During Business Approval

When a moderator approves a business import:

### Step 1

Retrieve the selected Place ID from the Google Places result.

### Step 2

Call Google Places Details API and request:

* photos
* displayName
* formattedAddress
* websiteUri
* nationalPhoneNumber

Only request fields that are required.

### Step 3

Determine Business Image

Priority order:

1. First Google Place photo returned.
2. Google business profile image.
3. Application default business placeholder image.

A business must always have an image.

---

# Image Storage

## Download Image

The backend must:

1. Retrieve the photo from Google Places.
2. Download the image server-side.
3. Generate a unique filename.

Example:

business-{businessId}.jpg

or

business-{uuid}.jpg

---

## Store in MinIO

Upload the image to the existing MinIO bucket.

Example structure:

/businesses/
/businesses/{businessId}/cover.jpg

The Google image URL must never be used directly by the frontend.

All images should be served from MinIO.

---

# Database Changes

## Business Table

Add:

```prisma
imageUrl            String?
imageImportedAt     DateTime?
googlePlaceId       String?
```

Purpose:

* imageUrl = MinIO file URL
* imageImportedAt = timestamp of import
* googlePlaceId = reference to the original Google Place

---

# Import Process

## New Flow

Google Places Search

↓

Moderator Selects Business

↓

Moderator Approves Import

↓

Fetch Place Details

↓

Retrieve Photo Metadata

↓

Download Photo

↓

Upload To MinIO

↓

Create Business Record

↓

Store MinIO URL

↓

Business Published

---

# Frontend Changes

All business-related cards and pages must use:

```ts
business.imageUrl
```

Examples:

* Search results
* Business directory
* Business profile page
* Marketplace business references
* Emergency service listings
* Community service listings
* Any future business cards

A business image should never be loaded from Google directly.

---

# Fallback Logic

If photo retrieval fails:

Use:

```ts
/defaults/business-placeholder.png
```

The import must continue.

Image failure must never prevent business creation.

---

# Business Image Reload Option

Add a moderator action:

"Delete and Reload Business Image"

Process:

1. Delete the existing image from MinIO.
2. Use the stored googlePlaceId.
3. Fetch the latest photo metadata from Google Places.
4. Download the latest image.
5. Upload the new image to MinIO.
6. Update imageUrl.
7. Update imageImportedAt.

This action is manual only.

No automatic scheduled updates.

The existing image must be removed before a replacement image is imported.

---

# Performance Requirements

The application must:

* Never call Google Places API when rendering cards.
* Never call Google Places API when opening business profiles.
* Never call Google Places API during normal browsing.

Google should only be contacted:

1. During initial import.
2. During manual delete-and-reload operations.

All user-facing pages must load images directly from MinIO.

---

# Error Handling

If:

* Google photo unavailable
* Download fails
* MinIO upload fails

Then:

1. Log the error.
2. Assign default placeholder image.
3. Complete business import successfully.

The moderator should not lose the imported business.

For delete-and-reload operations:

1. Log the error.
2. Preserve the existing image if the replacement process fails after retrieval begins.
3. Notify the moderator that the reload failed.

---

# Expected Outcome

After implementation:

* Every imported business has a visual image.
* Images are permanently owned and served by the platform through MinIO.
* Business cards remain fast because they load from local storage.
* No unnecessary Google API costs are incurred after import.
* Moderators can delete and reload business images on demand.
* The existing Google Places API workflow remains unchanged, with image import becoming an additional approval-stage step.

