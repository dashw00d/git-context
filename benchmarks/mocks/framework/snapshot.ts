import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PipelineState } from '../../../src/analysis/runner/pipelineTypes';

type Serializable = any;

function toSortedArray<T>(value: Set<T> | T[] | undefined): T[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? [...value] : Array.from(value);
  return arr.sort();
}

function stableStringify(value: Serializable): string {
  const seen = new WeakSet();

  const stringify = (v: any): any => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return '[Circular]';
    seen.add(v);

    if (Array.isArray(v)) {
      return v.map(stringify);
    }

    const entries = Object.keys(v).sort().map(key => [key, stringify(v[key])]);
    return Object.fromEntries(entries);
  };

  return JSON.stringify(stringify(value));
}

export function stableHash(value: Serializable): string {
  return crypto.createHash('sha1').update(stableStringify(value)).digest('hex');
}

export interface StepSnapshot {
  stepId: string;
  data: Serializable;
  hash: string;
}

export function serializeStepState(stepId: string, state: PipelineState): Serializable {
  switch (stepId) {
    case 'scope':
      return state.scope ? {
        commitFiles: toSortedArray(state.scope.commitFiles),
        workingChanged: toSortedArray(state.scope.workingChanged),
        blastRadius: toSortedArray(state.scope.blastRadius),
        allPaths: toSortedArray(state.scope.allPaths)
      } : null;

    case 'intended':
      return state.intended ? Array.from(state.intended.entries()).map(([symbolId, v]) => ({
        symbolId,
        expect: v.expect,
        lastName: v.lastName,
        lastPath: v.lastPath,
        lastSig: v.lastSig,
        lastSha: v.lastSha,
        isRenamed: v.isRenamed || false
      })).sort((a, b) => a.symbolId.localeCompare(b.symbolId)) : null;

    case 'working':
      return state.working ? {
        symbols: Array.from(state.working.symbolsById.entries())
          .map(([symbolId, s]) => ({
            symbolId,
            name: s.name,
            kind: s.kind,
            signature: s.signature,
            loc_post: s.loc_post,
            loc_pre: s.loc_pre
          }))
          .sort((a, b) => a.symbolId.localeCompare(b.symbolId)),
        edges: state.working.edges
          .map(e => ({
            from: e.from_symbol_id,
            to: e.to_symbol_id,
            type: e.edge_type,
            change: e.change_type
          }))
          .sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to)),
        analyzedPaths: toSortedArray(state.working.analyzedPaths)
      } : null;

    case 'drift':
      return state.drift ? {
        missing_symbols: state.drift.missing_symbols,
        zombie_symbols: state.drift.zombie_symbols,
        divergent_symbols: state.drift.divergent_symbols,
        missing_edges: state.drift.missing_edges,
        zombie_edges: state.drift.zombie_edges,
        hotspots: state.drift.hotspots,
        conventionDrift: state.drift.conventionDrift,
        mixedConventionFiles: state.drift.mixedConventionFiles
      } : null;

    case 'legacy':
      return state.legacy ? {
        dead: state.legacy.dead,
        legacyUsed: state.legacy.legacyUsed,
        replacedLeftovers: state.legacy.replacedLeftovers
      } : null;

    case 'hotspots':
      return state.hotspots || null;

    case 'workspace_overlay':
      return state.workspaceFacts || null;

    case 'index_commits':
      return state.commitFacts || null;

    case 'bundle_facts':
      return state.bundleFacts || null;

    default:
      return null;
  }
}

export function saveStepSnapshot(stepId: string, state: PipelineState, dir: string): StepSnapshot | null {
  const data = serializeStepState(stepId, state);
  if (data === null || data === undefined) return null;

  const snapshot: StepSnapshot = {
    stepId,
    data,
    hash: stableHash(data)
  };

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${stepId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

export function loadStepSnapshot(stepId: string, dir: string): StepSnapshot | null {
  const filePath = path.join(dir, `${stepId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return parsed;
}

export function applySnapshotToState(state: PipelineState, snapshot: StepSnapshot): void {
  const { stepId, data } = snapshot;
  switch (stepId) {
    case 'scope':
      state.scope = data ? {
        commitFiles: new Set(data.commitFiles || []),
        workingChanged: new Set(data.workingChanged || []),
        blastRadius: new Set(data.blastRadius || []),
        allPaths: new Set(data.allPaths || [])
      } : undefined;
      break;
    case 'intended':
      state.intended = data ? new Map(
        (data as any[]).map(item => [item.symbolId, {
          expect: item.expect,
          lastName: item.lastName,
          lastPath: item.lastPath,
          lastSig: item.lastSig,
          lastSha: item.lastSha,
          isRenamed: item.isRenamed
        }])
      ) : undefined;
      break;
    case 'working':
      state.working = data ? {
        symbolsById: new Map(
          (data.symbols || []).map((s: any) => [s.symbolId, {
            id: 0,
            symbol_id: s.symbolId,
            name: s.name,
            kind: s.kind,
            signature: s.signature,
            loc_post: s.loc_post,
            loc_pre: s.loc_pre
          }])
        ),
        symbolsByFile: new Map(),
        edges: (data.edges || []).map((e: any) => ({
          from_symbol_id: e.from,
          to_symbol_id: e.to,
          edge_type: e.type,
          change_type: e.change,
          confidence: 1.0,
          is_resolved: true
        })),
        analyzedPaths: new Set(data.analyzedPaths || [])
      } : undefined;
      break;
    case 'drift':
      state.drift = data || undefined;
      break;
    case 'legacy':
      state.legacy = data || undefined;
      break;
    case 'hotspots':
      state.hotspots = data || undefined;
      break;
    case 'workspace_overlay':
      state.workspaceFacts = data || undefined;
      break;
    case 'index_commits':
      state.commitFacts = data || undefined;
      break;
    case 'bundle_facts':
      state.bundleFacts = data || undefined;
      break;
    default:
      break;
  }
}
