// BoxLens core — pure TypeScript, zero DOM dependency.
// Consumed by the single-file app via the UMD bundle (dist/boxlens-core.umd.js)
// which exposes `window.BoxLensCore` with these namespaces.

export * as iso6346 from './iso6346';
export * as sizetype from './sizetype';
export * as vgm from './vgm';
export * as rules from './rules';
export * as geo from './geo';
export * as congestion from './congestion';
export * as risk from './risk';
export * as provenance from './provenance';

export type {
  Quality,
  Severity,
  ValidationResult,
  ContainerSpec,
  VgmResult,
  RuleResult,
  EvaluateInput,
} from './types';
