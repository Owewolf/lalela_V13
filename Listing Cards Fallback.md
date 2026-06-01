# Listing Cards – Fallback Image Behaviour

## Decision

**Author/profile images must never be used as the main hero image of a listing card.**

The hero image area represents the content being shared, offered, requested, sold, or posted. Using a user's profile image as the primary card image can create confusion and may incorrectly imply that the profile photo is the item, location, notice, or event being displayed.

---

# Required Behaviour

## When a Listing Contains Images

* Display the first uploaded listing image as the hero image.
* All existing image behaviour remains unchanged.

---

## When a Listing Contains No Images

Instead of displaying:

* Blank image placeholders
* Generic "No Image" graphics
* User profile photos
* User avatars

The application must automatically generate and display a map-based fallback image.

---

# Map Fallback Image

The fallback image must use the same visual style already implemented for:

* Emergency Notices
* Warning Notices
* Any existing notice-posting map previews

The generated image should contain:

* A map centred on the listing location
* A clearly visible location pin
* Appropriate zoom level showing the immediate area
* Consistent styling with existing notice map cards

This map image becomes the hero image for the listing card.

---

# User Experience Goal

Every listing card should always contain a meaningful visual element.

If a user does not upload a photo, the location itself becomes the visual representation of the listing.

This provides:

* Better visual consistency throughout the application
* Improved card recognition and scanning
* Stronger location awareness
* A more professional appearance
* No reliance on profile images for content representation

---

# Examples

### Listing With Photos

Hero Image:

* Uploaded listing photo

### Listing Without Photos

Hero Image:

* Generated map preview
* Listing location pin visible

### Emergency Notice

Hero Image:

* Generated map preview
* Notice location pin visible

### Warning Notice

Hero Image:

* Generated map preview
* Notice location pin visible

---

# Explicit Rule

**Under no circumstances should the author's profile image, avatar, or account photo be used as the hero image of a listing, notice, event, request, or community post.**

** If no content image exists, the system must generate and display the standard map preview image with the associated location pin.

