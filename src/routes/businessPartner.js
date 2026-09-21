// AI Business Partner endpoint — structured JSON business intelligence
import { aiRouter } from '../services/aiRouter.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { ValidationError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { formatUSD, safeNumber } from '../utils/formatters.js';
import { fetchFacebookGroup, fetchBrevoStats, fetchSheetsData } from '../services/integrations.js';

const SYSTEM_PROMPT = `You are Hermes — Francesca's AI business partner at DigitallyDefined.

YOUR REAL-TIME DATA:
{BUSINESS_CONTEXT}

YOUR KNOWLEDGE:
- Runs DigitallyDefined: faceless digital real estate for Gen X women
- Core product: Digital Superpower Quiz → roadmap → email capture
- Traffic: Facebook groups, SEO, community
- Revenue: quiz conversions + Gumroad product sales
- Stack: React/Vite, Supabase, Notion, Brevo, OmniRoute AI

HOW YOU TALK:
- Conversational, trusted co-founder voice
- Lead with the answer, then explain
- Use natural phrases: "I think", "Here's my read", "Let me be straight with you"
- 3-8 sentences. Be direct. No markdown, no code fences, no emojis.

BUSINESS INTELLIGENCE STRUCTURE (return this JSON at the end):
{
  "summary": "One sentence: what's working, what's not",
  "revenue_signals": { "trend": "growing|stable|declining|insufficient_data", "top_product": "name or null", "top_lead_source": "name or null" },
  "growth_opportunities": ["opp 1", "opp 2", "opp 3"],
  "risk_flags": ["risk 1", "risk 2"],
  "recommended_next_action": "single most important next step",
  "confidence": "high|medium|low"
}

RULES:
- Never say "as an AI". You're her partner.
- Never hallucinate data. If you don't know, say so.
- Always end with a next step.`;

export async function handleBusinessPartner(req, res) {
  try {
    if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const userMessage = String(body.message || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    if (!userMessage) throw new ValidationError('message is required');

    logger.info('Business partner request', { length: userMessage.length });

    let businessContext = '';
    try {
      const [fbData, brevoData, sheetsResult] = await Promise.all([
        fetchFacebookGroup(), fetchBrevoStats(), fetchSheetsData()
      ]);
      const s = sheetsResult?.data || {};
      businessContext = [
        'REVENUE: ' + formatUSD(safeNumber(s.revenue, 0)),
        'LEADS: ' + safeNumber(s.leads, 0),
        'COMMUNITY: ' + safeNumber(s.communityCount, fbData?.member_count || 0) + ' members',
        'EMAIL SUBS: ' + safeNumber(brevoData?.totalSubscribers, 0),
        'OPEN RATE: ' + (safeNumber(brevoData?.emailOpenRate, 0) * 100).toFixed(1) + '%',
        'CLICK RATE: ' + (safeNumber(brevoData?.emailClickRate, 0) * 100).toFixed(1) + '%',
        'CONVERSION: ' + (safeNumber(s.conversionRate, 0) * 100).toFixed(1) + '%',
        'TOP PRODUCT: ' + (s.topProducts?.[0]?.product_name || 'N/A'),
        'TOP SOURCE: ' + (s.leadSources?.[0]?.source_page || 'N/A'),
        'SITE HEALTH: ' + (s.siteHealth || '100%'),
      ].join(' | ');
    } catch (err) {
      logger.warn('Business data fetch failed', { error: err.message });
      businessContext = 'Live data unavailable.';
    }

    const systemPrompt = SYSTEM_PROMPT.replace('{BUSINESS_CONTEXT}', businessContext);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(m => m.role === 'user' || m.role === 'assistant'),
      { role: 'user', content: userMessage }
    ];

    const result = await aiRouter.generate(null, userMessage, {
      mode: 'ultraMode',
      systemPrompt,
      jsonMode: true
    });

    if (result.error) {
      logger.error('Business partner AI failed', { error: result.error });
      return res.status(500).json({ error: 'AI failed', details: result.error });
    }

    let businessInsights = null;
    let reply = result.reply;
    try {
      const cleaned = reply.replace(/^\`\`\`(?:json)?\\s*/i, '').replace(/\\s*\`\`\`$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.summary || parsed.revenue_signals) {
        businessInsights = parsed;
        const jsonMatch = reply.match(/\{[\\s\\S]*\}/);
        if (jsonMatch) reply = reply.substring(0, reply.indexOf(jsonMatch[0])).trim() || 'Here are my insights:';
      }
    } catch {
      // Not JSON — use raw reply
    }

    return res.status(200).json({
      reply: reply.trim(),
      businessInsights,
      provider: result.provider || 'unknown',
      model: result.model || 'unknown',
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Business partner request failed', error);
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: 'Business partner failed', details: error.message });
  }
}

export default { handleBusinessPartner };
