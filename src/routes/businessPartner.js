// AI Business Partner endpoint — structured JSON business intelligence
import { aiRouter } from '../services/aiRouter.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { ValidationError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { formatUSD, safeNumber } from '../utils/formatters.js';
import { fetchFacebookGroup, fetchBrevoStats, fetchSheetsData } from '../services/integrations.js';
import * as githubEditor from '../services/githubEditor.js';
import { looksLikeWebsiteEdit } from '../services/websitePlanner.js';
import { JOB_TYPES } from '../services/aiRouter.js';

/** Render a plan as human-readable text for the chat bubble. */
function buildPlanPreview(plan) {
  const lines = [`Here's the change I'm ready to make:`, ``];
  lines.push(plan.understood || 'Website update');
  lines.push('');

  for (const edit of plan.edits || []) {
    const changed = (edit.hunks || [])
      .flat()
      .filter((h) => h.type === 'added').length;
    lines.push(`- ${edit.path} (${changed} line${changed === 1 ? '' : 's'} added)`);
  }

  for (const note of plan.notes || []) lines.push(`  ${note}`);

  if ((plan.warnings || []).length) {
    lines.push('');
    lines.push('I skipped:');
    for (const w of plan.warnings) lines.push(`  ${w}`);
  }

  lines.push('');
  lines.push('Nothing is changed yet — approve this and I will commit it.');
  return lines.join('\n');
}

/** Render the outcome of applying a plan. */
function summarizeAppliedEdits(result) {
  const lines = [];
  for (const r of result.appliedEdit || []) {
    if (r.ok) {
      lines.push(`Committed ${r.file}${r.created ? ' (new file)' : ''}. A deploy will follow.`);
    } else {
      lines.push(`Could not change ${r.file}: ${r.error}`);
    }
  }
  return lines.join('\n') || 'No changes were applied.';
}

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
- Always end with a next step.

WHEN SHE ASKS YOU TO CHANGE THE WEBSITE
- "Fix the homepage", "change the hero headline", "update the pricing copy" — these are CODE REQUESTS, not business questions.
- If the request names a page, file, component, or copy change, say plainly what you are about to change and hand the change to the website editor for approval.
- The edit is reviewed before it is committed, so never claim the change is already done. Say the change is ready for review.`;

export async function handleBusinessPartner(req, res) {
  try {
    if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const userMessage = String(body.message || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    if (!userMessage) throw new ValidationError('message is required');

    logger.info('Business partner request', { length: userMessage.length });

    // --- Website edit path -------------------------------------------------
    // If this is a code request (not a strategy question), plan the change and
    // return a preview. Nothing is written here — the user must approve via
    // POST /api/website/apply before a commit happens.
    if (body.applyPlan) {
      const { applyWebsitePlan } = await import('../services/websitePlanner.js');
      const result = await applyWebsitePlan(body.applyPlan, { confirm: body.confirm });
      return res.status(200).json({
        reply: summarizeAppliedEdits(result),
        appliedEdit: result.appliedEdit,
        provider: 'hermes',
        model: 'website-editor',
        timestamp: Date.now(),
      });
    }

    if (looksLikeWebsiteEdit(userMessage)) {
      const { planWebsiteEdit } = await import('../services/websitePlanner.js');
      if (!githubEditor.isGithubEditorConfigured()) {
        logger.warn('Website edit requested but GitHub editor is not configured');
      } else {
        try {
          const plan = await planWebsiteEdit(userMessage);
          return res.status(200).json({
            reply: plan.needsMoreContext
              ? plan.question
              : buildPlanPreview(plan),
            plan,
            needsApproval: !plan.needsMoreContext,
            provider: 'hermes',
            model: 'website-editor',
            timestamp: Date.now(),
          });
        } catch (planErr) {
          logger.error('Website plan failed inside business partner', planErr);
          return res.status(200).json({
            reply:
              `I couldn't turn that into a safe change yet: ${planErr.message}. ` +
              'Nothing was modified.',
            provider: 'hermes',
            model: 'website-editor',
            timestamp: Date.now(),
          });
        }
      }
    }

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

    // The client may hint at the job class (e.g. the dashboard sends
    // job:"reasoning"). Default to 'reasoning' — this endpoint does strategic
    // work, not casual chat.
    const job = JOB_TYPES.includes(body.job) ? body.job : 'reasoning';

    const result = await aiRouter.generate(null, userMessage, {
      mode: 'ultraMode',
      job,
      systemPrompt,
      jsonMode: true
    });

    if (result.error) {
      // The model chain failing is a degraded state, not a client error. The
      // dashboard renders a message either way, so return 200 with a flag
      // rather than 500 (which previously blanked the chat panel).
      logger.error('Business partner AI failed', { error: result.error });
      return res.status(200).json({
        success: false,
        available: false,
        degraded: true,
        error: 'AI failed',
        details: result.error,
        reply:
          'Hermes is not answering right now. Your dashboard data is safe - try again in a moment.',
        businessInsights: null,
        provider: result.provider || null,
        model: result.model || null,
        timestamp: Date.now(),
      });
    }

    let businessInsights = null;
    let reply = result.reply;
    try {
      // Strip an optional JSON fence, then parse. These regexes were previously
      // double-escaped (they matched literal backslashes), so the JSON block was
      // never parsed and leaked into the chat prose as raw fenced text.
      const cleaned = reply.replace(/^`(?:json)?\s*/i, '').replace(/\s*`$/i, '').trim();
      const braceStart = cleaned.indexOf('{');
      const braceEnd = cleaned.lastIndexOf('}');

      let parsed = null;
      if (braceStart !== -1 && braceEnd > braceStart) {
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          try {
            parsed = JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
          } catch {
            parsed = null;
          }
        }
      }

      if (parsed && (parsed.summary || parsed.revenue_signals)) {
        businessInsights = parsed;
        // Keep only the prose; the structured fields render separately.
        // Cut at the first fence OR brace so a trailing ` never leaks in.
        const fenceAt = cleaned.indexOf('`');
        const cut = fenceAt !== -1 && fenceAt < braceStart ? fenceAt : braceStart;
        reply = cleaned.slice(0, cut).trim() || 'Here are my insights:';
      }
    } catch {
      // Not JSON - use raw reply
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
