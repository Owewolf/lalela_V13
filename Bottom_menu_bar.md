**Convert Fixed Bottom Navigation to WhatsApp-Style Floating Pill Menu**

### Objective
Transform the existing fixed bottom navigation bar (Home, Posts, Chat, Market, Settings) into a **floating WhatsApp-style pill menu** that:
- Keeps **exactly the same icons and labels**.
- Sits **slightly elevated** off the bottom edge of the screen.
- Has a **rounded pill/capsule shape** with a subtle "bubble" appearance (soft shadow, rounded corners, semi-transparent with our global configeration).
- Maintains the same functionality (tab switching).

### Target Design (WhatsApp Reference)
- **Shape**: Horizontal pill/capsule (highly rounded corners, height ~60-70dp).
- **Position**: Floating ~8-16dp above the safe area bottom edge.
- **Style**: 
  - Background: Default global reach with subtle blur or elevation.
  - Active tab: Highlighted icon + label (usually colored dot or filled icon).
  - Inactive tabs: Muted icons.
  - Soft drop shadow for the "floating bubble" effect.
  - All present functionality to remain as is 

### Implementation Recommendations



#### 2. **For React Native** AS EXAMPLE ---ENsure ou APP compatablity 

#############   EXAMPLE ################
Use `react-native-safe-area-context` + a custom component:

```jsx
<View style={styles.floatingContainer}>
  <View style={styles.pill}>
    <TouchableOpacity style={styles.tab}>...</TouchableOpacity>
    {/* Repeat for all 5 tabs */}
  </View>
</View>

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 999, // Very rounded
    height: 66,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
});
```

#### 3. **General UI Guidelines**
- **Padding**: 8-12dp from screen edges (left/right).
- **Bottom Margin**: 8-20dp from device bottom (respect safe area).
- **Height**: 60-70dp.
- **Icon Size**: 24-28dp.
- **Active State**: As Is .
- **Dark Mode**: Ensure proper contrast and shadow.

### Deliverables Expected
1. New floating navigation component (reusable).
2. Update main screen layout to account for the floating element (add bottom padding to content).
3. Smooth animation when switching tabs (scale or color transition).
4. Safe area handling (iOS notch / Android gesture navigation).
5. Ensure our theme management is correctly wired 


