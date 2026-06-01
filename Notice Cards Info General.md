# Notice Cards (Info & General) – Fallback Image Behaviour

## Decision

**Author/profile images must never be used as the main hero image of an Info Notice or General Notice card.**

The hero image area represents the content being shared, posted, or announced. Using a user's profile image as the primary card image can create confusion and may incorrectly imply that the profile photo is the notice, location, or content being displayed.

---

# Required Behaviour

## When a Notice Contains Images

* Display the first uploaded notice image as the hero image.
* All existing image behaviour remains unchanged.

---

## When a Notice Contains No Images

Instead of displaying:

* Blank image placeholders
* Generic "No Image" graphics
* User profile photos
* User avatars

The application must automatically generate and display a map-based fallback image.

This rule applies to:

* Info Notices
* General Notices

---

# Map Fallback Image

The fallback image must use the same visual style already implemented for existing notice map previews.

The generated image should contain:

* A map centred on the notice location
* A clearly visible location pin
* Appropriate zoom level showing the immediate area
* Consistent styling across notice cards

This map image becomes the hero image for the notice card whenever no uploaded image exists.

---

# Notice Cards (Info & General)

Info Notices and General Notices must follow the same image logic.

### When Images Exist

Hero Image:

* First uploaded notice image

### When No Images Exist

Hero Image:

* Generated map preview
* Notice location pin visible

At no point should an Info Notice or General Notice fall back to displaying the author's profile image.

---

# User Experience Goal

Every notice card should always contain a meaningful visual element.

If a user does not upload a photo, the location itself becomes the visual representation of the notice.

This provides:

* Better visual consistency throughout the application
* Improved card recognition and scanning
* Stronger location awareness
* A more professional appearance
* No reliance on profile images for content representation

---

# Examples

### Info Notice

Hero Image:

* Uploaded notice image if available
* Otherwise generated map preview with notice location pin

### General Notice

Hero Image:

* Uploaded notice image if available
* Otherwise generated map preview with notice location pin

---

# Explicit Rule

**Under no circumstances should the author's profile image, avatar, or account photo be used as the hero image of an Info Notice or General Notice.**

If no notice image exists, the system must generate and display the standard map preview image with the associated location pin.

This rule applies equally to:

* Info Notices
* General Notices

