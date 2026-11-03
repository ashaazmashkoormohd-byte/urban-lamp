import { CityMetrics, CityState, MetricComparison, MetricStatus } from '../types/city';
import { clamp, roundVal, OPTIMIZATION_RULES, EMERGENCIES } from '../data/cityData';

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatClockTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatTimeOfDay(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${pad2(h)}:${pad2(m)}`;
}

export function getInitialState(): CityState {
  return {
    tick: 0,
    simRunning: true,
    temperature: 43,
    metrics: {
      traffic: 89.4,
      renewable: 18.2,
      water: 12.5,
      aqi: 218,
      demand: 94.6,
      supply: 52.3,
    },
    hospitalLoad: 91.7,
    population: 2400000,
    budgets: {
      infra: 100,
      infraMax: 100,
      response: 100,
      responseMax: 100,
    },
    activeEmergency: null,
    timeOfDay: 12,
    autoTime: true,
  };
}

export function cloneMetrics(s: CityState): MetricComparison {
  return {
    traffic: s.metrics.traffic,
    renewable: s.metrics.renewable,
    water: s.metrics.water,
    aqi: s.metrics.aqi,
    demand: s.metrics.demand,
    supply: s.metrics.supply,
    temperature: s.temperature,
    hospitalLoad: s.hospitalLoad,
  };
}

export function getTimeOfDayModifier(hours: number): number {
  if (hours < 6 || hours > 18) return 0;
  if (hours >= 6 && hours < 12) return (hours - 6) / 6;
  if (hours >= 12 && hours <= 18) return 1 - (hours - 12) / 6;
  return 0;
}

export function getDemandModifier(hours: number): number {
  if (hours >= 7 && hours < 9) return 1.2;
  if (hours >= 18 && hours < 21) return 1.3;
  if (hours >= 0 && hours < 6) return 0.6;
  if (hours >= 22 || hours < 24) return 0.7;
  return 1.0;
}

export function getRecommendations(s: CityState) {
  const recs: { id: string; title: string; severity: 'warning' | 'critical' | 'good' | 'info'; detail: string }[] = [];

  OPTIMIZATION_RULES.forEach(rule => {
    if (rule.condition(s)) {
      recs.push({
        id: rule.id,
        title: rule.title,
        severity: rule.severity,
        detail: rule.detect(s),
      });
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
      title: `Active Emergency: ${em ? em.label : 'Crisis'}`,
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

export function stepSimulation(prev: CityState): CityState {
  if (!prev.simRunning) return prev;

  const next: CityState = {
    ...prev,
    tick: prev.tick + 1,
    metrics: { ...prev.metrics },
    budgets: { ...prev.budgets },
  };

  // Time progression
  if (next.autoTime) {
    next.timeOfDay = (next.timeOfDay + 0.05) % 24;
  }

  // Slight diurnal influence & organic stochastic drift
  const solarFactor = getTimeOfDayModifier(next.timeOfDay);
  const demandFactor = getDemandModifier(next.timeOfDay);

  const jitter = (range: number) => (Math.random() - 0.5) * range;

  // Drift metrics realistically within boundaries
  next.metrics.traffic = clamp(next.metrics.traffic + jitter(0.4), 5, 100);
  
  // Solar impact on renewable
  const targetRenewableDrift = (solarFactor * 10 - 5) * 0.1;
  next.metrics.renewable = clamp(next.metrics.renewable + targetRenewableDrift + jitter(0.3), 5, 98);

  next.metrics.water = clamp(next.metrics.water + jitter(0.2), 5, 100);
  next.metrics.aqi = clamp(next.metrics.aqi + jitter(0.8), 20, 500);

  const demandDrift = (demandFactor - 1.0) * 0.5;
  next.metrics.demand = clamp(next.metrics.demand + demandDrift + jitter(0.4), 25, 100);
  next.metrics.supply = clamp(next.metrics.supply + jitter(0.3), 20, 100);

  // Temperature slight day/night variation
  const tempSolar = (solarFactor - 0.5) * 1.5;
  next.temperature = clamp(next.temperature + tempSolar * 0.05 + jitter(0.1), 15, 50);

  // Hospital load follows emergencies and heat
  if (next.temperature > 40) {
    next.hospitalLoad = clamp(next.hospitalLoad + 0.1, 10, 100);
  } else {
    next.hospitalLoad = clamp(next.hospitalLoad + jitter(0.2), 10, 100);
  }

  // Passive budget regeneration (very slow, realistic municipal recovery)
  if (next.budgets.infra < next.budgets.infraMax) {
    next.budgets.infra = clamp(next.budgets.infra + 0.2, 0, next.budgets.infraMax);
  }
  if (next.budgets.response < next.budgets.responseMax) {
    next.budgets.response = clamp(next.budgets.response + 0.3, 0, next.budgets.responseMax);
  }

  return next;
}

export function projectToYear(base: MetricComparison, year: number, isOptimized: boolean): MetricComparison {
  const baseYear = 2026;
  const yearsSpan = Math.max(0, year - baseYear);
  const progress = Math.min(1, yearsSpan / 14); // 0 to 1 over 14 years

  if (!isOptimized) {
    return {
      traffic: clamp(base.traffic + progress * 15, 0, 100),
      renewable: clamp(base.renewable - progress * 5, 0, 100),
      water: clamp(base.water - progress * 10, 0, 100),
      aqi: clamp(base.aqi + progress * 30, 0, 500),
      demand: clamp(base.demand + progress * 10, 0, 100),
      supply: clamp(base.supply - progress * 8, 0, 100),
      temperature: clamp(base.temperature + progress * 3, 15, 50),
      hospitalLoad: clamp(base.hospitalLoad + progress * 8, 0, 100),
    };
  }

  const improvementFactor = 0.7; // 70% improvement potential with sustained optimization
  return {
    traffic: clamp(base.traffic - progress * 40 * improvementFactor, 0, 100),
    renewable: clamp(base.renewable + progress * 45 * improvementFactor, 0, 100),
    water: clamp(base.water + progress * 35 * improvementFactor, 0, 100),
    aqi: clamp(base.aqi - progress * 100 * improvementFactor, 0, 500),
    demand: clamp(base.demand - progress * 20 * improvementFactor, 30, 100),
    supply: clamp(base.supply + progress * 30 * improvementFactor, 0, 100),
    temperature: clamp(base.temperature - progress * 5 * improvementFactor, 15, 50),
    hospitalLoad: clamp(base.hospitalLoad - progress * 40 * improvementFactor, 0, 100),
  };
}
