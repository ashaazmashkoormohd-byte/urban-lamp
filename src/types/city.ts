export type MetricStatus = 'good' | 'moderate' | 'critical';

export interface CityMetrics {
  traffic: number;
  renewable: number;
  water: number;
  aqi: number;
  demand: number;
  supply: number;
}

export interface CityState {
  tick: number;
  simRunning: boolean;
  temperature: number;
  metrics: CityMetrics;
  hospitalLoad: number;
  population: number;
  budgets: {
    infra: number;
    infraMax: number;
    response: number;
    responseMax: number;
  };
  activeEmergency: {
    id: string;
    startedTick: number;
  } | null;
  timeOfDay: number; // 0-24
  autoTime: boolean;
}

export interface MetricComparison {
  traffic: number;
  renewable: number;
  water: number;
  aqi: number;
  demand: number;
  supply: number;
  temperature: number;
  hospitalLoad: number;
}

export interface OptimizationRule {
  id: string;
  title: string;
  severity: 'warning' | 'critical' | 'good' | 'info';
  cost: number;
  condition: (s: CityState) => boolean;
  detect: (s: CityState) => string;
  apply: (s: CityState, factor: number) => void;
}

export interface EmergencyDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  responseCost: number;
  responseTitle: string;
  trigger: (s: CityState) => void;
  response: (s: CityState, factor: number) => void;
}

export interface ScenarioPreset {
  id: string;
  label: string;
  blurb: string;
  temperature: number;
  hospitalLoad: number;
  metrics: CityMetrics;
}

export interface LogEntry {
  id: string;
  time: string;
  severity: 'good' | 'warning' | 'critical' | 'info';
  tag: string;
  title: string;
  detail: string;
}

export interface ZoneDetail {
  id: string;
  title: string;
  tag: string;
  desc: string;
  stats: { label: string; value: string; status?: MetricStatus }[];
}

export type CameraPreset = 'overview' | 'cbd' | 'solar' | 'reservoir' | 'hospital';

export interface LayerVisibility {
  roads: boolean;
  electricity: boolean;
  water: boolean;
  transit: boolean;
  buildings: boolean;
}
