**✅ Update CreatePostPage.tsx to Match the New Mockup**

### 🎯 Goal
Make the **Listing form** look and feel like the clean, modern mockup while keeping most existing functionality (price calculations, charity logic, image upload, etc.).

---

### 1. Overall Structure Changes

**Remove / Simplify:**
- The big "Type Banner" at the top (Marketplace Listing card)
- Emergency notice handling (keep the logic, but since this is for listings, focus on listing UI)
- The full "Details" card that wraps everything
- Separate Quantity + Unit fields
- The long charity breakdown card (simplify)

**New Layout Order (Top to Bottom):**
1. Photo Upload (large, prominent)
2. Title
3. Description
4. **Item Details** row: Quantity (stepper) + Unit (dropdown) + Price
5. Free Items toggle
6. Community Contribution info + Active Charity (simple)
7. (Optional) Keep LocationPickerSection at bottom
8. Big Post Listing button at bottom

---

### 2. Key UI Component Changes

#### Photo Section
- Make it **larger** and more prominent (like mockup: ~180-220px height)
- Text: "**Tap to add photo** (Max 1 photo, up to 10MB)"
- Center camera icon when empty

#### Item Details Section
Replace the current Quantity + Unit + Price fields with one compact row:

```tsx
{/* Item Details */}
<View className="flex-row gap-3">
  <View className="flex-1">
    <Text>Quantity</Text>
    {/* Stepper: -  1  + */}
  </View>
  <View className="flex-1">
    <Text>Unit</Text>
    {/* Dropdown / Picker for units */}
  </View>
  <View className="flex-1">
    <Text>Price Per Unit (R)</Text>
    {/* Price input */}
  </View>
</View>
```

#### Unit Options
Use a proper dropdown/picker with these recommended options:

```ts
const UNIT_OPTIONS = [
  'items', 'piece', 'pair', 'set', 'dozen', 
  'bunch', 'kg', 'g', 'litre', 'ml', 'pack', 'box'
];
```

Default = `'items'`

---

### 3. Active Charity Section (Important)

**Simplify** the current charity card to match the mockup:

- Keep the info text about CAT contribution
- Show only: **"Active Charity"** → `RSPCA 15%` (no "Change" button)
- Remove the full price breakdown table (Local Price / Charity / Public Price) **OR** make it collapsible / smaller

---

### 4. Styling Priorities (Match Mockup)

- Light beige/cream background
- Clean cards with soft shadows and rounded corners
- Teal / primary accent color for buttons and headers
- Generous spacing (`gap-6` or `gap-8`)
- Large, friendly input fields
- Prominent **Post Listing** button at bottom (teal, with paper plane icon)

---

### 5. Implementation Priority Order

1. **Photo upload area** — make it the hero element
2. **Item Details row** — combine Quantity (stepper), Unit (dropdown), Price
3. **Free Items toggle** — make it clearer
4. **Simplify Charity section** — remove complexity
5. Adjust spacing and typography to feel more modern/minimal

---

**Would you like me to give you the full updated code now, or do you want me to break it down into smaller, step-by-step diffs first?**

Just say the word and I’ll generate the complete revised `CreatePostPage.tsx` based on this spec.
