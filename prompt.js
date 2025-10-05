// /api/prompt.js — Reflection prompt generator (auto-model, no keys in client)
// Produces: { status: 'ok'|'fallback'|'mock', prompt: string, debug?: {...} }

// ---------- tiny raw JSON reader ----------
async function readJsonBody(req) {
  return new Promise((resolve) => {
    try {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        if (!data) return resolve({});
        try { resolve(JSON.parse(data)); } catch { resolve({ _raw: data }); }
      });
    } catch { resolve({}); }
  });
}

function pick(arr, n) {
  if (!Array.isArray(arr) || !arr.length) return [];
  const copy = arr.slice(0);
  const out = [];
  while (out.length < Math.min(n, copy.length)) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function buildPrompt({ date, userId, context }) {
  const { pastReflections = [], habitWhys = [] } = context || {};
  const last = pick(pastReflections, 5).map(t => `- ${String(t).slice(0, 800)}`).join('\n');
  const whys = pick(habitWhys, 6).map(t => `- ${String(t).slice(0, 200)}`).join('\n');

  return `
You are a journaling assistant. Output ONLY one novel, high-quality journaling prompt
(≤ 180 characters, one sentence, no lead-in text) for date ${date}, user ${userId}.

Style: CBT, mindfulness, cognitive defusion, values, self-inquiry. Be concrete and specific; no clichés; no yes/no questions.
Lightly reflect the user's themes if context exists. Avoid repeating earlier wording.

Optional context:
Recent reflections:
${last || '(none)'}

Habits + whys:
${whys || '(none)'}
`.trim();
}

async function callGemini({ apiKey, model, text }) {
  const API_BASE = 'https://generativelanguage.googleapis.com';
  const resp = await fetch(
    `${API_BASE}/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 120 }
      })
    }
  );

  const raw = await resp.text();
  if (!resp.ok) {
    const err = new Error(`generateContent ${resp.status}`);
    err._body = raw.slice(0, 800);
    throw err;
  }

  let wrapper;
  try { wrapper = JSON.parse(raw); }
  catch {
    const err = new Error('parse-wrapper');
    err._sample = raw.slice(0, 600);
    throw err;
  }

  const parts = wrapper?.candidates?.[0]?.content?.parts || [];
  let out = (parts.find(p => typeof p?.text === 'string')?.text || '').trim();
  // Clean code fences if present
  out = out.replace(/^```(\w+)?/,'').replace(/```$/,'').trim();
  return out;
}

export default async function handler(req, res) {
  // --------- CORS (wide-open while developing; tighten later) ----------
  res.setHeader('Access-Control-Allow-Origin', '*'); // e.g., replace '*' with your GitHub Pages origin when ready
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // --------- Keys (accept multiple env names) ----------
  const apiKey =
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  const keyName =
    (process.env.GOOGLE_API_KEY && 'GOOGLE_API_KEY') ||
    (process.env.GEMINI_API_KEY && 'GEMINI_API_KEY') ||
    (process.env.GOOGLE_GENAI_API_KEY && 'GOOGLE_GENAI_API_KEY') ||
    (process.env.GOOGLE_GENERATIVE_AI_API_KEY && 'GOOGLE_GENERATIVE_AI_API_KEY') ||
    null;

  // --------- GET = quick diagnostics ----------
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      info: 'Use POST for prompt generation.',
      hasKey: Boolean(apiKey),
      keyName,
      endpoint: 'v1'
    });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'error', error: 'Use POST' });
  }

  // --------- Read body ----------
  const body   = await readJsonBody(req);
  const date   = (body && body.date)   || new Date().toISOString().slice(0, 10);
  const userId = (body && body.userId) || 'anon';
  const context= body && body.context ? body.context : {};

  // --------- No key → readable mock so UI never blocks ----------
  if (!apiKey || apiKey.length < 10) {
    return res.status(200).json({
      status: 'mock',
      prompt: 'Name one tiny action that would move today 1% closer to the kind of person you want to be — and when you’ll actually do it.',
      debug: { hasKey: false, keyName }
    });
  }

  // --------- Pick a generateContent-capable model visible to this key ----------
  const API_BASE = 'https://generativelanguage.googleapis.com';
  let pickedModel = '';
  try {
    const listResp = await fetch(`${API_BASE}/v1/models?key=${apiKey}`);
    const listText = await listResp.text();
    if (!listResp.ok) throw new Error(`listModels ${listResp.status}: ${listText.slice(0, 300)}`);
    const listed = JSON.parse(listText);
    const models = Array.isArray(listed?.models) ? listed.models : [];

    const supports = m => {
      const methods = m?.supportedGenerationMethods || m?.supportedMethods || [];
      return Array.isArray(methods) && methods.includes('generateContent');
    };

    // Prefer 2.5/1.5 flash/pro; else any generateContent model
    const prefer = models.filter(m =>
      /gemini-((2(\.5)?)|1\.5)-(flash|pro)/.test(m?.name || '') && supports(m)
    );
    const general = models.filter(supports);

    pickedModel = (prefer[0]?.name || general[0]?.name || '').replace(/^models\//, '');
    if (!pickedModel) throw new Error('No model with generateContent available to this key.');
  } catch (e) {
    // Fallback deterministic prompt so UI stays useful
    return res.status(200).json({
      status: 'fallback',
      prompt: 'When stress shows up today, what 10-second ritual will you use to return to center? Describe it in one sentence.',
      debug: { step: 'listModels', error: String(e), hasKey: true, keyName }
    });
  }

  // --------- Generate prompt ----------
  try {
    const text = buildPrompt({ date, userId, context });
    let out = await callGemini({ apiKey, model: pickedModel, text });

    // Normalize → single line, ≤ 180 chars
    out = out.replace(/\s+/g, ' ').trim();
    if (!out) throw new Error('Empty output');
    if (out.length > 180) out = out.slice(0, 177).replace(/\s+\S*$/, '').trim() + '…';

    return res.status(200).json({
      status: 'ok',
      prompt: out,
      debug: { hasKey: true, keyName, pickedModel }
    });
  } catch (err) {
    // Fallback prompt keeps journaling unblocked
    return res.status(200).json({
      status: 'fallback',
      prompt: 'Pick one feeling you noticed today. Name it, locate it in your body, and write one sentence about what it was asking for.',
      debug: { step: 'generate', error: String(err) }
    });
  }
}
