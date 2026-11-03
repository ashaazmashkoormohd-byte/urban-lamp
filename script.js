/* =============================================================================
   NEXUS 2040 — India's AI City Intelligence System
   script.js

   IMPORTANT (read this before editing):
   - Every number in this file is SIMULATED. Nothing here reads real sensors,
     real traffic data, or any external API.
   - The "Decision Engine" and "Optimization Engine" below are plain
     deterministic if/else RULE-BASED logic. They are NOT a trained machine
     learning model, and this file makes no claim that they are.
   - File layout:
       1. Utilities
       2. Domain data: optimization rules, emergencies, scenario presets
       3. City state
       4. Decision engine (advisory recommendations)
       5. Optimization engine (applies rules, spends budget)
       6. Emergency simulation engine (applies/resolves crises, spends budget)
       7. Scenario presets
       8. Decision log
       9. Charts (hand-rolled canvas drawing — no external chart library)
      10. City map (3D) glue — talks to city3d.js, owns zone info text
      11. Dashboard / UI rendering
      12. Live simulation ticker
      13. Event wiring + init
   ============================================================================= */


/* ============================= 1. UTILITIES ============================= */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundVal(value) {
  return Math.round(value * 10) / 10;
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function pad2(n) {
  return n.toString().padStart(2, '0');
}

function formatClockTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatTimeOfDay(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${pad2(h)}:${pad2(m)}`;
}

function getTimeOfDayModifier(hours) {
  // Returns a factor (0-1) representing solar availability
  // 0 at night, 1 at noon, with smooth transitions
  if (hours < 6 || hours > 18) return 0;
  if (hours >= 6 && hours < 12) return (hours - 6) / 6;
  if (hours >= 12 && hours <= 18) return 1 - (hours - 12) / 6;
  return 0;
}

function getDemandModifier(hours) {
  // Returns a factor representing energy demand variation
  // Higher in morning (7-9) and evening (18-21), lower at night
  if (hours >= 7 && hours < 9) return 1.2; // Morning peak
  if (hours >= 18 && hours < 21) return 1.3; // Evening peak
  if (hours >= 0 && hours < 6) return 0.6; // Night low
  if (hours >= 22 || hours < 24) return 0.7; // Late night
  return 1.0; // Daytime baseline
}

/* Status thresholds. These are the single source of truth for what counts
   as "good", "moderate" or "critical" across cards, the map and the log. */
function trafficStatus(v)   { return v <= 40 ? 'good' : v <= 65 ? 'moderate' : 'critical'; }
function renewableStatus(v) { return v >= 70 ? 'good' : v >= 45 ? 'moderate' : 'critical'; }
function waterStatus(v)     { return v >= 55 ? 'good' : v >= 30 ? 'moderate' : 'critical'; }
function aqiStatus(v)       { return v <= 100 ? 'good' : v <= 200 ? 'moderate' : 'critical'; }
function marginStatus(supply, demand) {
  const margin = supply - demand;
  return margin >= 15 ? 'good' : margin >= 0 ? 'moderate' : 'critical';
}

function statusColor(status) {
  return status === 'good' ? COLORS.green : status === 'moderate' ? COLORS.amber : COLORS.red;
}

/* Snapshot of just the comparable metrics, used for before/after panels. */
function cloneMetrics(state) {
  return {
    traffic: state.metrics.traffic,
    renewable: state.metrics.renewable,
    water: state.metrics.water,
    aqi: state.metrics.aqi,
    demand: state.metrics.demand,
    supply: state.metrics.supply,
    temperature: state.temperature,
    hospitalLoad: state.hospitalLoad,
  };
}


/* ================== 2. DOMAIN DATA: RULES, EMERGENCIES, PRESETS ================== */

/* --- Optimization rules ---------------------------------------------------
   Each rule explicitly defines: when it fires, what it costs from the
   Infrastructure Budget, and exactly what it changes. If the budget can't
   cover the full cost, `factor` (0–1) scales the effect down proportionally
   — the engine never applies an effect it hasn't paid for.

   Effect sizes are fixed point-deltas (not percentages of the current
   value), which keeps a rule's contribution independent of the order rules
   run in — the same flat amount applies wherever a rule fires. They are
   calibrated so that, starting from the default crisis baseline in
   freshState() with a full 100-unit budget (total cost of all seven rules:
   80, comfortably inside budget), the city reaches the exact exhibition
   demo numbers below. On any OTHER starting state (presets, mid-demo
   drift, a partially spent budget) the exact same formulas run and produce
   whatever they genuinely compute — nothing is special-cased per scenario.

     Metric          Default demo: before -> after   (rule contribution)
     Traffic          89.4 -> 31.7   (-50 TRAFFIC-01, -7.7 AQI-04 secondary)
     Renewable        18.2 -> 65.4   (+47.2 SOLAR-02)
     Water            12.5 -> 48.5   (+36.0 WATER-03)
     AQI               218 -> 85.5   (-125 AQI-04, -7.5 TRAFFIC-01 secondary)
     Demand           94.6 -> 65.2   (-29.4 GRID-05 secondary)
     Supply           52.3 -> 97.9   (+40.0 GRID-05, +5.6 SOLAR-02 secondary)
     Temperature        43 -> 35     (-8.0 HEAT-06)
     Hospital Load    91.7 -> 26.6   (-55.0 HEALTH-07, -10.1 HEAT-06 secondary) */
const OPTIMIZATION_RULES = [
  {
    id: 'RULE-TRAFFIC-01',
    title: 'Adaptive Traffic Signal Control',
    severity: 'warning',
    cost: 8,
    condition: s => s.metrics.traffic > 65,
    detect: s => `Traffic congestion at ${roundVal(s.metrics.traffic)}% exceeds the 65% threshold.`,
    apply: (s, f) => {
      s.metrics.traffic = clamp(s.metrics.traffic - 50 * f, 5, 100);
      s.metrics.aqi = clamp(s.metrics.aqi - 7.5 * f, 0, 500);
    },
  },
  {
    id: 'RULE-SOLAR-02',
    title: 'Scale Up Solar Farm Output',
    severity: 'warning',
    cost: 12,
    condition: s => s.metrics.renewable < 55 && s.metrics.supply < 97,
    detect: s => `Renewable share at ${roundVal(s.metrics.renewable)}% is below the 55% target.`,
    apply: (s, f) => {
      s.metrics.renewable = clamp(s.metrics.renewable + 47.2 * f, 0, 95);
      s.metrics.supply = clamp(s.metrics.supply + 5.6 * f, 0, 100);
    },
  },
  {
    id: 'RULE-WATER-03',
    title: 'Recycling & Rainwater Harvesting',
    severity: 'warning',
    cost: 10,
    condition: s => s.metrics.water < 40,
    detect: s => `Water reserves at ${roundVal(s.metrics.water)}% are below the 40% safety margin.`,
    apply: (s, f) => {
      s.metrics.water = clamp(s.metrics.water + 36.0 * f, 0, 95);
    },
  },
  {
    id: 'RULE-AQI-04',
    title: 'Emission Control & Green Corridors',
    severity: 'critical',
    cost: 9,
    condition: s => s.metrics.aqi > 150,
    detect: s => `AQI at ${roundVal(s.metrics.aqi)} exceeds the 150 threshold for poor air quality.`,
    apply: (s, f) => {
      s.metrics.aqi = clamp(s.metrics.aqi - 125 * f, 20, 500);
      s.metrics.traffic = clamp(s.metrics.traffic - 7.7 * f, 0, 100);
    },
  },
  {
    id: 'RULE-GRID-05',
    title: 'Battery Storage & Demand Response',
    severity: 'critical',
    cost: 15,
    condition: s => (s.metrics.supply - s.metrics.demand) < 10,
    detect: s => `Grid margin at ${roundVal(s.metrics.supply - s.metrics.demand)} points is below the safe 10-point threshold.`,
    apply: (s, f) => {
      s.metrics.supply = clamp(s.metrics.supply + 40.0 * f, 0, 100);
      s.metrics.demand = clamp(s.metrics.demand - 29.4 * f, 30, 100);
    },
  },
  {
    id: 'RULE-HEAT-06',
    title: 'Urban Cooling & Reflective Infrastructure',
    severity: 'warning',
    cost: 12,
    condition: s => s.temperature > 38,
    detect: s => `Ambient temperature at ${roundVal(s.temperature)}°C exceeds the 38°C threshold.`,
    apply: (s, f) => {
      s.temperature = clamp(s.temperature - 8.0 * f, 15, 50);
      s.hospitalLoad = clamp(s.hospitalLoad - 10.1 * f, 0, 100);
    },
  },
  {
    id: 'RULE-HEALTH-07',
    title: 'Mobile Health Surge Units & Telemedicine',
    severity: 'critical',
    cost: 14,
    condition: s => s.hospitalLoad > 70,
    detect: s => `Hospital load at ${roundVal(s.hospitalLoad)}% exceeds the 70% safe-capacity threshold.`,
    apply: (s, f) => {
      s.hospitalLoad = clamp(s.hospitalLoad - 55.0 * f, 0, 100);
    },
  },
];

/* --- Emergency simulations --------------------------------------------- */
const EMERGENCIES = {
  heatwave: {
    id: 'heatwave',
    label: 'Heatwave',
    description: 'Extreme temperatures are spiking cooling demand and straining the grid.',
    trigger: s => {
      s.temperature = clamp(s.temperature + 14, 20, 50);
      s.metrics.demand = clamp(s.metrics.demand + 22, 0, 100);
      s.metrics.water = clamp(s.metrics.water - 12, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi + 25, 0, 500);
      s.hospitalLoad = clamp(s.hospitalLoad + 18, 0, 100);
    },
    responseCost: 20,
    responseTitle: 'Cooling Centers & Peak Load Shift',
    response: (s, f) => {
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
    trigger: s => {
      s.metrics.traffic = clamp(s.metrics.traffic + 34, 0, 100);
      s.metrics.water = clamp(s.metrics.water - 18, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi + 15, 0, 500);
      s.hospitalLoad = clamp(s.hospitalLoad + 24, 0, 100);
    },
    responseCost: 22,
    responseTitle: 'Drainage Pumps & Emergency Rerouting',
    response: (s, f) => {
      s.metrics.traffic = clamp(s.metrics.traffic - 22 * f, 0, 100);
      s.metrics.water = clamp(s.metrics.water + 14 * f, 0, 100);
      s.hospitalLoad = clamp(s.hospitalLoad - 15 * f, 0, 100);
    },
  },
  traffic: {
    id: 'traffic',
    label: 'Traffic Jam',
    description: 'A sudden surge in congestion is worsening air quality citywide.',
    trigger: s => {
      s.metrics.traffic = clamp(s.metrics.traffic + 38, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi + 18, 0, 500);
    },
    responseCost: 14,
    responseTitle: 'Dynamic Rerouting & Traffic Marshals',
    response: (s, f) => {
      s.metrics.traffic = clamp(s.metrics.traffic - 27 * f, 0, 100);
      s.metrics.aqi = clamp(s.metrics.aqi - 9 * f, 0, 500);
    },
  },
  power: {
    id: 'power',
    label: 'Power Shortage',
    description: 'A generation shortfall has pushed grid supply below a safe demand margin.',
    trigger: s => {
      s.metrics.supply = clamp(s.metrics.supply - 28, 10, 100);
      s.hospitalLoad = clamp(s.hospitalLoad + 10, 0, 100);
    },
    responseCost: 18,
    responseTitle: 'Backup Grid & Load Shedding Protocol',
    response: (s, f) => {
      s.metrics.supply = clamp(s.metrics.supply + 21 * f, 0, 100);
      s.metrics.demand = clamp(s.metrics.demand - 10 * f, 0, 100);
    },
  },
};

/* --- Scenario presets ---------------------------------------------------- */
const PRESETS = {
  normal: {
    label: 'Normal Operations',
    blurb: 'Healthy baseline conditions restored.',
    temperature: 33, hospitalLoad: 28,
    metrics: { traffic: 38, renewable: 64, water: 70, aqi: 78, demand: 60, supply: 88 },
  },
  heatwaveCrisis: {
    label: 'Heatwave Crisis',
    blurb: 'Extreme heat is straining the grid and water supply.',
    temperature: 46, hospitalLoad: 64,
    metrics: { traffic: 55, renewable: 58, water: 38, aqi: 168, demand: 92, supply: 80 },
  },
  monsoonFlooding: {
    label: 'Monsoon Flooding',
    blurb: 'Flooding has disrupted roads and water treatment.',
    temperature: 27, hospitalLoad: 58,
    metrics: { traffic: 81, renewable: 60, water: 34, aqi: 130, demand: 70, supply: 82 },
  },
  festivalTraffic: {
    label: 'Festival Traffic Surge',
    blurb: 'Event crowds have pushed congestion and pollution up sharply.',
    temperature: 31, hospitalLoad: 40,
    metrics: { traffic: 88, renewable: 62, water: 62, aqi: 176, demand: 75, supply: 85 },
  },
  gridOverload: {
    label: 'Grid Overload',
    blurb: 'Demand is pressing against supply with weak renewable backup.',
    temperature: 35, hospitalLoad: 46,
    metrics: { traffic: 50, renewable: 40, water: 58, aqi: 140, demand: 96, supply: 78 },
  },
};

/* Table used by the comparison panel — what each field means and whether a
   higher number is good or bad, so deltas can be colour-coded correctly. */
const FIELD_META = {
  traffic:      { label: 'Traffic Congestion',  unit: '%',   higherIsBetter: false },
  renewable:    { label: 'Renewable Share',     unit: '%',   higherIsBetter: true  },
  water:        { label: 'Water Reserves',      unit: '%',   higherIsBetter: true  },
  aqi:          { label: 'Air Quality Index',   unit: ' AQI',higherIsBetter: false },
  demand:       { label: 'Electricity Demand',  unit: '%',   higherIsBetter: false },
  supply:       { label: 'Electricity Supply',  unit: '%',   higherIsBetter: true  },
  temperature:  { label: 'Temperature',         unit: '°C',  higherIsBetter: false },
  hospitalLoad: { label: 'Hospital Load',       unit: '%',   higherIsBetter: false },
};


/* ============================= 3. CITY STATE ============================= */

/* The default/reset state is deliberately a city already in multi-system
   crisis — Nexus City on a bad day — rather than a calm baseline. That's
   the intended exhibition demo: load the page, show the dashboard and 3D
   city in visible distress, then click Optimize City and watch all seven
   rules resolve it in one pass. A calm, healthy city is still available
   any time via the "Normal Operations" preset on the Scenarios tab. */
function freshState() {
  return {
    tick: 0,
    simRunning: true,
    temperature: 43,
    metrics: { traffic: 89.4, renewable: 18.2, water: 12.5, aqi: 218, demand: 94.6, supply: 52.3 },
    hospitalLoad: 91.7,
    population: 2400000,
    budgets: { infra: 100, infraMax: 100, response: 100, responseMax: 100 },
    activeEmergency: null, // { id, startedTick }
    timeOfDay: 12, // 0-24, 12 = noon
    autoTime: true, // Automatic day-night cycle
  };
}

let state = freshState();

const HISTORY_KEYS = ['traffic', 'renewable', 'water', 'aqi', 'demand'];
let HISTORY = emptyHistory();
function emptyHistory() {
  const h = {};
  HISTORY_KEYS.forEach(k => { h[k] = []; });
  return h;
}
function pushHistory() {
  HISTORY_KEYS.forEach(k => {
    const arr = HISTORY[k];
    arr.push(state.metrics[k]);
    if (arr.length > 40) arr.shift();
  });
}


/* ========================= 4. DECISION ENGINE =========================
   Advisory only — looks at current state and lists what it has detected,
   referencing the exact same thresholds the optimization engine uses. This
   is plain rule evaluation, not prediction and not machine learning. */

function getRecommendations(s) {
  const recs = [];

  OPTIMIZATION_RULES.forEach(rule => {
    if (rule.condition(s)) {
      recs.push({ id: rule.id, title: rule.title, severity: rule.severity, detail: rule.detect(s) });
    }
  });

  if (s.hospitalLoad > 70 && !s.activeEmergency) {
    recs.push({
      id: 'OBS-HOSP',
      title: 'Hospital Load Elevated',
      severity: 'warning',
      detail: `Hospital capacity at ${roundVal(s.hospitalLoad)}% with no active emergency on record — monitor closely.`,
    });
  }

  if (s.activeEmergency) {
    const em = EMERGENCIES[s.activeEmergency.id];
    recs.push({
      id: 'EMERGENCY-ACTIVE',
      title: `Active Emergency: ${em.label}`,
      severity: 'critical',
      detail: 'Deploy the emergency response from the Emergencies tab to resolve this.',
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'SYSTEM-NOMINAL',
      title: 'All Systems Nominal',
      severity: 'good',
      detail: 'Every monitored metric is within its healthy threshold range.',
    });
  }

  return recs;
}

/* Tracks which recommendation IDs were present last render, so the log only
   records genuine detections / resolutions instead of repeating every tick. */
let lastRecIds = new Set();
let trackingInitialized = false;

function syncRecommendationTracking() {
  const recs = getRecommendations(state).filter(r => r.id !== 'SYSTEM-NOMINAL' && r.id !== 'EMERGENCY-ACTIVE');
  const currentIds = new Set(recs.map(r => r.id));

  if (!trackingInitialized) {
    lastRecIds = currentIds;
    trackingInitialized = true;
    return;
  }

  recs.forEach(r => {
    if (!lastRecIds.has(r.id)) {
      addLog(r.severity, r.id, 'Condition Detected', `${r.title} — ${r.detail}`);
    }
  });

  lastRecIds.forEach(id => {
    if (!currentIds.has(id)) {
      const rule = OPTIMIZATION_RULES.find(r => r.id === id);
      addLog('info', id, 'Condition Resolved', `${rule ? rule.title : id} no longer detected — metric is back within its threshold.`);
    }
  });

  lastRecIds = currentIds;
}


/* ======================== 5. OPTIMIZATION ENGINE ========================
   Applies OPTIMIZATION_RULES against the current state, spending from the
   finite Infrastructure Budget. If the budget can't cover a rule's full
   cost, the effect is scaled down proportionally (never free, never over
   100% applied) and the log says so explicitly. */

function optimizeCity() {
  const before = cloneMetrics(state);
  let appliedAny = false;

  OPTIMIZATION_RULES.forEach(rule => {
    if (!rule.condition(state)) return;
    appliedAny = true;
    const detectMsg = rule.detect(state);

    if (state.budgets.infra <= 0) {
      addLog('warning', rule.id, `${rule.title} — Skipped`, `${detectMsg} No infrastructure budget remains; action deferred until the budget regenerates.`);
      return;
    }

    let factor = 1;
    let partialNote = '';
    if (state.budgets.infra < rule.cost) {
      factor = state.budgets.infra / rule.cost;
      partialNote = ` Applied partially (${Math.round(factor * 100)}%) — only ${roundVal(state.budgets.infra)} of ${rule.cost} required budget units were available.`;
    }

    const spend = Math.min(rule.cost, state.budgets.infra);
    state.budgets.infra = clamp(state.budgets.infra - spend, 0, state.budgets.infraMax);
    rule.apply(state, factor);

    addLog(rule.severity, rule.id, rule.title, `${detectMsg} Spent ${roundVal(spend)} infrastructure budget to apply this rule.${partialNote}`);
  });

  if (!appliedAny) {
    addLog('good', 'SYSTEM', 'No Action Needed', 'All monitored metrics are within healthy thresholds — optimization was not required.');
  }

  const after = cloneMetrics(state);
  showComparison(before, after, 'City Optimization');
  renderAll();
}


/* ====================== 6. EMERGENCY SIMULATION ENGINE ======================
   Triggering an emergency applies an immediate adverse change to the city
   (the "before" state for the eventual response). Deploying a response
   spends from the separate Response Capacity budget, with the same
   partial-application safeguard as the optimizer. Only one emergency can be
   active at a time, to keep cause and effect legible during a demo. */

function triggerEmergency(id) {
  if (state.activeEmergency) {
    const activeLabel = EMERGENCIES[state.activeEmergency.id].label;
    addLog('warning', 'SYSTEM', 'Emergency Already Active', `Cannot trigger ${EMERGENCIES[id].label}: resolve the active ${activeLabel} first.`);
    renderAll();
    return;
  }

  const em = EMERGENCIES[id];
  em.trigger(state);
  state.activeEmergency = { id, startedTick: state.tick };
  addLog('critical', id.toUpperCase(), `${em.label} Detected`, em.description);
  renderAll();
}

function deployResponse() {
  if (!state.activeEmergency) return; // guard, in addition to the disabled button

  const em = EMERGENCIES[state.activeEmergency.id];
  const before = cloneMetrics(state);

  if (state.budgets.response <= 0) {
    addLog('warning', em.id.toUpperCase(), 'Response Blocked', 'No Emergency Response Capacity remains — wait for it to regenerate, or reset the city.');
    renderAll();
    return;
  }

  let factor = 1;
  let partialNote = '';
  if (state.budgets.response < em.responseCost) {
    factor = state.budgets.response / em.responseCost;
    partialNote = ` (partial response — ${Math.round(factor * 100)}% of the planned effect, limited by available capacity)`;
  }

  const spend = Math.min(em.responseCost, state.budgets.response);
  state.budgets.response = clamp(state.budgets.response - spend, 0, state.budgets.responseMax);
  em.response(state, factor);
  state.activeEmergency = null;

  const after = cloneMetrics(state);
  addLog('good', em.id.toUpperCase(), em.responseTitle, `Deployed in response to ${em.label}${partialNote}. Spent ${roundVal(spend)} response capacity.`);
  showComparison(before, after, `${em.label} Response`);
  renderAll();
}


/* =========================== 7. SCENARIO PRESETS =========================== */

function applyScenario(key) {
  const preset = PRESETS[key];
  if (!preset) return;

  state.temperature = preset.temperature;
  state.metrics = { ...preset.metrics };
  state.hospitalLoad = preset.hospitalLoad;
  state.activeEmergency = null;
  state.budgets.infra = state.budgets.infraMax;
  state.budgets.response = state.budgets.responseMax;

  clearComparison();
  addLog('info', 'SCENARIO', preset.label, `Preset loaded — ${preset.blurb}`);
  highlightScenario(key);
  renderAll();
}

/* =========================== 8. DECISION LOG ============================ */

let logEntries = []; // newest first

function addLog(severity, tag, title, detail) {
  logEntries.unshift({ time: formatClockTime(new Date()), severity, tag, title, detail });
  if (logEntries.length > 200) logEntries.pop();
  renderLogPanel();
}

function renderLogPanel() {
  const el = document.getElementById('decisionLog');
  if (logEntries.length === 0) {
    el.innerHTML = '<div class="log-empty">No events yet. Trigger a scenario or run an optimization to populate the log.</div>';
    return;
  }
  el.innerHTML = logEntries.map(e => (
    `<div class="log-entry ${e.severity}"><span class="log-time">[${e.time}]</span> <span class="log-tag">${e.tag}</span> — <strong>${e.title}:</strong> ${e.detail}</div>`
  )).join('');
}

function clearLog() {
  logEntries = [];
  renderLogPanel();
  addLog('info', 'SYSTEM', 'Log Cleared', 'Decision log cleared by operator.');
}

/* =========================== 11. 2D MAP RENDERER =========================== */

let map2dCanvas = null;
let map2dCtx = null;
const map2dZones = [];

// 2D Map zoom/pan state
let map2dState = {
  zoom: 1,
  panX: 450,
  panY: 300,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0
};

function initMap2D() {
  map2dCanvas = document.getElementById('map2dCanvas');
  if (!map2dCanvas) return;
  map2dCtx = map2dCanvas.getContext('2d');

  // Define zones for 2D map (BotW-style layout)
  const scale = 4;
  const offsetX = 450;
  const offsetY = 300;

  map2dZones.push(
    { id: 'res-a', x: offsetX + (-61) * scale, y: offsetY + (-40) * scale, w: 35, h: 35, type: 'residential', label: 'Residential A' },
    { id: 'cbd', x: offsetX + (-17) * scale, y: offsetY + (-40) * scale, w: 35, h: 35, type: 'cbd', label: 'CBD' },
    { id: 'res-b', x: offsetX + (17) * scale, y: offsetY + (-40) * scale, w: 35, h: 35, type: 'residential', label: 'Residential B' },
    { id: 'park-a', x: offsetX + (61) * scale, y: offsetY + (-40) * scale, w: 35, h: 35, type: 'park', label: 'Central Park' },
    { id: 'hospital', x: offsetX + (-61) * scale, y: offsetY + (0) * scale, w: 35, h: 35, type: 'hospital', label: 'City Hospital' },
    { id: 'solar-a', x: offsetX + (-17) * scale, y: offsetY + (0) * scale, w: 35, h: 35, type: 'solar', label: 'Solar Farm North' },
    { id: 'solar-b', x: offsetX + (17) * scale, y: offsetY + (0) * scale, w: 35, h: 35, type: 'solar', label: 'Solar Farm East' },
    { id: 'substation', x: offsetX + (61) * scale, y: offsetY + (0) * scale, w: 35, h: 35, type: 'power', label: 'Substation' },
    { id: 'reservoir', x: offsetX + (-61) * scale, y: offsetY + (34) * scale, w: 35, h: 35, type: 'water', label: 'Reservoir' },
    { id: 'wind', x: offsetX + (-17) * scale, y: offsetY + (34) * scale, w: 35, h: 35, type: 'wind', label: 'Wind Farm' },
    { id: 'metro', x: offsetX + (17) * scale, y: offsetY + (34) * scale, w: 35, h: 35, type: 'transit', label: 'Metro Hub' },
    { id: 'park-b', x: offsetX + (61) * scale, y: offsetY + (34) * scale, w: 35, h: 35, type: 'park', label: 'Riverside Park' }
  );

  // Mouse wheel zoom
  map2dCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = clamp(map2dState.zoom * delta, 0.5, 3);
    
    // Zoom towards mouse position
    const rect = map2dCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = newZoom / map2dState.zoom;
    map2dState.panX = mouseX - (mouseX - map2dState.panX) * zoomFactor;
    map2dState.panY = mouseY - (mouseY - map2dState.panY) * zoomFactor;
    map2dState.zoom = newZoom;
    
    renderMap2D();
  });

  // Mouse drag to pan
  map2dCanvas.addEventListener('mousedown', (e) => {
    map2dState.isDragging = true;
    map2dState.lastMouseX = e.clientX;
    map2dState.lastMouseY = e.clientY;
    map2dCanvas.style.cursor = 'grabbing';
  });

  map2dCanvas.addEventListener('mousemove', (e) => {
    if (!map2dState.isDragging) return;
    const dx = e.clientX - map2dState.lastMouseX;
    const dy = e.clientY - map2dState.lastMouseY;
    map2dState.panX += dx;
    map2dState.panY += dy;
    map2dState.lastMouseX = e.clientX;
    map2dState.lastMouseY = e.clientY;
    renderMap2D();
  });

  map2dCanvas.addEventListener('mouseup', () => {
    map2dState.isDragging = false;
    map2dCanvas.style.cursor = 'grab';
  });

  map2dCanvas.addEventListener('mouseleave', () => {
    map2dState.isDragging = false;
    map2dCanvas.style.cursor = 'grab';
  });

  map2dCanvas.style.cursor = 'grab';

  // Zoom control buttons
  document.getElementById('map2dZoomIn').addEventListener('click', () => {
    map2dState.zoom = clamp(map2dState.zoom * 1.2, 0.5, 3);
    renderMap2D();
  });

  document.getElementById('map2dZoomOut').addEventListener('click', () => {
    map2dState.zoom = clamp(map2dState.zoom / 1.2, 0.5, 3);
    renderMap2D();
  });

  document.getElementById('map2dReset').addEventListener('click', () => {
    map2dState.zoom = 1;
    map2dState.panX = 450;
    map2dState.panY = 300;
    renderMap2D();
  });

  // Initial render
  renderMap2D();

  // Update on tab switch
  const originalSwitchTab = window.switchTab;
  window.switchTab = function(tabName) {
    if (originalSwitchTab) originalSwitchTab(tabName);
    if (tabName === 'map2d') renderMap2D();
  };
}

function renderMap2D() {
  if (!map2dCtx) return;

  const w = map2dCanvas.width;
  const h = map2dCanvas.height;

  // Clear canvas
  map2dCtx.clearRect(0, 0, w, h);

  // Apply zoom and pan transformations
  map2dCtx.save();
  map2dCtx.translate(map2dState.panX, map2dState.panY);
  map2dCtx.scale(map2dState.zoom, map2dState.zoom);
  map2dCtx.translate(-w/2, -h/2);

  // ===== PARCHMENT BACKGROUND =====
  // Create textured parchment effect
  const parchmentGradient = map2dCtx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/1.5);
  parchmentGradient.addColorStop(0, '#f4e4c1');
  parchmentGradient.addColorStop(0.3, '#e8d4a8');
  parchmentGradient.addColorStop(0.7, '#d4c094');
  parchmentGradient.addColorStop(1, '#c4b084');
  map2dCtx.fillStyle = parchmentGradient;
  map2dCtx.fillRect(0, 0, w, h);

  // Add paper texture noise
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = Math.random() * 2;
    map2dCtx.fillStyle = `rgba(139, 119, 82, ${Math.random() * 0.1})`;
    map2dCtx.fillRect(x, y, size, size);
  }

  // Add aged paper stains
  const stainGradient = map2dCtx.createRadialGradient(w * 0.8, h * 0.2, 0, w * 0.8, h * 0.2, 200);
  stainGradient.addColorStop(0, 'rgba(139, 119, 82, 0.15)');
  stainGradient.addColorStop(1, 'rgba(139, 119, 82, 0)');
  map2dCtx.fillStyle = stainGradient;
  map2dCtx.fillRect(0, 0, w, h);

  // ===== TOPOGRAPHIC CONTOUR LINES =====
  map2dCtx.strokeStyle = 'rgba(101, 67, 33, 0.15)';
  map2dCtx.lineWidth = 1.5;

  for (let elevation = 0; elevation < 5; elevation++) {
    const baseOffset = elevation * 40;
    map2dCtx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      const radius = 200 + baseOffset + Math.sin(angle * 3) * 30 + Math.cos(angle * 5) * 20;
      const x = w/2 + Math.cos(angle) * radius;
      const y = h/2 + Math.sin(angle) * radius * 0.7;
      if (angle === 0) map2dCtx.moveTo(x, y);
      else map2dCtx.lineTo(x, y);
    }
    map2dCtx.closePath();
    map2dCtx.stroke();
  }

  // ===== HAND-DRAWN ROADS =====
  map2dCtx.strokeStyle = '#8b7355';
  map2dCtx.lineWidth = 12;
  map2dCtx.lineCap = 'round';
  map2dCtx.lineJoin = 'round';

  // Draw wavy roads (hand-drawn effect)
  const drawWavyLine = (x1, y1, x2, y2) => {
    map2dCtx.beginPath();
    map2dCtx.moveTo(x1, y1);
    const segments = 20;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      const offset = Math.sin(t * Math.PI * 4) * 3;
      if (i === 1) map2dCtx.lineTo(x, y + offset);
      else map2dCtx.lineTo(x, y + offset);
    }
    map2dCtx.stroke();
  };

  // Vertical roads
  [-34, 0, 34].forEach(x => {
    const roadX = 450 + x * 4;
    drawWavyLine(roadX, 40, roadX, h - 40);
  });

  // Horizontal roads
  [-18, 18].forEach(z => {
    const roadY = 300 + z * 4;
    drawWavyLine(40, roadY, w - 40, roadY);
  });

  // Road center lines (dashed)
  map2dCtx.strokeStyle = '#a67c52';
  map2dCtx.lineWidth = 2;
  map2dCtx.setLineDash([8, 8]);
  [-34, 0, 34].forEach(x => {
    const roadX = 450 + x * 4;
    drawWavyLine(roadX, 40, roadX, h - 40);
  });
  [-18, 18].forEach(z => {
    const roadY = 300 + z * 4;
    drawWavyLine(40, roadY, w - 40, roadY);
  });
  map2dCtx.setLineDash([]);

  // ===== WATERCOLOR ZONES =====
  map2dZones.forEach(zone => {
    let baseColor, statusBorder;

    // Get zone status
    const m = state.metrics;
    let status = 'good';
    if (zone.type === 'residential' || zone.type === 'cbd') {
      status = trafficStatus(m.traffic);
    } else if (zone.type === 'solar' || zone.type === 'wind') {
      status = renewableStatus(m.renewable);
    } else if (zone.type === 'water') {
      status = waterStatus(m.water);
    } else if (zone.type === 'power') {
      status = marginStatus(m.supply, m.demand);
    }

    switch (status) {
      case 'good': statusBorder = '#4a7c59'; break;
      case 'moderate': statusBorder = '#c4a35a'; break;
      case 'critical': statusBorder = '#b84949'; break;
      default: statusBorder = '#4a8fa8';
    }

    switch (zone.type) {
      case 'residential': baseColor = '#6b8cae'; break;
      case 'cbd': baseColor = '#7a9bbd'; break;
      case 'hospital': baseColor = '#d4a574'; break;
      case 'solar': baseColor = '#7cb97c'; break;
      case 'power': baseColor = '#d4a574'; break;
      case 'water': baseColor = '#6bb3d4'; break;
      case 'wind': baseColor = '#b8c4d4'; break;
      case 'transit': baseColor = '#7cb97c'; break;
      case 'park': baseColor = '#7a9b6a'; break;
      default: baseColor = '#8b9bb0';
    }

    // Draw organic, hand-drawn shape
    map2dCtx.save();
    map2dCtx.translate(zone.x, zone.y);

    // Watercolor blob effect (multiple semi-transparent layers)
    for (let layer = 0; layer < 3; layer++) {
      map2dCtx.fillStyle = baseColor + Math.floor((0.3 + layer * 0.2) * 255).toString(16).padStart(2, '0');
      map2dCtx.beginPath();
      const wobble = (layer + 1) * 3;
      const points = 12;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const r = (zone.w / 2) + Math.sin(angle * 3) * wobble + Math.cos(angle * 5) * wobble * 0.5;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) map2dCtx.moveTo(x, y);
        else map2dCtx.lineTo(x, y);
      }
      map2dCtx.closePath();
      map2dCtx.fill();
    }

    // Hand-drawn border
    map2dCtx.strokeStyle = statusBorder;
    map2dCtx.lineWidth = 3;
    map2dCtx.beginPath();
    const wobble = 4;
    const points = 12;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const r = (zone.w / 2) + Math.sin(angle * 3) * wobble + Math.cos(angle * 5) * wobble * 0.5;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) map2dCtx.moveTo(x, y);
      else map2dCtx.lineTo(x, y);
    }
    map2dCtx.closePath();
    map2dCtx.stroke();

    // Inner accent line
    map2dCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    map2dCtx.lineWidth = 1;
    map2dCtx.stroke();

    map2dCtx.restore();

    // Draw stylized icon
    const icons = {
      residential: '🏘',
      cbd: '🏛',
      hospital: '⚕',
      solar: '☀',
      power: '⚡',
      water: '💧',
      wind: '🌪',
      transit: '🚂',
      park: '🌲'
    };
    map2dCtx.font = '28px Arial';
    map2dCtx.textAlign = 'center';
    map2dCtx.textBaseline = 'middle';
    map2dCtx.fillStyle = '#2c2c2c';
    map2dCtx.fillText(icons[zone.type] || '📍', zone.x, zone.y - 8);

    // Handwritten-style label
    map2dCtx.font = 'italic bold 11px Georgia, serif';
    map2dCtx.fillStyle = '#4a3a2a';
    map2dCtx.fillText(zone.label.toUpperCase(), zone.x, zone.y + 18);
  });

  // ===== INK BLOTCHES & STAMPS =====
  // Add ink stains for aged effect
  const blotches = [
    { x: 100, y: 100, r: 15 },
    { x: w - 80, y: h - 120, r: 20 },
    { x: 200, y: h - 80, r: 12 }
  ];
  blotches.forEach(blotch => {
    const blotchGrad = map2dCtx.createRadialGradient(blotch.x, blotch.y, 0, blotch.x, blotch.y, blotch.r);
    blotchGrad.addColorStop(0, 'rgba(44, 62, 80, 0.15)');
    blotchGrad.addColorStop(1, 'rgba(44, 62, 80, 0)');
    map2dCtx.fillStyle = blotchGrad;
    map2dCtx.beginPath();
    map2dCtx.arc(blotch.x, blotch.y, blotch.r, 0, Math.PI * 2);
    map2dCtx.fill();
  });

  // ===== ARTISTIC COMPASS =====
  const compassX = w - 50;
  const compassY = 50;
  const compassRadius = 35;

  // Compass ring
  map2dCtx.strokeStyle = '#5c4a3a';
  map2dCtx.lineWidth = 3;
  map2dCtx.beginPath();
  map2dCtx.arc(compassX, compassY, compassRadius, 0, Math.PI * 2);
  map2dCtx.stroke();

  // Inner ring
  map2dCtx.strokeStyle = '#8b7355';
  map2dCtx.lineWidth = 1;
  map2dCtx.beginPath();
  map2dCtx.arc(compassX, compassY, compassRadius - 8, 0, Math.PI * 2);
  map2dCtx.stroke();

  // Compass star
  map2dCtx.fillStyle = '#c4a574';
  map2dCtx.beginPath();
  map2dCtx.moveTo(compassX, compassY - compassRadius + 5);
  map2dCtx.lineTo(compassX - 8, compassY);
  map2dCtx.lineTo(compassX, compassY + 8);
  map2dCtx.lineTo(compassX + 8, compassY);
  map2dCtx.closePath();
  map2dCtx.fill();

  // N pointer
  map2dCtx.fillStyle = '#b84949';
  map2dCtx.beginPath();
  map2dCtx.moveTo(compassX, compassY - compassRadius + 8);
  map2dCtx.lineTo(compassX - 6, compassY - 2);
  map2dCtx.lineTo(compassX + 6, compassY - 2);
  map2dCtx.closePath();
  map2dCtx.fill();

  // Cardinal directions
  map2dCtx.font = 'bold 14px Georgia, serif';
  map2dCtx.fillStyle = '#2c2c2c';
  map2dCtx.textAlign = 'center';
  map2dCtx.textBaseline = 'middle';
  map2dCtx.fillText('N', compassX, compassY - compassRadius - 12);
  map2dCtx.font = '12px Georgia, serif';
  map2dCtx.fillStyle = '#5c4a3a';
  map2dCtx.fillText('S', compassX, compassY + compassRadius + 12);
  map2dCtx.fillText('E', compassX + compassRadius + 15, compassY);
  map2dCtx.fillText('W', compassX - compassRadius - 15, compassY);

  // ===== HANDWRITTEN TITLE =====
  map2dCtx.font = 'italic bold 28px Georgia, serif';
  map2dCtx.fillStyle = '#4a3a2a';
  map2dCtx.textAlign = 'left';
  map2dCtx.textBaseline = 'top';
  map2dCtx.fillText('NEXUS CITY', 25, 25);

  // Subtitle
  map2dCtx.font = 'italic 12px Georgia, serif';
  map2dCtx.fillStyle = '#6b5a4a';
  map2dCtx.fillText('Vision 2040 — Urban Intelligence System', 25, 55);

  // ===== DECORATIVE CORNERS =====
  const drawCorner = (x, y, rotation) => {
    map2dCtx.save();
    map2dCtx.translate(x, y);
    map2dCtx.rotate(rotation);
    map2dCtx.strokeStyle = '#8b7355';
    map2dCtx.lineWidth = 3;
    map2dCtx.beginPath();
    map2dCtx.moveTo(0, 0);
    map2dCtx.lineTo(30, 0);
    map2dCtx.lineTo(0, 30);
    map2dCtx.stroke();
    map2dCtx.restore();
  };

  drawCorner(15, 15, 0);
  drawCorner(w - 15, 15, Math.PI / 2);
  drawCorner(w - 15, h - 15, Math.PI);
  drawCorner(15, h - 15, -Math.PI / 2);

  // ===== SCALE BAR =====
  const scaleBarX = 25;
  const scaleBarY = h - 25;
  map2dCtx.strokeStyle = '#5c4a3a';
  map2dCtx.lineWidth = 2;
  map2dCtx.beginPath();
  map2dCtx.moveTo(scaleBarX, scaleBarY);
  map2dCtx.lineTo(scaleBarX + 80, scaleBarY);
  map2dCtx.stroke();
  // Ticks
  for (let i = 0; i <= 4; i++) {
    map2dCtx.beginPath();
    map2dCtx.moveTo(scaleBarX + i * 20, scaleBarY - 5);
    map2dCtx.lineTo(scaleBarX + i * 20, scaleBarY + 5);
    map2dCtx.stroke();
  }
  map2dCtx.font = '10px Georgia, serif';
  map2dCtx.fillStyle = '#5c4a3a';
  map2dCtx.textAlign = 'center';
  map2dCtx.fillText('500m', scaleBarX + 40, scaleBarY - 10);

  // Restore transformations
  map2dCtx.restore();
}

/* =========================== 12. FUTURE SIMULATOR =========================== */

function projectToYear(year, isOptimized) {
  // Project city metrics from current state to a target year
  // Uses simple linear interpolation with improvement factors for optimized path
  const baseYear = 2026;
  const yearsSpan = year - baseYear;
  const progress = Math.min(1, yearsSpan / 14); // 0 to 1 over 14 years

  const current = cloneMetrics(state);

  // Baseline projection: gradual degradation without intervention
  const baselineProjection = {
    traffic: clamp(current.traffic + progress * 15, 0, 100),
    renewable: clamp(current.renewable - progress * 5, 0, 100),
    water: clamp(current.water - progress * 10, 0, 100),
    aqi: clamp(current.aqi + progress * 30, 0, 500),
    demand: clamp(current.demand + progress * 10, 0, 100),
    supply: clamp(current.supply - progress * 8, 0, 100),
    temperature: clamp(current.temperature + progress * 3, 15, 50),
    hospitalLoad: clamp(current.hospitalLoad + progress * 8, 0, 100),
  };

  // Optimized projection: improvement based on sustained optimization policies
  const improvementFactor = isOptimized ? 0.7 : 0; // 70% improvement potential with optimization
  const optimizedProjection = {
    traffic: clamp(current.traffic - progress * 40 * improvementFactor, 0, 100),
    renewable: clamp(current.renewable + progress * 45 * improvementFactor, 0, 100),
    water: clamp(current.water + progress * 35 * improvementFactor, 0, 100),
    aqi: clamp(current.aqi - progress * 100 * improvementFactor, 0, 500),
    demand: clamp(current.demand - progress * 20 * improvementFactor, 30, 100),
    supply: clamp(current.supply + progress * 30 * improvementFactor, 0, 100),
    temperature: clamp(current.temperature - progress * 5 * improvementFactor, 15, 50),
    hospitalLoad: clamp(current.hospitalLoad - progress * 40 * improvementFactor, 0, 100),
  };

  return isOptimized ? optimizedProjection : baselineProjection;
}

function drawFutureChart(canvas, year, showBaseline, showOptimized) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  // Draw axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.stroke();

  // Year labels
  ctx.font = '10px ' + FONT_MONO;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'center';
  for (let y = 2026; y <= 2040; y += 2) {
    const x = pad.left + ((y - 2026) / 14) * chartW;
    ctx.fillText(y.toString(), x, h - pad.bottom + 16);
  }

  // Draw selected year indicator
  const selectedX = pad.left + ((year - 2026) / 14) * chartW;
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(selectedX, pad.top);
  ctx.lineTo(selectedX, h - pad.bottom);
  ctx.stroke();

  // Metric to plot (AQI as representative example)
  const metrics = ['traffic', 'renewable', 'water', 'aqi'];
  const metricColors = [COLORS.red, COLORS.green, COLORS.cyan, COLORS.amber];
  const metricLabels = ['Traffic', 'Renewable', 'Water', 'AQI'];

  metrics.forEach((metric, idx) => {
    if (!showBaseline && !showOptimized) return;

    const maxVal = metric === 'aqi' ? 400 : 100;

    if (showBaseline) {
      ctx.strokeStyle = metricColors[idx];
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = 2026; y <= 2040; y++) {
        const proj = projectToYear(y, false);
        const x = pad.left + ((y - 2026) / 14) * chartW;
        const val = proj[metric];
        const plotY = h - pad.bottom - (val / maxVal) * chartH;
        if (y === 2026) ctx.moveTo(x, plotY);
        else ctx.lineTo(x, plotY);
      }
      ctx.stroke();
    }

    if (showOptimized) {
      ctx.strokeStyle = metricColors[idx];
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = 2026; y <= 2040; y++) {
        const proj = projectToYear(y, true);
        const x = pad.left + ((y - 2026) / 14) * chartW;
        const val = proj[metric];
        const plotY = h - pad.bottom - (val / maxVal) * chartH;
        if (y === 2026) ctx.moveTo(x, plotY);
        else ctx.lineTo(x, plotY);
      }
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1;

  // Legend
  ctx.textAlign = 'left';
  let legendX = pad.left;
  metrics.forEach((metric, idx) => {
    ctx.fillStyle = metricColors[idx];
    ctx.fillRect(legendX, 8, 10, 10);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(metricLabels[idx], legendX + 14, 16);
    legendX += 80;
  });
}

function updateFutureSummary(year, showBaseline, showOptimized) {
  const container = document.getElementById('futureSummaryContent');
  if (!showBaseline && !showOptimized) {
    container.innerHTML = '<p class="empty-state">Select at least one projection to view summary.</p>';
    return;
  }

  let html = '<div class="future-comparison-grid">';

  if (showBaseline) {
    const baseline = projectToYear(year, false);
    html += `<div class="future-projection baseline">
      <h4>Baseline ${year}</h4>
      <div class="fp-metrics">
        <div><span>Traffic:</span> <span>${roundVal(baseline.traffic)}%</span></div>
        <div><span>Renewable:</span> <span>${roundVal(baseline.renewable)}%</span></div>
        <div><span>Water:</span> <span>${roundVal(baseline.water)}%</span></div>
        <div><span>AQI:</span> <span>${roundVal(baseline.aqi)}</span></div>
      </div>
    </div>`;
  }

  if (showOptimized) {
    const optimized = projectToYear(year, true);
    html += `<div class="future-projection optimized">
      <h4>Optimized ${year}</h4>
      <div class="fp-metrics">
        <div><span>Traffic:</span> <span>${roundVal(optimized.traffic)}%</span></div>
        <div><span>Renewable:</span> <span>${roundVal(optimized.renewable)}%</span></div>
        <div><span>Water:</span> <span>${roundVal(optimized.water)}%</span></div>
        <div><span>AQI:</span> <span>${roundVal(optimized.aqi)}</span></div>
      </div>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function highlightMilestones(year) {
  document.querySelectorAll('.milestone-card').forEach(card => {
    const cardYear = parseInt(card.dataset.year);
    card.classList.toggle('highlighted', cardYear === year);
  });
}

function highlightScenario(key) {
  document.querySelectorAll('.scenario-card').forEach(card => {
    card.classList.toggle('active', card.dataset.scenario === key);
  });
}


/* ================ 10. CHARTS (hand-rolled canvas, no dependency) ================ */

let COLORS = {};
const FONT_MONO = 'ui-monospace, Menlo, Consolas, monospace';

function initColors() {
  const rootStyle = getComputedStyle(document.documentElement);
  COLORS = {
    cyan: rootStyle.getPropertyValue('--cyan').trim(),
    green: rootStyle.getPropertyValue('--green').trim(),
    amber: rootStyle.getPropertyValue('--amber').trim(),
    red: rootStyle.getPropertyValue('--red').trim(),
    muted: rootStyle.getPropertyValue('--text-muted').trim(),
    grid: 'rgba(135,206,235,0.12)',
  };
}

function drawSparkline(canvas, data, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!data || data.length < 2) return;

  const min = Math.min(...data), max = Math.max(...data);
  const range = (max - min) || 1;
  const padY = h * 0.12;

  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * (w - 4) + 2;
    const y = h - padY - ((v - min) / range) * (h - padY * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.lineTo(w - 2, h);
  ctx.lineTo(2, h);
  ctx.closePath();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

const COMPARISON_ITEMS = [
  { key: 'traffic',   label: 'Traffic',   max: 100 },
  { key: 'renewable', label: 'Renewable', max: 100 },
  { key: 'water',     label: 'Water',     max: 100 },
  { key: 'aqi',       label: 'AQI',       max: 400 },
  { key: 'demand',    label: 'Demand',    max: 100 },
  { key: 'supply',    label: 'Supply',    max: 100 },
];

function drawComparisonChart(canvas, before, after) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 20, right: 16, bottom: 34, left: 16 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const groupW = chartW / COMPARISON_ITEMS.length;
  const barW = Math.min(26, groupW * 0.3);
  const baseY = h - pad.bottom;

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, baseY);
  ctx.lineTo(w - pad.right, baseY);
  ctx.stroke();

  ctx.font = '10px ' + FONT_MONO;
  ctx.textAlign = 'center';

  COMPARISON_ITEMS.forEach((item, i) => {
    const cx = pad.left + groupW * i + groupW / 2;
    const bVal = Math.min(before[item.key], item.max);
    const aVal = Math.min(after[item.key], item.max);
    const bH = Math.max(1, (bVal / item.max) * chartH);
    const aH = Math.max(1, (aVal / item.max) * chartH);

    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(cx - barW - 3, baseY - bH, barW, bH);
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(cx + 3, baseY - aH, barW, aH);

    ctx.fillStyle = COLORS.muted;
    ctx.fillText(item.label, cx, baseY + 16);
  });

  // legend
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.cyan; ctx.fillRect(pad.left, 2, 8, 8);
  ctx.fillStyle = COLORS.muted; ctx.fillText('Before', pad.left + 12, 10);
  ctx.fillStyle = COLORS.green; ctx.fillRect(pad.left + 74, 2, 8, 8);
  ctx.fillStyle = COLORS.muted; ctx.fillText('After', pad.left + 86, 10);
}

function buildComparisonTable(before, after, label) {
  let rows = `<div class="ct-row" style="color:var(--text-secondary);border-bottom:1px solid var(--border-strong)">
    <span>${label}</span><span>Before</span><span></span><span>After</span><span>Change</span>
  </div>`;

  Object.keys(FIELD_META).forEach(key => {
    const meta = FIELD_META[key];
    const b = roundVal(before[key]);
    const a = roundVal(after[key]);
    const delta = roundVal(a - b);
    const improved = meta.higherIsBetter ? delta > 0 : delta < 0;
    const cls = delta === 0 ? 'flat' : improved ? 'up' : 'down';
    const arrow = delta === 0 ? '→' : (delta > 0 ? '▲' : '▼');
    rows += `<div class="ct-row">
      <span>${meta.label}</span><span>${b}${meta.unit}</span><span>→</span><span>${a}${meta.unit}</span>
      <span class="ct-delta ${cls}">${arrow} ${Math.abs(delta)}${meta.unit}</span>
    </div>`;
  });

  return rows;
}

function showComparison(before, after, label) {
  document.getElementById('comparisonEmpty').hidden = true;
  const content = document.getElementById('comparisonContent');
  content.hidden = false;
  drawComparisonChart(document.getElementById('comparisonChart'), before, after);
  document.getElementById('comparisonTable').innerHTML = buildComparisonTable(before, after, label);
}

function clearComparison() {
  document.getElementById('comparisonEmpty').hidden = false;
  document.getElementById('comparisonContent').hidden = true;
  document.getElementById('comparisonTable').innerHTML = '';
  const canvas = document.getElementById('comparisonChart');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}


/* ============================== 10. CITY MAP (3D) ============================== *
   The 3D rendering itself lives in city3d.js, which knows nothing about
   thresholds or rule logic. This section is the glue: it turns `state`
   into a small plain "view state" object for City3D.update(), and answers
   City3D's click callback with the same kind of zone info the old 2D map
   panel used to show. City3D never reads `state` directly. */

function updateCityScene() {
  if (!window.City3D) return;
  City3D.update({
    trafficStatus: trafficStatus(state.metrics.traffic),
    renewableStatus: renewableStatus(state.metrics.renewable),
    waterPct: state.metrics.water,
    gridStatus: marginStatus(state.metrics.supply, state.metrics.demand),
    hospitalAlert: state.hospitalLoad > 70 || !!state.activeEmergency,
    activeEmergency: state.activeEmergency ? state.activeEmergency.id : null,
    aqiValue: state.metrics.aqi,
  });
  City3D.setTimeOfDay(state.timeOfDay);
}

function buildZoneInfo(id) {
  const m = state.metrics;
  const grid = capitalize(marginStatus(m.supply, m.demand));
  switch (id) {
    case 'roads':
      return { title: 'Road Network', rows: [
        ['Status', capitalize(trafficStatus(m.traffic))],
        ['Congestion', `${roundVal(m.traffic)}%`],
      ]};
    case 'res-a':
      return { title: 'Residential Sector A', rows: [
        ['Simulated population', '~1.1M residents'],
        ['Air quality', `${capitalize(aqiStatus(m.aqi))} (${roundVal(m.aqi)} AQI)`],
        ['Water access', capitalize(waterStatus(m.water))],
      ]};
    case 'res-b':
      return { title: 'Residential Sector B', rows: [
        ['Simulated population', '~1.3M residents'],
        ['Air quality', `${capitalize(aqiStatus(m.aqi))} (${roundVal(m.aqi)} AQI)`],
        ['Water access', capitalize(waterStatus(m.water))],
      ]};
    case 'cbd':
      return { title: 'Central Business District', rows: [
        ['Simulated office population', '~480,000 workers'],
        ['Grid draw', `${roundVal(m.demand)}% of capacity`],
        ['Grid status', grid],
      ]};
    case 'hospital':
      return { title: 'City Hospital', rows: [
        ['Capacity load', `${roundVal(state.hospitalLoad)}%`],
        ['Status', state.activeEmergency
          ? `Responding to ${EMERGENCIES[state.activeEmergency.id].label}`
          : (state.hospitalLoad > 70 ? 'Elevated load' : 'Normal operations')],
      ]};
    case 'solar-a':
      return { title: 'Solar Farm North', rows: [
        ['City-wide renewable share', `${roundVal(m.renewable)}%`],
        ['Output status', capitalize(renewableStatus(m.renewable))],
      ]};
    case 'solar-b':
      return { title: 'Solar Farm East', rows: [
        ['City-wide renewable share', `${roundVal(m.renewable)}%`],
        ['Output status', capitalize(renewableStatus(m.renewable))],
      ]};
    case 'substation':
      return { title: 'Power Substation', rows: [
        ['Grid supply', `${roundVal(m.supply)}%`],
        ['Grid demand', `${roundVal(m.demand)}%`],
        ['Status', grid],
      ]};
    case 'reservoir':
      return { title: 'City Reservoir', rows: [
        ['Reserves', `${roundVal(m.water)}%`],
        ['Status', capitalize(waterStatus(m.water))],
      ]};
    case 'wind':
      return { title: 'Wind Turbine Farm', rows: [
        ['Role', 'Supplemental renewable generation, paired with solar'],
        ['City-wide renewable share', `${roundVal(m.renewable)}%`],
      ]};
    case 'metro':
      return { title: 'Metro Transit Hub', rows: [
        ['Ridership impact', 'Tied to road congestion'],
        ['Congestion', `${roundVal(m.traffic)}%`],
        ['Status', capitalize(trafficStatus(m.traffic))],
      ]};
    case 'park-a':
      return { title: 'Central Park', rows: [
        ['Role', 'Urban green cover — supports air quality'],
        ['City AQI', `${roundVal(m.aqi)} (${capitalize(aqiStatus(m.aqi))})`],
      ]};
    case 'park-b':
      return { title: 'Riverside Park', rows: [
        ['Role', 'Urban green cover — supports air quality'],
        ['City AQI', `${roundVal(m.aqi)} (${capitalize(aqiStatus(m.aqi))})`],
      ]};
    default:
      return { title: 'Unknown Zone', rows: [] };
  }
}

function showMapInfo(id) {
  const info = buildZoneInfo(id);
  document.getElementById('mapInfo').innerHTML =
    `<h3>${info.title}</h3>` + info.rows.map(([l, v]) => `<div class="mi-row"><span>${l}</span><span>${v}</span></div>`).join('');
}


/* ========================= 11. DASHBOARD / UI RENDER ========================= */

function setCard(key, rawVal, status, barPctOverride) {
  document.getElementById('value-' + key).textContent = roundVal(rawVal);
  const pill = document.getElementById('status-' + key);
  pill.textContent = capitalize(status);
  pill.className = 'status-pill ' + status;
  const bar = document.getElementById('bar-' + key);
  bar.style.width = (barPctOverride !== undefined ? barPctOverride : clamp(rawVal, 0, 100)) + '%';
  bar.className = 'metric-bar-fill ' + status;
  drawSparkline(document.getElementById('spark-' + key), HISTORY[key] || [rawVal], statusColor(status));
}

function updateDashboard() {
  pushHistory();
  setCard('traffic', state.metrics.traffic, trafficStatus(state.metrics.traffic));
  setCard('renewable', state.metrics.renewable, renewableStatus(state.metrics.renewable));
  setCard('water', state.metrics.water, waterStatus(state.metrics.water));
  setCard('aqi', state.metrics.aqi, aqiStatus(state.metrics.aqi), clamp((state.metrics.aqi / 400) * 100, 0, 100));
  setCard('demand', state.metrics.demand, marginStatus(state.metrics.supply, state.metrics.demand));
  updateStatRow();
  updateHeroTelemetry();
}

function updateHeroTelemetry() {
  const heroTraffic = document.getElementById('hero-traffic');
  if (heroTraffic) heroTraffic.textContent = `${roundVal(state.metrics.traffic)}%`;
  const heroRenewable = document.getElementById('hero-renewable');
  if (heroRenewable) heroRenewable.textContent = `${roundVal(state.metrics.renewable)}%`;
  const heroWater = document.getElementById('hero-water');
  if (heroWater) heroWater.textContent = `${roundVal(state.metrics.water)}%`;
  const heroAqi = document.getElementById('hero-aqi');
  if (heroAqi) heroAqi.textContent = `${roundVal(state.metrics.aqi)} AQI`;
  const heroDemand = document.getElementById('hero-demand');
  if (heroDemand) {
    const margin = roundVal(state.metrics.supply - state.metrics.demand);
    heroDemand.textContent = `${margin >= 0 ? '+' : ''}${margin}%`;
  }

  const statusTraffic = document.getElementById('hero-status-traffic');
  if (statusTraffic) {
    const st = trafficStatus(state.metrics.traffic);
    statusTraffic.textContent = st === 'good' ? 'Optimal Flow' : st === 'moderate' ? 'Moderate Congestion' : 'Critical Gridlock';
    statusTraffic.className = 'ht-status ' + (st === 'good' ? 'color-good' : st === 'moderate' ? 'color-mod' : 'color-crit');
  }
  const statusRenewable = document.getElementById('hero-status-renewable');
  if (statusRenewable) {
    const st = renewableStatus(state.metrics.renewable);
    statusRenewable.textContent = st === 'good' ? 'Solar/BESS Active' : st === 'moderate' ? 'Grid Balancing' : 'Renewable Deficit';
    statusRenewable.className = 'ht-status ' + (st === 'good' ? 'color-good' : st === 'moderate' ? 'color-mod' : 'color-crit');
  }
  const statusWater = document.getElementById('hero-status-water');
  if (statusWater) {
    const st = waterStatus(state.metrics.water);
    statusWater.textContent = st === 'good' ? 'Sponge Aquifer Full' : st === 'moderate' ? 'Moderate Reserves' : 'Critical Depletion';
    statusWater.className = 'ht-status ' + (st === 'good' ? 'color-good' : st === 'moderate' ? 'color-mod' : 'color-crit');
  }
  const statusAqi = document.getElementById('hero-status-aqi');
  if (statusAqi) {
    const st = aqiStatus(state.metrics.aqi);
    statusAqi.textContent = st === 'good' ? 'Clean Air Corridor' : st === 'moderate' ? 'Moderate Particulates' : 'Toxic Smog Inversion';
    statusAqi.className = 'ht-status ' + (st === 'good' ? 'color-good' : st === 'moderate' ? 'color-mod' : 'color-crit');
  }
  const statusDemand = document.getElementById('hero-status-demand');
  if (statusDemand) {
    const st = marginStatus(state.metrics.supply, state.metrics.demand);
    statusDemand.textContent = st === 'good' ? 'Supply Margin Safe' : st === 'moderate' ? 'Tight Capacity' : 'Brownout Warning';
    statusDemand.className = 'ht-status ' + (st === 'good' ? 'color-good' : st === 'moderate' ? 'color-mod' : 'color-crit');
  }
}

function updateStatRow() {
  const margin = roundVal(state.metrics.supply - state.metrics.demand);
  const chips = [
    { label: 'Temperature', val: `${roundVal(state.temperature)}°C` },
    { label: 'Electricity Supply', val: `${roundVal(state.metrics.supply)}%` },
    { label: 'Grid Margin', val: `${margin >= 0 ? '+' : ''}${margin}%` },
    { label: 'Hospital Load', val: `${roundVal(state.hospitalLoad)}%` },
    { label: 'Population (sim.)', val: state.population.toLocaleString('en-IN') },
    { label: 'Active Emergency', val: state.activeEmergency ? EMERGENCIES[state.activeEmergency.id].label : 'None' },
  ];
  document.getElementById('statRowGrid').innerHTML =
    chips.map(c => `<div class="stat-chip"><div class="label">${c.label}</div><div class="val">${c.val}</div></div>`).join('');
}

function updateRecommendations() {
  const recs = getRecommendations(state);
  document.getElementById('recommendationsList').innerHTML = recs.map(r => `
    <div class="rec-item">
      <span class="rec-dot ${r.severity}"></span>
      <div>
        <h4>${r.title} <span class="rec-id">${r.id}</span></h4>
        <p>${r.detail}</p>
      </div>
    </div>`).join('');
}

function updateBudgetMeters() {
  document.getElementById('infraBudgetLabel').textContent = `${roundVal(state.budgets.infra)} / ${state.budgets.infraMax}`;
  document.getElementById('infraBudgetFill').style.width = `${(state.budgets.infra / state.budgets.infraMax) * 100}%`;
  document.getElementById('responseBudgetLabel').textContent = `${roundVal(state.budgets.response)} / ${state.budgets.responseMax}`;
  document.getElementById('responseBudgetFill').style.width = `${(state.budgets.response / state.budgets.responseMax) * 100}%`;
}

function updateEmergencyBanner() {
  const active = state.activeEmergency;
  const banner = document.getElementById('emergencyBanner');
  banner.hidden = !active;
  document.querySelectorAll('.emergency-card').forEach(btn => { btn.disabled = !!active; });
  if (active) {
    const em = EMERGENCIES[active.id];
    document.getElementById('emergencyName').textContent = `${em.label} — Active`;
    document.getElementById('emergencyDesc').textContent = em.description;
  }
}

function renderAll() {
  updateDashboard();
  updateCityScene();
  updateRecommendations();
  updateBudgetMeters();
  updateEmergencyBanner();
  syncRecommendationTracking();
}


/* ========================= 12. LIVE SIMULATION TICKER ========================= */

function applyDrift(s) {
  s.metrics.traffic = clamp(s.metrics.traffic + randRange(-3, 3), 0, 100);
  s.metrics.renewable = clamp(s.metrics.renewable + randRange(-2, 2), 0, 100);
  s.metrics.water = clamp(s.metrics.water + randRange(-2, 2), 0, 100);
  s.metrics.aqi = clamp(s.metrics.aqi + randRange(-6, 6), 5, 500);
  s.metrics.demand = clamp(s.metrics.demand + randRange(-3, 3), 0, 100);
  s.metrics.supply = clamp(s.metrics.supply + randRange(-2, 2), 0, 100);
  s.temperature = clamp(s.temperature + randRange(-0.4, 0.4), 15, 50);
  s.hospitalLoad = clamp(s.hospitalLoad + randRange(-2, 2), 0, 100);
  s.budgets.infra = clamp(s.budgets.infra + 2, 0, s.budgets.infraMax);
  s.budgets.response = clamp(s.budgets.response + 2, 0, s.budgets.responseMax);
}

function tickSimulation() {
  if (!state.simRunning) return;
  state.tick++;
  applyDrift(state);
  renderAll();
}

function tickTime() {
  if (!state.simRunning || !state.autoTime) return;
  
  // Advance time: 1 hour = 3 minutes real time (180 seconds)
  // Each tick advances by 1/180 hours (0.00556 hours)
  state.timeOfDay += 1 / 180;
  
  // Wrap around at 24 hours
  if (state.timeOfDay >= 24) {
    state.timeOfDay = 0;
  }
  
  // Update UI
  const timeSlider = document.getElementById('timeSlider');
  if (timeSlider) {
    timeSlider.value = state.timeOfDay;
    document.getElementById('timeDisplay').textContent = formatTimeOfDay(state.timeOfDay);
  }
  
  // Update 3D scene
  if (window.City3D) City3D.setTimeOfDay(state.timeOfDay);
}

function updateAutoTimeButton() {
  const btn = document.getElementById('autoTimeBtn');
  if (btn) {
    btn.textContent = state.autoTime ? 'Auto: ON' : 'Auto: OFF';
    btn.classList.toggle('off', !state.autoTime);
  }
}


/* ========================= 13. EVENT WIRING + INIT ========================= */

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabName));
  if (!window.City3D) return;
  if (tabName === 'map') City3D.onTabShown(); else City3D.onTabHidden();
}

function toggleSimulation() {
  state.simRunning = !state.simRunning;
  document.getElementById('simToggleBtn').textContent = state.simRunning ? 'Pause Simulation' : 'Resume Simulation';
  document.getElementById('liveDot').classList.toggle('paused', !state.simRunning);
  addLog('info', 'SYSTEM', state.simRunning ? 'Simulation Resumed' : 'Simulation Paused',
    state.simRunning ? 'Live metric drift resumed.' : 'Live metric drift paused — values will stay fixed until resumed.');
}

function resetCity() {
  state = freshState();
  logEntries = [];
  trackingInitialized = false;
  HISTORY = emptyHistory();
  clearComparison();
  document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
  document.getElementById('simToggleBtn').textContent = 'Pause Simulation';
  document.getElementById('liveDot').classList.remove('paused');
  if (window.City3D) City3D.resetCamera();
  renderAll();
  addLog('info', 'SYSTEM', 'City Reset', 'All metrics, budgets and the active emergency have been restored to the default crisis baseline.');
}

function updateClock() {
  document.getElementById('clock').textContent = formatClockTime(new Date());
}

function wireEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  if (window.City3D) {
    City3D.setClickHandler(showMapInfo);
  }
  const resetCameraBtn = document.getElementById('resetCameraBtn');
  if (resetCameraBtn) resetCameraBtn.addEventListener('click', () => window.City3D && City3D.resetCamera());

  document.querySelectorAll('.emergency-card').forEach(btn => {
    btn.addEventListener('click', () => triggerEmergency(btn.dataset.emergency));
  });
  document.getElementById('deployResponseBtn').addEventListener('click', deployResponse);

  document.querySelectorAll('.scenario-card').forEach(btn => {
    btn.addEventListener('click', () => applyScenario(btn.dataset.scenario));
  });

  document.getElementById('optimizeBtn').addEventListener('click', optimizeCity);
  document.getElementById('clearLogBtn').addEventListener('click', clearLog);
  document.getElementById('resetBtn').addEventListener('click', resetCity);
  document.getElementById('simToggleBtn').addEventListener('click', toggleSimulation);

  // Time slider handler
  const timeSlider = document.getElementById('timeSlider');
  if (timeSlider) {
    timeSlider.addEventListener('input', (e) => {
      const hours = parseFloat(e.target.value);
      state.timeOfDay = hours;
      state.autoTime = false; // Disable auto-time when user manually adjusts
      updateAutoTimeButton();
      document.getElementById('timeDisplay').textContent = formatTimeOfDay(hours);
      if (window.City3D) City3D.setTimeOfDay(hours);
      // Apply time-based modifiers to metrics
      applyTimeBasedModifiers();
      renderAll();
    });
  }

  // Auto-time toggle button
  const autoTimeBtn = document.getElementById('autoTimeBtn');
  if (autoTimeBtn) {
    autoTimeBtn.addEventListener('click', () => {
      state.autoTime = !state.autoTime;
      updateAutoTimeButton();
    });
  }

  // Layer toggle handlers
  document.querySelectorAll('.layer-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      const isActive = btn.classList.toggle('active');
      if (window.City3D) City3D.setLayerVisible(layer, isActive);
    });
  });

  // Future Simulator handlers
  const yearSlider = document.getElementById('yearSlider');
  const yearDisplay = document.getElementById('yearDisplay');
  const baselineToggle = document.getElementById('baselineToggle');
  const optimizedToggle = document.getElementById('optimizedToggle');

  if (yearSlider && yearDisplay) {
    const updateFutureSimulator = () => {
      const year = parseInt(yearSlider.value);
      yearDisplay.textContent = year;
      const showBaseline = baselineToggle.checked;
      const showOptimized = optimizedToggle.checked;
      drawFutureChart(document.getElementById('futureChart'), year, showBaseline, showOptimized);
      updateFutureSummary(year, showBaseline, showOptimized);
      highlightMilestones(year);
    };

    yearSlider.addEventListener('input', updateFutureSimulator);
    baselineToggle.addEventListener('change', updateFutureSimulator);
    optimizedToggle.addEventListener('change', updateFutureSimulator);

    // Initial render
    updateFutureSimulator();
  }

  // 2D Map initialization
  const map2dCanvas = document.getElementById('map2dCanvas');
  if (map2dCanvas) {
    initMap2D();
  }

  // Operations Suite sub-tool tabs
  document.querySelectorAll('.ops-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.toolTab;
      document.querySelectorAll('.ops-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.ops-tool-panel').forEach(p => {
        p.style.display = p.id === 'tool-panel-' + tabKey ? 'block' : 'none';
      });
      if (tabKey === 'map2d' && typeof renderMap2D === 'function') {
        renderMap2D();
      }
    });
  });

  // Interactive Systems showcase tabs
  document.querySelectorAll('.system-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sysKey = btn.dataset.systemTab;
      document.querySelectorAll('.system-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.system-panel').forEach(p => {
        p.classList.toggle('active', p.id === 'sys-panel-' + sysKey);
      });
    });
  });

  // Camera preset buttons
  document.querySelectorAll('[data-cam-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cam-preset]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (window.City3D && window.City3D.setCameraPreset) {
        window.City3D.setCameraPreset(btn.dataset.camPreset);
      }
    });
  });

  // In-page embedded game toggle
  const toggleEmbedGameBtn = document.getElementById('toggleEmbedGameBtn');
  const embedGameWrap = document.getElementById('embedGameWrap');
  if (toggleEmbedGameBtn && embedGameWrap) {
    toggleEmbedGameBtn.addEventListener('click', () => {
      const isHidden = embedGameWrap.hidden;
      embedGameWrap.hidden = !isHidden;
      toggleEmbedGameBtn.textContent = isHidden ? '✕ Collapse In-Page Game' : '🎮 Play Inside Page';
      if (isHidden) {
        embedGameWrap.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

function applyTimeBasedModifiers() {
  // Time-based modifiers are primarily visual through the 3D scene
  // We add a small note to the log when time changes significantly
  // but don't permanently alter metrics to avoid state corruption
  const hours = state.timeOfDay;
  if (hours >= 6 && hours < 8) {
    // Dawn - just a visual effect
  } else if (hours >= 18 && hours < 20) {
    // Dusk - just a visual effect
  }
}

function init() {
  initColors();

  if (window.City3D) {
    const cityContainer = document.getElementById('cityCanvasWrap');
    if (cityContainer) {
      City3D.init(cityContainer);
      City3D.onTabShown();
    }
  }

  // Initialize time slider display
  const timeSlider = document.getElementById('timeSlider');
  if (timeSlider) {
    timeSlider.value = state.timeOfDay;
    document.getElementById('timeDisplay').textContent = formatTimeOfDay(state.timeOfDay);
  }
  updateAutoTimeButton();

  wireEvents();
  renderAll(); // first pass: silently establishes the recommendation baseline, also does the first 3D paint
  addLog('info', 'SYSTEM', 'Nexus City Online', 'Decision-support simulation initialized in a default crisis baseline. All data is synthetic.');
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(tickSimulation, 4000);
  setInterval(tickTime, 1000); // Time advances every second (1 hour = 3 minutes = 180 seconds)
}

init();
