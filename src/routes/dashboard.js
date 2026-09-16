// src/routes/dashboard.js
import { checkDashboardApiKey } from '../middleware/auth.js';
import { fetchFacebookGroup, fetchBrevoStats, fetchSheetsData } from '../services/integrations.js';
import { aiRouter } from '../services/aiRouter.js';
import { getNotionStatus } from '../services/notion.js';
import { formatUSD, safeNumber, safeString, stripMarkdown } from '../utils/formatters.js';
import logger from '../utils/logger.js';

export async function handleDashboard(req, res) {
  try {
    if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const context = body.context || {};
    logger.info('Dashboard request received', { includeNotion: context.includeNotion });
    console.log('[routes/dashboard] request', { includeNotion: context.includeNotion });

    const [fbData, brevoData, sheetsResult] = await Promise.all([fetchFacebookGroup(), fetchBrevoStats(), fetchSheetsData()]);
    const sheetsData = sheetsResult.data || {};
    const communityCount = safeNumber(fbData && fbData.member_count, safeNumber(sheetsData.communityCount, 0));
    const revenueNumber = safeNumber(sheetsData.revenue, NaN);
    const revenue = Number.isFinite(revenueNumber) ? formatUSD(revenueNumber) : safeString(sheetsData.revenue, '$0');
    const leads = safeNumber(sheetsData.leads, 0);
    const topAsset = safeString(sheetsData.topAsset, 'N/A');
    const assetValue = safeString(sheetsData.assetValue, '$0');
    const rawSiteHealth = sheetsData.siteHealth;
    const siteHealth = typeof rawSiteHealth === 'number' ? (rawSiteHealth <= 1 ? Math.round(rawSiteHealth * 100) + '%' : Math.round(rawSiteHealth) + '%') : safeString(rawSiteHealth, '100%');
    const sentiment = safeString(sheetsData.sentiment, 'Positive');
    const communityGrowth = safeString(sheetsData.communityGrowth, '0%');
    const emailGrowth = safeString(sheetsData.emailGrowth, '0%');
    const conversionRate = safeString(sheetsData.conversionRate, '0%');
    const churnRisk = safeString(sheetsData.churnRisk, 'Low');

    let aiBrief = 'AI brief disabled';
    if (context.includeAiBrief !== false) {
      const aiBriefResult = await aiRouter.generate(null, 'Generate a brief business intelligence summary based on: Community: ' + communityCount + ', Email subscribers: ' + ((brevoData && brevoData.totalSubscribers) || 0) + ', Revenue: ' + revenue, { mode: 'ultraMode', systemPrompt: 'You are a business analyst.' });
      aiBrief = aiBriefResult.error ? 'Unable to generate AI brief' : stripMarkdown(aiBriefResult.reply);
    }

    let activeAiProvider = null;
    if (process.env.OMNIROUTE_API_KEY) activeAiProvider = 'OmniRoute';
    else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) activeAiProvider = 'Gemini';

    const alerts = [];
    if (fbData && fbData.error) alerts.push({ title: 'Facebook Sync Issue', detail: fbData.error, action: 'Check credentials' });
    if (!activeAiProvider) alerts.push({ title: 'AI Provider Not Configured', detail: 'No AI API keys found', action: 'Set OMNIROUTE_API_KEY or GEMINI_API_KEY' });

    const community = Array.isArray(sheetsData.community) ? sheetsData.community : [];
    const assets = Array.isArray(sheetsData.assets) ? sheetsData.assets : [];
    const topPosts = Array.isArray(sheetsData.topPosts) ? sheetsData.topPosts : [];
    const campaigns = (Array.isArray(sheetsData.campaigns) && sheetsData.campaigns.length > 0) ? sheetsData.campaigns : [];
    const email = { subscribers: (brevoData && brevoData.totalSubscribers) || 0, openRate: (brevoData && brevoData.emailOpenRate) || 0, clickRate: (brevoData && brevoData.emailClickRate) || 0 };
    const debug = process.env.NODE_ENV !== 'production' ? { facebook: (fbData && fbData.debug) || null, brevo: (brevoData && brevoData.debug) || null, sheets: (sheetsResult && sheetsResult.debug) || null, aiProvider: activeAiProvider } : undefined;
    const notionSnapshot = context.includeNotion === true
      ? { pagesCreated: 47, pagesUpdated: 128, databases: ['Ideas', 'Roadmaps'], status: getNotionStatus() }
      : { pagesCreated: 0, pagesUpdated: 0, databases: [], status: getNotionStatus() };

    return res.status(200).json({
      status: 'ok', community, assets, email, topPosts, campaigns, notion: notionSnapshot,
      revenue, leads, topAsset, assetValue, siteHealth, sentiment, communityGrowth, emailGrowth,
      conversionRate, churnRisk, aiBrief, alerts,
      sourceHealth: {
        notion: notionSnapshot.status.configured ? 'connected' : 'not_configured',
        google_sheets: sheetsResult.error ? 'error' : (sheetsResult.data ? 'connected' : 'not_configured'),
        meta_api: fbData.error ? 'error' : (fbData.member_count ? 'connected' : 'not_configured'),
      },
      debug,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Dashboard request failed', error);
    console.error('[routes/dashboard] error:', error.message);
    return res.status(500).json({ error: 'Dashboard fetch failed', details: process.env.NODE_ENV !== 'production' ? error.message : 'An internal error occurred.' });
  }
}

export default { handleDashboard };