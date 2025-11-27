/**
 * Export all mock scenarios for LLM analysis testing
 */

export { cleanRefactor } from './cleanRefactor';
export { incompleteRefactor } from './incompleteRefactor';
export { missingDependencies } from './missingDependencies';

// Export scenario registry
import { MockScenario } from '../dataFactory';
import { cleanRefactor } from './cleanRefactor';
import { incompleteRefactor } from './incompleteRefactor';
import { missingDependencies } from './missingDependencies';

export const allScenarios: MockScenario[] = [
  cleanRefactor,
  incompleteRefactor,
  missingDependencies
];

export const scenariosByName: Record<string, MockScenario> = {
  cleanRefactor,
  incompleteRefactor,
  missingDependencies
};
