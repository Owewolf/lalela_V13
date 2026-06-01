# : In-Chat Static Snapshot Feature

## 1. Objective

Instead of relying on dynamic data fields or injecting a pinned, live UI widget at the top of the chat thread, this feature introduces a **Static Snapshot Card** (treated natively by the system as an image/photograph attachment).

When a user initiates a discussion from a specific listing, notice, or general post, they are dropped immediately into their **existing, continuous 1-on-1 chat thread** with that person (no duplicate chat rooms are created).

The state of that listing at that exact moment is captured as a single, immutable snapshot card. This snapshot is injected directly into the message history flow as the very first message context indicator of the new inquiry.

---

## 2. Trigger & Visibility Mechanics (Crucial Flow Change)

* **Continuous Thread Continuity:** Clicking an action from a post redirects the user into the single ongoing chat thread history with that specific counterparty.
* **The "First Message" Trigger:** The static snapshot card does **not** instantly post or become visible to the receiver upon simply opening the chat window.
* **Draft State:** The snapshot card sits staged at the beginning of the new interaction segment.
* **Delivery:** Only once the sender types and transmits their **first text message** (or media message) regarding this item does the snapshot card commit to the database timeline. It then displays inline within the chat stream for both the sender and the receiver.

---

## 3. UI/UX Design Specifications (The Snapshot Card Layout)

The snapshot component acts visually as a cleanly structured container imitating the styling from ``. Since it functions like a static image/photograph of the listing's state, it combines the map graphic, context metadata, and user attribution into a single block.

```
+--------------------------------------------------------------+
|                                                              |
|                      LOCATION PREVIEW                        |
|             [ Google Map Mini-Map Graphics ]                 |
|                                                              |
+--------------------------------------------------------------+
|  Empty Water Tanks tomorrow                                  |
|  Kareedouw                                     [ Location ]  |
|                                                  |
|  (🏷️ GENERAL)                                  [  Avatar  ]            |
+--------------------------------------------------------------+

```

### Visual Component Rules (Based on `watermarked_img_7614911586297733063.png`)

* **Top Section (Map Graphic):** A fixed aspect-ratio rectangular graphic featuring the map background, the location pin, and the "LOCATION PREVIEW" banner overlaid cleanly across the upper portion.
* **Bottom Section (Metadata Area):** A light-colored content canvas containing the textual information.
* **Title & Text Layout:**
* The main text (e.g., `Empty Water Tanks tomorrow`) displays clearly on the left.
* The precise location name text (e.g., `Kareedouw`) is placed inline or directly alongside the main text payload, completely replacing the old trailing vertical three-dots (`...`) menu options.


* **Bottom-Right Circular Avatar:** A perfectly **circular user profile avatar picture** is positioned in the bottom-right quadrant of the textual canvas space.
* **Location Text Elevation:** The location name metadata string prints explicitly on the text canvas layout, positioned directly **above** the upper boundary curve of the circular avatar image element.
* **Category Badge:** A small rounded pill container (e.g., `🏷️ GENERAL`) sits anchored at the bottom-left of the metadata quadrant.

---

## 4. Technical Architecture & Data Handling

Because this component acts as a photograph of a point-in-time state, it does **not** dynamically call backend databases to update pricing, availability, or edits later on.

* **Message Type:** The system must treat this item structurally as an immutable message type payload (e.g., `message_type: "listing_snapshot"`).
* **Data Flattening:** The text strings, category tags, map coordinates, and user images present at the second of interaction are flattened into the message block. If the original post is later deleted or edited by its creator, this card inside the continuous chat remains entirely unaltered.

---

## 5. Global Chat Layout Consistency

This card layout is embedded within the application's unified messaging engine layout (patterned after standard messaging protocols like `IMG_8408.jpg`):

* **No Scrolling Interference:** Unlike a fixed, pinned header widget, this snapshot card scrolls away organically with the chat stream text bubbles as historical messages are pulled down or pushed up by the user.
* **Alignment:** The snapshot blocks are integrated inline directly above the sender's initial text message bubble
string.
* **Backend Alignment:*** Complete all nessesary schema alignments and migrations
