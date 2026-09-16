// src/workflows/index.js - Workflows Module Entry Point
// Purpose: Export all workflow helpers.
// Workflows orchestrate multiple agents/services for a single business outcome.

export { runSyncWorkflow, describeSyncPlan } from './sync.js';

/** Registry of available workflows (name -> description). */
export const workflowRegistry = {
  sync: 'Aggregate Facebook / Brevo / Sheets data into a single dashboard snapshot.',
  roadmap: 'Score a quiz-style intake, then generate a phased roadmap.',
  product: 'Generate a product concept, then a launch plan.',
};

/**
 * List available workflows.
 * @returns {object[]} Array of { name, description }
 */
export function listWorkflows() {
  return Object.entries(workflowRegistry).map(([name, description]) => ({ name, description }));
}

export default { workflowRegistry, listWorkflows };