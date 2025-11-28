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

/**
 * Deep serialize step state with circular reference handling, Map/Set conversion,
 * and string truncation for large fields (e.g., markdown)
 */
export function deepSerializeStepState(stepId: string, state: PipelineState): Serializable {
  if (!state) return null;

  const seen = new WeakSet();
  const MAX_STRING_LENGTH = 2000;

  const deepSerialize = (value: any, depth = 0): any => {
    if (value === null || value === undefined) return value;
    
    // Handle primitives
    if (typeof value !== 'object') {
      // Truncate large strings
      if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
        return value.substring(0, MAX_STRING_LENGTH) + '... [truncated]';
      }
      return value;
    }

    // Handle circular references - check before adding
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    // Handle Maps
    if (value instanceof Map) {
      return Array.from(value.entries()).map(([k, v]) => [deepSerialize(k, depth + 1), deepSerialize(v, depth + 1)]);
    }

    // Handle Sets
    if (value instanceof Set) {
      return Array.from(value).map(item => deepSerialize(item, depth + 1));
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => deepSerialize(item, depth + 1));
    }

    // Handle objects - skip non-serializable
    if (value.constructor && value.constructor.name !== 'Object') {
      // Skip DB connections, Qdrant instances, etc.
      if (typeof value.query === 'function' || typeof value.prepare === 'function' || 
          typeof value.get === 'function' || value.constructor.name.includes('Database')) {
        return '[Omitted: External/Non-serializable]';
      }
    }

    // Recursively serialize object properties
    const result: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        // Skip internal/private properties
        if (key.startsWith('_') && key !== '_id') continue;
        result[key] = deepSerialize(value[key], depth + 1);
      }
    }
    return result;
  };

  // Use existing serializeStepState for structured extraction, then deep serialize
  const baseData = serializeStepState(stepId, state);
  
  // Special handling for LLM and history steps
  if (stepId === 'llm_story' && state.llmOutputs) {
    const llmAnalysis = state.llmOutputs.llmAnalysis;
    if (llmAnalysis) {
      return {
        llmAnalysis: {
          summary: llmAnalysis.summary ? (llmAnalysis.summary.length > MAX_STRING_LENGTH 
            ? llmAnalysis.summary.substring(0, MAX_STRING_LENGTH) + '... [truncated]' 
            : llmAnalysis.summary) : undefined,
          blocks: llmAnalysis.blocks ? llmAnalysis.blocks.map((block: any) => ({
            id: block.id,
            title: block.title,
            type: block.type,
            claims: block.claims?.map((claim: any) => ({
              text: claim.text ? (claim.text.length > 500 ? claim.text.substring(0, 500) + '...' : claim.text) : undefined,
              confidence: claim.confidence,
              severity: claim.severity,
              evidence: claim.evidence?.slice(0, 5) // Limit evidence items
            })) || [],
            actions: block.actions?.map((action: any) => ({
              description: action.description ? (action.description.length > 500 ? action.description.substring(0, 500) + '...' : action.description) : undefined,
              priority: action.priority,
              effort: action.effort,
              risk: action.risk
            })) || [],
            confidence: block.confidence,
            timestamp: block.timestamp
          })) : [],
          metadata: llmAnalysis.metadata || {},
          markdown: llmAnalysis.markdown ? (llmAnalysis.markdown.length > MAX_STRING_LENGTH 
            ? llmAnalysis.markdown.substring(0, MAX_STRING_LENGTH) + '... [truncated]' 
            : llmAnalysis.markdown) : undefined
        },
        history: state.llmOutputs.history ? deepSerialize(state.llmOutputs.history) : undefined
      };
    }
  }

  if (stepId === 'retrieve_history' && state.history) {
    return {
      ...deepSerialize(state.history),
      // Ensure symbolEvolution Map is converted
      symbolEvolution: state.history.symbolEvolution instanceof Map
        ? Object.fromEntries(state.history.symbolEvolution)
        : state.history.symbolEvolution
    };
  }

  // For other steps, deep serialize the base data
  return deepSerialize(baseData);
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
        mixedConventionFiles: state.drift.mixedConventionFiles,
        hybridDrifts: state.drift.hybridDrifts || []
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
      // Serialize bundle facts, ensuring hybridFacts are included
      if (!state.bundleFacts) return null;
      return {
        ...state.bundleFacts,
        hybridFacts: state.bundleFacts.hybridFacts || {}
      };

    case 'llm_story':
      // Base serialization - deepSerializeStepState handles the full extraction
      return state.llmOutputs || null;

    case 'retrieve_history':
      // Base serialization - deepSerializeStepState handles the full extraction
      return state.history || null;

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
