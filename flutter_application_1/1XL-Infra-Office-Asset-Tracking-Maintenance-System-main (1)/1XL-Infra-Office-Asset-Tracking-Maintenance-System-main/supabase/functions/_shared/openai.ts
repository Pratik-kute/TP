// Thin wrapper around the OpenAI Chat Completions API.
// Generates the three narrative sections used in the audit report.
// On any failure (missing key, network, parse, timeout) returns deterministic
// templated fallback strings — the report MUST always send.

import type { ComputedStats } from './stats.ts';

export interface Narrative {
  executiveSummary: string;
  auditFlagsCommentary: string;
  recommendations: string;
}

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 12_000;

export async function generateNarrative(
  stats: ComputedStats,
  organizationName: string,
): Promise<Narrative> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return fallback(stats, organizationName);

  const prompt = buildPrompt(stats, organizationName);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a professional IT asset auditor. You write concise, formal audit report ' +
              'paragraphs in third person. Output JSON only with the requested keys.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    return {
      executiveSummary: String(parsed.executiveSummary || '').trim() || fallback(stats, organizationName).executiveSummary,
      auditFlagsCommentary: String(parsed.auditFlagsCommentary || '').trim() || fallback(stats, organizationName).auditFlagsCommentary,
      recommendations: String(parsed.recommendations || '').trim() || fallback(stats, organizationName).recommendations,
    };
  } catch (err) {
    console.error('[openai] generateNarrative failed, using fallback:', err);
    return fallback(stats, organizationName);
  }
}

function buildPrompt(stats: ComputedStats, organizationName: string): string {
  const summary = {
    organization: organizationName,
    period: `${stats.period.monthName} ${stats.period.year}`,
    location: stats.period.locationName,
    totals: stats.totals,
    statusBreakdown: stats.statusBreakdown,
    flagsCount: stats.flags.length,
    deadCount: stats.deadAssets.length,
    flaggedLowRam: stats.computing.flaggedLowRam.length,
    flaggedNoSerial: stats.computing.flaggedNoSerial.length,
    flaggedNoGpu: stats.computing.flaggedNoGpu.length,
    peripheralsGap: {
      keyboards: stats.peripherals.keyboardGap,
      mice: stats.peripherals.mouseGap,
      adaptors: stats.peripherals.adaptorGap,
    },
  };
  return [
    'Write three sections of an IT asset audit report based on the following aggregated statistics.',
    'Return a JSON object with exactly three string keys: executiveSummary, auditFlagsCommentary, recommendations.',
    '',
    'Section requirements:',
    '- executiveSummary: 2 paragraphs (max 200 words). Cover scope, totals, overall condition.',
    '- auditFlagsCommentary: 1 paragraph (max 120 words). Discuss the flagged items and their business impact.',
    '- recommendations: 1 paragraph (max 120 words). Suggest concrete next steps prioritized by urgency.',
    '',
    'Tone: formal, professional, third-person, no first-person pronouns. Do not invent numbers — only use the figures below.',
    '',
    'Statistics:',
    JSON.stringify(summary, null, 2),
  ].join('\n');
}

function fallback(stats: ComputedStats, organizationName: string): Narrative {
  const t = stats.totals;
  const periodLabel = `${stats.period.monthName} ${stats.period.year}`;
  return {
    executiveSummary:
      `This report presents the findings of the IT and physical assets audit conducted for ${organizationName} ` +
      `at its ${stats.period.locationName} location during ${periodLabel}. The audit covered all computing hardware, ` +
      `peripheral devices, mobile assets, and miscellaneous office items.\n\n` +
      `A total of ${t.assets} assets were inspected and documented, including ${t.desktops} desktop unit(s), ` +
      `${t.laptops} laptop(s), ${t.monitors} monitor(s), ${t.peripherals} peripheral device(s), and ${t.mobile} mobile asset(s). ` +
      `Each asset has been tagged with a unique asset code for tracking purposes. The overall state of assets is in good condition, ` +
      `however the audit identified ${stats.flags.length} item(s) requiring corrective action.`,
    auditFlagsCommentary:
      stats.flags.length === 0
        ? 'No significant issues were identified during this audit period. All hardware specifications, peripheral assignments, and serial number records were found to be compliant with internal standards.'
        : `${stats.flags.length} category of issues were identified during the physical audit. ` +
          `Notable items include ${stats.computing.flaggedLowRam.length} unit(s) with below-standard RAM, ` +
          `${stats.computing.flaggedNoSerial.length} unit(s) with missing serial numbers, and ` +
          `${stats.deadAssets.length} asset(s) currently marked as dead, retired, or disposed. None of these are critical to day-to-day operations but should be resolved within the next 30-60 days.`,
    recommendations:
      `Immediate actions: label all unmarked assets, recover missing serial numbers from BIOS or manufacturer records, ` +
      `and resolve peripheral assignment gaps for ${stats.peripherals.keyboardGap + stats.peripherals.mouseGap + stats.peripherals.adaptorGap} workstation(s). ` +
      `Medium-term: standardise RAM configuration across the fleet to 16 GB minimum. Ongoing: conduct quarterly physical verification ` +
      `and maintain a digital asset register synced with this report.`,
  };
}
