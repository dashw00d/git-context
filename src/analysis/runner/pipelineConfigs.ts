export const LIVE_OPTIONAL_STEPS = new Set([
  'hotspots',
  'moved_blocks',
  'embedding_index',
  'retrieve_history',
  'llm_story',
]);
export const CHEAP_LIVE_STEPS = new Set(['drift', 'legacy']);

export const OPTIONAL_STEPS = new Set([...LIVE_OPTIONAL_STEPS, ...CHEAP_LIVE_STEPS]);
