"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.applySnapshotToState = exports.loadStepSnapshot = exports.saveStepSnapshot = exports.serializeStepState = exports.stableHash = void 0;
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
function toSortedArray(value) {
    if (!value)
        return [];
    var arr = Array.isArray(value) ? __spreadArray([], value, true) : Array.from(value);
    return arr.sort();
}
function stableStringify(value) {
    var seen = new WeakSet();
    var stringify = function (v) {
        if (v === null || typeof v !== 'object')
            return v;
        if (seen.has(v))
            return '[Circular]';
        seen.add(v);
        if (Array.isArray(v)) {
            return v.map(stringify);
        }
        var entries = Object.keys(v).sort().map(function (key) { return [key, stringify(v[key])]; });
        return Object.fromEntries(entries);
    };
    return JSON.stringify(stringify(value));
}
function stableHash(value) {
    return crypto.createHash('sha1').update(stableStringify(value)).digest('hex');
}
exports.stableHash = stableHash;
function serializeStepState(stepId, state) {
    switch (stepId) {
        case 'scope':
            return state.scope ? {
                commitFiles: toSortedArray(state.scope.commitFiles),
                workingChanged: toSortedArray(state.scope.workingChanged),
                blastRadius: toSortedArray(state.scope.blastRadius),
                allPaths: toSortedArray(state.scope.allPaths)
            } : null;
        case 'intended':
            return state.intended ? Array.from(state.intended.entries()).map(function (_a) {
                var symbolId = _a[0], v = _a[1];
                return ({
                    symbolId: symbolId,
                    expect: v.expect,
                    lastName: v.lastName,
                    lastPath: v.lastPath,
                    lastSig: v.lastSig,
                    lastSha: v.lastSha,
                    isRenamed: v.isRenamed || false
                });
            }).sort(function (a, b) { return a.symbolId.localeCompare(b.symbolId); }) : null;
        case 'working':
            return state.working ? {
                symbols: Array.from(state.working.symbolsById.entries())
                    .map(function (_a) {
                    var symbolId = _a[0], s = _a[1];
                    return ({
                        symbolId: symbolId,
                        name: s.name,
                        kind: s.kind,
                        signature: s.signature,
                        loc_post: s.loc_post,
                        loc_pre: s.loc_pre
                    });
                })
                    .sort(function (a, b) { return a.symbolId.localeCompare(b.symbolId); }),
                edges: state.working.edges
                    .map(function (e) { return ({
                    from: e.from_symbol_id,
                    to: e.to_symbol_id,
                    type: e.edge_type,
                    change: e.change_type
                }); })
                    .sort(function (a, b) { return (a.from + a.to).localeCompare(b.from + b.to); }),
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
exports.serializeStepState = serializeStepState;
function saveStepSnapshot(stepId, state, dir) {
    var data = serializeStepState(stepId, state);
    if (data === null || data === undefined)
        return null;
    var snapshot = {
        stepId: stepId,
        data: data,
        hash: stableHash(data)
    };
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    var filePath = path.join(dir, "".concat(stepId, ".json"));
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    return snapshot;
}
exports.saveStepSnapshot = saveStepSnapshot;
function loadStepSnapshot(stepId, dir) {
    var filePath = path.join(dir, "".concat(stepId, ".json"));
    if (!fs.existsSync(filePath))
        return null;
    var parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed;
}
exports.loadStepSnapshot = loadStepSnapshot;
function applySnapshotToState(state, snapshot) {
    var stepId = snapshot.stepId, data = snapshot.data;
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
            state.intended = data ? new Map(data.map(function (item) { return [item.symbolId, {
                    expect: item.expect,
                    lastName: item.lastName,
                    lastPath: item.lastPath,
                    lastSig: item.lastSig,
                    lastSha: item.lastSha,
                    isRenamed: item.isRenamed
                }]; })) : undefined;
            break;
        case 'working':
            state.working = data ? {
                symbolsById: new Map((data.symbols || []).map(function (s) { return [s.symbolId, {
                        id: 0,
                        symbol_id: s.symbolId,
                        name: s.name,
                        kind: s.kind,
                        signature: s.signature,
                        loc_post: s.loc_post,
                        loc_pre: s.loc_pre
                    }]; })),
                symbolsByFile: new Map(),
                edges: (data.edges || []).map(function (e) { return ({
                    from_symbol_id: e.from,
                    to_symbol_id: e.to,
                    edge_type: e.type,
                    change_type: e.change,
                    confidence: 1.0,
                    is_resolved: true
                }); }),
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
exports.applySnapshotToState = applySnapshotToState;
