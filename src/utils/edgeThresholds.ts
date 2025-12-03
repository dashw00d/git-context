export function getDynamicThreshold(edgeCount: number): number {
  return edgeCount < 50 ? 0.4 : 0.7;
}

export function getDefaultThreshold(): number {
  return 0.5;
}
