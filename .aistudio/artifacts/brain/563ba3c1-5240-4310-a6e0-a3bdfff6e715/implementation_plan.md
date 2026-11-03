# NEXUS 2040: Third-Person 3D World Integration & Crisis Explorer

Transform the NEXUS 2040 metropolitan experience by replacing the website's 3D city preview with the exact procedural Three.js city engine from the game, and elevating the game into a full third-person 3D adventure where players control a cybernetic field engineer navigating the living city, resolving municipal infrastructure crises through interactive logic puzzles, and restoring metropolitan stability.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following core design decisions were confirmed during Phase 1:
> - **Player Character Archetype**: High-tech cybernetic field engineer equipped with an articulated modular exoskeleton suit, glowing plasma power core, responsive articulated joints, jet thruster jump boosters, and illuminated visor display.
> - **Progression & Exploration**: Open-city exploration with active waypoint beacons, dynamic compass navigation bar, and an in-world objective tracker directing the engineer across five critical municipal sectors.
> - **Camera & Control Scheme**: Modern third-person follow camera with pointer-lock mouse look, crosshair reticle, obstacle collision avoidance, sprint acceleration, and interactive terminal prompts (`E`).

---

### 1. Overview & Core Concept

- **What It Delivers**:
  1. **Unified 3D City Environment**: The website's "Explore Nexus City in Genuine 3D" section is updated to render the exact same rich, procedural city environment (`cityBuilder3D.ts`) utilized by the game—featuring architectural stepped skyscrapers, procedural facade window matrices, multilane asphalt roads with crosswalks, moving vehicular traffic with headlights, an elevated maglev monorail, wind turbine rotors, solar farms, and eco-reservoirs.
  2. **Third-Person 3D Exploration & Gameplay**: Players control a 3D field engineer in real time within the city streets. The character walks, sprints, jumps using thrusters, and smoothly turns with responsive third-person camera tracking and building collision.
  3. **Five Genuine Infrastructure Puzzles**: Rather than passive clickers, each sector hosts an interactive engineering puzzle:
     - *Clean Grid Substation*: Circuit conduit alignment and load-balancing switchboard.
     - *Eco-Reservoir Sponge Aquifer*: Hydraulic valve and sluice routing maze.
     - *Traffic Intelligence Command*: Dynamic signal phase timing and green-wave sequencing.
     - *Bio-Resonance Clean Air Hub*: Frequency harmonic matching to neutralize PM2.5 smog plumes.
     - *Trauma Hospital Microgrid*: Emergency triage power distributor balancing ICU lifelines during brownouts.
  4. **Living World Reactivity**: Solving puzzles triggers immediate, visible environmental responses in 3D: substations hum and emit power conduits, reservoir floodwaters recede, traffic congestion clears, clean air corridors sparkle, and street illumination restores.

- **Target Persona & Context**: Students, evaluators, and technology enthusiasts experiencing an ambitious, explainable smart-city simulation for India's Vision 2040 exhibition.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Website 3D City Exploration**:
   - Visitors scroll to "Explore Nexus City in Genuine 3D".
   - The viewport renders the living city with orbital rotation, smooth zooming, 5 cinematic camera presets (Overview, CBD Towers, Solar Grid, Eco-Reservoir, Hospital Hub), time-of-day scrubbers, and live zone telemetry sidebars.
2. **Launching Crisis Explorer**:
   - Clicking "PLAY THE GAME" or navigating to `#game-section` seamlessly reveals the Crisis Commander 3D viewport.
   - Clicking **"ENTER NEXUS CITY"** locks the mouse cursor (pointer-lock), spawns the field engineer on the central boulevard, and introduces the HUD (Compass, Objective Tracker, Stability Meter, Energy Reserves).
3. **Navigating to Active Crises**:
   - Active waypoint beacons in the 3D sky and on the top-screen 360° compass guide the player to distressed infrastructure facilities.
4. **Interacting & Solving Puzzles**:
   - Approaching a terminal displays an in-world prompt: `[E] ACCESS SUBSTATION CONDUIT MATRIX`.
   - Pressing `E` unlocks the mouse and opens an ergonomic, tactile puzzle interface.
   - Completing the puzzle restores that sector, rewards the player with stability points and compute capacity, triggers local 3D environmental restoration effects, and updates the overall quest progression.
5. **Metropolitan Harmonization (Victory)**:
   - Restoring all 5 sectors activates the Central Arcology Core, presenting a cinematic victory debrief with efficiency rating and operational certification.

#### Visual Identity & Styling
- **Aesthetic Direction**: Apple-inspired cinematic minimalism meets high-tech cyber-infrastructure. Deep midnight slate canvas (`#060b13`), cool architectural glass tones, crisp tabular typography, and calibrated accent signals (Emerald `#35d399` for stable systems, Amber `#f2a93b` for warning states, Crimson `#ff5d5d` for critical faults, and Cyan `#28d9ec` for active cybernetic data).
- **HUD & Overlay Ergonomics**: Non-occluding floating HUD elements: top navigational compass strip, compact bottom-left sector vital status, bottom-center keybind prompt bar, and top-right objective checklist.

---

### 3. Key Product Decisions & Trade-Offs

- **Unified Single City Generator (`cityBuilder3D.ts`)**:
  - *Chosen Approach*: Share the exact procedural city geometry and materials between the website preview (`City3DSection.tsx`) and the playable game (`ThirdPersonGame.tsx`).
  - *Rationale*: Fulfills the strict requirement that both views showcase the exact same world without loading separate redundant assets or fragmenting visual fidelity.
- **Procedural Articulated 3D Character Model**:
  - *Chosen Approach*: Build a composite procedural character (`THREE.Group`) with articulated torso, head visor, upper/lower arms, cybernetic hands, pelvis, thighs, shins, boots, and jet thruster backpack using high-quality PBR materials and procedural canvas decals.
  - *Rationale*: Eliminates fragile external `.glb` downloads or 404 network failures, ensuring instant offline startup and zero loading latency.
- **Pointer-Lock Third-Person Controller with Camera Raycast**:
  - *Chosen Approach*: Use pointer-lock mouse look with spherical coordinate damping (`yaw`, `pitch`, `distance`) combined with multi-point sphere/raycast checks against city bounding boxes so the camera never clips through skyscraper walls.
  - *Rationale*: Delivers modern AAA action-adventure ergonomics while maintaining comfortable sightlines.
- **Deterministic 2D Canvas / Interactive Puzzles**:
  - *Chosen Approach*: Implement puzzles as dedicated responsive modal overlays featuring real interactive puzzles (circuit rotating tiles, hydraulic pipe routing, signal timing curves, audio-visual harmonic matching).
  - *Rationale*: Guarantees high-framerate gameplay on all devices, accessible touch/keyboard controls, and verifiable puzzle logic.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             NEXUS 2040 APPLICATION                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌───────────────────────────────────┐               ┌───────────────────────────────────┐
│     WEBSITE 3D PREVIEW            │               │      CRISIS EXPLORER (3D GAME)    │
│     (src/components/City3DSection)│               │  (src/components/CrisisGame3D)    │
│  - OrbitControls Inspection       │               │  - Third-Person Camera & Controls │
│  - Cinematic Camera Presets       │               │  - Articulated Exoskeleton Hero   │
│  - Zone Telemetry & Inspection    │               │  - 3D Collision & Waypoint Beacons│
└─────────────────┬─────────────────┘               └─────────────────┬─────────────────┘
                  │                                                   │
                  └─────────────────────────┬─────────────────────────┘
                                            │
                                            ▼
                  ┌───────────────────────────────────────────────────┐
                  │          UNIFIED 3D CITY ENGINE                   │
                  │         (src/utils/cityBuilder3D.ts)              │
                  │  - Skyscraper Silhouettes & Window Facades        │
                  │  - Multilane Asphalt Roads & Sidewalks            │
                  │  - Moving Vehicle Traffic & Animated Maglev       │
                  │  - Substations, Solar Array, Reservoirs, Hospital │
                  │  - Environmental Day/Night & Lighting Shaders     │
                  └─────────────────────────┬─────────────────────────┘
                                            │
                                            ▼
                  ┌───────────────────────────────────────────────────┐
                  │       INTERACTIVE PUZZLE & PROGRESSION MATRIX     │
                  │          (src/components/puzzles/*)               │
                  │  [1] Power Grid Conduit Switchboard               │
                  │  [2] Hydraulic Sluice Aquifer Routing             │
                  │  [3] Traffic Green-Wave Waveform Sequencing       │
                  │  [4] Bio-Resonance Smog Scrubber Calibration      │
                  │  [5] Trauma Hospital Emergency Microgrid Triage   │
                  └───────────────────────────────────────────────────┘
```

#### State & Entity Mapping

| Entity / System | Location / File | Purpose & Handlers |
| :--- | :--- | :--- |
| `City3DScene` | `src/utils/cityBuilder3D.ts` | Core procedural 3D world generator with lighting, vehicles, collision volumes, and sector zones. |
| `CharacterController` | `src/utils/characterController.ts` | Manages player position, velocity, jump physics, collision resolution with city boxes, and skeletal animation blending (idle, walk, run, jump). |
| `ThirdPersonCamera` | `src/utils/thirdPersonCamera.ts` | Computes behind-the-shoulder follow position with mouse yaw/pitch, collision raycast standoff, and camera damping. |
| `CrisisCommanderGame` | `src/components/CrisisCommanderGame.tsx` | Main game view, mounting the 3D canvas, HUD, waypoint indicators, interaction prompt trigger (`distance < 5m`), and puzzle modal host. |
| `City3DSection` | `src/components/City3DSection.tsx` | Updated website section using `cityBuilder3D.ts` for consistent visual architecture, camera presets, and zone telemetry. |
| `PuzzleModules` | `src/components/puzzles/` | Modular interactive components for the 5 infrastructure challenges with instant feedback, reset, and solve callbacks. |
| `AudioSynthesizer` | `src/utils/audio.ts` | Synthesizes footsteps, thruster bursts, terminal interaction chimes, puzzle rotation clicks, and restoration fanfares. |

---

### Step-by-Step Implementation Sequence

1. **Modularize & Export City Collision Volumes in `cityBuilder3D.ts`**:
   - Expose city bounding boxes and zone terminal coordinates for player collision detection and waypoint positioning.
2. **Replace Website Preview in `City3DSection.tsx`**:
   - Refactor `City3DSection.tsx` to mount and drive the unified `buildProceduralCity` engine with full camera preset navigation, day/night lighting, and contextual telemetry sidebar.
3. **Develop Articulated Cybernetic Character & Controller (`characterController.ts`)**:
   - Build procedural multi-part exoskeleton model with animated limb swings, jump thrusters, and smooth acceleration/damping.
   - Implement AABB / capsule collision against ground and building obstacles.
4. **Develop Third-Person Follow Camera (`thirdPersonCamera.ts`)**:
   - Implement pointer-lock mouse look, crosshair reticle, pitch clamp, and obstacle raycast collision avoidance.
5. **Construct Five Interactive Puzzle Interfaces (`src/components/puzzles/`)**:
   - Create Circuit Switchboard, Sluice Valve Routing, Green-Wave Signal Timing, Smog Harmonic Scrubber, and Hospital ICU Microgrid Triage with interactive state machines and responsive controls.
6. **Implement Progression & Living World Reactivity in `CrisisCommanderGame.tsx`**:
   - Wire waypoint beacons, objective compass, interaction prompts (`E`), puzzle completion rewards, and dynamic 3D environmental changes.
7. **End-to-End Verification**:
   - Test in browser using `playwright-cli`, verify character movement, jumping, terminal interaction, puzzle solutions, camera collision, and zero console errors. Run `compile_applet` and `lint_applet`.
