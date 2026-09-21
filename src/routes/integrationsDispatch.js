// src/routes/integrationsDispatch.js - Handles integration.* actions from the dashboard
import { checkDashboardApiKey } from '../middleware/auth.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v21.0';
const BREVO_API_BASE = 'https://api.brevo.com/v3';

async function fetchBrevoStatsReal() {
  const apiKey = env.brevo.apiKey;
  if (!apiKey) return { error: 'BREVO_API_KEY not configured' };
  try {
    // Try contacts/statistics first, then fall back to transactions
    const res = await fetch(BREVO_API_BASE + '/contacts/statistics', { headers: { 'api-key': apiKey }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const data = await res.json();
      return { subscribers: data.totalActiveContacts || 0, totalSubscribers: data.totalActiveContacts || 0, emailOpenRate: null, emailClickRate: null, topCampaigns: [], error: null };
    }
    // Fallback: try to get contact list count
    const listRes = await fetch(BREVO_API_BASE + '/contacts/lists', { headers: { 'api-key': apiKey }, signal: AbortSignal.timeout(15000) });
    if (listRes.ok) {
      const listData = await listRes.json();
      let totalContacts = 0;
      if (Array.isArray(listData.lists)) {
        for (const list of listData.lists) {
          if (list.relinkedContactsCount) totalContacts += list.relinkedContactsCount;
        }
      }
      return { subscribers: totalContacts, totalSubscribers: totalContacts, emailOpenRate: null, emailClickRate: null, topCampaigns: [], error: null };
    }
    throw new Error('Brevo stats API error: ' + res.status);
  } catch (err) {
    logger.warn('Brevo stats fetch failed', { error: err.message });
    return { error: 'Brevo API error: ' + err.message, subscribers: 0, totalSubscribers: 0, emailOpenRate: 0, emailClickRate: 0, topCampaigns: [] };
  }
}

async function fetchFacebookStats() {
  const accessToken = env.facebook.accessToken || env.facebook.pageAccessToken;
  const groupId = env.facebook.groupId;
  const pageId = env.facebook.pageId;
  if (!accessToken) return { error: 'Facebook access token not configured', member_count: 0, followers: 0 };
  const results = {};
  if (groupId) {
    try {
      const res = await fetch(FACEBOOK_API_BASE + '/' + groupId + '?fields=member_count,name&access_token=' + encodeURIComponent(accessToken), { signal: AbortSignal.timeout(15000) });
      if (res.ok) results.group = await res.json();
      else results.group = { error: 'Facebook group API error: ' + res.status, member_count: 0 };
    } catch (err) { results.group = { error: err.message, member_count: 0 }; }
  }
  if (pageId) {
    try {
      const res = await fetch(FACEBOOK_API_BASE + '/' + pageId + '?fields=followers_count,likes_count&access_token=' + encodeURIComponent(accessToken), { signal: AbortSignal.timeout(15000) });
      if (res.ok) results.page = await res.json();
      else results.page = { error: 'Facebook page API error: ' + res.status, followers: 0 };
    } catch (err) { results.page = { error: err.message, followers: 0 }; }
  }
  const memberCount = (results.group && results.group.member_count) || 0;
  const followers = (results.page && (results.page.followers_count || results.page.likes_count)) || 0;
  return { ...results, member_count: memberCount, followers, error: null };
}

async function fetchInstagramStats() {
  const accessToken = env.instagram.accessToken;
  const businessId = env.instagram.businessId;
  if (!accessToken || !businessId) return { error: 'Instagram not configured', followers: 0 };
  try {
    const res = await fetch(FACEBOOK_API_BASE + '/' + businessId + '?fields=follower_count,media_count&access_token=' + encodeURIComponent(accessToken), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('Instagram API error: ' + res.status);
    const data = await res.json();
    return { followers: data.follower_count || 0, mediaCount: data.media_count || 0, error: null };
  } catch (err) { return { error: err.message, followers: 0 }; }
}

async function fetchGoogleAnalytics() {
  // Priority 1: GA4 Data API (if measurement ID + OAuth credentials are set)
  const measurementId = env.ga4.measurementId;
  const propertyId = env.ga4.propertyId;
  const refreshToken = env.sheets.refreshToken;
  const clientId = env.sheets.googleClientId;
  const clientSecret = env.sheets.googleClientSecret;

  if (measurementId && refreshToken && clientId && clientSecret) {
    try {
      // Step 1: Exchange refresh token for access token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!tokenRes.ok) throw new Error('GA4 OAuth token refresh failed: ' + tokenRes.status);
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Step 2: Query GA4 Data API
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const props = propertyId || 'properties/' + measurementId.replace('G-', '');
      const res = await fetch(
        'https://analyticsdata.googleapis.com/v1beta/' + props + ':runReport' +
        '?dates=startDate=' + startDate + '&endDate=' + endDate +
        '&metrics=name=sessionCount' +
        '&dimensions=name=city,name=country,name=sessionSource,name=sessionMedium',
        {
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!res.ok) throw new Error('GA4 Data API error: ' + res.status + ' ' + (await res.text()).slice(0, 200));
      const data = await res.json();

      let totalSessions = 0;
      let topPages = [];
      let users30d = 0;
      if (data.rows) {
        totalSessions = data.rows.reduce((s, r) => s + (parseInt(r.values[0]) || 0), 0);
      }
      if (data.dimensionHeaders) {
        const dimIdx = data.dimensionHeaders.findIndex(h => h.name === 'pagePath');
        if (dimIdx >= 0 && data.rows) {
          topPages = data.rows.slice(0, 5).map(r => ({
            path: r.dimensions[dimIdx],
            sessions: parseInt(r.values[data.metricHeaders?.[0]?.name === 'sessionCount' ? 0 : 1]) || 0,
          }));
        }
      }
      return {
        propertyId: propertyId || null,
        measurementId,
        users30d: data.totalRecords > 0 ? data.totalRecords : null,
        sessions30d: totalSessions || null,
        bounceRate: null,
        goalConversions: null,
        revenue30d: null,
        topPages,
        error: null,
      };
    } catch (err) {
      logger.warn('GA4 Data API fetch failed, falling back to Sheets', { error: err.message });
    }
  }

  // Priority 2: Sheets webhook (existing setup)
  if (!env.sheets.webhookUrl) return { error: 'Google Analytics not configured — add GA4_MEASUREMENT_ID + Google OAuth tokens to .env, or use the GA4→Sheets connector', users30d: null, sessions30d: null, revenue30d: null };
  try {
    const res = await fetch(env.sheets.webhookUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('Sheets webhook error: ' + res.status);
    const data = await res.json();
    return {
      propertyId: null,
      measurementId: null,
      users30d: data.analytics?.users30d ?? null,
      sessions30d: data.analytics?.sessions30d ?? null,
      bounceRate: data.analytics?.bounceRate ?? null,
      goalConversions: data.analytics?.goalConversions ?? null,
      revenue30d: data.analytics?.revenue30d ?? null,
      topPages: data.analytics?.topPages ?? [],
      error: null,
    };
  } catch (err) {
    return { error: 'Google Analytics fetch failed: ' + err.message, users30d: null, sessions30d: null, revenue30d: null };
  }
}

export async function handleIntegrationData(req, res, action) {
  if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const subAction = action.replace('integration.', '');
  logger.info('Integration request', { action: subAction });
  try {
    let result;
    switch (subAction) {
      case 'googleAnalytics': result = await fetchGoogleAnalytics(); break;
      case 'social': {
        const fb = await fetchFacebookStats();
        const ig = await fetchInstagramStats();
        result = { platforms: { facebook: fb.error ? null : { followers: fb.followers || 0, members: fb.member_count || 0 }, instagram: ig.error ? null : { followers: ig.followers || 0 } }, followers: (fb.followers || 0) + (ig.followers || 0), engagementRate: null, impressions30d: null, topPosts: [], error: fb.error || ig.error || null };
        break;
      }
      case 'email': result = await fetchBrevoStatsReal(); break;
      case 'community': {
        const fb = await fetchFacebookStats();
        result = { platform: 'facebook', members: fb.member_count || 0, activeToday: null, growth30d: null, error: fb.error || null };
        break;
      }
      case 'all': {
        const [ga, social, email, community] = await Promise.allSettled([
          fetchGoogleAnalytics(),
          fetchFacebookStats().then(fb => ({ platforms: { facebook: fb.error ? null : { followers: fb.followers || 0, members: fb.member_count || 0 }, instagram: { followers: 0 } }, followers: fb.followers || 0, engagementRate: null, impressions30d: null, topPosts: [], error: fb.error || null })),
          fetchBrevoStatsReal(),
          fetchFacebookStats().then(fb => ({ platform: 'facebook', members: fb.member_count || 0, activeToday: null, growth30d: null, error: fb.error || null })),
        ]);
        result = { googleAnalytics: ga.status === 'fulfilled' ? ga.value : { error: ga.reason?.message }, social: social.status === 'fulfilled' ? social.value : { error: social.reason?.message }, email: email.status === 'fulfilled' ? email.value : { error: email.reason?.message }, community: community.status === 'fulfilled' ? community.value : { error: community.reason?.message } };
        break;
      }
      default: return res.status(400).json({ error: 'Unknown integration action: ' + subAction });
    }
    const hasError = result && typeof result === 'object' && result.error;
    res.status(200).json({ success: true, data: result, connected: !hasError && (result.subscribers || result.followers || result.member_count || result.users30d || Object.keys(result.platforms || {}).length > 0) });
  } catch (err) {
    logger.error('Integration handler failed', { action: subAction, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleIntegrationStart(req, res) {
  if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const provider = body.provider || '';
  logger.info('Integration start requested', { provider });
  res.status(200).json({ success: true, message: provider + ' connection initiated. Configure credentials in .env to complete.' });
}

export default { handleIntegrationData, handleIntegrationStart };
