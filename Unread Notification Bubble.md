## Unread Notification Bubble System

Add **green unread-count badges** throughout the app UI similar to WhatsApp.

### 1. Chat List Badges (Right Side)

Each conversation row should display a circular green badge on the far right when unread messages exist.

Example:

* `11`
* `3`
* `1`

#### Behaviour

* Only show badge if `unreadCount > 0`
* Badge should auto-size depending on number length
* White bold text inside green circle
* Vertically centered with the conversation item
* Hide when conversation is opened/read

#### Style

* Background: WhatsApp-style green
* Shape: fully rounded pill/circle
* Text: white, semibold/bold
* Small shadow optional

#### Example UI Logic

```js
if (chat.unreadCount > 0) {
   showUnreadBadge(chat.unreadCount)
}
```

---

### 2. Bottom Navigation Badges

Add smaller unread badges to bottom navigation icons.

Example:

* Chats tab → `5`


#### Behaviour

* Positioned top-right of icon
* Aggregated total count per section
* Hidden when count is zero

#### Example

```js
totalUnreadChats = chats.reduce((a,b) => a + b.unreadCount, 0)
```

---

### 3. Badge Positioning Rules

#### Chat List

* Right aligned
* Same vertical line as timestamp
* Does not shift layout when appearing/disappearing

#### Bottom Nav

* Absolute positioned
* Slight overlap on icon edge
* Responsive on all screen sizes

---

### 4. Animation

Optional but recommended:

* Smooth scale/fade when count changes
* Small “pop” animation for new messages

---

### 5. Design Goal

The badges must:

* Immediately attract attention
* Be highly visible
* Give the interface a “live activity” feeling
* Encourage users to open conversations


