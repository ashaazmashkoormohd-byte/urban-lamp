export type GameMode = 'menu' | 'instructions' | 'playing' | 'paused' | 'victory' | 'defeat' | 'settings';

export interface GameMetrics {
  stability: number; // 0 - 100%
  energy: number;    // 0 - 100%
  water: number;     // 0 - 100%
  traffic: number;   // 0 - 100% (lower is better)
  pollution: number; // 0 - 100% (lower is better)
  compute: number;   // 0 - 100% action capacity
}

export type ProtocolType = 'energy' | 'water' | 'traffic' | 'environment' | 'emergency';

export interface ProtocolDef {
  id: ProtocolType;
  name: string;
  code: string;
  tagline: string;
  description: string;
  cost: number;        // Compute cost
  cooldown: number;    // Seconds
  duration: number;    // Active effect duration in seconds
  icon: string;
  color: string;
  keybind: string;
}

export type CrisisType = 'blackout' | 'flood' | 'gridlock' | 'smog' | 'hospital';

export interface CrisisInstance {
  id: string;
  type: CrisisType;
  title: string;
  sector: string;
  coords: [number, number, number]; // [x, y, z] in 3D world
  severity: 'moderate' | 'severe' | 'critical';
  resolvedBy: ProtocolType;
  spawnTime: number;
  timeRemaining: number; // Seconds until critical collapse
  durationTotal: number;
  description: string;
}

export interface GameStats {
  score: number;
  crisesResolved: number;
  protocolsTriggered: number;
  maxStability: number;
  minStability: number;
  citizensSaved: number;
  rank: 'S+' | 'S' | 'A' | 'B' | 'C';
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  volume: number; // 0 - 1
  cameraSensitivity: number; // 0.5 - 2
  graphicsQuality: 'ultra' | 'high' | 'balanced';
}

export interface SectorObjective {
  id: string;
  stationId: string;
  name: string;
  sector: ProtocolType;
  title: string;
  locationName: string;
  coords: [number, number, number];
  terminalCoords: [number, number, number];
  solved: boolean;
  active: boolean;
  icon: string;
  color: string;
  promptLabel: string;
  briefing: string;
}

export type ActivePuzzleType = 'power_grid' | 'water_network' | 'traffic_timing' | 'air_scrubber' | 'hospital_microgrid' | null;

export interface PlayerControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  interact: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  isGrounded: boolean;
  isSprinting: boolean;
  isMoving: boolean;
  actionState: 'idle' | 'walking' | 'running' | 'jumping' | 'interacting';
}

