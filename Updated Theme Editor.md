**✅ Updated Theme Editor – Minimal Change Proposal**

### Summary of Changes
- **Minimal layout disruption**: No resizing of any existing elements.
- Move the **color preview swatches** from the bottom PREVIEW section directly next to each hex value.
- Make each color block clickable to open a color picker.
- Keep hex numbers fully editable.

---

### New Structure (Side-by-Side Visual)

**Theme Name**  
`Lalela Light` *(unchanged)*

**PRIMARY**  
`[█ #2D4B32]` ← *Clickable swatch + editable hex*

**SECONDARY**  
`[█ #BD5D38]` ← *Clickable swatch + editable hex*

**BACKGROUND**  
`[█ #F2E8D5]` ← *Clickable swatch + editable hex*

**SURFACE**  
`[█ #E8DDC8]` ← *Clickable swatch + editable hex*

**TEXT PRIMARY**  
`[█ #1A1C18]` ← *Clickable swatch + editable hex*

**TEXT SECONDARY**  
`[█ #4A4F45]` ← *Clickable swatch + editable hex*

*(Remove the entire bottom PREVIEW row of colored dots)*

---

### How It Works
- Each line becomes: **Label** + **Large color swatch** + **Hex input field**
- Tapping the swatch opens the color picker.
- Typing in the hex field instantly updates the swatch.
- All existing spacing, padding, and card sizes remain **exactly the same**.

---

### Benefits
- Cleaner look (no redundant preview section at the bottom)
- Much more intuitive — colors are now directly associated with their labels
- Still feels familiar to current users

---

Would you like me to write the exact component structure (e.g. React Native/Tailwind) for this minimal update?**✅ React Native Color Picker Implementation (Minimal Changes)**

Here's a clean, minimal implementation to enhance your **Theme Editor** screen.

### 1. Install Recommended Library

```bash
# Best modern choice (2026)
npm install reanimated-color-picker react-native-reanimated

# OR Classic simple option
npm install react-native-color-picker
```

---

### 2. Minimal Code Implementation

#### `ThemeColorField.tsx` (Reusable Component)

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import ColorPicker, { toHsv, fromHsv } from 'react-native-color-picker'; // or reanimated-color-picker

interface ThemeColorFieldProps {
  label: string;
  color: string;
  onColorChange: (newColor: string) => void;
}

export const ThemeColorField: React.FC<ThemeColorFieldProps> = ({
  label,
  color,
  onColorChange,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState(color);

  const handleColorSelected = (selectedColor: any) => {
    const hexColor = fromHsv(selectedColor); // or selectedColor.hex
    setCurrentColor(hexColor);
    onColorChange(hexColor);
    setShowPicker(false);
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      
      <TouchableOpacity 
        style={styles.colorRow}
        onPress={() => setShowPicker(true)}
      >
        <View style={[styles.swatch, { backgroundColor: currentColor }]} />
        <TextInput
          style={styles.hexInput}
          value={currentColor}
          onChangeText={(text) => {
            setCurrentColor(text);
            onColorChange(text);
          }}
          maxLength={7}
        />
      </TouchableOpacity>

      {/* Modal Color Picker */}
      {showPicker && (
        <View style={styles.pickerModal}>
          <ColorPicker
            color={toHsv(currentColor)}
            onColorSelected={handleColorSelected}
            style={styles.picker}
          />
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowPicker(false)}
          >
            <Text>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  hexInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  pickerModal: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 1000,
  },
  picker: {
    height: 280,
  },
  closeButton: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 12,
  },
});
```

---

### 3. Usage in Your Theme Screen

```tsx
// Inside your main Theme Management component
<ThemeColorField
  label="PRIMARY"
  color="#2D4B32"
  onColorChange={(newColor) => updateTheme('primary', newColor)}
/>

<ThemeColorField
  label="SECONDARY"
  color="#BD5D38"
  onColorChange={(newColor) => updateTheme('secondary', newColor)}
/>

{/* Repeat for BACKGROUND, SURFACE, TEXT PRIMARY, TEXT SECONDARY */}
```

---

**This keeps your existing layout almost untouched** — just replaces the static beige boxes with interactive swatch + hex fields.

