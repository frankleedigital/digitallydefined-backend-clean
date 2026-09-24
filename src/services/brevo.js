// src/services/brevo.js - Brevo transactional email via REST API
import env from '../config/env.js';
import logger from '../utils/logger.js';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function headers(extra = {}) {
  return {
    'api-key': env.brevo.apiKey,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(path, init = {}) {
  const res = await fetch(BREVO_API_BASE + path, {
    ...init,
    headers: headers(init.headers),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error('Brevo ' + res.status + ': ' + text.slice(0, 300));
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Send a transactional email via Brevo.
 * @param {object} params
 * @param {string} params.to - recipient email
 * @param {string} params.subject
 * @param {string} params.htmlContent - HTML body
 * @param {string} [params.textContent] - plain text body
 * @param {string} [params.senderEmail]
 * @param {string} [params.senderName]
 * @returns {Promise<object>}
 */
export async function sendEmail({ to, subject, htmlContent, textContent, senderEmail, senderName }) {
  if (!env.brevo.apiKey) {
    return { ok: false, error: 'BREVO_API_KEY not configured' };
  }
  const payload = {
    to: [{ email: to }],
    sender: {
      email: senderEmail || env.brevo.fromEmail || 'francesca@digitallydefined.online',
      name: senderName || env.brevo.fromName || 'DigitallyDefined',
    },
    subject,
    htmlContent: htmlContent || '',
    textContent: textContent || '',
  };
  try {
    const data = await request('/smtp/email', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { ok: true, data };
  } catch (err) {
    logger.error('Brevo sendEmail failed', { error: err.message });
    return { ok: false, error: err.message };
  }
}

/**
 * Send the quiz roadmap email to a user.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.superpower
 * @param {string} params.superpowerName
 * @param {string} params.superpowerDescription
 * @param {Array} params.roadmapSteps
 * @param {string} [params.estimatedTime]
 * @returns {Promise<object>}
 */
export async function sendQuizRoadmapEmail({ email, superpower, superpowerName, superpowerDescription, roadmapSteps, estimatedTime }) {
  const steps = Array.isArray(roadmapSteps) ? roadmapSteps : [];
  const stepsHtml = steps.map((step, i) => `<li style="margin-bottom:8px;"><strong>Step ${i + 1}:</strong> ${step}</li>`).join('');
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
      <h1 style="color:#F18B25;">Your Digital Superpower: ${superpowerName || superpower}</h1>
      <p style="font-size:16px;line-height:1.6;">${superpowerDescription || ''}</p>
      <h2 style="color:#47B7D4;">Your Roadmap (${estimatedTime || '30-60 days'})</h2>
      <ol style="line-height:1.8;">${stepsHtml}</ol>
      <p style="margin-top:24px;font-size:14px;color:#5F5F5F;">Access your full dashboard at <a href="https://digitallydefined.online/dashboard">digitallydefined.online/dashboard</a></p>
    </div>
  `;
  const text = `Your Digital Superpower: ${superpowerName || superpower}\n\n${superpowerDescription || ''}\n\nRoadmap (${estimatedTime || '30-60 days'}):\n` +
    steps.map((step, i) => `${i + 1}. ${step}`).join('\n') +
    `\n\nAccess your dashboard: https://digitallydefined.online/dashboard`;
  return sendEmail({
    to: email,
    subject: `Your ${superpowerName || superpower} Roadmap | DigitallyDefined`,
    htmlContent: html,
    textContent: text,
  });
}

export function isBrevoConfigured() {
  return !!env.brevo.apiKey;
}

export default { sendEmail, sendQuizRoadmapEmail, isBrevoConfigured };
