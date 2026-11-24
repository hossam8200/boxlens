// Shared domain types for BoxLens core. Zero DOM dependency.

/** Provenance/quality state for any value shown in the UI. */
export type Quality = 'ok' | 'partial' | 'missing' | 'stale' | 'conflict';

/** Compliance outcome severity (ordered: fail > warn > nodata > pass). */
export type Severity = 'pass' | 'warn' | 'fail' | 'nodata';

/** Result of validating an 11-character container number under ISO 6346. */
export interface ValidationResult {
  input: string;
  normalized: string;
  valid: boolean;
  checkDigit: number | null;
  expected: number | null;
  errors: string[];
}

/** Technical record for a container (subset consumed by the rule engine). */
export interface ContainerSpec {
  sizeType?: string | null;
  tare: number;
  maxGross: number;
  maxPayload: number;
  maxStacking?: number | null;
  manufacturer?: string | null;
  csc?: { plate?: string; nextInspection?: string; approved?: boolean } | null;
  special?: Record<string, unknown> | null;
  source?: string;
  fetchedAt?: string;
  quality?: string;
}

/** VGM Method 2 computation + limit check result. */
export interface VgmResult {
  tare: number;
  cargo: number;
  vgm: number;
  within: boolean;
  warnings: string[];
}

/** Compliance rule-engine result. */
export interface RuleResult {
  result: Severity;
  reasons: string[];
}

/** Input to the rule engine. */
export interface EvaluateInput {
  valid: boolean;
  spec: ContainerSpec | null;
  weight: number;
  sizeType?: string | null;
}
