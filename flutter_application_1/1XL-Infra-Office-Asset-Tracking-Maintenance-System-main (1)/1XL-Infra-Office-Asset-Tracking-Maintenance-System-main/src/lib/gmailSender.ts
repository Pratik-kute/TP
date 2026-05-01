/**
 * Shared Gmail sender (browser-side).
 *
 * Flow:
 *   1. POST oauth2.googleapis.com/token  → fresh access token (refresh_token grant)
 *   2. Build RFC 2822 message (optionally multipart/mixed for attachments)
 *   3. POST gmail.googleapis.com/gmail/v1/users/me/messages/send
 *
 * All functions are fire-and-forget friendly: they never throw, they return
 * { ok, error } so callers can log without wrapping in try/catch.
 *
 * Security note: VITE_-prefixed env vars are bundled into the browser. The
 * Gmail refresh token therefore ships to every visitor. This matches the
 * existing project convention — migrate to a server-side Edge Function if
 * you need tighter control.
 */

const CLIENT_ID     = String(import.meta.env.VITE_GMAIL_CLIENT_ID     ?? '').trim();
const CLIENT_SECRET = String(import.meta.env.VITE_GMAIL_CLIENT_SECRET ?? '').trim();
const REFRESH_TOKEN = String(import.meta.env.VITE_GMAIL_REFRESH_TOKEN ?? '').trim();
const SENDER        = String(import.meta.env.VITE_GMAIL_SENDER        ?? '').trim();
const SENDER_NAME   = String(import.meta.env.VITE_GMAIL_SENDER_NAME   ?? '1XL Asset Tracker').trim();

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  /** Raw bytes (Uint8Array) or a Blob. */
  content: Uint8Array | Blob;
}

export interface SendGmailArgs {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface SendGmailResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/** In-memory access-token cache so rapid fire-and-forget calls share a token. */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 30_000 > now) return cachedToken.token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const msg = data.error_description ?? data.error ?? `Token exchange ${res.status}`;
    throw new Error(`Gmail auth failed: ${msg}`);
  }

  const expiresIn = Number(data.expires_in) || 3600;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + expiresIn * 1000,
  };
  return data.access_token;
}

function utf8ToBase64Url(input: string): string {
  // Handles non-ASCII safely (btoa wants binary-string input)
  const binary = unescape(encodeURIComponent(input));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function attachmentToBase64(att: EmailAttachment): Promise<string> {
  if (att.content instanceof Uint8Array) return bytesToBase64(att.content);
  const buf = new Uint8Array(await att.content.arrayBuffer());
  return bytesToBase64(buf);
}

/** Splits base64 into 76-char lines per RFC 2045. */
function base64Wrap(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

async function buildRawMessage(args: SendGmailArgs): Promise<string> {
  const fromHeader = SENDER
    ? `From: "${SENDER_NAME.replace(/"/g, '')}" <${SENDER}>`
    : '';
  const toHeader = args.toName
    ? `To: "${args.toName.replace(/"/g, '')}" <${args.to}>`
    : `To: ${args.to}`;

  // Encode subject as RFC 2047 to handle non-ASCII safely.
  const subjectEncoded = /[^\x20-\x7E]/.test(args.subject)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(args.subject)))}?=`
    : args.subject;

  const headersBase = [
    fromHeader,
    toHeader,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  if (!args.attachments || args.attachments.length === 0) {
    const message = [
      ...headersBase,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      args.html,
    ].join('\r\n');
    return message;
  }

  // Multipart/mixed for attachments
  const boundary = `----=_1xl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const parts: string[] = [
    ...headersBase,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    args.html,
  ];

  for (const att of args.attachments) {
    const b64 = await attachmentToBase64(att);
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      base64Wrap(b64),
    );
  }

  parts.push(`--${boundary}--`, '');
  return parts.join('\r\n');
}

export function isGmailConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

/**
 * Send a single email via Gmail API.
 * Never throws — returns { ok, error } so callers can fire-and-forget.
 */
export async function sendGmail(args: SendGmailArgs): Promise<SendGmailResult> {
  if (!isGmailConfigured()) {
    console.warn('[Gmail] VITE_GMAIL_* env vars not configured');
    return { ok: false, error: 'Gmail credentials not configured' };
  }
  if (!args.to) {
    return { ok: false, error: 'No recipient email' };
  }

  try {
    const accessToken = await getAccessToken();
    const raw = utf8ToBase64Url(await buildRawMessage(args));

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
      console.error('[Gmail] Send failed:', data);
      return { ok: false, error: msg };
    }

    return { ok: true, messageId: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Gmail] Send exception:', msg);
    return { ok: false, error: msg };
  }
}
