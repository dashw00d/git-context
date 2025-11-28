"use strict";
/**
 * Shared utilities for edge confidence thresholds
 * Centralizes threshold logic used across multiple modules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultThreshold = exports.getDynamicThreshold = void 0;
/**
 * Get dynamic confidence threshold based on edge count
 * Lower threshold for smaller graphs, higher for larger graphs
 */
function getDynamicThreshold(edgeCount) {
    return edgeCount < 50 ? 0.4 : 0.7;
}
exports.getDynamicThreshold = getDynamicThreshold;
/**
 * Get default confidence threshold for edge filtering
 */
function getDefaultThreshold() {
    return 0.5;
}
exports.getDefaultThreshold = getDefaultThreshold;
