// _shared/brevo-email.ts — Brevo email service with dev/test/blackhole modes
// Protects Brevo quota during testing while maintaining full production capability

const BLACKHOLE_EMAIL = 'blackhole@brevo.com';

export type EmailMode = 'dev' | 'test' | 'blackhole' | 'live';

export interface BrevoConfig {
  apiKey: string | null;
  listId: string | null;
  fromEmail: string | null;
  fromName: string;
}

export interface QuizEmailPayload {
  toEmail: string;
  toName: string;
  superpower: string;
  roadmap?: Record<string, unknown>;
  answers?: Record<string, string>;
}

export interface EmailResult {
  ok: boolean;
  mode: EmailMode;
  emailSent: boolean;
  email?: string;
  originalEmail?: string;
  brevoUsed?: boolean;
  emailSkipped?: boolean;
  meta?: Record<string, unknown>;
  error?: string;
}

/**
 * Determine email mode from request body flags
 */
export function detectEmailMode(
  body: Record<string, unknown>,
  config: BrevoConfig
): EmailMode {
  const devMode = body.devMode === true || body.dev === true;
  const brevoTest = body.brevoTest === true;
  const testEmail = body.testEmail === true;
  const email = String(body.email || '').toLowerCase();

  if (devMode) return 'dev';
  if (brevoTest) return 'test';
  if (testEmail || email === BLACKHOLE_EMAIL) return 'blackhole';
  if (!config.apiKey || !config.listId) return 'dev'; // fallback to dev if not configured
  return 'live';
}

/**
 * Send quiz completion email with mode-aware routing
 */
export async function sendQuizEmail(
  payload: QuizEmailPayload,
  mode: EmailMode,
  config: BrevoConfig
): Promise<EmailResult> {
  const { toEmail, toName, superpower, roadmap, answers } = payload;

  // DEV MODE: Skip entirely, log to console
  if (mode === 'dev') {
    console.log('[quiz-email] DEV MODE — skipping Brevo send');
    console.log('[quiz-email] Would send to:', {
      to: toEmail,
      name: toName,
      superpower,
      hasRoadmap: !!roadmap,
      answerCount: Object.keys(answers || {}).length,
    });
    return {
      ok: true,
      mode: 'dev',
      emailSent: false,
      email: toEmail,
      emailSkipped: true,
      brevoUsed: false,
    };
  }

  // TEST MODE: Send with X-Brevo-Test header
  if (mode === 'test') {
    console.log('[quiz-email] TEST MODE — sending with X-Brevo-Test header');
    return await sendWithTestHeader(toEmail, toName, superpower, roadmap, answers, config);
  }

  // BLACKHOLE MODE: Send to blackhole address
  if (mode === 'blackhole') {
    console.log('[quiz-email] BLACKHOLE MODE — sending to blackhole@brevo.com');
    return await sendToBlackhole(toEmail, toName, superpower, roadmap, answers, config);
  }

  // LIVE MODE: Send real email
  console.log('[quiz-email] LIVE MODE — sending real email');
  return await sendLiveEmail(toEmail, toName, superpower, roadmap, answers, config);
}

/**
 * Send email with X-Brevo-Test header (sandbox mode)
 */
async function sendWithTestHeader(
  toEmail: string,
  toName: string,
  superpower: string,
  roadmap: Record<string, unknown> | undefined,
  answers: Record<string, string> | undefined,
  config: BrevoConfig
): Promise<EmailResult> {
  if (!config.apiKey) {
    return { ok: false, mode: 'test', emailSent: false, error: 'Brevo API key not configured' };
  }

  try {
    const htmlContent = buildQuizEmailHtml(toName, superpower, roadmap);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
        'X-Brevo-Test': 'true', // Sandbox mode - no delivery, no quota
      },
      body: JSON.stringify({
        sender: {
          email: config.fromEmail || 'hello@digitallydefined.online',
          name: config.fromName || 'DigitallyDefined',
        },
        to: [{ email: toEmail, name: toName }],
        subject: `${toName}, your Digital Superpower roadmap is ready`,
        contentMigration: 'replace',
        htmlContent,
        tags: ['quiz-roadmap', 'test-mode'],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log('[quiz-email] TEST mode response:', { messageId: data.messageId, messageIdGroup: data.messageIdGroup });
      return {
        ok: true,
        mode: 'test',
        emailSent: true,
        email: toEmail,
        brevoUsed: true,
        meta: data,
      };
    }

    const text = await res.text().catch(() => '');
    console.error('[quiz-email] TEST mode failed:', res.status, text);
    return {
      ok: false,
      mode: 'test',
      emailSent: false,
      email: toEmail,
      brevoUsed: true,
      error: `Brevo test send failed: ${res.status} ${text.slice(0, 100)}`,
    };
  } catch (error) {
    console.error('[quiz-email] TEST mode exception:', error);
    return {
      ok: false,
      mode: 'test',
      emailSent: false,
      email: toEmail,
      brevoUsed: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send to blackhole address (accepts but doesn't deliver)
 */
async function sendToBlackhole(
  originalEmail: string,
  toName: string,
  superpower: string,
  roadmap: Record<string, unknown> | undefined,
  answers: Record<string, string> | undefined,
  config: BrevoConfig
): Promise<EmailResult> {
  if (!config.apiKey) {
    return { ok: false, mode: 'blackhole', emailSent: false, error: 'Brevo API key not configured' };
  }

  try {
    const htmlContent = buildQuizEmailHtml(toName, superpower, roadmap);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: config.fromEmail || 'hello@digitallydefined.online',
          name: config.fromName || 'DigitallyDefined',
        },
        to: [{ email: BLACKHOLE_EMAIL, name: toName }],
        subject: `${toName}, your Digital Superpower roadmap is ready`,
        contentMigration: 'replace',
        htmlContent,
        variables: {
          NAME: toName,
          SUPERPOWER: superpower,
          ORIGINAL_EMAIL: originalEmail,
        },
        tags: ['quiz-roadmap', 'blackhole-test'],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log('[quiz-email] BLACKHOLE mode response:', { messageId: data.messageId });
      return {
        ok: true,
        mode: 'blackhole',
        emailSent: true,
        email: BLACKHOLE_EMAIL,
        originalEmail,
        brevoUsed: true,
        meta: data,
      };
    }

    const text = await res.text().catch(() => '');
    console.error('[quiz-email] BLACKHOLE mode failed:', res.status, text);
    return {
      ok: false,
      mode: 'blackhole',
      emailSent: false,
      email: BLACKHOLE_EMAIL,
      originalEmail,
      brevoUsed: true,
      error: `Brevo blackhole send failed: ${res.status} ${text.slice(0, 100)}`,
    };
  } catch (error) {
    console.error('[quiz-email] BLACKHOLE mode exception:', error);
    return {
      ok: false,
      mode: 'blackhole',
      emailSent: false,
      email: BLACKHOLE_EMAIL,
      originalEmail,
      brevoUsed: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send live production email
 */
async function sendLiveEmail(
  toEmail: string,
  toName: string,
  superpower: string,
  roadmap: Record<string, unknown> | undefined,
  answers: Record<string, string> | undefined,
  config: BrevoConfig
): Promise<EmailResult> {
  if (!config.apiKey || !config.listId) {
    return { ok: false, mode: 'live', emailSent: false, error: 'Brevo configuration incomplete' };
  }

  try {
    const htmlContent = buildQuizEmailHtml(toName, superpower, roadmap);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: config.fromEmail || 'hello@digitallydefined.online',
          name: config.fromName || 'DigitallyDefined',
        },
        to: [{ email: toEmail, name: toName }],
        subject: `${toName}, your Digital Superpower roadmap is ready`,
        contentMigration: 'replace',
        htmlContent,
        tags: ['quiz-roadmap', 'live'],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log('[quiz-email] LIVE send successful:', { messageId: data.messageId });
      return {
        ok: true,
        mode: 'live',
        emailSent: true,
        email: toEmail,
        brevoUsed: true,
        meta: data,
      };
    }

    const text = await res.text().catch(() => '');
    console.error('[quiz-email] LIVE send failed:', res.status, text);
    return {
      ok: false,
      mode: 'live',
      emailSent: false,
      email: toEmail,
      brevoUsed: true,
      error: `Brevo send failed: ${res.status} ${text.slice(0, 100)}`,
    };
  } catch (error) {
    console.error('[quiz-email] LIVE send exception:', error);
    return {
      ok: false,
      mode: 'live',
      emailSent: false,
      email: toEmail,
      brevoUsed: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build HTML email content for quiz completion
 */
function buildQuizEmailHtml(
  name: string,
  superpower: string,
  roadmap: Record<string, unknown> | undefined
): string {
  const steps = roadmap?.steps as string[] | undefined;
  const nextAction = roadmap?.nextAction as string | undefined;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Digital Superpower Roadmap</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a12; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 4px;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; border-bottom: 1px solid #2a2a4a;">
              <h1 style="margin: 0; color: #c9a84c; font-size: 24px; font-weight: 600;">
                DigitallyDefined
              </h1>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #c9a84c; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                Your result is ready
              </p>
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 28px; font-weight: 600;">
                Hello ${name},
              </h2>
              <p style="margin: 0 0 30px; color: #a0a0b0; font-size: 16px; line-height: 1.6;">
                Based on your answers, your digital superpower is:
              </p>
              <div style="background-color: #0a0a12; border: 1px solid #c9a84c; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; color: #c9a84c; font-size: 20px; font-weight: 600; text-transform: capitalize;">
                  ${superpower}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Roadmap Steps -->
          ${steps && steps.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 40px;">
              <h3 style="margin: 0 0 20px; color: #ffffff; font-size: 18px; font-weight: 600;">
                Your Personalized Roadmap
              </h3>
              <ol style="margin: 0; padding-left: 20px; color: #a0a0b0; font-size: 15px; line-height: 1.8;">
                ${steps.map((step: string) => `<li style="margin-bottom: 10px;">${step}</li>`).join('\n                ')}
              </ol>
            </td>
          </tr>
          ` : ''}
          
          <!-- Next Action -->
          ${nextAction ? `
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #0a0a12; border-left: 3px solid #c9a84c; padding: 20px;">
                <p style="margin: 0 0 10px; color: #c9a84c; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                  Your next action
                </p>
                <p style="margin: 0; color: #ffffff; font-size: 16px;">
                  ${nextAction}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          
          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="https://digitallydefined.online/tools/scorecard" 
                 style="display: inline-block; background-color: #c9a84c; color: #0a0a12; padding: 14px 32px; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 4px; margin-top: 20px;">
                Score My Niche →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 40px; border-top: 1px solid #2a2a4a; text-align: center;">
              <p style="margin: 0 0 10px; color: #666677; font-size: 13px;">
                You're receiving this because you completed the Digital Superpower Quiz at DigitallyDefined.online
              </p>
              <p style="margin: 0; color: #666677; font-size: 12px;">
                © 2026 DigitallyDefined. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Get Brevo configuration from environment
 */
export function getBrevoConfig(): BrevoConfig {
  return {
    apiKey: Deno.env.get('BREVO_API_KEY') || null,
    listId: Deno.env.get('BREVO_LIST_ID') || null,
    fromEmail: Deno.env.get('BREVO_FROM_EMAIL') || Deno.env.get('SELLABLE_FROM_EMAIL') || null,
    fromName: Deno.env.get('BREVO_FROM_NAME') || Deno.env.get('SELLABLE_FROM_NAME') || 'DigitallyDefined',
  };
}

export interface ContactSyncResult {
  ok: boolean;
  mode: EmailMode;
  brevoUsed: boolean;
  email?: string;
  error?: string;
}

/**
 * Add (or update) a contact on the Brevo list.
 *
 * Used by the public `subscribe` action so every website signup
 * (launcher CTA, tool funnels, footer) lands in the same Brevo list
 * the quiz emails already use.
 *
 * Mode-aware like the quiz email sender:
 *  - no apiKey/listId -> 'dev' (skip, log only)
 *  - blackhole target -> still recorded, sent as the blackhole address
 *  - otherwise        -> live POST /v3/contacts (updateEnabled: true)
 */
export async function addContactToList(
  email: string,
  name: string | null,
  source: string | null,
  tags: string[] | null,
  config: BrevoConfig
): Promise<ContactSyncResult> {
  const normalized = String(email || '').trim().toLowerCase();

  // Not configured -> skip quietly (dev parity with the email sender).
  if (!config.apiKey || !config.listId) {
    console.log('[brevo-contacts] DEV/SKIP — BREVO_API_KEY or BREVO_LIST_ID not set. Would add:', {
      email: normalized,
      name,
      source,
      tags,
    });
    return { ok: true, mode: 'dev', brevoUsed: false, email: normalized };
  }

  // Guard the Brevo sandbox/quota during testing.
  const targetEmail = normalized === BLACKHOLE_EMAIL ? BLACKHOLE_EMAIL : normalized;
  const listIdNumber = Number(config.listId);

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
      },
      body: JSON.stringify({
        email: targetEmail,
        updateEnabled: true, // upsert — never fail because the contact exists
        listIds: Number.isFinite(listIdNumber) && listIdNumber > 0 ? [listIdNumber] : undefined,
        attributes: {
          NAME: name || '',
          SOURCE: source || 'website',
          ...(tags && tags.length ? { TAGS: tags.join(', ') } : {}),
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    // 201 created, 204 updated, 200 ok — all success paths.
    if (res.ok) {
      console.log('[brevo-contacts] Contact synced:', { email: targetEmail, listId: config.listId });
      return { ok: true, mode: 'live', brevoUsed: true, email: targetEmail };
    }

    const text = await res.text().catch(() => '');
    console.error('[brevo-contacts] Sync failed:', res.status, text.slice(0, 200));
    return {
      ok: false,
      mode: 'live',
      brevoUsed: true,
      email: targetEmail,
      error: `Brevo contact sync failed: ${res.status} ${text.slice(0, 100)}`,
    };
  } catch (error) {
    console.error('[brevo-contacts] Sync exception:', error);
    return {
      ok: false,
      mode: 'live',
      brevoUsed: true,
      email: targetEmail,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Generic transactional email + roadmap email builder
// (consolidated from workspace-root supabase/functions/_shared/brevo-email.ts)
// ============================================================================

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

interface RoadmapStep { title?: string; description?: string; timeframe?: string }
interface RoadmapPayload {
  title?: string;
  summary?: string;
  steps?: RoadmapStep[];
  next3Steps?: string[];
  recommendedTool?: string;
  cta?: string;
}
interface RoadmapProfile { superpowerName: string; superpowerDescription?: string }

export async function sendBrevoEmail({ to, name, subject, html }: { to: string; name?: string; subject: string; html: string }) {
  const apiKey = Deno.env.get("BREVO_API_KEY") || "";
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "hello@digitallydefined.online";
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "DigitallyDefined";

  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to, name: name || undefined }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildRoadmapEmail(profile: RoadmapProfile, roadmap: RoadmapPayload, name?: string) {
  const greeting = name ? `Hi ${esc(name)},` : "Hi there,";
  const steps = Array.isArray(roadmap?.steps) ? roadmap.steps : [];
  const next3 = Array.isArray(roadmap?.next3Steps) ? roadmap.next3Steps : [];
  const tool = roadmap?.recommendedTool;
  const cta = roadmap?.cta;
  const appUrl = Deno.env.get("APP_URL") || "https://digitallydefined.online/dashboard";

  const stepHtml = steps.map((s, i) =>
    `<li style="margin-bottom:10px;"><strong>${i + 1}. ${esc(s.title)}</strong>${s.description ? `<br/><span style="color:#555;">${esc(s.description)}</span>` : ""}${s.timeframe ? `<br/><em style="color:#888;font-size:12px;">${esc(s.timeframe)}</em>` : ""}</li>`
  ).join("");

  const nextHtml = next3.map((n) => `<li style="margin-bottom:6px;">${esc(n)}</li>`).join("");

  return `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:640px;margin:auto;padding:24px;">
  <h1 style="font-size:22px;">${greeting} your superpower is <span style="color:#4f46e5;">${esc(profile.superpowerName)}</span></h1>
  <p style="font-size:14px;color:#555;">${esc(profile.superpowerDescription)}</p>
  ${roadmap?.title ? `<h2 style="font-size:18px;">${esc(roadmap.title)}</h2>` : ""}
  ${roadmap?.summary ? `<p style="font-size:14px;color:#555;">${esc(roadmap.summary)}</p>` : ""}
  ${steps.length ? `<h3 style="font-size:15px;">Your roadmap</h3><ol style="font-size:14px;padding-left:18px;">${stepHtml}</ol>` : ""}
  ${next3.length ? `<h3 style="font-size:15px;">Your next 3 steps</h3><ol style="font-size:14px;padding-left:18px;">${nextHtml}</ol>` : ""}
  ${tool ? `<p style="margin-top:16px;"><strong>Recommended tool:</strong> ${esc(tool)}</p>` : ""}
  <p style="margin-top:28px;"><a href="${appUrl}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">${esc(cta || "Continue your journey →")}</a></p>
  <p style="margin-top:32px;font-size:12px;color:#999;">You received this because you completed the Digital Superpower Quiz at DigitallyDefined.</p>
</body></html>`;
}
