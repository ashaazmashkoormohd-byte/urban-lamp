import { CityState, EmergencyDef, OptimizationRule, ScenarioPreset } from '../types/city';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundVal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function trafficStatus(v: number): 'good' | 'moderate' | 'critical' {
  return v <= 40 ? 'good' : v <= 65 ? 'moderate' : 'critical';
}

export function renewableStatus(v: number): 'good' | 'moderate' | 'critical' {
  return v >= 70 ? 'good' : v >= 45 ? 'moderate' : 'critical';
}

export function waterStatus(v: number): 'good' | 'moderate' | 'critical' {
  return v >= 55 ? 'good' : v >= 30 ? 'moderate' : 'critical';
}

export function aqiStatus(v: number): 'good' | 'moderate' | 'critical' {
  return v <= 100 ? 'good' : v <= 200 ? 'moderate' : 'critical';
}

export function marginStatus(supply: number, demand: number): 'good' | 'moderate' | 'critical' {
  const margin = supply - demand;
  return margin >= 15 ? 'good' : margin >= 0 ? 'moderate' : 'critical';
}

export const OPTIMIZATION_RULES: OptimizationRule[] = [
  {
    id: 'RULE-TRAFFIC-01',
    title: 'Adaptive Traffic Signal Control',
    severity: 'warning',
    cost: 8,
    condition: (s: CityState) => s.metrics.traffic > 65,
    detect: (s: CityState) => `Traffic congestion at ${roundVal(s.metrics.traffic)}% exceeds the 65% threshold.`,
    apply: (s: CityState, f: number) => {
      s.metrics.traffic = clamp(s.metrics.traffic - 50 * f, 5, 100);
      s.metrics.aqi = clamp(s.metrics.aqi - 7.5 * f, 0, 500);
    },
  },
  {
    id: 'RULE-SOLAR-02',
    title: 'Scale Up Solar Farm Output',
    severity: 'warning',
    cost: 12,
    condition: (s: CityState) => s.metrics.renewable < 55 && s.metrics.supply < 97,
    detect: (s: CityState) => `Renewable share at ${roundVal(s.metrics.renewable)}% is below the 55% target.`,
    apply: (s: CityState, f: number) => {
      s.metrics.renewable = clamp(s.metrics.renewable + 47.2 * f, 0, 95);
      s.metrics.supply = clamp(s.metrics.supply + 5.6 * f, 0, 100);
    },
  },
  {
    id: 'RULE-WATER-03',
    title: 'Recycling & Rainwater Harvesting',
    severity: 'warning',
    cost: 10,
    condition: (s: CityState) => s.metrics.water < 40,
    detect: (s: CityState) => `Water reserves at ${roundVal(s.metrics.water)}% are below the 40% safety margin.`,
    apply: (s: CityState, f: number) => {
      s.metrics.water = clamp(s.metrics.water + 36.0 * f, 0, 95);
    },
  },
  {
    id: 'RULE-AQI-04',
    title: 'Emission Control & Green Corridors',
    severity: 'critical',
    cost: 9,
    condition: (s: CityState) => s.metrics.aqi > 150,
    detect: (s: CityState) => `AQI at ${roundVal(s.metrics.aqi)} exceeds the 150 threshold for poor air quality.`,
    apply: (s: CityState, f: number) => {
      s.metrics.aqi = clamp(s.metrics.aqi - 125 * f, 20, 500);
      s.metrics.traffic = clamp(s.metrics.traffic - 7.7 * f, 0, 100);
    },
  },
  {
    id: 'RULE-GRID-05',
    title: 'Battery Storage & Demand Response',
    severity: 'critical',
    cost: 15,
    condition: (s: CityState) => (s.metrics.supply - s.metrics.demand) < 10,
    detect: (s: CityState) => `Grid margin at ${roundVal(s.metrics.supply - s.metrics.demand)} points is below the safe 10-point threshold.`,
    apply: (s: CityState, f: number) => {
      s.metrics.supply = clamp(s.metrics.supply + 40.0 * f, 0, 100);
      s.metrics.demand = clamp(s.metrics.demand - 29.4 * f, 30, 100);
    },
  },
  {
    id: 'RULE-HEAT-06',
    title: 'Urban Cooling & Reflective Infrastructure',
    severity: 'warning',
    cost: 12,
    condition: (s: CityState) => s.temperature > 38,
    detect: (s: CityState) => `Ambient temperature at ${roundVal(s.temperature)}°C exceeds the 38°C threshold.`,
    apply: (s: CityState, f: number) => {
      s.temperature = clamp(s.temperature - 8.0 * f, 15, 50);
      s.hospitalLoad = clamp(s.hospitalLoad - 10.1 * f, 0, 100);
    },
  },
  {
    id: 'RULE-HEALTH-07',
    title: 'Mobile Health Surge Units & Telemedicine',
    severity: 'critical',
    cost: 14,
    condition: (s: CityState) => s.hospitalLoad > 70,
    detect: (s: CityState) => `Hospital load at ${roundVal(s.hospitalLoad)}% exceeds the 70% safe-capacity threshold.`,
    apply: (s: CityState, f: number) => {
      s.hospitalLoad = clamp(s.hospitalLoad - 55.0 * f, 0, 100);
    },
  },
];

export const EMERGENCIES: Record<string, EmergencyDef> = {
  heatwave: {
    id: 'heatwave',
    label: 'Heatwave',
    description: 'Extreme temperatures are spiking cooling demand and straining the grid.',
    icon: '☀️',
    responseCost: 20,
    responseTitle: 'Cooling Centers & Peak Load Shift',
    trigger: (s: CityState) => {
      s.temperature = clamp(s.temperature + 14, 20, 50);
      s.metrics.demand = clamp(s.metrics.demand + 22, 0, 100);
      s.metrics.water = clamp(s.metrics.water - 12, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi + 25, 0, 500);
      s.hospitalLoad = clamp(s.hospitalLoad + 18, 0, 100);
    },
    response: (s: CityState, f: number) => {
      s.temperature = clamp(s.temperature - 7 * f, 20, 50);
      s.metrics.demand = clamp(s.metrics.demand - 15 * f, 0, 100);
      s.hospitalLoad = clamp(s.hospitalLoad - 13 * f, 0, 100);
      s.metrics.water = clamp(s.metrics.water + 4 * f, 0, 100);
    },
  },
  flood: {
    id: 'flood',
    label: 'Flood',
    description: 'Monsoon flooding is disrupting roads and contaminating water treatment.',
    icon: '🌊',
    responseCost: 22,
    responseTitle: 'Drainage Pumps & Emergency Rerouting',
    trigger: (s: CityState) => {
      s.metrics.traffic = clamp(s.metrics.traffic + 34, 0, 100);
      s.metrics.water = clamp(s.metrics.water - 18, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi + 15, 0, 500);
      s.hospitalLoad = clamp(s.hospitalLoad + 24, 0, 100);
    },
    response: (s: CityState, f: number) => {
      s.metrics.traffic = clamp(s.metrics.traffic - 22 * f, 0, 100);
      s.metrics.water = clamp(s.metrics.water + 14 * f, 0, 100);
      s.hospitalLoad = clamp(s.hospitalLoad - 15 * f, 0, 100);
    },
  },
  traffic: {
    id: 'traffic',
    label: 'Traffic Jam',
    description: 'A sudden surge in congestion is worsening air quality citywide.',
    icon: '🚦',
    responseCost: 14,
    responseTitle: 'Dynamic Rerouting & Traffic Marshals',
    trigger: (s: CityState) => {
      s.metrics.traffic = clamp(s.metrics.traffic + 38, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi + 18, 0, 500);
    },
    response: (s: CityState, f: number) => {
      s.metrics.traffic = clamp(s.metrics.traffic - 27 * f, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi - 9 * f, 0, 500);
    },
  },
  power: {
    id: 'power',
    label: 'Power Shortage',
    description: 'A generation shortfall has pushed grid supply below a safe demand margin.',
    icon: '⚡',
    responseCost: 18,
    responseTitle: 'Backup Grid & Load Shedding Protocol',
    trigger: (s: CityState) => {
      s.metrics.supply = clamp(s.metrics.supply - 28, 10, 100);
      s.hospitalLoad = clamp(s.hospitalLoad + 10, 0, 100);
    },
    response: (s: CityState, f: number) => {
      s.metrics.supply = clamp(s.metrics.supply + 21 * f, 0, 100);
      s.metrics.demand = clamp(s.metrics.demand - 10 * f, 0, 100);
    },
  },
};

export const PRESETS: Record<string, ScenarioPreset> = {
  normal: {
    id: 'normal',
    label: 'Normal Operations',
    blurb: 'Healthy baseline conditions restored.',
    temperature: 33,
    hospitalLoad: 28,
    metrics: { traffic: 38, renewable: 64, water: 70, aqi: 78, demand: 60, supply: 88 },
  },
  heatwaveCrisis: {
    id: 'heatwaveCrisis',
    label: 'Heatwave Crisis',
    blurb: 'Extreme heat is straining the grid and water supply.',
    temperature: 46,
    hospitalLoad: 64,
    metrics: { traffic: 55, renewable: 58, water: 38, aqi: 168, demand: 92, supply: 80 },
  },
  monsoonFlooding: {
    id: 'monsoonFlooding',
    label: 'Monsoon Flooding',
    blurb: 'Flooding has disrupted roads and water treatment.',
    temperature: 27,
    hospitalLoad: 58,
    metrics: { traffic: 81, renewable: 60, water: 34, aqi: 130, demand: 70, supply: 82 },
  },
  festivalTraffic: {
    id: 'festivalTraffic',
    label: 'Festival Traffic Surge',
    blurb: 'Event crowds have pushed congestion and pollution up sharply.',
    temperature: 31,
    hospitalLoad: 40,
    metrics: { traffic: 88, renewable: 62, water: 62, aqi: 176, demand: 75, supply: 85 },
  },
  gridOverload: {
    id: 'gridOverload',
    label: 'Grid Overload',
    blurb: 'Demand is pressing against supply with weak renewable backup.',
    temperature: 35,
    hospitalLoad: 46,
    metrics: { traffic: 50, renewable: 40, water: 58, aqi: 140, demand: 96, supply: 78 },
  },
};

export const FIELD_META: Record<string, { label: string; unit: string; higherIsBetter: boolean }> = {
  traffic:      { label: 'Traffic Congestion',  unit: '%',   higherIsBetter: false },
  renewable:    { label: 'Renewable Share',     unit: '%',   higherIsBetter: true  },
  water:        { label: 'Water Reserves',      unit: '%',   higherIsBetter: true  },
  aqi:          { label: 'Air Quality Index',   unit: ' AQI',higherIsBetter: false },
  demand:       { label: 'Electricity Demand',  unit: '%',   higherIsBetter: false },
  supply:       { label: 'Electricity Supply',  unit: '%',   higherIsBetter: true  },
  temperature:  { label: 'Temperature',         unit: '°C',  higherIsBetter: false },
  hospitalLoad: { label: 'Hospital Load',       unit: '%',   higherIsBetter: false },
};

export const ZONE_DETAILS_MAP: Record<string, { title: string; tag: string; desc: string }> = {
  'res-a': {
    title: 'Residential Sector Alpha',
    tag: 'Zone A-1 · Smart Living',
    desc: 'High-density arcology equipped with passive solar shading, automated greywater recirculation, and rooftop micro-gardens.',
  },
  'res-b': {
    title: 'Residential Sector Beta',
    tag: 'Zone B-2 · Smart Living',
    desc: 'Suburban cluster connected to the autonomous metro viaduct, with distributed heat pumps and permeable stormwater pavements.',
  },
  'cbd': {
    title: 'Central Business District (CBD)',
    tag: 'Zone C-1 · Commercial Core',
    desc: 'Metropolitan commercial epicenter. Dynamically sheds HVAC cooling loads when grid supply margins drop below safe thresholds.',
  },
  'hospital': {
    title: 'Metropolitan Hospital Complex',
    tag: 'Zone H-1 · Critical Care',
    desc: 'Level-1 trauma center with dedicated microgrid feed and battery reserve priority. Automatically triggers triage protocols during climate surges.',
  },
  'solar-a': {
    title: 'Solar Photovoltaic Farm North',
    tag: 'Zone S-1 · Clean Generation',
    desc: 'Bifacial solar array feeding 240 MW into solid-state battery banks, equipped with autonomous dust-clearing robotic wipers.',
  },
  'solar-b': {
    title: 'Solar Photovoltaic Farm East',
    tag: 'Zone S-2 · Clean Generation',
    desc: 'Perovskite-silicon tandem solar field balancing daytime industrial loads across eastern manufacturing corridors.',
  },
  'substation': {
    title: 'Solid-State Power Substation',
    tag: 'Zone E-1 · Grid Distribution',
    desc: 'High-voltage DC distribution node with automated load-shedding switchgear and 120 MWh battery storage synchronization.',
  },
  'reservoir': {
    title: 'Yamuna Eco-Reservoir',
    tag: 'Zone W-1 · Sponge Hydrology',
    desc: 'Subterranean retention basin and surface wetland capable of absorbing 4.5 million litres per monsoon cloudburst in under 120 seconds.',
  },
  'wind': {
    title: 'Ridge Wind Farm',
    tag: 'Zone R-1 · Clean Generation',
    desc: 'Trio of 4.2 MW direct-drive wind turbines harvesting nocturnal thermal drafts to supply continuous baseload clean power.',
  },
  'metro': {
    title: 'Autonomous Transit Hub & Metro Viaduct',
    tag: 'Zone T-1 · Mobility Spine',
    desc: 'Elevated magnetic-levitation corridor moving 85,000 passengers/hour with zero localized emissions and AI signal sequencing.',
  },
  'park-a': {
    title: 'Central Ecological Park',
    tag: 'Zone P-1 · Urban Biosphere',
    desc: 'Native deciduous urban forest acting as an organic carbon sink, reducing ambient urban heat island temperatures by up to 3.8°C.',
  },
  'park-b': {
    title: 'Riverside Wetland Sanctuary',
    tag: 'Zone P-2 · Urban Biosphere',
    desc: 'Engineered bio-retention swales filtering runoff before natural discharge, maintaining localized biodiversity corridors.',
  },
  'roads': {
    title: 'Autonomous Green Corridor Arterials',
    tag: 'Zone R-X · Municipal Transit Arteries',
    desc: 'Dynamic lane-reversal smart roads with embedded inductive EV charging pads and adaptive wave signal sequencing.',
  },
};
