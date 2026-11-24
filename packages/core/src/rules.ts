// Compliance rule engine. Pure: given a validation result, an optional
// technical record, a cargo weight and an optional declared size/type, produce
// a severity (pass/warn/fail/nodata) with human-readable reasons.
// Precedence mirrors the production bulk evaluator: a fail (bad check digit or
// overweight) dominates; warnings (size/csc/stale) apply only when not failing;
// nodata applies only when valid but no record; otherwise pass.

import type { EvaluateInput, RuleResult, Severity } from './types';

export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  applies: string;
  desc: string;
}

/** The rule library (versioned in Methodology). */
export const RULES: ReadonlyArray<Rule> = Object.freeze([
  { id: 'R1', name: 'Invalid check digit', severity: 'fail', applies: 'all', desc: 'Container number fails ISO 6346 check-digit verification.' },
  { id: 'R2', name: 'Overweight vs max gross', severity: 'fail', applies: 'hasWeight', desc: "VGM exceeds the container's max gross mass." },
  { id: 'R3', name: 'Cargo exceeds max payload', severity: 'fail', applies: 'hasWeight', desc: "Cargo + packing weight exceeds the container's max payload." },
  { id: 'R4', name: 'Exceeds stacking limit', severity: 'warn', applies: 'hasStack', desc: 'Stacked weight approaches or exceeds max stacking weight.' },
  { id: 'R5', name: 'Size/type mismatch', severity: 'warn', applies: 'hasSizeType', desc: 'Declared size/type differs from registered size-type.' },
  { id: 'R6', name: 'CSC plate expired', severity: 'warn', applies: 'hasSpec', desc: 'CSC plate inspection is overdue or not approved.' },
  { id: 'R7', name: 'Owner mismatch', severity: 'warn', applies: 'hasOwner', desc: 'Declared owner code does not match registered owner.' },
  { id: 'R8', name: 'Missing data', severity: 'nodata', applies: 'all', desc: 'No technical record found for this container.' },
]);

/** Severity rank for precedence: fail > warn > nodata > pass. */
const RANK: Record<Severity, number> = { fail: 3, warn: 2, nodata: 1, pass: 0 };

/** Promote to the more severe of the two states (never demotes). */
function promote(cur: Severity, next: Severity): Severity {
  return RANK[next] > RANK[cur] ? next : cur;
}

/** Evaluate compliance rules for a single container. */
export function evaluate(input: EvaluateInput): RuleResult {
  const { valid, spec, weight, sizeType } = input;
  const reasons: string[] = [];
  let result: Severity = 'pass';

  if (!valid) {
    result = promote(result, 'fail');
    reasons.push('Invalid check digit');
  }

  if (!spec) {
    // nodata only when nothing harder has fired; a bad check digit stays 'fail'.
    if (result === 'pass') result = promote(result, 'nodata');
    reasons.push('No technical record');
  } else {
    if (weight + spec.tare > spec.maxGross) {
      result = promote(result, 'fail');
      reasons.push(`VGM > max gross (${spec.maxGross})`);
    } else if (weight > spec.maxPayload) {
      result = promote(result, 'fail');
      reasons.push(`Cargo > max payload (${spec.maxPayload})`);
    }
    if (sizeType && spec.sizeType && sizeType.toUpperCase() !== spec.sizeType) {
      result = promote(result, 'warn');
      reasons.push(`Size/type mismatch (${spec.sizeType})`);
    }
    if (spec.csc && !spec.csc.approved) {
      result = promote(result, 'warn');
      reasons.push('CSC not approved');
    }
    if (spec.quality === 'stale') {
      result = promote(result, 'warn');
      reasons.push('Stale data');
    }
  }

  return { result, reasons };
}
