"""
Build the printable PDF of the Asset Tracker API reference.

Output: server/Asset-Tracker-API-Reference.pdf
"""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, NextPageTemplate, PageBreak, PageTemplate,
    Paragraph, Preformatted, Spacer, Table, TableStyle, KeepTogether,
)

# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------
PAGE_WIDTH, PAGE_HEIGHT = A4
LEFT_MARGIN  = 2.0 * cm
RIGHT_MARGIN = 2.0 * cm
TOP_MARGIN   = 2.2 * cm
BOTTOM_MARGIN = 2.0 * cm
CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN

EMERALD       = colors.HexColor("#10b981")
EMERALD_DARK  = colors.HexColor("#047857")
EMERALD_LIGHT = colors.HexColor("#ecfdf5")
INK           = colors.HexColor("#0f172a")
SUBTLE        = colors.HexColor("#334155")
MUTED         = colors.HexColor("#64748b")
HAIRLINE      = colors.HexColor("#e2e8f0")

# Code-block palette — chosen for high contrast in print
CODE_BG_DARK  = colors.HexColor("#0b1220")   # near-black slate
CODE_FG_LIGHT = colors.HexColor("#f1f5f9")   # near-white
CODE_FG_MINT  = colors.HexColor("#86efac")   # mint for curl

CODE_BG_LIGHT = colors.HexColor("#f1f5f9")   # very light slate
CODE_FG_DARK  = colors.HexColor("#0f172a")   # near-black

TABLE_HEAD_BG = colors.HexColor("#f1f5f9")
TABLE_ALT_BG  = colors.HexColor("#fafafa")

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
styles = getSampleStyleSheet()

H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                    fontSize=20, leading=26, textColor=INK,
                    spaceBefore=8, spaceAfter=10, keepWithNext=1)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                    fontSize=14, leading=18, textColor=INK,
                    spaceBefore=14, spaceAfter=6, keepWithNext=1)
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontName="Helvetica-Bold",
                    fontSize=11, leading=15, textColor=EMERALD_DARK,
                    spaceBefore=10, spaceAfter=4, keepWithNext=1)
ENDPOINT = ParagraphStyle("Endpoint", parent=styles["Heading3"],
                          fontName="Courier-Bold", fontSize=11, leading=14,
                          textColor=INK, spaceBefore=10, spaceAfter=2,
                          keepWithNext=1)
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica",
                      fontSize=9.5, leading=13, textColor=INK,
                      spaceAfter=6, alignment=TA_LEFT)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=8, leading=11,
                       textColor=MUTED)
TOC_LINE = ParagraphStyle("Toc", parent=BODY, fontSize=10, leading=15,
                          leftIndent=8, spaceAfter=2)
COVER_TITLE = ParagraphStyle("CoverTitle", parent=H1, fontSize=34, leading=40,
                             alignment=TA_CENTER, textColor=INK,
                             spaceBefore=0, spaceAfter=8)
COVER_SUBTITLE = ParagraphStyle("CoverSubtitle", parent=BODY, fontSize=14,
                                leading=18, alignment=TA_CENTER,
                                textColor=SUBTLE, spaceAfter=4)
COVER_META = ParagraphStyle("CoverMeta", parent=BODY, fontSize=10, leading=14,
                            alignment=TA_CENTER, textColor=MUTED)


# ---------------------------------------------------------------------------
# Page templates
# ---------------------------------------------------------------------------
def _cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(EMERALD)
    canvas.rect(0, PAGE_HEIGHT - 6 * mm, PAGE_WIDTH, 6 * mm, stroke=0, fill=1)
    canvas.setFillColor(EMERALD_DARK)
    canvas.rect(0, 0, PAGE_WIDTH, 6 * mm, stroke=0, fill=1)
    canvas.restoreState()


def _content_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(HAIRLINE)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT_MARGIN, PAGE_HEIGHT - 1.4 * cm,
                PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 1.4 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(LEFT_MARGIN, PAGE_HEIGHT - 1.1 * cm,
                      "Asset Tracker — API Reference")
    canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 1.1 * cm, "v1.0")

    canvas.setStrokeColor(HAIRLINE)
    canvas.line(LEFT_MARGIN, 1.3 * cm,
                PAGE_WIDTH - RIGHT_MARGIN, 1.3 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(LEFT_MARGIN, 1.0 * cm, "Confidential — internal use")
    canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, 1.0 * cm,
                           f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def build_doc(output_path: Path) -> BaseDocTemplate:
    doc = BaseDocTemplate(
        str(output_path), pagesize=A4,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        title="Asset Tracker — API Reference",
        author="Asset Tracker Platform",
        subject="REST API documentation for the Asset Tracker platform.",
    )
    frame = Frame(LEFT_MARGIN, BOTTOM_MARGIN, CONTENT_WIDTH,
                  PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN, id="body")
    doc.addPageTemplates([
        PageTemplate(id="cover",   frames=[frame], onPage=_cover_page),
        PageTemplate(id="content", frames=[frame], onPage=_content_page),
    ])
    return doc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _code_table(text: str, *, dark: bool, fg) -> Table:
    """
    Wrap a Preformatted in a 1-cell Table so the background actually fills
    the entire box (Preformatted's own backColor is buggy in ReportLab).
    """
    style = ParagraphStyle(
        "CodeInline",
        parent=styles["Code"],
        fontName="Courier", fontSize=8.2, leading=11.0,
        textColor=fg, leftIndent=0, rightIndent=0,
        spaceBefore=0, spaceAfter=0,
    )
    pre = Preformatted(text, style)
    bg = CODE_BG_DARK if dark else CODE_BG_LIGHT
    tbl = Table([[pre]], colWidths=[CONTENT_WIDTH], style=TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",(0, 0), (-1, -1), 10),
        ("TOPPADDING",  (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("BOX",         (0, 0), (-1, -1), 0.4, bg),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
    ]))
    tbl.spaceBefore = 4
    tbl.spaceAfter = 8
    return tbl


def code_block(text: str, *, light: bool = False) -> Table:
    """JSON / generic code. Dark bg + light text by default."""
    if light:
        return _code_table(text, dark=False, fg=CODE_FG_DARK)
    return _code_table(text, dark=True, fg=CODE_FG_LIGHT)


def curl_block(text: str) -> Table:
    """curl example. Dark bg + mint text to distinguish from JSON."""
    return _code_table(text, dark=True, fg=CODE_FG_MINT)


def make_table(rows, col_widths=None, font_size=8.5):
    style = TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), TABLE_HEAD_BG),
        ("TEXTCOLOR",   (0, 0), (-1, 0), INK),
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), font_size),
        ("LEADING",     (0, 0), (-1, -1), font_size + 2.5),
        ("ALIGN",       (0, 0), (-1, -1), "LEFT"),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW",   (0, 0), (-1, 0), 0.6, SUBTLE),
        ("LINEBELOW",   (0, 1), (-1, -1), 0.25, HAIRLINE),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, TABLE_ALT_BG]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",(0, 0), (-1, -1), 6),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
        ("TEXTCOLOR",   (0, 1), (-1, -1), INK),
    ])
    return Table(rows, colWidths=col_widths, style=style, hAlign="LEFT", repeatRows=1)


def p(text: str)    -> Paragraph: return Paragraph(text, BODY)
def small(text: str) -> Paragraph: return Paragraph(text, SMALL)
def h1(text: str)   -> Paragraph: return Paragraph(text, H1)
def h3(text: str)   -> Paragraph: return Paragraph(text, H3)


def endpoint_header(method: str, path: str) -> Table:
    """Coloured pill for the HTTP method + monospace path."""
    method_colour = {
        "GET":    colors.HexColor("#3b82f6"),
        "POST":   colors.HexColor("#10b981"),
        "PATCH":  colors.HexColor("#f59e0b"),
        "DELETE": colors.HexColor("#ef4444"),
    }.get(method, colors.HexColor("#64748b"))

    method_p = Paragraph(
        f'<font color="white"><b>{method}</b></font>',
        ParagraphStyle("Method", fontName="Helvetica-Bold", fontSize=10,
                       leading=12, textColor=colors.white, alignment=TA_CENTER),
    )
    path_p = Paragraph(
        path,
        ParagraphStyle("Path", fontName="Courier-Bold", fontSize=10,
                       leading=12, textColor=INK),
    )
    tbl = Table(
        [[method_p, path_p]],
        colWidths=[1.8 * cm, CONTENT_WIDTH - 1.8 * cm],
        style=TableStyle([
            ("BACKGROUND",  (0, 0), (0, 0), method_colour),
            ("BACKGROUND",  (1, 0), (1, 0), EMERALD_LIGHT),
            ("ALIGN",       (0, 0), (0, 0), "CENTER"),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",(0, 0), (-1, -1), 8),
            ("TOPPADDING",  (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("BOX",         (0, 0), (-1, -1), 0.3, EMERALD),
        ]),
    )
    tbl.spaceBefore = 10
    tbl.spaceAfter = 4
    return tbl


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------
def cover() -> list:
    return [
        Spacer(1, 5 * cm),
        Paragraph(
            '<font color="#10b981" size="14">ASSET TRACKER PLATFORM</font>',
            ParagraphStyle("CoverEyebrow", parent=BODY, alignment=TA_CENTER,
                           fontName="Helvetica-Bold", fontSize=14, leading=18,
                           textColor=EMERALD, spaceAfter=10),
        ),
        Paragraph("API Reference", COVER_TITLE),
        Paragraph("Version 1.0  &nbsp;·&nbsp;  <i>OpenAPI 3.1</i>", COVER_SUBTITLE),
        Spacer(1, 2.5 * cm),
        Paragraph(
            "Complete REST contract for any integration calling the Asset Tracker "
            "platform — authentication, asset lookup, photo upload, maintenance, "
            "repairs, recovery, audit verification, and reference data.",
            ParagraphStyle("CoverBlurb", parent=BODY, fontSize=11, leading=16,
                           alignment=TA_CENTER, textColor=SUBTLE,
                           leftIndent=2 * cm, rightIndent=2 * cm),
        ),
        Spacer(1, 5 * cm),
        Paragraph(date.today().strftime("%B %d, %Y"), COVER_META),
        Spacer(1, 0.5 * cm),
        Paragraph("Confidential — internal use", COVER_META),
    ]


def toc() -> list:
    items = [
        ("1.",  "Overview & conventions"),
        ("2.",  "Base URLs & environments"),
        ("3.",  "Authentication"),
        ("4.",  "Common headers"),
        ("5.",  "Error envelope & error codes"),
        ("6.",  "Rate limiting"),
        ("7.",  "Idempotency"),
        ("8.",  "Pagination"),
        ("9.",  "Endpoints — Health"),
        ("10.", "Endpoints — Auth"),
        ("11.", "Endpoints — Assets"),
        ("12.", "Endpoints — Photos"),
        ("13.", "Endpoints — Maintenance"),
        ("14.", "Endpoints — Repairs"),
        ("15.", "Endpoints — Recovery"),
        ("16.", "Endpoints — Audit"),
        ("17.", "Endpoints — Reference data"),
        ("18.", "Schemas"),
        ("19.", "Scope catalogue"),
        ("20.", "Permitted-actions matrix"),
        ("21.", "Asset status enum"),
        ("22.", "Versioning policy"),
        ("23.", "Changelog & support"),
    ]
    flow: list = [h1("Contents"), Spacer(1, 4 * mm)]
    for num, title in items:
        flow.append(Paragraph(
            f'<font color="#10b981"><b>{num}</b></font>&nbsp;&nbsp;{title}',
            TOC_LINE,
        ))
    return flow


def section_overview() -> list:
    return [
        h1("1.&nbsp;&nbsp;Overview &amp; conventions"),
        p(
            "This document is the complete REST contract for the Asset Tracker "
            "platform API. The accompanying machine-readable spec is "
            "<font face='Courier'>server/openapi.yaml</font> (OpenAPI 3.1) — load it "
            "into Postman, Insomnia, or generate a typed client with "
            "<font face='Courier'>openapi-generator</font>. When the spec and this "
            "document disagree, the spec wins; it is validated against the running server."
        ),
        h3("Wire-format conventions"),
        make_table([
            ["Topic", "Convention"],
            ["Format", "JSON, UTF-8"],
            ["Casing", "camelCase on the wire (server translates from snake_case)"],
            ["Timestamps", "ISO 8601 with timezone — e.g. 2026-04-29T11:32:18.412Z"],
            ["Dates", "YYYY-MM-DD"],
            ["IDs", "UUID v4 unless otherwise noted"],
            ["Money", "number (not string). Currency from organization.currency"],
            ["Booleans", "native true / false"],
            ["Null fields", "explicit null — never omitted"],
        ], col_widths=[3.5 * cm, CONTENT_WIDTH - 3.5 * cm]),
    ]


def section_base_urls() -> list:
    return [
        h1("2.&nbsp;&nbsp;Base URLs &amp; environments"),
        p("All endpoints below are prefixed with <font face='Courier'>/api/v1</font> "
          "unless under <font face='Courier'>/health</font> or "
          "<font face='Courier'>/api/v1/admin/*</font>."),
        make_table([
            ["Environment", "Base URL"],
            ["Local development", "http://localhost:4000"],
            ["Staging",           "(to be assigned)"],
            ["Production",        "https://asset.thebizzfly.com"],
        ], col_widths=[4.5 * cm, CONTENT_WIDTH - 4.5 * cm]),
        Spacer(1, 6),
        small("Configure the base URL in your client's environment settings. The "
              "web admin UI uses <font face='Courier'>VITE_MOBILE_API_URL</font>."),
    ]


def section_auth() -> list:
    return [
        h1("3.&nbsp;&nbsp;Authentication"),
        p("All requests use the standard <b>Bearer</b> scheme:"),
        code_block("Authorization: Bearer <token>"),
        p("There are two kinds of bearer token; the server tells them apart by their "
          "shape, so the same header carries either:"),
        make_table([
            ["Kind", "Format", "Issued by", "Lifetime"],
            ["API key", "<orgslug>_<live|test>_<24chars>", "Org admin (web UI)", "Indefinite, or expires_at"],
            ["Access JWT", "Standard HS256 JWT", "POST /auth/login", "30 minutes"],
        ], col_widths=[2.5 * cm, 5.5 * cm, 4 * cm, CONTENT_WIDTH - 12 * cm]),
        h3("Which token to send"),
        make_table([
            ["Endpoint group", "Send"],
            ["POST /auth/login, /auth/refresh, /auth/logout", "API key only"],
            ["GET /auth/me",                                  "User JWT only"],
            ["All other endpoints",                            "Either — JWT for user-scoped, API key for server-to-server"],
            ["GET /health",                                    "No auth"],
        ], col_widths=[7 * cm, CONTENT_WIDTH - 7 * cm]),
        h3("API key format"),
        p("The key is composed from your organization's short name, an environment "
          "tag (<font face='Courier'>live</font> in production, "
          "<font face='Courier'>test</font> elsewhere), and 24 random base-62 chars:"),
        code_block(
            "1xl_live_K8j3pQrX9bR2sN7wHzVc1qLm\n"
            "demo_test_K8j3pQrX9bR2sN7wHzVc1qLm\n"
            "acmecorp_live_K8j3pQrX9bR2sN7wHzVc"
        ),
        p("Keys are bcrypt-hashed server-side. The full secret is shown <b>only once</b> "
          "on creation — store it in your secrets manager immediately."),
        h3("Refresh-token rotation"),
        p("<font face='Courier'>POST /auth/refresh</font> returns a new refresh token "
          "<b>and</b> revokes the old one. Clients must store the new value immediately. "
          "Reusing a revoked refresh token revokes <b>every</b> active session for the "
          "user — this is the reuse-detection defence against stolen tokens."),
    ]


def section_common_headers() -> list:
    return [
        h1("4.&nbsp;&nbsp;Common headers"),
        make_table([
            ["Header", "Direction", "Purpose"],
            ["Authorization", "Request", "Bearer <token> — required (except /health)"],
            ["X-Request-Id", "Request + Response",
             "Optional client id [A-Z a-z 0-9 . _ : -], 1–128 chars. Mirrored on every response and inside the error envelope. Always log this in client crash reports."],
            ["Idempotency-Key", "Request",
             "Required-ish for POST mutations. See section 7."],
            ["X-RateLimit-Limit",     "Response", "Per-key limit (req/min)"],
            ["X-RateLimit-Remaining", "Response", "Tokens left in the current window"],
            ["X-RateLimit-Reset",     "Response", "Unix epoch when the bucket refills"],
            ["Retry-After",           "Response (429 only)", "Seconds to wait"],
        ], col_widths=[4.5 * cm, 3.5 * cm, CONTENT_WIDTH - 8 * cm]),
    ]


def section_errors() -> list:
    envelope = """{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found",
    "requestId": "5b1a4d8c-7c80-4f19-a64a-7b9f3a8b2c11",
    "fieldErrors": [
      { "field": "assetId", "message": "Invalid uuid" }
    ],
    "details": null
  }
}"""
    return [
        h1("5.&nbsp;&nbsp;Error envelope &amp; error codes"),
        p("Every non-2xx response uses this exact shape:"),
        code_block(envelope),
        p("<b>code</b> is the only field clients should branch on — strings are stable "
          "across versions. <b>message</b> is human-readable and may change wording. "
          "<b>requestId</b> is also echoed in the <font face='Courier'>X-Request-Id</font> "
          "response header. <b>fieldErrors</b> is present for "
          "<font face='Courier'>VALIDATION_FAILED</font> and is suitable for inline form errors."),
        h3("All error codes"),
        make_table([
            ["HTTP", "code", "When"],
            ["400", "INVALID_QR_PAYLOAD",   "qrPayload didn't parse as UUID, asset tag, or known URL"],
            ["401", "UNAUTHENTICATED",      "Missing/bad credentials, or wrong-org user"],
            ["401", "TOKEN_EXPIRED",        "Access JWT has aged out — call /auth/refresh"],
            ["401", "INVALID_API_KEY",      "API key missing, malformed, expired, or revoked"],
            ["403", "FORBIDDEN",            "Authenticated, but not allowed (e.g. cross-org)"],
            ["403", "INSUFFICIENT_SCOPE",   "API key is missing the scope this endpoint requires"],
            ["404", "NOT_FOUND",            "Generic"],
            ["404", "ASSET_NOT_FOUND",      "Asset id/tag not in caller's organization"],
            ["404", "REPAIR_NOT_FOUND",     "Repair id not in caller's organization"],
            ["404", "PHOTO_NOT_FOUND",      "Photo id does not exist"],
            ["404", "CYCLE_NOT_FOUND",      "No active audit cycle for the org"],
            ["409", "CONFLICT",             "Idempotency-key reuse with different body, or business-rule conflict"],
            ["422", "VALIDATION_FAILED",    "Body / query / path didn't match the schema"],
            ["429", "RATE_LIMITED",         "Per-key bucket or per-IP login bucket exceeded"],
            ["500", "INTERNAL_ERROR",       "Server bug. File a ticket with the requestId."],
        ], col_widths=[1.6 * cm, 4.5 * cm, CONTENT_WIDTH - 6.1 * cm], font_size=8.2),
    ]


def section_rate_limits() -> list:
    return [
        h1("6.&nbsp;&nbsp;Rate limiting"),
        make_table([
            ["Scope", "Default", "Configurable via"],
            ["Per API key, per minute",            "120", "api_keys.rate_limit_per_minute"],
            ["POST /auth/login per IP, per 15 min", "20", "LOGIN_RATE_LIMIT_PER_15MIN env"],
        ], col_widths=[7 * cm, 1.8 * cm, CONTENT_WIDTH - 8.8 * cm]),
        Spacer(1, 6),
        p("Every response — successful or not — includes:"),
        code_block(
            "X-RateLimit-Limit: 120\n"
            "X-RateLimit-Remaining: 47\n"
            "X-RateLimit-Reset: 1714397340"
        ),
        p("On <font face='Courier'>429 RATE_LIMITED</font>, honour the "
          "<font face='Courier'>Retry-After</font> header before retrying. Exponential "
          "backoff is fine, but never retry sooner than the value provided."),
    ]


def section_idempotency() -> list:
    snippet = """final idem = Uuid().v4(); // generate ONCE per intent
try {
  await api.raiseRepair(assetId, body, idempotencyKey: idem);
} catch (e) {
  if (isNetworkError(e)) {
    // safe to retry — same idem key dedupes server-side
    await api.raiseRepair(assetId, body, idempotencyKey: idem);
  }
}"""
    return [
        h1("7.&nbsp;&nbsp;Idempotency"),
        p("Any POST may include <font face='Courier'>Idempotency-Key</font> "
          "(16–128 chars, A–Z a–z 0–9 _ -):"),
        make_table([
            ["Scenario", "Result"],
            ["Key not seen", "Handler runs; if 2xx, the body is cached for 24 h"],
            ["Key seen, same request body hash",   "Cached response replayed (same status + body)"],
            ["Key seen, different request body hash", "409 CONFLICT"],
            ["TTL expired (24 h)", "Treated as not-seen"],
        ], col_widths=[7.5 * cm, CONTENT_WIDTH - 7.5 * cm]),
        h3("Recommended pattern"),
        code_block(snippet),
        p("Generate the key when the user <b>commits the action</b>, not on every retry. "
          "GET and DELETE ignore <font face='Courier'>Idempotency-Key</font> — they're "
          "already safe to retry."),
    ]


def section_pagination() -> list:
    return [
        h1("8.&nbsp;&nbsp;Pagination"),
        p("List endpoints currently return up to <font face='Courier'>limit</font> items "
          "and a <font face='Courier'>total</font>. Cursor-based pagination is on the "
          "roadmap if needed."),
        code_block('{ "items": [...], "total": 47 }'),
        p("<font face='Courier'>limit</font> query parameter — default 100, max 500 on "
          "most endpoints."),
    ]


# ---------------------------------------------------------------------------
# Endpoint sections
# ---------------------------------------------------------------------------
def endpoint_meta(auth: str, scope: str = "—", idem: str = "—"):
    return make_table([
        ["Auth", "Scope", "Idempotency-Key"],
        [auth, scope, idem],
    ], col_widths=[5 * cm, 5 * cm, CONTENT_WIDTH - 10 * cm], font_size=8.5)


def section_health() -> list:
    response = """{
  "ok": true,
  "service": "1xl-asset-tracker-api",
  "env": "production",
  "uptimeSeconds": 142,
  "db": { "ok": true, "latencyMs": 87 },
  "minAppVersion": { "ios": "1.0.0", "android": "1.0.0" },
  "maintenanceMessage": null
}"""
    curl = "curl https://asset.thebizzfly.com/health"
    return [
        h1("9.&nbsp;&nbsp;Endpoints — Health"),
        endpoint_header("GET", "/health"),
        endpoint_meta("Public — no auth"),
        h3("Response 200"),
        code_block(response),
        h3("curl"),
        curl_block(curl),
        p("<b>Notes.</b> <font face='Courier'>db.ok</font> is your readiness probe. "
          "<font face='Courier'>minAppVersion</font> drives the in-client force-upgrade "
          "screen. <font face='Courier'>maintenanceMessage</font> drives a non-dismissable "
          "banner when non-null."),
    ]


def section_auth_endpoints() -> list:
    flow = [h1("10.&nbsp;&nbsp;Endpoints — Auth")]

    # ── /auth/login ─────────────────────────────────────────────────────────
    body = """{
  "email": "alice@1xl.com",
  "password": "supersecret",
  "deviceId": "iPhone-15-Pro-Alice"
}"""
    response = """{
  "accessToken": "eyJhbGciOi...",
  "accessTokenExpiresIn": 1800,
  "refreshToken": "rT8K...",
  "refreshTokenExpiresIn": 2592000,
  "user": {
    "id": "...",
    "name": "Alice Admin",
    "email": "alice@1xl.com",
    "role": "admin",
    "departmentId": null,
    "phone": "",
    "avatar": null,
    "isActive": true,
    "organizationId": "..."
  }
}"""
    curl = """curl -X POST https://asset.thebizzfly.com/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $API_KEY" \\
  -d '{
    "email": "alice@1xl.com",
    "password": "supersecret"
  }'"""
    flow += [
        endpoint_header("POST", "/api/v1/auth/login"),
        endpoint_meta("API key only", "auth:login"),
        h3("Request body"),
        code_block(body),
        make_table([
            ["Field", "Type", "Required", "Notes"],
            ["email",    "string", "yes", "Normalised to lowercase"],
            ["password", "string", "yes", "1–200 chars"],
            ["deviceId", "string", "no",  "1–128 chars. Stored on the refresh-token row."],
        ], col_widths=[2.4 * cm, 1.8 * cm, 2 * cm, CONTENT_WIDTH - 6.2 * cm]),
        h3("Response 200"),
        code_block(response),
        h3("Errors"),
        make_table([
            ["Status", "code", "Cause"],
            ["401", "UNAUTHENTICATED",   "Wrong email/password, or account disabled"],
            ["403", "FORBIDDEN",         "User belongs to a different org than the API key"],
            ["422", "VALIDATION_FAILED", "Bad email format etc."],
            ["429", "RATE_LIMITED",      "More than 20 attempts/15 min from this IP"],
        ], col_widths=[1.6 * cm, 4.5 * cm, CONTENT_WIDTH - 6.1 * cm]),
        h3("curl"),
        curl_block(curl),
        small("Wrong email and wrong password return identical responses to prevent "
              "user-enumeration. Legacy plaintext passwords are bcrypt-hashed on "
              "first successful login."),
        Spacer(1, 6),
    ]

    # ── /auth/refresh ───────────────────────────────────────────────────────
    body2 = """{ "refreshToken": "rT8K...", "deviceId": "iPhone-15-Pro-Alice" }"""
    response2 = """{
  "accessToken": "...",
  "accessTokenExpiresIn": 1800,
  "refreshToken": "...",
  "refreshTokenExpiresIn": 2592000
}"""
    curl2 = """curl -X POST https://asset.thebizzfly.com/api/v1/auth/refresh \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $API_KEY" \\
  -d '{ "refreshToken": "'"$REFRESH"'" }'"""
    flow += [
        endpoint_header("POST", "/api/v1/auth/refresh"),
        endpoint_meta("API key only", "auth:refresh"),
        h3("Request body"),
        code_block(body2),
        h3("Response 200"),
        code_block(response2),
        p("<b>Clients MUST overwrite the stored refresh token immediately.</b> The "
          "previous token is now revoked; presenting it again invalidates every session "
          "for the user."),
        h3("curl"),
        curl_block(curl2),
        Spacer(1, 6),
    ]

    # ── /auth/logout ────────────────────────────────────────────────────────
    body3 = """{ "refreshToken": "rT8K...", "allDevices": false }"""
    curl3 = """curl -X POST https://asset.thebizzfly.com/api/v1/auth/logout \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $API_KEY" \\
  -d '{ "refreshToken": "'"$REFRESH"'" }'"""
    flow += [
        endpoint_header("POST", "/api/v1/auth/logout"),
        endpoint_meta("API key only"),
        h3("Request body"),
        code_block(body3),
        small("allDevices=true revokes every active refresh token for the user "
              "(sign-out everywhere). Default false."),
        h3("Response 200"),
        code_block('{ "ok": true }'),
        p("Idempotent — <font face='Courier'>ok: true</font> even if the token never existed."),
        h3("curl"),
        curl_block(curl3),
        Spacer(1, 6),
    ]

    # ── /auth/me ────────────────────────────────────────────────────────────
    response4 = """{
  "user": {
    "id": "...",
    "name": "Alice Admin",
    "email": "alice@1xl.com",
    "role": "admin",
    "departmentId": null,
    "phone": "",
    "avatar": null,
    "isActive": true,
    "organizationId": "..."
  },
  "organization": {
    "id": "...",
    "name": "1XL Infra",
    "shortName": "1xl",
    "logoUrl": "...",
    "currency": "USD",
    "country": "IN",
    "contactEmail": "ops@1xl.com",
    "contactPhone": "...",
    "industry": "Real Estate"
  }
}"""
    curl4 = """curl https://asset.thebizzfly.com/api/v1/auth/me \\
  -H "Authorization: Bearer $ACCESS\""""
    flow += [
        endpoint_header("GET", "/api/v1/auth/me"),
        endpoint_meta("User JWT only", "auth:read"),
        h3("Response 200"),
        code_block(response4),
        small("organization is null for super-admins (they have no org)."),
        h3("curl"),
        curl_block(curl4),
    ]
    return flow


def section_assets_endpoints() -> list:
    body = """{
  "qrPayload": "LAP-1XL-01-001",
  "geoLat": 28.6139,
  "geoLng": 77.2090
}"""
    curl = """curl -X POST https://asset.thebizzfly.com/api/v1/assets/lookup-by-qr \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{ "qrPayload": "LAP-1XL-01-001" }'"""
    curl_get = """curl https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID \\
  -H "Authorization: Bearer $TOKEN\""""
    return [
        h1("11.&nbsp;&nbsp;Endpoints — Assets"),
        p("Both endpoints below return the <b>asset envelope</b> — see section 18 for "
          "the full schema. <font face='Courier'>$TOKEN</font> can be either an API "
          "key or a user JWT."),
        endpoint_header("POST", "/api/v1/assets/lookup-by-qr"),
        endpoint_meta("Either", "assets:read"),
        h3("Request body"),
        code_block(body),
        make_table([
            ["Field", "Type", "Required", "Notes"],
            ["qrPayload", "string", "yes",
             "UUID, asset tag, or full /scan/ or /asset/ URL. Tags are uppercased."],
            ["geoLat",    "number", "no", "Logged for verification context (V2)"],
            ["geoLng",    "number", "no", ""],
        ], col_widths=[2.4 * cm, 1.8 * cm, 2 * cm, CONTENT_WIDTH - 6.2 * cm]),
        h3("Errors"),
        make_table([
            ["Status", "code", "Cause"],
            ["400", "INVALID_QR_PAYLOAD", "Couldn't parse the string"],
            ["404", "ASSET_NOT_FOUND",    "Parsed but no matching asset in this org"],
        ], col_widths=[1.6 * cm, 4.5 * cm, CONTENT_WIDTH - 6.1 * cm]),
        h3("curl"),
        curl_block(curl),
        Spacer(1, 6),
        endpoint_header("GET", "/api/v1/assets/{assetId}"),
        endpoint_meta("Either", "assets:read"),
        p("Returns the same envelope shape as /lookup-by-qr."),
        h3("curl"),
        curl_block(curl_get),
    ]


def section_photos_endpoints() -> list:
    body = """{
  "filename": "shot.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 12345,
  "caption": "Front view"
}"""
    response = """{
  "photoId": "9c3a...",
  "uploadUrl": "https://xdtrqkjztgjihtahmbjx.supabase.co/storage/v1/object/...",
  "uploadMethod": "PUT",
  "uploadHeaders": {
    "content-type": "image/jpeg",
    "x-upsert": "false"
  },
  "storagePath": "<org>/<asset>/<photoId>.jpg",
  "bucket": "asset-images",
  "expiresInSeconds": 600,
  "maxSizeBytes": 10485760
}"""
    response2 = """{
  "photo": {
    "id": "9c3a...",
    "url": "https://.../public/asset-images/<path>",
    "caption": "Front view after cleaning",
    "mimeType": "image/jpeg",
    "sizeBytes": 12345,
    "createdAt": "2026-04-29T11:30:00Z",
    "finalizedAt": "2026-04-29T11:30:18Z"
  }
}"""
    curl1 = """RESP=$(curl -s -X POST \\
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/photos/upload-url \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{ "filename": "shot.jpg", "mimeType": "image/jpeg", "sizeBytes": 12345 }')

PHOTO_ID=$(echo $RESP | jq -r .photoId)
UPLOAD_URL=$(echo $RESP | jq -r .uploadUrl)"""
    curl2 = """curl -X PUT "$UPLOAD_URL" \\
  -H "Content-Type: image/jpeg" \\
  -H "x-upsert: false" \\
  --data-binary @./shot.jpg"""
    curl3 = """curl -X POST \\
  "https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/photos/$PHOTO_ID/finalize" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{ "caption": "Front view after cleaning" }'"""
    return [
        h1("12.&nbsp;&nbsp;Endpoints — Photos"),
        p("Three-step flow: <b>(1)</b> request a presigned URL, <b>(2)</b> PUT bytes "
          "directly to Supabase Storage, <b>(3)</b> finalize. Privacy: clients are "
          "responsible for stripping EXIF/GPS before upload."),
        endpoint_header("POST", "/api/v1/assets/{assetId}/photos/upload-url"),
        endpoint_meta("Either", "photos:write", "Recommended"),
        h3("Request body"),
        code_block(body),
        make_table([
            ["Field", "Type", "Required", "Notes"],
            ["filename", "string", "yes", "Used for the storage path's extension"],
            ["mimeType", "string", "yes",
             "image/jpeg | image/png | image/webp | image/heic | image/heif"],
            ["sizeBytes","int",    "yes", "Must be ≤ maxSizeBytes (10 MB default)"],
            ["caption",  "string", "no",  "Stored on the photo row; can also be set on finalize"],
        ], col_widths=[2.4 * cm, 1.8 * cm, 2 * cm, CONTENT_WIDTH - 6.2 * cm]),
        h3("Response 200"),
        code_block(response),
        h3("Step 2 — direct PUT to Supabase Storage"),
        p("Send the bytes to <font face='Courier'>uploadUrl</font> with the headers "
          "from <font face='Courier'>uploadHeaders</font>. Do <b>not</b> include "
          "<font face='Courier'>Authorization</font> on this request — the signed URL "
          "carries its own token."),
        Spacer(1, 6),
        endpoint_header("POST", "/api/v1/assets/{assetId}/photos/{photoId}/finalize"),
        endpoint_meta("Either", "photos:write", "Recommended"),
        h3("Request body (optional)"),
        code_block('{ "caption": "Front view after cleaning" }'),
        h3("Response 200"),
        code_block(response2),
        h3("Errors"),
        make_table([
            ["Status", "code", "Cause"],
            ["404", "PHOTO_NOT_FOUND",   "Photo id doesn't exist for this asset"],
            ["422", "VALIDATION_FAILED", "Object not found in storage — the PUT didn't actually land"],
        ], col_widths=[1.6 * cm, 4.5 * cm, CONTENT_WIDTH - 6.1 * cm]),
        h3("curl — full flow"),
        curl_block(curl1),
        curl_block(curl2),
        curl_block(curl3),
    ]


def section_maintenance_endpoints() -> list:
    list_resp = """{
  "items": [
    {
      "id": "...",
      "assetId": "...",
      "scheduledDate": "2026-04-15T10:00:00Z",
      "completedDate": "2026-04-15T10:42:00Z",
      "technicianId": "...",
      "status": "completed",
      "type": "preventive",
      "cost": 0,
      "notes": "[task:cleaning] Cleaned vents and screen",
      "checklist": ["Vents cleaned", "Screen wiped"],
      "organizationId": "...",
      "createdAt": "..."
    }
  ],
  "total": 1
}"""
    types_resp = """{
  "items": [
    { "id": "preventive_inspection", "label": "Preventive Inspection", "defaultType": "preventive" },
    { "id": "cleaning",              "label": "Cleaning",              "defaultType": "preventive" },
    { "id": "firmware_update",       "label": "Firmware/Software Update", "defaultType": "preventive" },
    { "id": "lubrication",           "label": "Lubrication",           "defaultType": "preventive" },
    { "id": "calibration",           "label": "Calibration",           "defaultType": "preventive" },
    { "id": "replacement",           "label": "Part Replacement",      "defaultType": "corrective" },
    { "id": "corrective_other",      "label": "Corrective — Other",    "defaultType": "corrective" }
  ]
}"""
    body = """{
  "taskTypeId": "cleaning",
  "type": "preventive",
  "scheduledDate": "2026-04-29T11:00:00Z",
  "completedDate": "2026-04-29T11:30:00Z",
  "technicianId": null,
  "cost": 0,
  "notes": "Cleaned vents and screen",
  "checklist": ["Vents cleaned", "Screen wiped"],
  "status": "completed"
}"""
    curl1 = """curl https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/maintenance \\
  -H "Authorization: Bearer $TOKEN\""""
    curl2 = """curl https://asset.thebizzfly.com/api/v1/maintenance/task-types \\
  -H "Authorization: Bearer $TOKEN\""""
    curl3 = """curl -X POST \\
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/maintenance \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "taskTypeId": "cleaning",
    "type": "preventive",
    "notes": "Cleaned vents and screen",
    "checklist": ["Vents cleaned", "Screen wiped"]
  }'"""
    return [
        h1("13.&nbsp;&nbsp;Endpoints — Maintenance"),
        endpoint_header("GET", "/api/v1/assets/{assetId}/maintenance"),
        endpoint_meta("Either", "maintenance:read"),
        h3("Response 200"),
        code_block(list_resp),
        h3("curl"),
        curl_block(curl1),
        Spacer(1, 6),
        endpoint_header("GET", "/api/v1/maintenance/task-types"),
        endpoint_meta("Either", "maintenance:read"),
        h3("Response 200"),
        code_block(types_resp),
        h3("curl"),
        curl_block(curl2),
        Spacer(1, 6),
        endpoint_header("POST", "/api/v1/assets/{assetId}/maintenance"),
        endpoint_meta("Either", "maintenance:write", "Recommended"),
        h3("Request body"),
        code_block(body),
        make_table([
            ["Field", "Type", "Required", "Default", "Notes"],
            ["taskTypeId",   "string",   "yes", "—",                  "Echoed into notes as [task:<id>]"],
            ["type",         "enum",     "yes", "—",                  "preventive | corrective"],
            ["scheduledDate","datetime", "no",  "now",                ""],
            ["completedDate","datetime", "no",  "now (if completed)", ""],
            ["technicianId", "UUID",     "no",  "the caller",         "Must belong to caller's org"],
            ["cost",         "number",   "no",  "0",                  ""],
            ["notes",        "string",   "no",  '""',                 "Max 2000 chars"],
            ["checklist",    "string[]", "no",  "[]",                 "Max 50 × 200 chars"],
            ["status",       "enum",     "no",  "completed",          "scheduled | in_progress | completed | overdue | cancelled"],
        ], col_widths=[2.5 * cm, 1.7 * cm, 1.6 * cm, 2.5 * cm, CONTENT_WIDTH - 8.3 * cm], font_size=8),
        h3("curl"),
        curl_block(curl3),
    ]


def section_repairs_endpoints() -> list:
    list_resp = """{
  "items": [
    {
      "id": "...",
      "assetId": "...",
      "vendorId": null,
      "technicianId": null,
      "issue": "Battery does not charge past 80%",
      "status": "in_progress",
      "priority": "medium",
      "cost": 0,
      "partsUsed": "",
      "laborHours": 0,
      "completionDate": null,
      "notes": "Reproduced 3 times today",
      "organizationId": "...",
      "createdAt": "..."
    }
  ],
  "total": 1
}"""
    detail_resp = """{
  "repair":  { /* same shape as above */ },
  "vendor":  { "id": "...", "name": "TechFix Inc",
               "contactPerson": "...", "phone": "..." },
  "updates": [
    { "id": "...", "statusFrom": null, "statusTo": "pending",
      "note": "Repair raised via API", ... },
    { "id": "...", "statusFrom": "pending", "statusTo": "in_progress",
      "note": "Picked up by IT, diagnosing", ... }
  ]
}"""
    create_body = """{
  "issue": "Battery does not charge past 80%",
  "priority": "medium",
  "vendorId": null,
  "technicianId": null,
  "partsUsed": "",
  "notes": "Reproduced 3 times today"
}"""
    update_body = """{
  "statusTo": "in_progress",
  "note": "Picked up by IT, diagnosing",
  "partsUsed": "battery cell",
  "laborHours": 0.5,
  "cost": 75
}"""
    curl1 = """curl https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/repairs \\
  -H "Authorization: Bearer $TOKEN\""""
    curl2 = """curl https://asset.thebizzfly.com/api/v1/repairs/$REPAIR_ID \\
  -H "Authorization: Bearer $TOKEN\""""
    curl3 = """curl -X POST https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/repairs \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "issue": "Battery does not charge past 80%",
    "priority": "medium",
    "notes": "Reproduced 3 times today"
  }'"""
    curl4 = """curl -X POST https://asset.thebizzfly.com/api/v1/repairs/$REPAIR_ID/updates \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "statusTo": "in_progress",
    "note": "Picked up by IT, diagnosing"
  }'"""
    return [
        h1("14.&nbsp;&nbsp;Endpoints — Repairs"),
        endpoint_header("GET", "/api/v1/assets/{assetId}/repairs"),
        endpoint_meta("Either", "repairs:read"),
        h3("Response 200"),
        code_block(list_resp),
        h3("curl"),
        curl_block(curl1),
        Spacer(1, 6),
        endpoint_header("GET", "/api/v1/repairs/{repairId}"),
        endpoint_meta("Either", "repairs:read"),
        h3("Response 200"),
        code_block(detail_resp),
        h3("curl"),
        curl_block(curl2),
        Spacer(1, 6),
        endpoint_header("POST", "/api/v1/assets/{assetId}/repairs"),
        endpoint_meta("Either", "repairs:write", "Recommended"),
        h3("Request body"),
        code_block(create_body),
        make_table([
            ["Field", "Type", "Required", "Notes"],
            ["issue",        "string", "yes", "3–2000 chars"],
            ["priority",     "enum",   "no",  "low | medium (default) | high | critical"],
            ["vendorId",     "UUID",   "no",  "If set, ticket starts in 'assigned'"],
            ["technicianId", "UUID",   "no",  "Same"],
            ["partsUsed",    "string", "no",  "Max 500 chars"],
            ["notes",        "string", "no",  "Max 2000 chars"],
        ], col_widths=[2.4 * cm, 1.8 * cm, 2 * cm, CONTENT_WIDTH - 6.2 * cm]),
        h3("curl"),
        curl_block(curl3),
        Spacer(1, 6),
        endpoint_header("POST", "/api/v1/repairs/{repairId}/updates"),
        endpoint_meta("Either", "repairs:write", "Recommended"),
        h3("Request body"),
        code_block(update_body),
        make_table([
            ["Field", "Type", "Required", "Notes"],
            ["statusTo",   "enum",   "no",  "pending | assigned | in_progress | completed | cancelled. If omitted, status is unchanged."],
            ["note",       "string", "yes", "1–2000 chars"],
            ["partsUsed",  "string", "no",  "Replaces existing value if set"],
            ["laborHours", "number", "no",  "Replaces existing value if set"],
            ["cost",       "number", "no",  "Replaces existing value if set"],
        ], col_widths=[2.4 * cm, 1.8 * cm, 2 * cm, CONTENT_WIDTH - 6.2 * cm]),
        small("If statusTo === \"completed\", server stamps completion_date = now()."),
        h3("curl"),
        curl_block(curl4),
    ]


def section_recovery_endpoints() -> list:
    body = """{
  "incidentType": "stolen",
  "severity": "high",
  "description": "Reported missing from desk 4B",
  "estimatedLoss": 1200,
  "incidentDate": "2026-04-29T09:00:00Z",
  "markAssetDead": true
}"""
    response = """{
  "recovery": {
    "id": "...",
    "incidentType": "stolen",
    "status": "reported",
    ...
  },
  "asset": {
    "id": "...",
    "status": "dead",
    ...
  }
}"""
    curl = """curl -X POST https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/recovery \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "incidentType": "stolen",
    "severity": "high",
    "description": "Reported missing from desk 4B",
    "estimatedLoss": 1200,
    "markAssetDead": true
  }'"""
    return [
        h1("15.&nbsp;&nbsp;Endpoints — Recovery"),
        endpoint_header("POST", "/api/v1/assets/{assetId}/recovery"),
        endpoint_meta("Either", "recovery:write", "Recommended"),
        p("Files a loss / damage / theft / claim / write-off incident. Optionally flips "
          "the asset to <font face='Courier'>dead</font> <b>atomically</b> — if the asset "
          "update fails, the recovery row is rolled back."),
        h3("Request body"),
        code_block(body),
        make_table([
            ["Field", "Type", "Required", "Notes"],
            ["incidentType",  "enum",     "yes", "lost | damaged | stolen | insurance_claim | write_off"],
            ["severity",      "enum",     "no",  "low | medium (default) | high | critical"],
            ["description",   "string",   "yes", "3–2000 chars"],
            ["estimatedLoss", "number",   "no",  "Default 0"],
            ["incidentDate",  "datetime", "no",  "Default now"],
            ["markAssetDead", "boolean",  "no",  "Default false. When true, asset.status becomes 'dead'."],
        ], col_widths=[2.6 * cm, 1.8 * cm, 2 * cm, CONTENT_WIDTH - 6.4 * cm]),
        h3("Response 201"),
        code_block(response),
        small("asset is null if markAssetDead was false."),
        h3("Errors"),
        make_table([
            ["Status", "code", "Cause"],
            ["409", "CONFLICT", "Asset is already 'dead' or 'disposed'"],
        ], col_widths=[1.6 * cm, 4.5 * cm, CONTENT_WIDTH - 6.1 * cm]),
        h3("curl"),
        curl_block(curl),
    ]


def section_audit_endpoints() -> list:
    verify_body = """{
  "cycleId": null,
  "actualLocationId": "...",
  "actualAssigneeId": "...",
  "notes": "Verified in person",
  "geoLat": 28.6139,
  "geoLng": 77.2090
}"""
    flag_body = """{
  "cycleId": null,
  "flagReason": "wrong_location",
  "actualLocationId": "...",
  "actualAssigneeId": null,
  "notes": "Found in Conference Room B; expected Floor 4 storage",
  "geoLat": 28.6139,
  "geoLng": 77.2090
}"""
    response = """{
  "verification": {
    "id": "...",
    "cycleId": "...",
    "assetId": "...",
    "verifierId": "...",
    "result": "verified",
    "expectedLocationId": "...",
    "actualLocationId": "...",
    "expectedAssigneeId": "...",
    "actualAssigneeId": "...",
    "flagReason": null,
    "notes": "Verified in person",
    "geoLat": 28.6139,
    "geoLng": 77.209,
    "createdAt": "..."
  }
}"""
    curl1 = """curl -X POST \\
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/audit/verify \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{ "notes": "Verified in person" }'"""
    curl2 = """curl -X POST \\
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/audit/flag \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "flagReason": "wrong_location",
    "notes": "Found in Conference Room B; expected Floor 4 storage"
  }'"""
    return [
        h1("16.&nbsp;&nbsp;Endpoints — Audit"),
        p("Both endpoints upsert one row per (cycle, asset). The active cycle is found "
          "automatically; pass <font face='Courier'>cycleId</font> only to target a "
          "specific one."),
        endpoint_header("POST", "/api/v1/assets/{assetId}/audit/verify"),
        endpoint_meta("Either", "audit:write", "Recommended"),
        h3("Request body"),
        code_block(verify_body),
        h3("Response 201"),
        code_block(response),
        h3("Errors"),
        make_table([
            ["Status", "code", "Cause"],
            ["404", "CYCLE_NOT_FOUND", "No active audit cycle for the org"],
        ], col_widths=[1.6 * cm, 4.5 * cm, CONTENT_WIDTH - 6.1 * cm]),
        h3("curl"),
        curl_block(curl1),
        Spacer(1, 6),
        endpoint_header("POST", "/api/v1/assets/{assetId}/audit/flag"),
        endpoint_meta("Either", "audit:write", "Recommended"),
        h3("Request body"),
        code_block(flag_body),
        make_table([
            ["Field", "Type", "Required", "Notes"],
            ["cycleId",          "UUID",   "no",  "Default = active cycle"],
            ["flagReason",       "enum",   "yes", "wrong_location | wrong_assignee | damaged | missing | other"],
            ["actualLocationId", "UUID",   "no",  "What you actually saw — null if missing"],
            ["actualAssigneeId", "UUID",   "no",  "Same"],
            ["notes",            "string", "yes", "3–1000 chars"],
            ["geoLat / geoLng",  "number", "no",  "Coordinates of the flag"],
        ], col_widths=[3 * cm, 1.7 * cm, 2 * cm, CONTENT_WIDTH - 6.7 * cm]),
        h3("curl"),
        curl_block(curl2),
    ]


def section_reference_endpoints() -> list:
    users_resp = """{
  "items": [
    {
      "id": "...",
      "name": "Bob Technician",
      "email": "bob@1xl.com",
      "role": "technician",
      "departmentId": null,
      "phone": "...",
      "avatar": null
    }
  ],
  "total": 1
}"""
    locs_resp = """{
  "items": [
    {
      "id": "...",
      "name": "Head Office",
      "address": "...",
      "city": "Delhi",
      "state": "DL",
      "country": "IN",
      "floorNo": "4"
    }
  ],
  "total": 1
}"""
    curl1 = """curl "https://asset.thebizzfly.com/api/v1/reference/users?q=bob&limit=10" \\
  -H "Authorization: Bearer $TOKEN\""""
    curl2 = """curl "https://asset.thebizzfly.com/api/v1/reference/locations?limit=50" \\
  -H "Authorization: Bearer $TOKEN\""""
    return [
        h1("17.&nbsp;&nbsp;Endpoints — Reference data"),
        p("Picker sources for client dropdowns when raising repairs, flagging audits, "
          "etc. Both accept <font face='Courier'>q</font> (substring search) and "
          "<font face='Courier'>limit</font> (default 100, max 500)."),
        endpoint_header("GET", "/api/v1/reference/users"),
        endpoint_meta("Either", "reference:read"),
        h3("Response 200"),
        code_block(users_resp),
        h3("curl"),
        curl_block(curl1),
        Spacer(1, 6),
        endpoint_header("GET", "/api/v1/reference/locations"),
        endpoint_meta("Either", "reference:read"),
        h3("Response 200"),
        code_block(locs_resp),
        h3("curl"),
        curl_block(curl2),
    ]


def section_schemas() -> list:
    envelope = """{
  "asset": {
    "id": "uuid",
    "assetTag": "LAP-1XL-01-001",
    "name": "Dell XPS 13 — Alice",
    "type": "it_equipment",
    "category": "Laptop",
    "brand": "Dell",
    "model": "XPS 13",
    "serialNumber": "SN-12345",
    "status": "allocated",
    "description": "...",
    "purchaseDate": "2024-09-01",
    "purchaseCost": 1200,
    "currency": "USD",
    "warrantyStart": "2024-09-01",
    "warrantyEnd": "2027-09-01",
    "imageUrl": "https://.../primary.jpg",
    "imageUrls": ["https://.../1.jpg", "..."],
    "processor": "Intel i7-1360P",
    "ram": "16 GB",
    "storage": "512 GB SSD",
    "assetUse": "personal",
    "organizationId": "uuid",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "location":   { ... } | null,
  "department": { ... } | null,
  "vendor":     { ... } | null,
  "currentAllocation": {
    "id": "uuid", "status": "active",
    "startDate": "2024-09-15", "endDate": null,
    "allocationType": "new_employee",
    "employeeId": "uuid", "departmentId": "uuid"
  } | null,
  "currentAssignee": {
    "id": "uuid", "name": "Alice Admin",
    "email": "alice@1xl.com", "phone": "...", "role": "admin"
  } | null,
  "auditContext": {
    "cycleId": "uuid",
    "cycleName": "Q2 2026",
    "cycleStartsAt": "2026-04-01T00:00:00Z",
    "cycleEndsAt": null,
    "expectedLocationId": "uuid",
    "expectedAssigneeId": "uuid",
    "currentVerification": {
      "id": "uuid", "result": "verified", "createdAt": "..."
    } | null
  } | null,
  "permittedActions": [
    "add_photo", "log_maintenance", "raise_repair",
    "update_repair", "mark_recovery", "verify_audit"
  ]
}"""
    user = """{
  "id": "uuid",
  "name": "Alice Admin",
  "email": "alice@1xl.com",
  "role": "admin",
  "departmentId": "uuid" | null,
  "phone": "...",
  "avatar": "https://..." | null,
  "isActive": true,
  "organizationId": "uuid" | null
}"""
    org = """{
  "id": "uuid",
  "name": "1XL Infra",
  "shortName": "1xl",
  "logoUrl": "https://..." | null,
  "currency": "USD",
  "country": "IN" | null,
  "contactEmail": "...",
  "contactPhone": "...",
  "industry": "Real Estate"
}"""
    return [
        h1("18.&nbsp;&nbsp;Schemas"),
        h3("Asset envelope"),
        p("The single source of truth for the client asset screen. Returned by "
          "<font face='Courier'>/lookup-by-qr</font> and "
          "<font face='Courier'>GET /assets/{id}</font>."),
        code_block(envelope),
        small("auditContext is null when no audit cycle is active. currentVerification "
              "is null when this asset hasn't been touched in the active cycle yet."),
        h3("User"),
        code_block(user),
        h3("Organization"),
        code_block(org),
    ]


def section_scopes() -> list:
    return [
        h1("19.&nbsp;&nbsp;Scope catalogue"),
        p("Every endpoint requires the API key to carry the matching scope. "
          "Defined in <font face='Courier'>server/src/lib/scopes.ts</font>. The web "
          "admin page's <b>Default scopes</b> button selects the standard bundle."),
        make_table([
            ["Scope", "Endpoints"],
            ["auth:login",        "POST /auth/login"],
            ["auth:refresh",      "POST /auth/refresh"],
            ["auth:read",         "GET /auth/me"],
            ["assets:read",       "POST /assets/lookup-by-qr, GET /assets/:id"],
            ["assets:write",      "(reserved)"],
            ["photos:write",      "POST /assets/:id/photos/upload-url, /finalize"],
            ["maintenance:read",  "GET /assets/:id/maintenance, GET /maintenance/task-types"],
            ["maintenance:write", "POST /assets/:id/maintenance"],
            ["repairs:read",      "GET /assets/:id/repairs, GET /repairs/:id"],
            ["repairs:write",     "POST /assets/:id/repairs, POST /repairs/:id/updates"],
            ["recovery:write",    "POST /assets/:id/recovery"],
            ["audit:read",        "(reserved — no read endpoint yet)"],
            ["audit:write",       "POST /assets/:id/audit/verify, /flag"],
            ["reference:read",    "GET /reference/users, /locations"],
        ], col_widths=[4.5 * cm, CONTENT_WIDTH - 4.5 * cm], font_size=8.3),
        h3("Wildcards"),
        make_table([
            ["Form",            "Effect"],
            ["<resource>:*",    "All actions on a resource (e.g. assets:*, repairs:*)"],
            ["*",               "All scopes (god-mode key — use sparingly)"],
        ], col_widths=[3.5 * cm, CONTENT_WIDTH - 3.5 * cm]),
    ]


def section_actions_matrix() -> list:
    return [
        h1("20.&nbsp;&nbsp;Permitted-actions matrix"),
        p("The <font face='Courier'>permittedActions</font> array in every asset "
          "envelope is computed server-side per (user, asset). Clients show action "
          "tiles based on it — never roll your own client-side check."),
        make_table([
            ["Action", "Admin", "Manager", "Technician", "Vendor", "Auditor", "Employee", "Staff"],
            ["add_photo",       "✓", "✓", "✓", "—", "✓", "✓", "✓"],
            ["log_maintenance", "✓", "✓", "✓", "—", "—", "—", "—"],
            ["raise_repair",    "✓", "✓", "✓", "—", "—", "✓", "✓"],
            ["update_repair",   "✓", "✓", "✓", "✓", "—", "—", "—"],
            ["mark_recovery",   "✓", "✓", "—", "—", "—", "—", "—"],
            ["verify_audit",    "✓", "✓", "—", "—", "✓", "—", "—"],
        ], col_widths=[3.2 * cm] + [(CONTENT_WIDTH - 3.2 * cm) / 7] * 7, font_size=8.5),
        Spacer(1, 6),
        small("When asset.status is retired, disposed, or dead, the only permitted "
              "action is add_photo (regardless of role). Integrations using an API key "
              "without a user JWT are treated as admin-equivalent — their authority "
              "comes from explicit scope grants on the key."),
    ]


def section_status_enum() -> list:
    return [
        h1("21.&nbsp;&nbsp;Asset status enum"),
        p("Canonical seven values. Clients should adopt these exactly."),
        make_table([
            ["Value", "Display", "Means"],
            ["available",         "Available",          "In inventory, not assigned"],
            ["allocated",         "Allocated",          "Assigned to a person"],
            ["in_use",            "In Use (Shared)",    "Common-use asset (printer, conference TV)"],
            ["under_maintenance", "Under Maintenance",  "Temporarily out of service"],
            ["retired",           "Retired",            "End of life, not in active use"],
            ["disposed",          "Disposed",           "Sold or scrapped"],
            ["dead",              "Dead",               "Lost / stolen / written off"],
        ], col_widths=[4 * cm, 4 * cm, CONTENT_WIDTH - 8 * cm]),
    ]


def section_versioning() -> list:
    return [
        h1("22.&nbsp;&nbsp;Versioning policy"),
        make_table([
            ["Rule", "Detail"],
            ["/api/v1/* is additive-only",    "Adding optional fields, new endpoints, new enum values is allowed."],
            ["Breaking changes get /api/v2/*","v1 stays alive in parallel for at least one client release cycle."],
            ["Stable error codes",            "error.code strings never change meaning across versions."],
            ["Deprecation signals",           "Sunset endpoints carry Deprecation: true and Sunset: <date> response headers months ahead of removal."],
        ], col_widths=[5.5 * cm, CONTENT_WIDTH - 5.5 * cm]),
    ]


def section_changelog() -> list:
    return [
        h1("23.&nbsp;&nbsp;Changelog &amp; support"),
        h3("Changelog"),
        make_table([
            ["Version", "Date", "Notes"],
            ["1.0", date.today().strftime("%Y-%m-%d"),
             "Initial release. Single Authorization: Bearer scheme, org-prefixed API keys, "
             "auth (login/refresh/logout/me), assets, photos, maintenance, repairs, "
             "recovery, audit, reference."],
        ], col_widths=[2 * cm, 3 * cm, CONTENT_WIDTH - 5 * cm]),
        h3("Where to file issues"),
        p("Include the <font face='Courier'>requestId</font> from the failing response. "
          "Server logs are indexed on this field — without it, debugging is much slower."),
        h3("Quick reference card"),
        code_block("""BASE       https://asset.thebizzfly.com  (or http://localhost:4000)
HEADERS    Authorization: Bearer <token>     (token = API key OR user JWT)
           Idempotency-Key: <uuid>           (recommended on POSTs)
           X-Request-Id: <id>                (recommended on every call)

AUTH       POST   /api/v1/auth/login
           POST   /api/v1/auth/refresh
           POST   /api/v1/auth/logout
           GET    /api/v1/auth/me

ASSETS     POST   /api/v1/assets/lookup-by-qr
           GET    /api/v1/assets/:id

PHOTOS     POST   /api/v1/assets/:id/photos/upload-url
           POST   /api/v1/assets/:id/photos/:photoId/finalize

MAINT      GET    /api/v1/assets/:id/maintenance
           GET    /api/v1/maintenance/task-types
           POST   /api/v1/assets/:id/maintenance

REPAIRS    GET    /api/v1/assets/:id/repairs
           GET    /api/v1/repairs/:id
           POST   /api/v1/assets/:id/repairs
           POST   /api/v1/repairs/:id/updates

RECOVERY   POST   /api/v1/assets/:id/recovery

AUDIT      POST   /api/v1/assets/:id/audit/verify
           POST   /api/v1/assets/:id/audit/flag

REFERENCE  GET    /api/v1/reference/users
           GET    /api/v1/reference/locations

HEALTH     GET    /health"""),
    ]


# ---------------------------------------------------------------------------
# Build it
# ---------------------------------------------------------------------------
def build():
    out = Path(__file__).parent / "Asset-Tracker-API-Reference.pdf"
    doc = build_doc(out)

    flow: list = [NextPageTemplate("cover")]
    flow += cover()
    flow.append(NextPageTemplate("content"))
    flow.append(PageBreak())

    flow += toc();                            flow.append(PageBreak())
    flow += section_overview();               flow.append(PageBreak())
    flow += section_base_urls();              flow.append(PageBreak())
    flow += section_auth();                   flow.append(PageBreak())
    flow += section_common_headers();         flow.append(PageBreak())
    flow += section_errors();                 flow.append(PageBreak())
    flow += section_rate_limits();            flow.append(PageBreak())
    flow += section_idempotency();            flow.append(PageBreak())
    flow += section_pagination();             flow.append(PageBreak())
    flow += section_health();                 flow.append(PageBreak())
    flow += section_auth_endpoints();         flow.append(PageBreak())
    flow += section_assets_endpoints();       flow.append(PageBreak())
    flow += section_photos_endpoints();       flow.append(PageBreak())
    flow += section_maintenance_endpoints();  flow.append(PageBreak())
    flow += section_repairs_endpoints();      flow.append(PageBreak())
    flow += section_recovery_endpoints();     flow.append(PageBreak())
    flow += section_audit_endpoints();        flow.append(PageBreak())
    flow += section_reference_endpoints();    flow.append(PageBreak())
    flow += section_schemas();                flow.append(PageBreak())
    flow += section_scopes();                 flow.append(PageBreak())
    flow += section_actions_matrix();         flow.append(PageBreak())
    flow += section_status_enum();            flow.append(PageBreak())
    flow += section_versioning();             flow.append(PageBreak())
    flow += section_changelog()

    doc.build(flow)
    print(f"Wrote {out} ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
