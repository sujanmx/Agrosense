# PROJECT PROGRESS SUMMARY — STATE CHECKPOINT

> **Document Type:** Project Progress Checkpoint & Handover Reference  
> **Project:** AgroSense (SIH25015) — Smart Agriculture IoT Dashboard  
> **Status:** Phase 1 & 2 Complete (Frontend Architecture, UI Shell, Mock Telemetry, Throttled Vision Pipeline, Hardware Trust Model, State Overlays)  
> **Primary Purpose:** Checkpoint for AI models / developers to understand exact implementation details, real vs. simulated boundaries, and prevent redundant rebuilding.

---

## 1. PROJECT FOUNDATION

- **Core Framework & Runtime:** React 19.2.8, React DOM 19.2.8, TypeScript ~6.0.2 (configured for `es2023`, `ESNext` modules, bundler resolution, strict type-checking, and `@/*` alias mapped to `./src/*`).
- **Build Tooling:** Vite 8.2.0 (`@vitejs/plugin-react` 6.1.0, `@tailwindcss/vite` 4.3.3). Production build compiles clean with zero TypeScript errors.
- **Styling System:** Tailwind CSS v4 (`@import "tailwindcss";`), configured with custom CSS theme tokens (`--color-background: #09090b`, `--color-card`, `--color-primary`, border colors, radii) and custom `@custom-variant dark (&:is(.dark *));`.
- **UI Primitives:** Radix UI (`@radix-ui/react-slot`, `radix-ui`) and Class Variance Authority (`cva`, `clsx`, `tailwind-merge`) with custom shadcn-style base components:
  - `src/components/ui/button.tsx`: Variant-driven button (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and multiple size presets (`xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`).
  - `src/components/ui/badge.tsx`: Variant-driven status badges.
  - `src/components/ui/card.tsx`: Compound card primitives (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`).
- **State Management:** Zustand 5.0.15 centralized store in `src/store/index.ts` with three integrated slices:
  - `AiState`: Tracks model lifecycle, inference status, current diagnosis, diagnosis history (max 20), inference frame counters, and render update counters.
  - `TelemetryState`: Tracks live readings (temperature, humidity, soil moisture), last updated timestamp, and rolling history buffer (max 50 points).
  - `HardwareState`: Tracks gateway connection status, device registry, pump/valve actuation states, and in-flight command objects.
- **Utility / Throttling Architecture:** Custom zero-dependency frame-budget-aware throttling utility in `src/lib/throttle.ts` (`throttle`, `throttlePerSecond`) providing leading-edge execution, trailing-edge cooldown guarantees, and frame-rate decoupling.

---

## 2. DASHBOARD / UI

- **Shell & Navigation (`src/components/DashboardLayout.tsx`):**
  - Sticky top navigation bar with AgroSense branding, SIH25015 tag, DataLotus animated logo, `SystemHealthTicker`, ESP32 target badge, and version indicator.
  - Responsive 3-column desktop layout (`grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)]`):
    - **Left Column:** Sensor Telemetry panel (`TelemetryPanel.tsx`).
    - **Center Column (Main):** AI Vision Module (`VisionModule.tsx`) containing video feed, AI overlays, diagnostic observations, and throttling performance metrics.
    - **Right Column:** Hardware Controls (`PumpControl.tsx`), DataLotus state gallery, and Empty State gallery.
  - Mobile responsive behavior: Collapses to a single column where the center camera feed is prioritized at the top using `order-first`.
  - Bottom status footer: Displays pipeline status indicator (`AI Vision ➔ Telemetry ➔ Hardware Action`) and event metadata.
- **Visual Design:** Industrial dark aesthetic (`#09090b` background, `#27272a` borders, emerald/amber/cyan/orange semantic accents, Inter sans-serif typography, monospace numbers and status tags).

---

## 3. TELEMETRY

- **Mock Telemetry Engine (`src/providers/WebSocketProvider.tsx`):**
  - Implements `createSensorEngine()`, a realistic mathematical sensor simulator combining:
    - Random-walk Brownian noise (`±1.2°C`, `±2.0% RH`, `±1.5% moisture`).
    - Slow diurnal sinusoidal cycle (`sin(tick * 0.05)`) simulating day/night shifts.
    - Mean-reverting snapback towards typical Indian agricultural baseline conditions (28°C–30°C temp, 55%–60% humidity, 40%–45% soil moisture).
    - Clamping functions ensuring values remain within physical domains (18°C–48°C temp, 25%–95% RH, 8%–85% soil moisture).
- **Live Updates:** `WebSocketProvider` emits new telemetry payloads every `2000ms` (2 seconds) to the Zustand store upon successful simulated connection.
- **Telemetry Store & History:** Stores current values (`temperature`, `humidity`, `soilMoisture`), `lastUpdated` date, and rolling array `history` capped at `MAX_HISTORY = 50` points.
- **Telemetry Display (`src/components/panels/TelemetryPanel.tsx`):**
  - Live sensor cards with visual icons (`Thermometer`, `Droplets`, `Leaf`).
  - Animated horizontal progress bar gauges calibrated to sensor operating ranges.
  - Live / Idle status badge and timestamp metadata showing history buffer depth (`historyLength/50 pts`).
- **Trend Visualization:** Mini percentage fill bars are implemented. Continuous timeseries charts (e.g., Recharts / Chart.js line graphs) are **not yet implemented**.

---

## 4. COMPUTER VISION

- **Camera Implementation (`src/components/CameraFeed.tsx`):**
  - Uses HTML5 `navigator.mediaDevices.getUserMedia` requesting `{ video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }`.
  - Renders to native `<video autoPlay playsInline muted />` element with `object-fit: cover`.
  - Exposes imperative handle (`CameraFeedHandle`) via `useImperativeHandle` for parent control: `videoElement`, `stop()`, `restart()`.
- **Camera Lifecycle States:** Handles `awaiting_permission`, `active`, `permission_denied`, and `error` (e.g., `DOMException` / `NotAllowedError`).
- **Inference Simulation (`src/components/panels/VisionModule.tsx`):**
  - Simulates a 30fps Teachable Machine / TensorFlow.js inference loop firing every `33ms`.
  - Produces mock diagnoses with weighted distribution (`Healthy Leaf`, `Early Blight`, `Powdery Mildew`, `Normal Growth`, `Pest Damage (Aphids)`, `Nutrient Deficiency`, `No Clear Detection`).
  - Simulates normalized bounding box coordinates (`0.0`–`1.0`) when anomalies are detected.
- **Inference Throttling Architecture:**
  - Raw frame loop executes at ~30Hz and increments raw `inferenceCount`.
  - UI updates are routed through `throttledSetDiagnosis = throttlePerSecond(..., 2)`.
  - React re-renders and Zustand diagnosis mutations occur strictly at **≤ 2 updates per second (500ms interval)**.
  - Dedicated `ThrottleProof` panel visually displays the ~15:1 ratio between raw inference frames (`INF`) and UI renders (`RND`).
- **AI Overlay (`src/components/AIOverlay.tsx`):**
  - Normalized percentage positioning (`left: x%`, `top: y%`, `width: w%`, `height: h%`) ensuring resize resilience across screen resolutions.
  - 4 corner brackets, top-anchored hedged diagnosis tag, confidence percentage, and full viewport anomaly frame border.
- **Overlay Toggle:** User toggle (`Eye` / `EyeOff` button) allows toggling bounding boxes and AI badges on/off while keeping video stream and inference running.

---

## 5. AI / DIAGNOSTIC UX

- **Diagnostic Badge (`src/components/DiagnosticBadge.tsx`):**
  - **Confidence Tiers (`deriveConfidenceTier`):**
    - `high` (≥ 85%): Solid border, crisp display, direct label.
    - `medium` (60%–84%): Dashed border styling, 90% opacity, hedged label prefix (`"Likely ..."`).
    - `low` (40%–59%): Dashed border, 75% opacity, hedged label prefix (`"Possible ..."`).
    - `insufficient` (< 40%): Dotted border, 60% opacity, hedged label prefix (`"Uncertain — ..."`), `HelpCircle` icon.
  - **Severity Derivation (`deriveSeverity`):** Decouples severity from confidence (e.g., healthy plants remain `healthy` severity regardless of confidence; blights/wilts/rots elevate to `warning` or `critical`).
- **Diagnostic Card (`src/components/DiagnosticCard.tsx`):**
  - Rich observation panel directly below camera feed implementing the full AI trust pipeline:
    `OBSERVATION → CONFIDENCE → CONTEXT → RECOMMENDATION`
  - **Environmental Correlation:** Cross-references active sensor telemetry with visual detection (e.g., flags high humidity `>65%` when early blight is observed to warn of accelerated spore propagation).
  - **Actionable Recommendations:** Rule-based recommendation engine generating specific actions prioritized by urgency (`info`, `action`, `urgent`).
  - **Special States:** Dedicated UI treatments for `No Clear Detection` (prompts repositioning) and low-confidence readings (prompts better lighting).

---

## 6. MASCOT / BRANDING (DataLotus)

- **DataLotus Component (`src/components/DataLotus.tsx`):**
  - Custom SVG wireframe vector mascot inspired by sacred geometry and Indian agricultural symbolism.
  - Constructed with an origin-centered coordinate space (`viewBox="-50 -50 100 100"`) featuring:
    - Center seed node (2 concentric circles).
    - Inner petal ring (6 petals).
    - Middle petal ring (6 petals, offset 30°).
    - Outer petal ring (8 petals).
    - Geometric dashed accent rings.
  - Driven by `currentColor` stroke to seamlessly adapt to Tailwind semantic text colors.
- **Mascot Animation States:**
  - `loading`: Amber-400 stroke + continuous slow 360° rotation (`animate-lotus-spin`, 8s linear).
  - `idle`: Emerald-500/70 stroke + gentle pulsing scale/glow (`animate-lotus-pulse`, 3s ease-in-out).
  - `error`: Red-500/50 static stroke.
  - `offline`: Zinc-600/40 dimmed static stroke.
- **Mascot Integration:** Used as top navbar header logo, hero element in all `StateOverlay` placeholders, and featured in a 4-state showcase gallery.

---

## 7. HARDWARE CONTROL

- **Controlled Actuators (`src/components/panels/PumpControl.tsx`):**
  - **Irrigation Pump:** Target `pump`, actions `start` / `stop`.
  - **Solenoid Valve:** Target `valve`, actions `open` / `close`.
- **Command State Representation:**
  - Hardware state slice tracks `pumpActive: boolean`, `valveOpen: boolean`, and `pendingCommands: Record<HardwareCommandTarget, HardwareCommand | null>`.
  - Individual `HardwareCommand` objects track `id`, `target`, `action`, `status`, `issuedAt`, `acknowledgedAt`, `confirmedAt`, and `failureReason`.
- **Command Handling & Error Protection:**
  - Dispatches unique command ID (`cmd_${target}_${Date.now()}`).
  - Action buttons disable during in-flight operations with an animated spinner (`Loader2`).
  - Stale command detection prevents asynchronous callbacks of superseded commands from mutating state.
  - Auto-clearing mechanism removes confirmed command status badges after 3000ms.

---

## 8. HARDWARE TRUST MODEL

- **Implemented Command Pipeline Flow:**
  ```
  USER INTENT (Button Click)
       ↓
  SENDING        — Status: "Command sent…" (Yellow pulse / Send icon)
       ↓
  AWAITING_ACK   — Status: "Waiting for controller…" (Blue pulse / Radio icon)
       ↓
  CONFIRMED      — Status: "Hardware confirmed" (Green / CheckCircle2 icon)
                   State (pumpActive / valveOpen) ONLY updates here!
       ↓
  (Auto-clears after 3s)
  ```
  *(Or transitions to `FAILED` / `TIMEOUT` with error message if rejected)*.
- **Physical Integration Status:**
  - **CURRENTLY 100% SIMULATED in client memory.**
  - The pipeline simulates network transit (400ms delay to ACK) and actuator mechanical actuation (800ms delay to CONFIRMED) using JavaScript timers in `src/store/index.ts`.
  - **No physical ESP32 or serial/MQTT backend is currently connected.**

---

## 9. SYSTEM STATES

- **State Overlay Engine (`src/components/StateOverlay.tsx`):**
  - Standardized empty, loading, error, and offline UI overlay utilizing the DataLotus mascot.
- **Implemented System State Handlers:**
  - `loading`: Used during WebSocket handshake and module initialization (amber spinning lotus + 3 bouncing dots).
  - `analyzing`: 1500ms AI model warmup state before inference streaming begins.
  - `empty` / `awaiting_permission`: Initial standby state or camera permission prompt.
  - `permission_denied`: Explicit banner when camera access is blocked in browser settings.
  - `error`: Camera hardware failure or controller timeout with retry hooks.
  - `disconnected` / `offline`: Triggered when IoT gateway is unreachable; locks hardware actuation buttons, dims sensor displays, and provides a manual "Reconnect Gateway" action button.
  - `recovery`: Reconnection lifecycle exposed via `useWebSocket().reconnect()` and camera restart via `cameraRef.current?.restart()`.

---

## 10. VALIDATION

The following items have been explicitly verified on the live codebase:
- **TypeScript Compilation:** `tsc` passed with 0 errors (`strict: true`, no unused locals/parameters).
- **Vite Production Build:** `npm run build` executed successfully in 1.37s producing production-ready bundles (`dist/index.html`, `dist/assets/index-*.css` 44.04 kB, `dist/assets/index-*.js` 274.42 kB).
- **Runtime Integrity:** Clean React component hierarchy, valid hook dependencies, zero missing imports or syntax issues.
- **Responsive Layout:** Verified CSS Grid with collapsing desktop columns and mobile-first ordering.
- **Console / Diagnostics:** Verified structured emoji log output for all lifecycle events (`[WebSocket]`, `[HW]`, `[CameraFeed]`, `[VisionModule]`).

---

## 11. CURRENT REAL VS. SIMULATED STATUS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **HTML5 Camera Feed (`getUserMedia`)** | **REAL** | Directly captures local webcam / mobile environment camera. |
| **UI Shell & Responsive Grid** | **REAL** | Fully functional React + Tailwind CSS v4 layout. |
| **Zustand State Store & Throttling** | **REAL** | Real frame-budget throttle ensuring ≤ 2 UI renders/sec. |
| **Confidence Tiers & Hedging Logic** | **REAL** | Algorithmic hedging based on confidence thresholds. |
| **DataLotus Vector Mascot** | **REAL** | Custom SVG paths and CSS keyframe animations. |
| **Sensor Telemetry Stream** | **SIMULATED** | Mathematical random-walk + diurnal curve (no physical sensors). |
| **IoT Gateway WebSocket** | **SIMULATED** | JavaScript provider simulating 1.5s connect delay & 2s intervals. |
| **Crop Disease AI Model** | **SIMULATED / MOCKED** | Weighted random generator simulating 30fps Teachable Machine output. |
| **Hardware Actuator Pipeline** | **SIMULATED** | Timers simulate 400ms ACK + 800ms confirmation on ESP32 GPIOs. |
| **Historical Telemetry Charts** | **PARTIAL** | Stores 50 points in memory, renders fill bars, no line charts yet. |
| **Backend / ESP32 Firmware** | **NOT INTEGRATED** | No backend server, MQTT broker, or C++/Arduino firmware present. |

---

## 12. CURRENT PROJECT STATE

Where the project stands right now and what has been successfully built so far:

> AgroSense (SIH25015) currently has a complete, production-grade frontend dashboard shell built with React 19, TypeScript, Tailwind CSS v4, and Zustand. The dashboard features a responsive 3-column architecture containing a functional HTML5 camera feed with real-time video streaming, a high-performance throttled AI overlay pipeline (decoupling 30fps inference from a 2Hz UI render cycle), confidence-tiered diagnostic cards with environmental telemetry correlation, a complete 4-stage hardware command trust model (INTENT → SENT → AWAITING ACK → CONFIRMED), unified empty/loading/error state overlays, and the custom animated DataLotus vector mascot. All background telemetry streams, AI crop disease inferences, and hardware actuator responses are currently powered by high-fidelity client-side mathematical simulations and are ready for real model and backend/microcontroller integration in subsequent development phases.

---
*Checkpoint recorded into `PROJECT_PROGRESS_SUMMARY.md`.*



