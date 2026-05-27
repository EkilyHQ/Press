import {
  COMPOSER_ACTION_PLAN,
  getComposerActionPlan,
  validateComposerActionPlan
} from './composer-action-contract.js';

function normalizeActionPlan(plan) {
  const failures = validateComposerActionPlan(plan);
  if (failures.length) {
    throw new Error(`Invalid composer action plan: ${failures.join('; ')}`);
  }
  const sourcePlan = Array.isArray(plan) ? plan : getComposerActionPlan();
  return sourcePlan.map(action => ({
    type: String(action.type || '').trim(),
    label: String(action.label || '').trim(),
    requires: Array.isArray(action.requires) ? [...action.requires] : [],
    effects: Array.isArray(action.effects) ? [...action.effects] : []
  }));
}

function normalizeSet(value) {
  if (value instanceof Set) return new Set([...value].map(item => String(item || '').trim()).filter(Boolean));
  if (Array.isArray(value)) return new Set(value.map(item => String(item || '').trim()).filter(Boolean));
  return new Set();
}

function describeTraceValue(value) {
  if (Array.isArray(value)) return { type: 'array', length: value.length };
  if (value && typeof value === 'object') return { type: 'object', keys: Object.keys(value).sort() };
  return { type: value === null ? 'null' : typeof value };
}

function summarizeTracePayload(payload) {
  if (!payload || typeof payload !== 'object') return { keys: [], values: {} };
  const keys = Object.keys(payload).sort();
  return {
    keys,
    values: Object.fromEntries(keys.map(key => [key, describeTraceValue(payload[key])]))
  };
}

export function createComposerActionDispatcher(options = {}) {
  const appName = String(options.name || 'composer-actions').trim() || 'composer-actions';
  const actions = normalizeActionPlan(options.plan || COMPOSER_ACTION_PLAN);
  const handlers = options.handlers && typeof options.handlers === 'object' ? options.handlers : {};
  const availableServices = normalizeSet(options.availableServices);
  const maxTracesValue = Number(options.maxTraces);
  const maxTraces = Number.isFinite(maxTracesValue) ? Math.max(0, Math.floor(maxTracesValue)) : 50;
  const actionByType = new Map(actions.map(action => [action.type, action]));
  const traces = [];

  function assertReady() {
    const missing = [];
    actions.forEach((action) => {
      action.requires.forEach((service) => {
        if (!availableServices.has(service)) missing.push(`${action.type} requires service ${service}`);
      });
      action.effects.forEach((effect) => {
        if (typeof handlers[effect] !== 'function') missing.push(`${action.type} requires effect ${effect}`);
      });
    });
    if (missing.length) {
      throw new Error(`${appName}: invalid composer action handlers: ${missing.join('; ')}`);
    }
    return true;
  }

  function dispatch(type, payload = {}) {
    const actionType = String(type || '').trim();
    const action = actionByType.get(actionType);
    if (!action) throw new Error(`${appName}: unknown composer action "${actionType || '(empty)'}"`);
    const actionPayload = payload && typeof payload === 'object' ? payload : {};
    const trace = {
      type: action.type,
      effects: [...action.effects],
      payload: summarizeTracePayload(actionPayload)
    };
    if (maxTraces > 0) {
      traces.push(trace);
      if (traces.length > maxTraces) traces.splice(0, traces.length - maxTraces);
    }
    let result;
    action.effects.forEach((effect) => {
      result = handlers[effect](actionPayload, {
        action,
        dispatch,
        effect,
        trace
      });
    });
    return result;
  }

  return {
    assertReady,
    dispatch,
    getActionPlan: () => actions.map(action => ({
      type: action.type,
      label: action.label,
      requires: [...action.requires],
      effects: [...action.effects]
    })),
    getTraces: () => traces.map(trace => ({
      type: trace.type,
      effects: [...trace.effects],
      payload: { ...trace.payload }
    }))
  };
}
