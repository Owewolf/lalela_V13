

Here is a detailed plan for implementing the **Community Identity Management** component, covering the structure, required fields, and necessary backend considerations.
By Replacing the Community theme Management block 
---

## 🛠️ Implementation Plan: Community Identity

We will create a new, distinct section titled **Community Identity** (or **Community Profile**).

### 1. Component Structure & Layout

The layout should be clean and functional, grouping the editable properties together.

*   **Section Title:** Community Identity
*   **Layout:** Should use a standard form layout (e.g., two-column layout if space permits, or a single vertical column).
*   **Save Mechanism:** This section **must** have its own dedicated "Save Changes" button. This prevents users from accidentally saving only the theme settings while editing the name.

### 2. Required Fields & Inputs

| Property | Input Type | Placeholder/Label | Notes |
| :--- | :--- | :--- | :--- |
| **Community Name** | `TextInput` | Enter the full community name (e.g., Tech Hub Quarterly) | **Validation:** Should check for special characters, length limits, and uniqueness against other communities. |
| **Community Icon/Logo** | `File Uploader / Image Picker` | Upload Logo (Minimum 200x200 px) | **Backend:** Requires image processing/resizing on the backend to ensure various sizes (thumbnail, header, etc.) are stored. |
| **Community Description** | `Textarea` | Briefly describe your community's purpose... | **Optional but Recommended:** Allows for SEO and user clarity. |

### 3. User Experience (UX) Considerations

1.  **Initial State:** When the page loads, the fields must be pre-filled with the currently active community data.
2.  **Loading State:** When the user clicks "Save Changes," the button should temporarily disable and show a "Saving..." state to prevent double-submissions.
3.  **Feedback:** Provide clear, contextual feedback:
    *   **Success:** A green toast/banner: "Community profile updated successfully!"
    *   **Error:** A red error message placed directly under the problematic field: "The name is already taken by another community."

### 4. Backend & API Flow (Crucial)

This functionality requires interaction with a dedicated backend endpoint (`/api/community/update_profile`).

1.  **Client Action:** User fills out the form and clicks "Save Changes."
2.  **Client Sends Data:** The frontend sends a JSON payload containing: `{ name: "New Name", icon_url: "...", description: "..." }`
3.  **Server Validation:** The backend must perform *all* necessary validation checks:
    *   Is the name unique?
    *   Is the icon file valid and correctly stored?
    *   Are all required fields present?
4.  **Server Response:** The backend responds with `200 OK` on success, or a specific error code and message on failure.

---

### Summary Checklist

✅ **Placement:** Prominent location near the top.
✅ **Inputs:** Name (text), Icon (uploader), Description (textarea).
✅ **Action:** Dedicated "Save Changes" button.
✅ **Validation:** Front-end and Back-end validation implemented.
✅ **Feedback:** Clear success/error messaging for the user.
**✅ Expo Image Picker Integration for Community Icon**

Here's the complete, production-ready implementation for your **Community Settings** card.

### 1. Installation

```bash
npx expo install expo-image-picker
```

### 2. `CommunityIconPicker.tsx` (Reusable Component)

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface CommunityIconPickerProps {
  currentIcon?: string | null;
  onIconSelected: (uri: string) => void;
}

export const CommunityIconPicker: React.FC<CommunityIconPickerProps> = ({
  currentIcon,
  onIconSelected,
}) => {
  const [image, setImage] = useState<string | null>(currentIcon || null);

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to change the community icon.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],           // Square for community icon
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImage(uri);
      onIconSelected(uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera permissions to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImage(uri);
      onIconSelected(uri);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.iconWrapper} onPress={pickImage}>
        <Image
          source={{ uri: image || 'https://via.placeholder.com/120?text=Community' }}
          style={styles.communityIcon}
        />
        <View style={styles.editOverlay}>
          <Text style={styles.editText}>📷</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
          <Text style={styles.actionText}>Choose from Library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Text style={styles.actionText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  communityIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  editOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#10b981',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editText: {
    fontSize: 14,
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  actionText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
});
```

### 3. How to Use It in Your Screen

```tsx
// In your Community Theme Management / Settings component

const [communityIcon, setCommunityIcon] = useState<string | null>(initialIcon);

<CommunityIconPicker
  currentIcon={communityIcon}
  onIconSelected={setCommunityIcon}
/>
```

This gives you:
- Tap the icon → opens gallery
- Dedicated "Take Photo" and "Choose from Library" buttons
- Square cropping (perfect for community icons)
- Clean visual feedback

Ensure the  backend** logic (Prisma) or integrate it into the full card?
