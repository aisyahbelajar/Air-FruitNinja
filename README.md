# Air Fruit Ninja — Gesture Controlled Game

A modern browser-based game inspired by Fruit Ninja, controlled entirely using **hand gestures via webcam**. No mouse, no touch — just your hand in the air.

---

## Features

*  **Hand Tracking Control**

  * Uses webcam + AI to detect hand movement
  * Index finger acts as a “blade”

*  **Fruit Slicing Gameplay**

  * Fruits spawn dynamically with physics
  * Slice them in mid-air to gain points

*  **Bomb System**

  * Avoid bombs — hitting one ends the game

*  **Score System**

  * Real-time score tracking
  * Smooth UI updates

*  **Camera Preview**

  * Live webcam feed displayed on screen
  * Helps users see their interaction

*  **Visual Effects**

  * Slice trail
  * Particle explosion
  * Smooth animations

*  **Sound Effects**

  * Slice sound
  * Bomb hit feedback

---

##  Tech Stack

* **React (Vite)**
* **Canvas API (2D rendering)**
* **MediaPipe Hands (AI hand tracking)**
* **requestAnimationFrame (game loop)**

##  Getting Started

### 1. Clone repository

```bash
git clone https://github.com/aisyahbelajar/Air-Canvas.git
cd Air-Canvas
```

### 2. Install dependencies

```bash
npm install
```

*or minimal setup:*

```bash
npm install @mediapipe/hands @mediapipe/camera_utils
```

### 3. Run development server

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

---

##  How It Works

1. Webcam captures user hand
2. MediaPipe detects hand landmarks
3. Index finger position is mapped to canvas
4. Game loop:

   * Spawn fruits
   * Apply physics
   * Detect collision
   * Render frame

---

##  Controls

| Gesture         | Action                   |
| --------------- | ------------------------ |
| ☝️ Index finger | Slice fruit              |
| ✋ Open hand     | (optional) clear / erase |
| 👍 (planned)    | Restart game             |

---

##  Requirements

* Browser with webcam access
* HTTPS or localhost (for camera permission)
* Good lighting for better hand detection

---

##  Future Improvements

* Combo system (x2, x3 multiplier)
* Slow-motion effects
* Gesture-based UI (pause, restart)
* Leaderboard (localStorage / backend)
* Mobile support

---

## Inspiration

Inspired by the classic **Fruit Ninja**, enhanced with modern AI-based interaction using hand gestures.

---

##  Support

If you like this project, consider giving it a star 
