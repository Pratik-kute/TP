// Shared Gmail sender for Supabase Edge Functions (Deno runtime).
//
// Reads credentials from env. Prefers non-prefixed GMAIL_* names when deployed,
// falls back to the VITE_GMAIL_* names used in the shared project .env for
// local `supabase functions serve` development.
//
// All failures throw so callers can decide how to record them (e.g. the
// monthly report writes `audit_reports.status='failed'` with the message).

import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

export interface EdgeEmailAttachment {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface EdgeSendGmailArgs {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  html: string;
  attachments?: EdgeEmailAttachment[];
}

const CLIENT_ID = Deno.env.get('GMAIL_CLIENT_ID') || Deno.env.get('VITE_GMAIL_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('GMAIL_CLIENT_SECRET') || Deno.env.get('VITE_GMAIL_CLIENT_SECRET') || '';
const REFRESH_TOKEN = Deno.env.get('GMAIL_REFRESH_TOKEN') || Deno.env.get('VITE_GMAIL_REFRESH_TOKEN') || '';
const SENDER = Deno.env.get('GMAIL_SENDER') || Deno.env.get('VITE_GMAIL_SENDER') || '';
const SENDER_NAME = Deno.env.get('GMAIL_SENDER_NAME') || Deno.env.get('VITE_GMAIL_SENDER_NAME') || '1XL Asset Tracker';

export function isGmailConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

async function fetchAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const msg = data?.error_description ?? data?.error ?? `token ${res.status}`;
    throw new Error(`Gmail auth failed: ${msg}`);
  }
  return data.access_token as string;
}

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64Wrap(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

function rfc2047(s: string): string {
  return /[^\x20-\x7E]/.test(s)
    ? `=?UTF-8?B?${encodeBase64(new TextEncoder().encode(s))}?=`
    : s;
}

function buildToHeader(to: Array<{ email: string; name?: string }>): string {
  const parts = to.map(r =>
    r.name ? `"${r.name.replace(/"/g, '')}" <${r.email}>` : r.email,
  );
  return `To: ${parts.join(', ')}`;
}

function buildRawMessage(args: EdgeSendGmailArgs): string {
  const fromHeader = SENDER
    ? `From: "${SENDER_NAME.replace(/"/g, '')}" <${SENDER}>`
    : '';
  const headers = [
    fromHeader,
    buildToHeader(args.to),
    `Subject: ${rfc2047(args.subject)}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  if (!args.attachments || args.attachments.length === 0) {
    return [
      ...headers,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      args.html,
    ].join('\r\n');
  }

  const boundary = `----=_1xl_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    args.html,
  ];

  for (const att of args.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      base64Wrap(encodeBase64(att.bytes)),
    );
  }
  parts.push(`--${boundary}--`, '');
  return parts.join('\r\n');
}

/**
 * Sends one Gmail message (optionally with multiple To recipients). Throws on
 * failure so the caller can record status in the database.
 */
export async function sendEdgeGmail(args: EdgeSendGmailArgs): Promise<{ messageId: string }> {
  if (!isGmailConfigured()) {
    throw new Error('Gmail credentials not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)');
  }
  if (!args.to || args.to.length === 0) {
    throw new Error('sendEdgeGmail: no recipients');
  }

  const accessToken = await fetchAccessToken();
  const raw = utf8ToBase64Url(buildRawMessage(args));

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message ?? `Gmail API ${res.status}`;
    throw new Error(`Gmail send failed: ${msg}`);
  }
  return { messageId: data.id as string };
}
