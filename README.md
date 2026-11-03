# NEXUS 2040 — India's AI City Intelligence System

NEXUS 2040 is an interactive metropolitan intelligence digital twin and rule-based simulation engine built for India's Vision 2040. It models a sustainable, net-zero megacity ("Nexus City") of 10 million citizens, demonstrating transparent, deterministic urban governance across competing climate, traffic, and energy constraints.

## Tech Stack & Architecture

- **Framework**: React 19 + TypeScript + Vite
- **3D Engine**: Three.js with OrbitControls, directional day/night sun cycle, dynamic mesh state rendering, particle systems (heatwave fire, flood rain, AQI smog), and raycast zone inspection
- **Design System**: Apple-inspired frosted glass styling, cyber-civic palette, responsive bento grids, and high-DPI canvas charts
- **Simulation Logic**: Deterministic if/else rule engine with auditable thresholds, finite 100-unit infrastructure economy, and multi-hazard emergency sandbox

## Key Features

1. **Interactive 3D Digital Twin**:
   - Orbit controls with 5 cinematic camera presets (Overview, CBD, Solar Grid, Eco-Reservoir, Hospital Hub)
   - Day/night lighting slider (0–24h) and auto day-night cycle
   - Layer toggles (Roads, Electricity, Water, Transit, Buildings)
   - Interactive zone picking displaying localized telemetry streams

2. **Operations & Command Suite**:
   - **Live Metrics**: Real-time traffic, renewable grid share, water reserves, AQI, and demand margin with live sparklines
   - **Decision Engine**: Traceable advisory recommendations and timestamped public audit log
   - **Optimization Engine**: Spends from a finite 100-unit budget to resolve crises with before/after comparison graphs
   - **Crisis Sandbox**: Trigger and mitigate Heatwaves, Monsoons/Floods, Traffic Jams, and Power Shortages
   - **Scenario Presets**: Normal Operations, Heatwave Crisis, Monsoon Flooding, Festival Traffic Surge, Grid Overload
   - **2D Topo Map**: Parchment-style map with elevation contour lines and watercolor zone status halos

3. **Future Simulator (2026–2040)**:
   - Dynamic canvas graph comparing baseline degradation vs AI-optimized trajectory
   - Milestone timeline for 2028, 2030, 2033, 2036, and 2040 targets

4. **NEXUS 2040: City Rescue**:
   - Interactive 2D emergency response driving mini-game
   - Navigate autonomous emergency response units to 3 critical infrastructure waypoints within the time limit

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run TypeScript checks
npm run lint
```