// src/workflows/sync.js - Data Sync Workflow
// Purpose: Aggregate Facebook / Brevo / Google Sheets data into one snapshot.
// Mirrors the dashboard route's data collection so it can be reused by cron jobs.

import { fetchFacebookGroup, fetchBrevoStats, fetchSheetsData } from '../services/integrations.js';
import { safeNumber, safeString } from '../utils/formatters.js';
import logger from '../utils/logger.js';

/** Describe what the sync workflow will collect (no network calls). */
export function describeSyncPlan() {
  return {
    sources: ['facebook', 'brevo', 'sheets'],
    outputs: ['community', 'email', 'revenue', 'leads', 'siteHealth'],
  };
}

/**
 * Run the sync workflow: fetch all sources in parallel and normalize the result.
 * Never throws — each source degrades to an error field.
 * @returns {Promise<object>} Normalized snapshot
 */
export async function runSyncWorkflow() {
  logger.info('Sync workflow started');
  console.log('[workflows/sync] starting');

  const [fbData, brevoData, sheetsResult] = await Promise.all([
    fetchFacebookGroup(),
    fetchBrevoStats(),
    fetchSheetsData(),
  ]);

  const sheetsData = sheetsResult.data || {};

  const snapshot = {
    community: {
      memberCount: safeNumber(fbData && fbData.member_count, safeNumber(sheetsData.communityCount, 0)),
      name: safeString(fbData && fbData.name, ''),
      error: (fbData && fbData.error) || null,
    },
    email: {
      subscribers: (brevoData && brevoData.totalSubscribers) || 0,
      openRate: (brevoData && brevoData.emailOpenRate) || 0,
      clickRate: (brevoData && brevoData.emailClickRate) || 0,
      error: (brevoData && brevoData.error) || null,
    },
    business: {
      revenue: safeString(sheetsData.revenue, '$0'),
      leads: safeNumber(sheetsData.leads, 0),
      siteHealth: safeString(sheetsData.siteHealth, '100%'),
      error: sheetsResult.error || null,
    },
    timestamp: Date.now(),
  };

  logger.info('Sync workflow completed', {
    community: snapshot.community.memberCount,
    subscribers: snapshot.email.subscribers,
  });
  console.log('[workflows/sync] completed', { community: snapshot.community.memberCount, subscribers: snapshot.email.subscribers });

  return snapshot;
}

export default { runSyncWorkflow, describeSyncPlan };