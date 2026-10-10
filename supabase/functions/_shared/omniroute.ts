/**
 * OmniRoute Client
 * Unified AI gateway client for DigitallyDefined OS
 *
 * OmniRoute ONLY — the single AI gateway. No direct provider calls,
 * no fallback models, no fallback providers.
 */

import { hermesSystemPrompt } from './hermesSystemPrompt.ts';

// Initialize AgentOps for monitoring
// deno-lint-ignore no-explicit-any
let agentops: any = null;
try {
  const AgentOps = await import('agentops');
  const AGENTOPS_API_KEY = Deno.env.get('AGENTOPS_API_KEY');
  if (AGENTOPS_API_KEY) {
    agentops = new AgentOps.default({ apiKey: AGENTOPS_API_KEY });
    console.log('✓ AgentOps initialized for OmniRoute');
  } else {
    console.log('⚠️  AgentOps API key not found - running without monitoring');
  }
} catch (e) {
  console.log('⚠️  AgentOps not available:', (e as Error)?.message || String(e));
}

// Normalize any configured base URL (with or without a trailing "/v1")
// into the canonical chat-completions endpoint.
export function omnirouteEndpoint(raw?: string | null): string {
  const base = (raw ?? Deno.env.get('OMNIROUTE_BASE_URL') ?? 'https://api.omniroute.ai/v1')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');
  return `${base}/v1/chat/completions`;
}
const OMNIROUTE_API_KEY = (Deno.env.get('OMNIROUTE_API_KEY') || '').trim();
const DEFAULT_MODEL = (Deno.env.get('OMNIROUTE_MODEL') || 'auto').trim();
const DEFAULT_SYSTEM_PROMPT = hermesSystemPrompt;

// ---- Direct Gemini fallback (Google's OpenAI-compatible endpoint) ----
// Used only when the OmniRoute call fails (e.g. the gateway is down).
const GEMINI_API_KEY = (Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || '').trim();
const GEMINI_BASE_URL = (Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta/openai').trim().replace(/\/+$/, '');
const GEMINI_MODEL = (Deno.env.get('GEMINI_MODEL') || 'gemini-3.6-flash').trim();

async function geminiFallback(messages: unknown[], jsonMode: boolean, timeout: number) {
  if (!GEMINI_API_KEY) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const requestBody: Record<string, unknown> = {
      model: GEMINI_MODEL,
      messages,
    };
    if (jsonMode) requestBody.response_format = { type: 'json_object' };
    const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini fallback error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
    }
    const reply = await extractReply(response);
    if (!reply) return null;
    return { reply, provider: 'gemini-direct', model: GEMINI_MODEL, error: null };
  } catch (error) {
    console.error('[OmniRoute] Gemini fallback failed:', (error as Error)?.message || String(error));
    return null;
  }
}

/**
 * Call OmniRoute with a prompt and optional parameters
 *
 * @param {string} prompt - The user prompt/message
 * @param {object} options - Optional configuration
 * @param {string} options.model - Model override (default: OMNIROUTE_MODEL env or 'auto')
 * @param {string} options.systemPrompt - System prompt override
 * @param {boolean} options.jsonMode - Force JSON response mode
 * @param {number} options.timeout - Request timeout in ms (default: 60000)
 * @returns {Promise<{reply: string, provider: string, model: string, error: string|null}>}
 */
type OmniRouteOptions = {
  model?: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  timeout?: number;
};

/**
 * Extract the assistant reply from either a standard JSON chat response or
 * an SSE stream body (this OmniRoute instance may stream even when
 * stream:false is requested, e.g. for the "auto" model).
 */
async function extractReply(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!contentType.includes('text/event-stream') && !text.trimStart().startsWith('data:')) {
    const data = JSON.parse(text);
    return data?.choices?.[0]?.message?.content || '';
  }

  let reply = '';
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload);
      reply += parsed?.choices?.[0]?.delta?.content
        || parsed?.choices?.[0]?.message?.content
        || '';
    } catch {
      // Skip invalid JSON chunks
    }
  }
  return reply;
}

export async function omniRoute(prompt: string, options: OmniRouteOptions = {}) {
  // When the OmniRoute gateway is known to be down, skip straight to Gemini.
  const omnirouteDisabled = Deno.env.get('OMNIROUTE_DISABLED') === 'true';

  if (!OMNIROUTE_API_KEY && !omnirouteDisabled) {
    return {
      reply: '',
      provider: null,
      model: null,
      error: 'OMNIROUTE_API_KEY not configured in environment variables',
    };
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return {
      reply: '',
      provider: null,
      model: null,
      error: 'Invalid prompt: must be a non-empty string',
    };
  }

  const model = options.model || DEFAULT_MODEL;
  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const jsonMode = options.jsonMode || false;
  const timeout = options.timeout || 60000;

  if (omnirouteDisabled) {
    const fallback = await geminiFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() },
      ],
      jsonMode,
      timeout,
    );
    if (fallback) return fallback;
    return {
      reply: '',
      provider: null,
      model: null,
      error: 'OmniRoute is disabled and the Gemini fallback is not configured/failed',
    };
  }

  try {
    // AgentOps trace for LLM call
    const trace = agentops?.startTrace('omniroute_llm_call', {
      metadata: { model, systemPrompt: systemPrompt.slice(0, 100) }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() },
      ],
    };

    // Add JSON mode if requested
    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(omnirouteEndpoint(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OMNIROUTE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OmniRoute error: ${response.status} ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += ` - ${errorJson.error?.message || errorText.slice(0, 200)}`;
      } catch {
        errorMessage += ` - ${errorText.slice(0, 200)}`;
      }

      throw new Error(errorMessage);
    }

    const rawReply = await extractReply(response);

    if (!rawReply) {
      throw new Error('OmniRoute returned empty response');
    }

    // End trace on success
    trace?.end({ status: 'success', model });

    return {
      reply: rawReply,
      provider: 'omniroute',
      model,
      error: null,
    };
  } catch (error) {
    const lastError = (error as Error)?.message || String(error);
    console.error('[OmniRoute] Call failed:', lastError);

    // End trace on error
    try {
      agentops?.startTrace('omniroute_llm_error', {
        metadata: { model, error: lastError }
      })?.end({ status: 'error' });
    } catch (e) {
      // Ignore trace errors
    }

    // Single OmniRoute attempt, then direct Gemini fallback.
    const fallback = await geminiFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() },
      ],
      jsonMode,
      timeout,
    );
    if (fallback) return fallback;
    return {
      reply: '',
      provider: null,
      model: null,
      error: lastError,
    };
  }
}

/**
 * Call OmniRoute with streaming support (if available)
 * 
 * @param {string} prompt - The user prompt/message
 * @param {object} options - Optional configuration (same as omniRoute)
 * @param {function} onChunk - Callback for each streaming chunk
 * @returns {Promise<{reply: string, provider: string, model: string, error: string|null}>}
 */
export async function omniRouteStream(prompt: string, options: OmniRouteOptions = {}, onChunk?: (chunk: string, fullReply: string) => void) {
  // When the OmniRoute gateway is known to be down, go straight to Gemini.
  const omnirouteDisabled = Deno.env.get('OMNIROUTE_DISABLED') === 'true';

  if (!OMNIROUTE_API_KEY && !omnirouteDisabled) {
    return {
      reply: '',
      provider: null,
      model: null,
      error: 'OMNIROUTE_API_KEY not configured in environment variables',
    };
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return {
      reply: '',
      provider: null,
      model: null,
      error: 'Invalid prompt: must be a non-empty string',
    };
  }

  const model = options.model || DEFAULT_MODEL;
  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const jsonMode = options.jsonMode || false;
  const timeout = options.timeout || 60000;

  if (omnirouteDisabled) {
    const fallback = await geminiFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() },
      ],
      jsonMode,
      timeout,
    );
    if (fallback) {
      if (typeof onChunk === 'function') onChunk(fallback.reply, fallback.reply);
      return fallback;
    }
    return {
      reply: '',
      provider: null,
      model: null,
      error: 'OmniRoute is disabled and the Gemini fallback is not configured/failed',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() },
      ],
      stream: true,
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(omnirouteEndpoint(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OMNIROUTE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OmniRoute streaming error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
    }

    if (!response.body) {
      throw new Error('OmniRoute streaming response has no body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed?.choices?.[0]?.delta?.content || '';
            if (content) {
              fullReply += content;
              if (typeof onChunk === 'function') {
                onChunk(content, fullReply);
              }
            }
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    }

    return {
      reply: fullReply,
      provider: 'omniroute',
      model,
      error: null,
    };

  } catch (error) {
    // OmniRoute failed — non-streamed Gemini fallback delivers the whole reply at once.
    const fallback = await geminiFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() },
      ],
      jsonMode,
      timeout,
    );
    if (fallback) {
      if (typeof onChunk === 'function') onChunk(fallback.reply, fallback.reply);
      return fallback;
    }
    return {
      reply: '',
      provider: null,
      model: null,
      error: (error as Error)?.message || String(error),
    };
  }
}

export default { omniRoute, omniRouteStream };
