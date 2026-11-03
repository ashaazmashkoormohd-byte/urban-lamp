import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CityState, LogEntry, MetricComparison } from './types/city';
import {
  getInitialState,
  stepSimulation,
  cloneMetrics,
  formatClockTime,
  getRecommendations,
} from './utils/simulation';
import {
  OPTIMIZATION_RULES,
  EMERGENCIES,
  PRESETS,
  clamp,
  roundVal,
} from './data/cityData';

import { Navigation } from './components/Navigation';
import { HeroSection } from './components/HeroSection';
import { VisionSection } from './components/VisionSection';
import { City3DSection } from './components/City3DSection';
import { SystemsShowcase } from './components/SystemsShowcase';
import { FutureSimulator } from './components/FutureSimulator';
import { CityRescueGame } from './components/CityRescueGame';
import { OperationsSuite } from './components/OperationsSuite';
import { Epilogue } from './components/Epilogue';

export const App: React.FC = () => {
  const [cityState, setCityState] = useState<CityState>(getInitialState);

  // Sparkline history buffers
  const [history, setHistory] = useState<Record<string, number[]>>({
    traffic: [89.4],
    renewable: [18.2],
    water: [12.5],
    aqi: [218],
    demand: [94.6],
  });

  // Decision Log
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-init-1',
      time: formatClockTime(new Date()),
      severity: 'warning',
      tag: 'SYSTEM',
      title: 'Crisis Baseline Loaded',
      detail: 'Metropolitan simulation initialized in elevated crisis baseline for demonstration purposes.',
    },
    {
      id: 'log-init-2',
      time: formatClockTime(new Date()),
      severity: 'critical',
      tag: 'RULE-TRAFFIC-01',
      title: 'Traffic Congestion Critical',
      detail: 'Traffic congestion at 89.4% exceeds the 65% threshold.',
    },
    {
      id: 'log-init-3',
      time: formatClockTime(new Date()),
      severity: 'critical',
      tag: 'RULE-AQI-04',
      title: 'Severe Particulate Spike',
      detail: 'AQI at 218 exceeds the 150 threshold for poor air quality.',
    },
  ]);

  // Operations Active Tab
  const [activeOpsTab, setActiveOpsTab] = useState<string>('metrics');

  // Optimization comparison
  const [comparisonData, setComparisonData] = useState<{
    before: MetricComparison;
    after: MetricComparison;
    title: string;
  } | null>(null);

  // Modal Game State
  const [isGameModalOpen, setIsGameModalOpen] = useState<boolean>(false);

  // Helper to add log entries
  const addLog = useCallback(
    (severity: 'good' | 'warning' | 'critical' | 'info', tag: string, title: string, detail: string) => {
      const newEntry: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        time: formatClockTime(new Date()),
        severity,
        tag,
        title,
        detail,
      };
      setLogs(prev => [newEntry, ...prev.slice(0, 199)]);
    },
    []
  );

  // Live simulation ticker (runs every 1000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setCityState(prev => {
        const next = stepSimulation(prev);

        // Update history if running
        if (prev.simRunning) {
          setHistory(h => {
            const nextH: Record<string, number[]> = {};
            (['traffic', 'renewable', 'water', 'aqi', 'demand'] as const).forEach(key => {
              const arr = [...(h[key] || []), next.metrics[key]];
              if (arr.length > 40) arr.shift();
              nextH[key] = arr;
            });
            return nextH;
          });
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Sync recommendation events with logs
  const lastRecIdsRef = useRef<Set<string>>(new Set());
  const trackingInitRef = useRef<boolean>(false);

  useEffect(() => {
    const recs = getRecommendations(cityState).filter(
      r => r.id !== 'SYSTEM-NOMINAL' && r.id !== 'EMERGENCY-ACTIVE'
    );
    const currentIds = new Set(recs.map(r => r.id));

    if (!trackingInitRef.current) {
      lastRecIdsRef.current = currentIds;
      trackingInitRef.current = true;
      return;
    }

    recs.forEach(r => {
      if (!lastRecIdsRef.current.has(r.id)) {
        addLog(r.severity, r.id, 'Condition Detected', `${r.title} — ${r.detail}`);
      }
    });

    lastRecIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        const rule = OPTIMIZATION_RULES.find(r => r.id === id);
        addLog('info', id, 'Condition Resolved', `${rule ? rule.title : id} no longer detected — metric is back within threshold.`);
      }
    });

    lastRecIdsRef.current = currentIds;
  }, [cityState, addLog]);

  // Actions
  const handleToggleSim = () => {
    setCityState(prev => {
      const nextSim = !prev.simRunning;
      addLog(
        'info',
        'SIMULATION',
        nextSim ? 'Simulation Resumed' : 'Simulation Paused',
        nextSim ? 'Autonomous time drift and sensor jitter active.' : 'City state paused.'
      );
      return { ...prev, simRunning: nextSim };
    });
  };

  const handleReset = () => {
    const initial = getInitialState();
    setCityState(initial);
    setComparisonData(null);
    addLog(
      'critical',
      'SYSTEM',
      'City Reset to Crisis Baseline',
      'Loaded high-congestion, stressed-grid baseline for demo purposes.'
    );
  };

  const handleUpdateTimeOfDay = (time: number) => {
    setCityState(prev => ({ ...prev, timeOfDay: time, autoTime: false }));
  };

  const handleToggleAutoTime = () => {
    setCityState(prev => ({ ...prev, autoTime: !prev.autoTime }));
  };

  const handleOptimizeCity = () => {
    setCityState(prev => {
      const before = cloneMetrics(prev);
      const next = {
        ...prev,
        metrics: { ...prev.metrics },
        budgets: { ...prev.budgets },
      };

      let appliedAny = false;

      OPTIMIZATION_RULES.forEach(rule => {
        if (!rule.condition(next)) return;
        appliedAny = true;
        const detectMsg = rule.detect(next);

        if (next.budgets.infra <= 0) {
          addLog(
            'warning',
            rule.id,
            `${rule.title} — Skipped`,
            `${detectMsg} No infrastructure budget remains.`
          );
          return;
        }

        let factor = 1;
        let partialNote = '';
        if (next.budgets.infra < rule.cost) {
          factor = next.budgets.infra / rule.cost;
          partialNote = ` Applied partially (${Math.round(factor * 100)}%) — only ${roundVal(
            next.budgets.infra
          )} of ${rule.cost} units available.`;
        }

        const spend = Math.min(rule.cost, next.budgets.infra);
        next.budgets.infra = clamp(next.budgets.infra - spend, 0, next.budgets.infraMax);
        rule.apply(next, factor);

        addLog(
          rule.severity,
          rule.id,
          rule.title,
          `${detectMsg} Spent ${roundVal(spend)} infrastructure budget.${partialNote}`
        );
      });

      if (!appliedAny) {
        addLog(
          'good',
          'SYSTEM',
          'No Action Needed',
          'All monitored metrics are within healthy thresholds — optimization was not required.'
        );
      }

      const after = cloneMetrics(next);
      setComparisonData({ before, after, title: 'City Optimization' });
      setActiveOpsTab('optimize');

      return next;
    });
  };

  const handleTriggerEmergency = (id: string) => {
    setCityState(prev => {
      if (prev.activeEmergency) {
        const activeLabel = EMERGENCIES[prev.activeEmergency.id]?.label || 'Crisis';
        addLog(
          'warning',
          'SYSTEM',
          'Emergency Already Active',
          `Cannot trigger ${EMERGENCIES[id]?.label}: resolve active ${activeLabel} first.`
        );
        return prev;
      }

      const em = EMERGENCIES[id];
      if (!em) return prev;

      const next = {
        ...prev,
        metrics: { ...prev.metrics },
        budgets: { ...prev.budgets },
      };
      em.trigger(next);
      next.activeEmergency = { id, startedTick: prev.tick };

      addLog('critical', id.toUpperCase(), `${em.label} Detected`, em.description);
      return next;
    });
  };

  const handleDeployEmergencyResponse = () => {
    setCityState(prev => {
      if (!prev.activeEmergency) return prev;
      const em = EMERGENCIES[prev.activeEmergency.id];
      if (!em) return prev;

      const before = cloneMetrics(prev);

      if (prev.budgets.response <= 0) {
        addLog(
          'warning',
          em.id.toUpperCase(),
          'Response Blocked',
          'No Emergency Response Capacity remains — wait for budget recovery.'
        );
        return prev;
      }

      const next = {
        ...prev,
        metrics: { ...prev.metrics },
        budgets: { ...prev.budgets },
      };

      let factor = 1;
      let partialNote = '';
      if (next.budgets.response < em.responseCost) {
        factor = next.budgets.response / em.responseCost;
        partialNote = ` (partial response — ${Math.round(factor * 100)}% effect)`;
      }

      const spend = Math.min(em.responseCost, next.budgets.response);
      next.budgets.response = clamp(next.budgets.response - spend, 0, next.budgets.responseMax);
      em.response(next, factor);
      next.activeEmergency = null;

      const after = cloneMetrics(next);
      addLog(
        'good',
        em.id.toUpperCase(),
        em.responseTitle,
        `Deployed in response to ${em.label}${partialNote}. Spent ${roundVal(spend)} capacity.`
      );

      setComparisonData({ before, after, title: `${em.label} Response` });
      return next;
    });
  };

  const handleApplyScenario = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    setCityState(prev => ({
      ...prev,
      temperature: preset.temperature,
      metrics: { ...preset.metrics },
      hospitalLoad: preset.hospitalLoad,
      activeEmergency: null,
      budgets: {
        ...prev.budgets,
        infra: prev.budgets.infraMax,
        response: prev.budgets.responseMax,
      },
    }));

    setComparisonData(null);
    addLog('info', 'SCENARIO', preset.label, `Preset loaded — ${preset.blurb}`);
  };

  const handleScrollToGame = () => {
    const el = document.getElementById('rescue-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="nexus-app">
      <Navigation
        simRunning={cityState.simRunning}
        onToggleSim={handleToggleSim}
        onReset={handleReset}
        onOpenGame={handleScrollToGame}
      />

      <main>
        <HeroSection state={cityState} onOpenGame={handleScrollToGame} />

        <VisionSection />

        <City3DSection
          state={cityState}
          onUpdateTimeOfDay={handleUpdateTimeOfDay}
          onToggleAutoTime={handleToggleAutoTime}
        />

        <SystemsShowcase onSelectOpsTab={setActiveOpsTab} />

        <FutureSimulator state={cityState} />

        <CityRescueGame
          isOpen={isGameModalOpen}
          onClose={() => setIsGameModalOpen(false)}
          onApplyOptimizationToCity={handleOptimizeCity}
        />

        <OperationsSuite
          state={cityState}
          history={history}
          logs={logs}
          activeOpsTab={activeOpsTab}
          onSelectOpsTab={setActiveOpsTab}
          onOptimizeCity={handleOptimizeCity}
          onTriggerEmergency={handleTriggerEmergency}
          onDeployEmergencyResponse={handleDeployEmergencyResponse}
          onApplyScenario={handleApplyScenario}
          onClearLogs={() => setLogs([])}
          comparisonData={comparisonData}
        />

        <Epilogue onOpenGame={handleScrollToGame} />
      </main>
    </div>
  );
};
