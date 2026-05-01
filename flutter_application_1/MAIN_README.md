# Asset Scanner — Mobile App

Flutter (iOS + Android) companion app for the **Asset Tracker** web platform at `asset.thebizzfly.com`. The web platform handles asset registration, QR generation, and full lifecycle administration. The mobile app extends that platform into physical-world workflows: scan an asset's QR code → fetch its details → run a workflow such as logging maintenance, raising a repair, marking recovery, or verifying audit position.

> **What's not yet built.** This repository is a **V1 UI scaffold**. Every screen, model, and pattern is in place, but every repository is a fake in-memory implementation seeded with three demo assets. There is no real HTTP client, no real authentication, no real camera, and no real photo upload. The OpenAPI 3.1 spec is still pending answers to [`docs/08-client-questionnaire.md.txt`](docs/08-client-questionnaire.md.txt). Treat this as a navigable visual prototype that boots end-to-end, not a production app.

---

## 1. Overview

The Asset Tracker platform manages physical assets — laptops, monitors, peripherals, furniture — across an organisation's offices and people. The web app handles registration, QR generation, allocations, depreciation, audits, and reports. **What it cannot do well is the physical-world half of the job:** walking up to a laptop, scanning its QR sticker, taking a photo, logging a maintenance check, or verifying that the asset is still where it should be. That's the gap the mobile app closes.

### Problem solved

- **For IT admins** — assigning laptops, raising and tracking repair tickets, marking recovery when staff leave, all from the device in front of them rather than back at a desk.
- **For facilities** — logging routine maintenance (cleaning, firmware updates, battery health checks) directly against the physical asset.
- **For auditors** — running an audit cycle by walking the floor, scanning each asset, and confirming or flagging its location and assignee against the system of record.

### Target users

Internal staff only. There is no customer-facing surface. Users are authenticated against the existing web platform's account system; the mobile app does not have its own user database.

| Role | Primary mobile workflows |
|------|--------------------------|
| **IT admin** | Asset details, raise/update repairs, mark recovery |
| **Facilities** | Log maintenance, add photos, raise repairs |
| **Auditors** | Audit verification (verify match / flag discrepancy) |
| **All roles** | Scan QR, view asset details, add standalone photos |

### The seven core workflows

1. **Sign in** — email + password, JWT (30 min) + rotated refresh token (30 days).
2. **Scan asset QR → view details** — read-only summary: identity + state + recent photos + permitted actions for the current user.
3. **Add a standalone photo** — attach a photo to an asset outside any other workflow.
4. **Log maintenance** — record routine cleaning, firmware updates, battery checks; optionally complete a scheduled item.
5. **Manage repairs** — raise tickets, view history, add updates with explicit status transitions (`reported` → `in_progress` → `resolved` / `cancelled`).
6. **Mark recovery** — return an assigned asset to inventory; if condition is "Needs repair," chain into raising a repair ticket.
7. **Audit verification** — for an asset in an active audit cycle, compare expected vs actual location/assignee, then verify-match or flag-discrepancy with a reason code.

### Permission model — "dumb defensive renderer"

The mobile app **never decides what a user can do**. The server returns a `permittedActions` array on every asset lookup; the UI shows action tiles only for actions present in that array. Mobile does not cache role/permission data, does not enforce policy locally, and does not branch on role. Authorisation is server-side; the array is a hint for what to render, not a security boundary.

### Compliance and locale

Built for Indian organisations on the **DPDP Act**. Personal-data minimisation is observed throughout: the app captures only what's necessary, stores tokens in platform-secure storage (planned), and the photo storage region is India. GST/TDS surfaces — handled in the web platform's billing module — are explicitly out of scope for mobile; the app never displays financial data.

### Out of scope for V1

Offline mode, push notifications, in-app messaging or comments threads, bulk operations, web/desktop support, multi-tenant org switching from inside the app. See `docs/01-product-overview.md` for the full V1/V2 split.

---

## 2. Tech Stack

### Mobile (this repository)

| Layer | Choice | Pinned in `pubspec.yaml` |
|-------|--------|--------------------------|
| Runtime | **Flutter** ≥ 3.19 with Dart sound null safety | `flutter: ">=3.19.0"` |
| Dart SDK | ≥ 3.3 | `sdk: ">=3.3.0 <4.0.0"` |
| State management | **`flutter_riverpod`** (exclusively) | `^2.5.1` |
| Routing | **`go_router`** (exclusively) | `^13.2.0` |
| Domain models | **`freezed`** + **`json_serializable`** | `freezed_annotation: ^2.4.1`, `json_annotation: ^4.8.1` |
| Time formatting | **`intl`** | `^0.20.2` (bumped to match SDK pin — see `docs/known-issues.md`) |
| Collections | **`collection`** | `^1.18.0` |
| Build tooling | **`build_runner`**, **`freezed`**, **`json_serializable`** | dev_dependencies |
| Lints | **`flutter_lints`** | `^3.0.0` |

That's the **complete dependency surface** for V1. No extra packages have been added; new packages require explicit confirmation per [`docs/04-engineering-conventions.md`](docs/04-engineering-conventions.md).

The lint configuration in [`asset_scanner_app/analysis_options.yaml`](asset_scanner_app/analysis_options.yaml) enforces `prefer_const_constructors`, `prefer_const_literals_to_create_immutables`, `prefer_const_declarations`, `avoid_print`, `sort_child_properties_last`, `use_super_parameters`, and `require_trailing_commas`. `dart analyze` is currently clean.

### Backend (informational — not in this repository)

The backend is being built in parallel and isn't part of this repo. The mobile app interacts with it via HTTPS once integration starts.

| Layer | Stack |
|-------|-------|
| Runtime | Node.js + TypeScript (modular monolith) |
| Transport | REST + JSON over HTTPS |
| Database | MySQL (shared with the web app — *reuse, not replicate*) |
| Object storage | S3-compatible, Indian region, presigned PUT for photo upload |
| Hosting region | India (DPDP Act / data residency) |
| Auth | JWT bearer (30 min) + opaque refresh token (30 days, rotated, hashed server-side) |

See [`docs/02-trd-summary.md`](docs/02-trd-summary.md) for the mobile-relevant slice of the TRD.

### Tooling that's *not* yet wired

- `mobile_scanner` for live QR detection (scaffold uses a "Simulate scan (demo)" button)
- `camera` for photo capture (scaffold uses a placeholder preview)
- `permission_handler` for runtime camera permission
- `flutter_secure_storage` for token persistence (lands with the auth interceptor)
- Crash reporting + analytics SDK (V1.x)

These are tracked in [`docs/known-issues.md`](docs/known-issues.md) and the roadmap in section 12 below.

---

## 3. Project Architecture

### Repository layout

```
flutter_application_1/                  ← project root (this README lives here)
├── README.md
├── docs/                               ← product, technical, UX, conventions, redesign
│   ├── 01-product-overview.md
│   ├── 02-trd-summary.md
│   ├── 03-ux-spec-summary.md
│   ├── 04-engineering-conventions.md
│   ├── 05-visual-design-system.md
│   ├── 06-architecture-future-proofing.md
│   ├── 08-client-questionnaire.md.txt  ← extension is .txt; see § 11
│   ├── known-issues.md
│   ├── questionnaire.md                ← cleaner duplicate of doc 08; see § 11
│   └── visual-references/              ← 16 web screenshots (visual source of truth)
├── stage-b-handoff/                    ← unmoved Stage B docs; see § 11
│   └── docs/07-screen-redesigns.md
└── asset_scanner_app/                  ← the Flutter project
    ├── README.md
    ├── pubspec.yaml
    ├── analysis_options.yaml
    └── lib/                            ← all application code
```

### Application layout (`asset_scanner_app/lib/`)

The Flutter app uses a **feature-first** layout. Cross-cutting infrastructure lives in `core/`; reusable UI primitives live in `shared/widgets/`; everything else is grouped by feature.

```
lib/
├── main.dart                                # entry; Riverpod ProviderScope + AssetScannerApp
├── app/
│   ├── app.dart                             # MaterialApp.router + theme wiring
│   └── router.dart                          # go_router config; all 17 routes; AppRoute name constants
├── core/
│   ├── theme/                               # design tokens — single source of truth for colour, spacing, radius, type
│   │   ├── app_colors.dart
│   │   ├── app_radius.dart
│   │   ├── app_spacing.dart
│   │   ├── app_typography.dart
│   │   ├── app_theme.dart                   # ThemeData factory
│   │   └── theme.dart                       # barrel export
│   ├── errors/
│   │   └── app_error.dart                   # AppError + AppErrorCode + userMessage mapping
│   ├── result/
│   │   └── async_result.dart                # AsyncResult<T> sealed type
│   └── utils/
│       └── relative_time.dart               # formatRelative + formatDue helpers
├── shared/
│   └── widgets/                             # V1 component library — used in 2+ places
│       ├── widgets.dart                     # barrel
│       ├── action_tile.dart                 # ActionTile + LargeChoiceTile
│       ├── app_picker.dart                  # bottom-sheet single-select with search
│       ├── app_segmented_control.dart
│       ├── app_text_field.dart              # AppTextField + AppPasswordField + AppTextArea
│       ├── banner_error.dart                # per-screen recoverable error banner
│       ├── confirm_dialog.dart              # showConfirmDialog + showResultSheet helpers
│       ├── empty_state.dart
│       ├── filter_pill_row.dart
│       ├── identity_header.dart             # IdentityHeader + StatChip + InlineTip + HintPill + HintText
│       ├── key_value_row.dart
│       ├── photo_attachment_row.dart        # PhotoAttachmentRow + PhotoListRow
│       ├── photo_thumb_strip.dart           # PhotoThumbStrip + Lightbox
│       ├── primary_button.dart
│       ├── secondary_button.dart            # SecondaryButton + DestructiveButton
│       ├── skeleton.dart                    # rect / line / circle pulsing placeholders
│       ├── status_badge.dart                # StatusBadge + BadgeTone enum
│       ├── toast.dart                       # showAppToast helper
│       └── update_entry.dart                # repair-detail timeline row
└── features/
    ├── auth/        # Login, Session expired
    ├── home/        # Home (single oversized "Scan asset QR" CTA)
    ├── scan/        # Scanner (camera placeholder + Simulate scan demo)
    ├── asset/       # Asset Details (the showcase screen)
    ├── photo/       # Photo Capture, Photo Preview
    ├── maintenance/ # Maintenance List, Log Maintenance
    ├── repair/      # Repairs List, Repair Detail, Raise Repair, Add Repair Update sheet
    ├── recovery/    # Mark Recovery
    ├── audit/       # Audit Verification (no domain/ folder — uses asset.AuditContext)
    ├── settings/    # Settings (profile, app info, sign out)
    └── permission/  # Camera Permission Rationale
```

Each feature follows a consistent four-layer slice:

```
features/<feature>/
├── data/         # abstract repository interface + Fake*Repository impl + Riverpod Provider
├── domain/       # freezed entities and enums (omitted when feature has no own domain)
├── state/        # Riverpod controllers (AsyncNotifierProvider / .family)
└── presentation/ # screens + feature-local widgets in a `widgets/` subfolder
```

> **Why `audit/` has no `domain/` folder.** The audit verification screen consumes `AuditContext`, `AssetLocation`, and `AssetUser` — all of which already live in [`asset_scanner_app/lib/features/asset/domain/asset.dart`](asset_scanner_app/lib/features/asset/domain/asset.dart). The audit feature itself only writes (verify-match / flag-discrepancy) and produces no entities of its own, so no `domain/` is needed yet. If the spec later returns a `DiscrepancyRecord` to the client, a `domain/` folder appears alongside `data/`.

### The three locked-in design patterns

These three patterns are non-negotiable per [`docs/04-engineering-conventions.md`](docs/04-engineering-conventions.md). Every feature follows them.

**1. Repository interface + concrete fake, wired through a Provider.** Screens depend on the abstract type; only the provider names the impl. Swapping the fake for a real HTTP implementation is one file's body change.

```dart
abstract class AssetRepository {
  Future<AssetLookupResult> lookupByQr(String qrPayload);
  Future<AssetLookupResult> getById(String assetId);
}

class FakeAssetRepository implements AssetRepository { /* in-memory seed data */ }

final assetRepositoryProvider = Provider<AssetRepository>((ref) {
  return FakeAssetRepository();
});
```

**2. `AsyncNotifierProvider.family` keyed on entity id, with `copyWithPrevious` refresh.** Entity-scoped controllers are the default for any screen that loads a specific record. Refresh keeps the prior data on screen rather than collapsing to a skeleton.

```dart
final assetDetailsControllerProvider =
    AsyncNotifierProvider.family<AssetDetailsController, AssetLookupResult, String>(
  AssetDetailsController.new,
);

class AssetDetailsController extends FamilyAsyncNotifier<AssetLookupResult, String> {
  late final AssetRepository _repo;

  @override
  Future<AssetLookupResult> build(String assetId) async {
    _repo = ref.read(assetRepositoryProvider);
    return _repo.getById(assetId);
  }

  Future<void> refresh() async {
    state = AsyncLoading<AssetLookupResult>().copyWithPrevious(state);
    state = AsyncData<AssetLookupResult>(await _repo.getById(arg));
  }
}
```

After mutations elsewhere (e.g. raising a repair), callers do `ref.invalidate(assetDetailsControllerProvider(id))` to force a clean re-read.

**3. Tokens-only styling.** No `Color(0xFF…)`, no `EdgeInsets.all(N)` with raw numbers, no inline font sizes anywhere outside `lib/core/theme/`. Status is always conveyed by **colour AND text** via `StatusBadge` (accessibility rule from the UX spec). The visual rebrand from navy to emerald in Stage A was a one-file edit to [`asset_scanner_app/lib/core/theme/app_colors.dart`](asset_scanner_app/lib/core/theme/app_colors.dart) — every widget already referenced tokens by name.

### Cross-feature wiring

Most features are independent: `repair` does not import from `maintenance`. The exceptions are deliberate:

- `scan/` depends on `asset/` — `FakeScanRepository` calls into `assetRepository.lookupByQr`. Wired through Riverpod, not a direct import in repositories.
- `audit/` borrows `AuditContext` from `asset/domain/`.
- `repair/raise_repair_screen.dart` invalidates `assetDetailsControllerProvider(assetId)` after a successful raise so the asset's open-repair count refreshes when the user navigates back.

---

## 4. Features

The 17 screens are grouped into 11 features. The router config (in [`asset_scanner_app/lib/app/router.dart`](asset_scanner_app/lib/app/router.dart)) lists all 17 routes by `AppRoute.<name>` constants.

### `auth/` — sign in, session expired (2 screens)

- **Login** — email + password fields. The fake repository accepts any non-empty email + password and synthesises a display name from the local part of the email. Real auth lands when the OpenAPI spec is signed off.
- **Session Expired** — hard-interrupt screen reached when a request returns `401 + TOKEN_EXPIRED` and the silent-refresh attempt also fails. Centred `EmptyState` with a "Sign in" `PrimaryButton` that returns to login.

### `home/` — landing screen (1 screen)

- **Home** — V1 has a single oversized "Scan asset QR" CTA. The screen is structurally simple by design; the architecture in [`docs/06-architecture-future-proofing.md`](docs/06-architecture-future-proofing.md) splits Home into composable sections so V1.1 can drop in `HomePendingApprovals`, `HomeRecentActivity`, etc. without rewriting the screen.

### `scan/` — QR scanner (1 screen)

- **Scanner** — placeholder camera viewport with a reticle overlay and a "Simulate scan (demo)" button at the bottom that opens a sheet listing four demo QR options (three valid asset codes plus a deliberately invalid payload that triggers the `INVALID_QR_PAYLOAD` error path). Real `mobile_scanner` integration is roadmap item 3.

### `asset/` — asset details (1 screen, the showcase)

- **Asset Details** — identity header (name + asset code + category + status pill), state block (location, assignee, serial, last-verified), recent photos thumbnail strip, action grid showing only the actions present in `permittedActions`. Pull-to-refresh wired via `RefreshIndicator`. This is the screen the Stage B redesign rebuilds from new primitives ([`docs/07-screen-redesigns.md`](stage-b-handoff/docs/07-screen-redesigns.md), pending move).

### `photo/` — photo capture flow (2 screens)

- **Photo Capture** — placeholder preview surface (replaces real `camera` plugin), shutter button, hint pill. Title varies by `flowContext` query param ("Add photo", "Maintenance photo", etc.).
- **Photo Preview** — confirm-or-retake before submit. Currently simulates upload; will become the upload-by-presigned-PUT flow once the backend is wired.

### `maintenance/` — preventive maintenance (2 screens)

- **Maintenance List** — two sections: **Due** (overdue or upcoming scheduled items, each tappable to log against) and **History** (logged entries with relative time + actor + optional photo).
- **Log Maintenance** — task-type picker, optional notes, optional photo, optional "Mark scheduled item complete" toggle when arrived from a Due item.

### `repair/` — repair lifecycle (3 screens + 1 sheet)

- **Repairs List** — filter pills (Open / Resolved / All); each ticket shows description, severity badge, status badge, relative time.
- **Repair Detail** — header card + vertical update timeline (one entry per status transition or note-only update). Bottom-bar "Add update" CTA disappears when the ticket is in a terminal state.
- **Raise Repair** — description (≥ 10 chars), severity segmented control (Low / Medium / High), required photo. After submit, navigates to the new ticket's detail screen.
- **Add Repair Update** (bottom sheet) — single-select picker over `_allowedTransitions(currentStatus)`, optional note, optional photo. Server-side state machine is mirrored client-side for input validation.

### `recovery/` — return asset to inventory (1 screen)

- **Mark Recovery** — recovered-from user picker, recovered-to location picker, condition segmented control (Good / Damaged / Needs repair), optional notes, required photo. Submission is atomic on the backend per TRD §4.4 (unassign + create recovery + optionally raise repair, in one transaction). When condition is "Needs repair," the post-submit flow chains into raising a repair ticket via `showResultSheet`.

### `audit/` — audit-cycle verification (1 screen + 1 sheet)

- **Audit Verification** — expected-vs-actual comparison cards for location and assignee (`_ExpectedCard`), then two prominent `LargeChoiceTile`s: "Verify match" or "Flag discrepancy."
- **Flag Discrepancy** sheet — reason-code picker, required note, required photo. Submission flags the asset in the cycle and creates a discrepancy record atomically.

### `settings/` — profile + app info (1 screen)

- **Settings** — read-only profile (Name, Email, Organisation), app version + build, "Sign out" with destructive confirm dialog.

### `permission/` — camera permission rationale (1 screen)

- **Camera Permission Rationale** — full-screen explanation reached only when the OS permission has been denied; offers "Open settings" (will wire `permission_handler` in roadmap item 5) and "Not now."

---

## 5. Installation & Setup

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Flutter SDK | ≥ 3.19 |
| Dart SDK | ≥ 3.3 |
| Platform tooling | Android Studio / Xcode for device builds; Chrome / Edge / Windows desktop work for development |

### First-time setup

```bash
cd asset_scanner_app
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

The `build_runner` step is **mandatory** before the first build — every domain model in `lib/features/<feature>/domain/` declares `part 'name.freezed.dart';` and (where serialisable) `part 'name.g.dart';`. Without those generated files the project will not compile.

### Active model development

```bash
dart run build_runner watch --delete-conflicting-outputs
```

This rebuilds generated files whenever a `freezed` source file changes. Run it in a separate terminal while editing.

### Sanity checks before claiming done

```bash
dart analyze       # lint + type check
flutter analyze    # same plus Flutter-specific lints
```

Both should report **no issues**. The repo's current baseline is clean (Stage A swept all 51 lint/error issues).

### Picking a device

```bash
flutter devices    # lists connected devices and emulators
flutter run -d windows                  # desktop development build
flutter run -d chrome                   # web build for quick token previews
flutter run -d <android-device-id>      # connected Android phone
```

### Environment variables

**None yet.** The V1 scaffold has no `.env` file and no compile-time secrets — every repository is a fake in-memory implementation. Real environment configuration (API base URL, auth endpoints, feature flags) lands when the HTTP client is wired in. The shape will follow `--dart-define` flags read by `lib/core/network/` (which doesn't exist yet); see [`docs/08-client-questionnaire.md.txt`](docs/08-client-questionnaire.md.txt) Section 1 for the unanswered questions that gate this work.

---

## 6. Usage

The scaffold boots end-to-end with no backend. Walk it like this:

### Login

Any non-empty email + non-empty password is accepted by [`FakeAuthRepository.login`](asset_scanner_app/lib/features/auth/data/auth_repository.dart). Empty fields throw `AppErrorCode.unauthenticated` to exercise the failure path.

```text
demo@1xl.com  /  anything
```

The display name on Home is auto-derived from the local part of the email (split on `.`, `_`, `-` and title-cased). `rahul@1xl.com` → "Rahul". `anjali.rao@example.com` → "Anjali Rao".

### Demo data — three seeded assets

| Asset id | QR code              | Status         | Notes                                                  |
|----------|----------------------|----------------|--------------------------------------------------------|
| `a-001`  | `QR-AST-OFFICE-0042` | Assigned       | MacBook Pro, in Q2 2026 audit cycle, 1 overdue maintenance, all 6 actions permitted |
| `a-002`  | `QR-AST-OFFICE-0107` | Available      | Dell U2723QE 27" monitor                                |
| `a-003`  | `QR-AST-OFFICE-0058` | Under repair   | ThinkPad T14, has open repair ticket `r-001` with 2 updates |

Pick `a-001` to exercise the full action grid (Add Photo, Maintenance, Repairs, Recovery, Audit). The other two demonstrate sparser permitted-action arrays.

### Walking the demo

1. **Login** with any non-empty creds.
2. **Home** → tap "Scan asset QR".
3. **Scanner** → tap "Simulate scan (demo)" → the sheet shows four QR options:
   - `QR-AST-OFFICE-0042` (a-001, assigned)
   - `QR-AST-OFFICE-0107` (a-002, available)
   - `QR-AST-OFFICE-0058` (a-003, under repair)
   - `Garbage payload` (triggers `INVALID_QR_PAYLOAD` → result-sheet interrupt)
4. **Asset Details** for `a-001` → tap any action tile. All five action flows are reachable end-to-end.
5. **Settings** → "Sign out" returns to Login.

### What persists, what doesn't

**Nothing persists across app restarts.** Every fake repository is in-memory only. A repair raised in one session won't exist in the next. Photos are placeholder grey rectangles; "uploading" simulates a delay and sets a `hasPhoto: true` flag locally.

### What's stubbed inside the demo

- The Scanner screen does not access the camera. The "Simulate scan (demo)" button is the only path forward.
- The Photo Capture screen renders a placeholder preview surface — no real camera feed.
- The Photo Preview "Save" button simulates a network round-trip but discards the would-be upload.
- The Camera Permission Rationale screen's "Open settings" button shows a `SnackBar` reminder to wire `permission_handler` rather than opening OS settings.

---

## 7. API Documentation

> **The real backend is not yet integrated.** Mobile currently uses fake repositories. No HTTP code has been written. The OpenAPI 3.1 spec is **pending** answers to [`docs/08-client-questionnaire.md.txt`](docs/08-client-questionnaire.md.txt). What follows is the **planned contract** as captured in [`docs/02-trd-summary.md`](docs/02-trd-summary.md) — *assumptions to be validated*, not commitments.

### Transport and base path

- Base URL: TBD — see questionnaire §1.1 (production) and §1.2 (staging)
- Mobile namespace: assumed `/api/v1/mobile/*` — see questionnaire §1.3
- Format: REST + JSON over HTTPS
- All requests carry `Authorization: Bearer <jwt>` except `/auth/login` and `/auth/refresh`

### Cross-cutting headers

| Header | Direction | Purpose |
|--------|-----------|---------|
| `Authorization: Bearer …` | client → server | Access token (JWT, 30 min TTL) |
| `X-Request-Id: <uuid v4>` | client → server | Mirrored back in errors and server logs for field debugging |
| `Idempotency-Key: <uuid v4>` | client → server | On every `POST` mutation; server caches result for 24h |

### Authentication

- Access token: JWT, 30 min TTL
- Refresh token: opaque, 30 day TTL, rotated on each refresh, stored hashed server-side
- 401 + `TOKEN_EXPIRED` → silent refresh + retry once → on refresh failure, route to `AppRoute.sessionExpired`
- 401 + `UNAUTHENTICATED` (refresh also failed) → clear tokens, route to login

### Stable error codes (mapped in [`asset_scanner_app/lib/core/errors/app_error.dart`](asset_scanner_app/lib/core/errors/app_error.dart))

| Code | Meaning |
|------|---------|
| `UNAUTHENTICATED` | No token / invalid signature |
| `TOKEN_EXPIRED` | JWT expired; client should refresh and retry |
| `FORBIDDEN` | Authenticated but lacks permission |
| `ASSET_NOT_FOUND` | Asset id doesn't exist or has been retired |
| `INVALID_QR_PAYLOAD` | QR didn't parse as an asset code |
| `VALIDATION_FAILED` | Body failed validation; `fieldErrors` map populated |
| `RATE_LIMITED` | Too many requests |
| `NOT_FOUND` | Resource id doesn't exist (non-asset, e.g. repair ticket) |
| `CONFLICT` | State conflict (e.g. invalid status transition) |
| `INTERNAL_ERROR` | Server bug; client shows generic copy and a retry |

User-facing copy is mapped at the presentation layer via `AppError.userMessage`; codes are never exposed to users.

### Photo upload — two-step presigned PUT

1. `POST /assets/{assetId}/photos/upload-url` → `{ uploadUrl, photoId, expiresAt }`
2. Client `PUT`s raw bytes directly to `uploadUrl` (S3-compatible storage)
3. `POST /assets/{assetId}/photos/{photoId}/finalize` confirms; server links the photo to the asset

Parent actions (raise repair, log maintenance, mark recovery, flag audit) take `photoIds: string[]` in the body. Photos are uploaded **before** the parent action; orphans are reaped server-side after 24h. (Mobile currently passes `bool hasPhoto` placeholders — see [`docs/known-issues.md`](docs/known-issues.md) item 1.)

### Planned endpoints (~ 20 total)

From [`docs/08-client-questionnaire.md.txt`](docs/08-client-questionnaire.md.txt) Section 5:

| Group | Endpoint |
|-------|----------|
| **Auth** | `POST /auth/login` |
|        | `POST /auth/refresh` |
|        | `POST /auth/logout` |
|        | `GET /auth/me` |
| **Asset** | `POST /assets/lookup-by-qr` |
|         | `GET /assets/{assetId}` |
|         | `POST /assets/{assetId}/photos/upload-url` |
|         | `POST /assets/{assetId}/photos/{photoId}/finalize` |
| **Maintenance** | `GET /assets/{assetId}/maintenance` |
|              | `GET /maintenance/task-types` |
|              | `POST /assets/{assetId}/maintenance` |
| **Repair** | `GET /assets/{assetId}/repairs` |
|          | `GET /repairs/{repairId}` |
|          | `POST /assets/{assetId}/repairs` |
|          | `POST /repairs/{repairId}/updates` |
| **Recovery** | `POST /assets/{assetId}/recovery` (atomic) |
| **Audit** | `POST /assets/{assetId}/audit/verify` |
|         | `POST /assets/{assetId}/audit/flag` |
| **Reference** | `GET /reference/users` |
|             | `GET /reference/locations` |

Full request/response shapes are pending OpenAPI 3.1 spec. The plan once questionnaire answers arrive:

1. Draft `docs/api/mobile-openapi.yaml` reflecting the answered contract.
2. Send back for backend-team sign-off before any HTTP code is written.
3. Build the shared HTTP client at `lib/core/network/` against the locked spec.
4. Wire auth interceptor + refresh-token rotation as the first feature.
5. Replace each `Fake*Repository` with a real implementation, one feature at a time. Screens and controllers do not change; only the provider body changes.

### What mobile must NEVER do (per TRD)

- Cache permission data
- Decide on its own whether an action is allowed
- Persist tokens to anywhere except secure storage (`flutter_secure_storage`, planned)
- Log tokens, full request bodies, or PII to console / crash reporter
- Display raw error codes or technical messages — always use `AppError.userMessage`

---

## 8. Data Model

All domain entities are `freezed` classes with `fromJson` factories where the entity is expected on the wire. The MySQL schema is **server-side and not part of this repository** — wire-format documentation lives in the OpenAPI spec (pending). What follows is the client-side type model from `asset_scanner_app/lib/features/<feature>/domain/`.

### Asset feature — [`asset_scanner_app/lib/features/asset/domain/asset.dart`](asset_scanner_app/lib/features/asset/domain/asset.dart)

The richest domain in the app. Six entities + two enums.

#### Enums

```dart
enum AssetStatus { available, assigned, underRepair, retired, lost }
enum PermittedAction {
  addPhoto, logMaintenance, raiseRepair,
  updateRepair, markRecovery, verifyAudit
}
```

#### Entities

| Entity | Fields | Relationships |
|--------|--------|---------------|
| `AssetCategory` | `id: String`, `name: String` | — |
| `AssetLocation` | `id: String`, `name: String` | — |
| `AssetUser` | `id: String`, `fullName: String` | Stand-in for users referenced by assets (assignees, reporters) |
| `AssetPhoto` | `id: String`, `url: String`, `uploadedAt: DateTime` | — |
| `AuditContext` | `cycleId: String`, `cycleName: String`, `expectedLocation: AssetLocation?`, `expectedAssignee: AssetUser?`, `existingVerificationResult: String?` | Returned only when an asset is part of an active cycle |
| `Asset` | `id`, `assetCode`, `name`, `category: AssetCategory`, `serialNumber: String?`, `status: AssetStatus`, `currentLocation: AssetLocation?`, `assignedToUser: AssetUser?`, `lastVerifiedAt: DateTime?`, `recentPhotos: List<AssetPhoto>` | Composes location, assignee, category, photos |
| `AssetLookupResult` | `asset: Asset`, `permittedActions: List<PermittedAction>`, `auditContext: AuditContext?`, `openRepairCount: int`, `overdueMaintenanceCount: int` | The full `lookup-by-qr` / `getById` response |

### Auth feature — [`asset_scanner_app/lib/features/auth/domain/user.dart`](asset_scanner_app/lib/features/auth/domain/user.dart)

| Entity | Fields |
|--------|--------|
| `User` | `id: String`, `fullName: String`, `email: String`, `organisationName: String` |

### Maintenance feature — [`asset_scanner_app/lib/features/maintenance/domain/maintenance.dart`](asset_scanner_app/lib/features/maintenance/domain/maintenance.dart)

| Entity | Fields | Relationships |
|--------|--------|---------------|
| `MaintenanceTaskType` | `id: String`, `name: String` | Org-scoped reference list |
| `MaintenanceScheduleItem` | `id: String`, `taskType: MaintenanceTaskType`, `dueAt: DateTime` | Items shown in the "Due" section |
| `MaintenanceEntry` | `id`, `taskType: MaintenanceTaskType`, `performedAt: DateTime`, `performedByFullName: String`, `notes: String?`, `hasPhoto: bool` | Entries in the "History" section |
| `MaintenanceListResult` | `due: List<MaintenanceScheduleItem>`, `history: List<MaintenanceEntry>` | List endpoint response |

### Repair feature — [`asset_scanner_app/lib/features/repair/domain/repair.dart`](asset_scanner_app/lib/features/repair/domain/repair.dart)

#### Enums

```dart
enum RepairSeverity { low, medium, high }
enum RepairStatus { reported, inProgress, resolved, cancelled }
```

#### Entities

| Entity | Fields | Relationships |
|--------|--------|---------------|
| `RepairUpdate` | `id`, `createdAt: DateTime`, `actorFullName: String`, `statusBefore: RepairStatus`, `statusAfter: RepairStatus`, `note: String?`, `hasPhoto: bool` | One per timeline entry on Repair Detail |
| `RepairTicket` | `id`, `assetId`, `assetCode`, `assetName`, `description: String`, `severity: RepairSeverity`, `status: RepairStatus`, `createdAt`, `reportedByFullName`, `updates: List<RepairUpdate>` | Aggregate; updates is ordered ascending |

### Recovery feature — [`asset_scanner_app/lib/features/recovery/domain/recovery.dart`](asset_scanner_app/lib/features/recovery/domain/recovery.dart)

Only an enum so far — the recovery action is fire-and-forget; no entity is returned to mobile.

```dart
enum RecoveryCondition { good, damaged, needsRepair }
```

### Audit feature

**No `domain/` folder.** Audit consumes `AuditContext` from the asset feature and returns nothing to the client (verify-match and flag-discrepancy are atomic server-side writes that mutate audit-cycle state).

### Cross-cutting types (in `lib/core/`)

| Type | Purpose |
|------|---------|
| `AppError` (freezed) | `code: AppErrorCode`, `message: String?`, `requestId: String?`. `userMessage` getter maps every code to a user-facing string. |
| `AppErrorCode` (enum) | The 10 stable codes plus `network`, `unknown`. `fromString` parser handles wire codes. |
| `AsyncResult<T>` (freezed sealed) | `idle / loading / refreshing(prev) / data(value) / error(err, prev?)`. Authored before the team standardised on Riverpod's `AsyncValue`; kept around because it makes "stale data + refreshing" explicit, which Asset Details uses. |

### Wire-format relationships

When the OpenAPI spec lands, these are the relationships the mobile expects to see preserved:

- `Asset.assignedToUser → AssetUser` (nullable; null when status ≠ assigned)
- `Asset.currentLocation → AssetLocation` (nullable for in-transit / unknown states)
- `Asset.category → AssetCategory` (required)
- `Asset.recentPhotos → List<AssetPhoto>` (typically capped server-side at the most recent 5)
- `RepairTicket.updates → List<RepairUpdate>` (ascending by `createdAt`)
- `MaintenanceListResult` flattens `due` and `history` for a single asset
- `AssetLookupResult.auditContext → AuditContext?` (present only for assets in an active cycle)

---

## 9. Code Walkthrough

The highest-leverage modules to read in order:

### Entry — [`asset_scanner_app/lib/main.dart`](asset_scanner_app/lib/main.dart)

```dart
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
  ]);
  runApp(const ProviderScope(child: AssetScannerApp()));
}
```

Three lines of work: lock to portrait, wrap in `ProviderScope` (the Riverpod root), launch `AssetScannerApp`. Nothing else lives here.

### App + router — [`asset_scanner_app/lib/app/app.dart`](asset_scanner_app/lib/app/app.dart), [`asset_scanner_app/lib/app/router.dart`](asset_scanner_app/lib/app/router.dart)

`AssetScannerApp` reads the router from a `Provider`, hands it to `MaterialApp.router`, and wires `AppTheme.light()`. The router declares a flat list of 17 routes with **named** routes (`AppRoute.<name>` constants) so navigation from any screen never hard-codes a path:

```dart
context.pushNamed(
  AppRoute.repairsList,
  pathParameters: {'assetId': assetId},
);
```

### Theme — [`asset_scanner_app/lib/core/theme/`](asset_scanner_app/lib/core/theme/)

Five files and a barrel.

- **`app_colors.dart`** — every named colour the app uses. Brand emerald `#10A47C`, status pill bg/fg pairs (8 of them), severity colours, the 5 stat-tint pairs, plus the surface / text / border tokens. Updating a single hex here ripples through the whole app.
- **`app_spacing.dart`** — 4 / 8 / 12 / 16 / 24 / 32 / 48 + screen-edge (16) + touch-target (44) + button-height tokens.
- **`app_radius.dart`** — 4 / 8 / 12 / 16 / 999 plus pre-built `BorderRadius.all8`, `all12`, `all16`, `pill`. Stage B will add `r14` / `r20` / `r28` for the redesigned card primitives.
- **`app_typography.dart`** — title / heading / subheading / body / caption / button + mono variants. After Stage A: `displayTitle` (32pt) and `pageTitle` (24pt) added; old `title` (28pt) is now a `@Deprecated` alias of `pageTitle`.
- **`app_theme.dart`** — `AppTheme.light()` factory wires the tokens into `ThemeData`. Anywhere widgets ask `Theme.of(context)`, they pull the brand colour, the radius, the focused border thickness from these tokens.

The whole subsystem is a single source of truth. **No widget has a `Color(0xFF…)` literal**; the rebrand is one file.

### Errors — [`asset_scanner_app/lib/core/errors/app_error.dart`](asset_scanner_app/lib/core/errors/app_error.dart)

A single freezed type used everywhere: `AppError(code: AppErrorCode, message: String?, requestId: String?)`. Repositories throw `AppError`, screens render `error.userMessage` (a getter that maps every code to user-facing copy). The `AppErrorCode.fromString` parser handles the 10 stable wire codes; anything else collapses to `unknown`. Codes never reach the user. Convenience factories: `AppError.network()`, `AppError.unknown([msg])`.

### Component library — [`asset_scanner_app/lib/shared/widgets/widgets.dart`](asset_scanner_app/lib/shared/widgets/widgets.dart)

Single barrel exporting 17 widget files containing roughly 25 widgets and helpers. Every screen imports the library through this barrel:

```dart
import '../../../shared/widgets/widgets.dart';
```

The widgets that matter most:

- `PrimaryButton` — full-width filled CTA with optional icon, oversized variant, loading state.
- `SecondaryButton` + `DestructiveButton` — outlined and danger-tinted respectively.
- `StatusBadge` — colour + text status indicator (`BadgeTone` enum). Accessibility rule: status is *always* conveyed by both colour and text, never colour alone.
- `EmptyState` — icon + title + optional message + optional action.
- `BannerError` — slim per-screen recoverable error banner (`BannerTone.danger / warning / info`).
- `showResultSheet` (in `confirm_dialog.dart`) — full-bleed sheet for hard interrupts.
- `showAppToast` — 2s bottom toast for successful completion.
- `showConfirmDialog` — destructive-confirmation dialog.
- `Skeleton.rect / .line / .circle` — pulsing loading placeholders.
- `PhotoThumbStrip` + `Lightbox` — read-only photo viewer.
- `PhotoAttachmentRow` — "Add photo" → captured thumb → remove pattern. Multi-ready API capped at 1 for V1.

### Showcase: `asset` feature

The asset feature is the cleanest end-to-end example of the architectural patterns shown in section 3.

- [`asset_scanner_app/lib/features/asset/data/asset_repository.dart`](asset_scanner_app/lib/features/asset/data/asset_repository.dart) — `AssetRepository` interface, `FakeAssetRepository` seeded with the three demo assets (`a-001` / `a-002` / `a-003`), and the `assetRepositoryProvider` that wires them. When the real backend lands, only the provider body changes; every consumer continues to work against the abstract type.
- [`asset_scanner_app/lib/features/asset/state/asset_details_controller.dart`](asset_scanner_app/lib/features/asset/state/asset_details_controller.dart) — the `AsyncNotifierProvider.family<…, String>` pattern from section 3, keyed on `assetId`. `refresh()` uses `AsyncLoading().copyWithPrevious(state)` so the previous record stays available during a re-fetch — *intended* to keep prior data on screen, but currently masked by `state.when(loading: …)` in the screen (the drift in [`docs/known-issues.md`](docs/known-issues.md) item 3, closed by the upcoming `AsyncBoundary` widget).
- [`asset_scanner_app/lib/features/asset/presentation/asset_details_screen.dart`](asset_scanner_app/lib/features/asset/presentation/asset_details_screen.dart) — the showcase screen. A `ConsumerWidget` watching `assetDetailsControllerProvider(assetId)` and composing `IdentityHeader` + `AssetStateBlock` + optional `StatChip` cluster + `PhotoThumbStrip` + `ActionGrid` (rendering only the tiles in `permittedActions`). Pull-to-refresh wired via `RefreshIndicator`. Stage B rebuilds this screen from `InfoCard` / `CalloutBlock` / `ActionListItem` / `HeroPhoto` primitives.

---

## 10. Screens & UI

### The design language

The app is themed to match the existing web platform's **emerald-green visual identity** while being structured for native mobile interaction:

| Token | Value | Where it appears |
|-------|-------|------------------|
| Brand | `#10A47C` | Primary buttons, focus rings, active timeline dots, the Settings icon, the AppBar focus state |
| Brand pressed | `#0D8A68` | Pressed-state primary, success status foreground, primary button shadow tint |
| Brand soft | `#E8F5EF` | Mint tinted backgrounds, soft filter-pill selection |
| Background | `#FCFCF8` | Warm off-white page backdrop — *not* pure white |
| Surface | `#FFFFFF` | Cards, sheets, dialogs |
| Text primary | `#0F1115` | Body and heading copy |
| Text secondary | `#5C6470` | Subtitles, muted body |
| Border | `#E7E5DE` | Subtle 1px on cards |

### Status colour pairs (`StatusBadge`)

Each pair is **bg + fg** — used together to keep contrast within accessibility limits:

| Tone | bg | fg |
|------|----|----|
| Available / Success | `#E8F5EF` | `#0D8A68` |
| Assigned / Info | `#E5EFFE` | `#1E5BC8` |
| Repair / Warning2 | `#FFF1E0` | `#B35900` |
| Retired / Neutral | `#EEEDF5` | `#605C72` |
| Lost / Disposed | `#FEE2E2` | `#C42424` |

Status is always conveyed by **both** colour and text — `StatusBadge` requires a label string. Colour alone is insufficient (UX spec §1, accessibility).

### Stat-tint palette (categorical-decorative)

Used for the small icon tiles that mark every InfoCard once Stage B lands. The tints mean *category*, not severity:

| Tint | Used for blocks about… |
|------|------------------------|
| Mint | Location, geography, places |
| Teal | Photos, media, documents |
| Lavender | People, assignment, identity |
| Cream | Time, schedule, dates, history |
| Rose | Money, value, alerts, severity |

### Spacing and touch targets

- 8-point grid: 4 / 8 / 12 / 16 / 24 / 32 / 48
- Screen edge padding always 16
- Touch-target minimum **44pt** (UX spec §1)
- Animations capped at 200 ms (Skeleton's pulse is the deliberate exception; it's purposeful loading affordance)

### Four-lane error UX

Severity routes to a specific UI affordance — **not interchangeable**:

| Severity | Affordance | Helper |
|----------|------------|--------|
| Recoverable, per-screen | `BannerError` | inline banner |
| Hard interrupt | `showResultSheet` | bottom sheet, no-dismiss |
| Successful completion | `showAppToast` | 2s toast |
| Destructive confirmation | `showConfirmDialog` | AlertDialog |

The TRD also specifies that 401 + `TOKEN_EXPIRED` does *not* surface in any of these — it triggers a silent refresh + retry; failure routes to `AppRoute.sessionExpired`.

### Tone & copy

- Plain English, no jargon ("Mark recovery," not "Initiate asset disposition.")
- Verbs in CTAs: "Scan asset QR," "Log maintenance," "Confirm recovery."
- Empty states describe the situation neutrally and point to the next action. No "Oops!" No exclamation marks.
- Error copy: state what happened, then the next step. "Something went wrong" alone is the absolute fallback for `INTERNAL_ERROR` only.

### Visual references

The 16 web-platform screenshots in [`docs/visual-references/`](docs/visual-references/) are the visual source of truth for what the *parent* product looks like. They cover Dashboard, Asset Management, Dead Assets, Allocations, Consumables, Asset Requests, Maintenance, Repairs, Recovery, Procurement, Vendors, Depreciation, Audits, Activity Log, Reports, Documents. The **mobile** does not replicate these layouts (the web is a sidebar + table workhorse; mobile is a stack of cards), but the colour, typography, status pills, and stat tints are mirrored from there.

Mobile "after" screenshots are **not yet captured**. The destination folder [`docs/visual-references/mobile-after-stage-a/`](docs/visual-references/mobile-after-stage-a/) is reserved for them once a device/emulator walkthrough is run.

### Loading patterns

- First load → `Skeleton` placeholders shaped like the final layout
- Refresh on screen with prior data → keep prior data interactive, show top progress strip *(currently regressed via `state.when` — being closed by `AsyncBoundary` in Stage B)*
- Mutating action → button enters `isLoading` state, screen stays interactive elsewhere

### Navigation rules

- All routing via `context.pushNamed(AppRoute.x, …)` — never raw paths, never `Navigator.push` of widgets except for transient sheets/dialogs
- Sheets via `showModalBottomSheet` wrapped in helpers (`showAddRepairUpdateSheet`, `showResultSheet`)
- After a mutation completes, pop back to the parent and let the parent's controller refresh — don't navigate forward from a success state unless the flow explicitly chains (recovery → "Raise repair?" → repair raise)

---

## 11. Challenges & Solutions

The non-obvious decisions made during scaffolding, and the open drift items that haven't been closed yet.

### 1. Reusing the web platform's MySQL + auth instead of forking

The mobile app does **not** maintain its own user database, role table, or asset table. It calls the existing web platform's APIs and renders what they return. Three reasons drove this:

1. **One source of truth.** Mobile and web are workflows over the same assets. Splitting the schema means reconciliation hell.
2. **Permissions stay server-side.** A "dumb defensive renderer" can't accidentally grant the wrong action.
3. **Faster delivery.** No mobile-only backend means no second team, no second migration story, no second deployment cadence.

The cost is a tighter coupling to the web platform's release cadence. We ask the backend team in [`docs/08-client-questionnaire.md.txt`](docs/08-client-questionnaire.md.txt) §9.2 about deployment cadence and breaking-change notice to mitigate.

### 2. The "dumb defensive renderer" permission model

Instead of mobile knowing role definitions, mobile receives a `permittedActions: PermittedAction[]` array on every asset lookup. The action grid renders only tiles whose action is present. Mobile never decides; it just renders what's allowed.

Risk this avoids: a stale local role cache letting a user tap an action they no longer have. The server still rejects, but the user experience is better when the affordance was never offered.

The TRD reinforces: even if mobile renders a button, the server re-checks on every mutation. The array is a UI hint, not a security boundary.

### 3. Token-based theming made the rebrand a one-file edit

When the visual direction changed from navy enterprise to emerald-green Notion, the actual diff was: **change `AppColors.brand` and a few neighbours in `lib/core/theme/app_colors.dart`**. Every widget already referenced tokens by name. The status pill mapping in `StatusBadge._palette` already pointed at `statusAvailableBg`, `statusAvailableFg`, etc. — those tokens' values changed, the palette function did not.

This is a deliberate architectural choice and the reason Stage A's diff was small enough to fit in a single PR.

### 4. Two-step presigned PUT photo upload

Two architectural options were considered for photo upload:

- **Direct multipart** through the API — simpler client, server bears bandwidth.
- **Presigned PUT** to S3-compatible storage, then finalize call — server only handles control plane; bytes go straight from device to storage.

We chose presigned PUT. It scales without growing the API server's bandwidth profile, makes resumable uploads achievable later (V2), and keeps photos out of the API boundary. The server holds a 24h reaper for orphans (photos uploaded but never finalized — e.g. user closes the app mid-flow). See [`docs/02-trd-summary.md`](docs/02-trd-summary.md) "Photo upload flow."

### 5. AsyncBoundary refresh pattern (in progress)

The current `state.when(loading: …, data: …)` pattern in five list screens collapses prior data to a Skeleton on every refresh. The `AsyncNotifierProvider.family` controllers correctly emit `AsyncLoading().copyWithPrevious(state)`, but `state.when` routes that back through the `loading:` branch.

The fix: introduce an `AsyncBoundary<T>` widget that reads `state.valueOrNull + state.isRefreshing + state.hasError` directly and renders a thin top progress strip while keeping prior data interactive. Lands in Stage B sub-stage B4. Tracked as [`docs/known-issues.md`](docs/known-issues.md) item 3.

### 6. Documentation vs code — known discrepancies

Per the README brief, where docs contradict code, **code wins**. Surfacing the active discrepancies:

#### a. `pageTitle` typography weight

- **Code** ([`asset_scanner_app/lib/core/theme/app_typography.dart`](asset_scanner_app/lib/core/theme/app_typography.dart)): `pageTitle` is `fontWeight: FontWeight.w700`.
- **Docs** ([`stage-b-handoff/docs/07-screen-redesigns.md`](stage-b-handoff/docs/07-screen-redesigns.md) §Login, §Asset Details): describes `pageTitle` as "weight 500" in two places.
- **Resolution:** code is authoritative; doc 07 is wrong. Either the token gets bumped to `w500` or the doc gets updated. Pending decision before Stage B sub-stage B1 begins.

#### b. Doc 07 lives outside `docs/`

- **State:** [`stage-b-handoff/docs/07-screen-redesigns.md`](stage-b-handoff/docs/07-screen-redesigns.md) is referenced by Stage B as the screen-by-screen blueprint, but the file itself is in the `stage-b-handoff/` folder, not `docs/`.
- **Resolution:** scheduled to be moved into `docs/07-screen-redesigns.md` as the first action of Stage B sub-stage B1. README cross-references use the actual path until then.

#### c. Doc 08 has a typo extension

- **State:** the file at `docs/08-client-questionnaire.md.txt` should be `docs/08-client-questionnaire.md` (no `.txt`). There's also a parallel `docs/questionnaire.md` (and `docs/questionnaire.md.txt`) with the same content reorganised by P0/P1/P2 priority — likely a working copy that was never merged.
- **Resolution:** rename + de-duplicate in a small follow-up sweep. Not urgent; tools that read `.txt` and `.md` treat both as text.

#### d. Asset status enum — mobile vs web mismatch

- **Code** ([`asset_scanner_app/lib/features/asset/domain/asset.dart`](asset_scanner_app/lib/features/asset/domain/asset.dart)): `AssetStatus` has 5 values — `available, assigned, underRepair, retired, lost`.
- **Web** (per [`docs/08-client-questionnaire.md.txt`](docs/08-client-questionnaire.md.txt) §4.3 and the visual references): displays 7 statuses — Available, Allocated, In Use (Shared), Under Maintenance, Retired, Disposed, Dead.
- **Resolution:** **unresolved.** Pending Section 4.3 of the client questionnaire — the backend team needs to confirm canonical wire values. Mobile may need to extend the enum or accept a wider canonical list and project to a smaller display set.

### 7. Pattern drift logged for sweep (from [`docs/known-issues.md`](docs/known-issues.md))

| # | Drift | Affected files | Trigger to fix |
|---|-------|----------------|----------------|
| 1 | `bool hasPhoto` flags instead of `List<String> photoIds` | `asset_repository.dart`, `maintenance_repository.dart`, `repair_repository.dart`, `recovery_repository.dart`, `audit_repository.dart` | After OpenAPI lands; bundled with the real-repository swap |
| 2 | `SnackBar` failures instead of `BannerError` / `showResultSheet` | 6 screens (`log_maintenance`, `raise_repair`, `add_repair_update_sheet`, `mark_recovery`, `audit_verification`, `photo_preview`) | Stage B sub-stage B4 |
| 3 | Refresh collapses to skeleton (the `state.when` issue above) | 5 screens (`asset_details`, `maintenance_list`, `repairs_list`, `repair_detail`, `audit_verification`) | Stage B sub-stage B4 |
| 4 | `flutter_secure_storage` missing | `pubspec.yaml`, future `lib/core/auth/token_store.dart` | First task of the auth interceptor work |

### 8. The `intl` SDK pin bump (Stage A)

The scaffold's original `pubspec.yaml` declared `intl: ^0.19.0`. The installed Flutter SDK pins `intl: 0.20.2` via `flutter_localizations`, so `flutter pub get` failed on first run. Fix was a one-character version bump to `^0.20.2` — confirmed not to affect any of the `DateFormat` call sites. Logged for the record as a small Stage A drift fix-up.

### 9. Build_runner is mandatory, not optional

Every domain model declares `part 'name.freezed.dart';` (and `part 'name.g.dart';` where serialisable). The first `flutter run` after a fresh checkout will fail with hundreds of errors until `dart run build_runner build --delete-conflicting-outputs` is run. The README at [`asset_scanner_app/README.md`](asset_scanner_app/README.md) calls this out, and section 5 here repeats it.

---

## 12. Roadmap

### Immediate — closing Stage B (visual rebuild)

The visual direction is locked; what remains is structural. Stage B is split into four sub-stages, executed sequentially (per [`stage-b-handoff/docs/07-screen-redesigns.md`](stage-b-handoff/docs/07-screen-redesigns.md)):

- **B1 — new primitives.** Add `InfoCard`, `CalloutBlock`, `ActionListItem`, `HeroPhoto`, `SectionLabel`, `StatCard`, `AsyncBoundary`, `ListScreenScaffold` to `lib/shared/widgets/`. Add `r14 / r20 / r28` to `app_radius.dart`, `sectionLabel` to `app_typography.dart`. Update `FilterPillRow` with style flavours and optional counts. **No screen changes.**
- **B2 — showcase screen.** Refactor only Asset Details to use the new primitives; prove the API; screenshot baseline.
- **B3 — list + detail screens.** Maintenance List, Repairs List, Repair Detail, Settings — adopt `ListScreenScaffold` on the two list screens.
- **B4 — forms + remaining screens + sweep.** Log Maintenance, Raise Repair, Mark Recovery, Audit Verification, Add Repair Update sheet — group into `InfoCard.custom` containers. Refactor `state.when` → `AsyncBoundary` (closes known-issues #3). Migrate failure-path SnackBars to top-of-form `BannerError` (closes known-issues #2 for form screens). Delete deprecated widgets (`ActionTile`, `ActionGrid`, `IdentityHeader`, `AssetStateBlock`, `_HeaderCard`, `StatChip`, `_ExpectedCard`).

### Backend integration (sequenced after Stage B and questionnaire answers)

Order of work, each step reviewable:

1. **OpenAPI 3.1 spec** drafted at `docs/api/mobile-openapi.yaml` reflecting the answered questionnaire.
2. **Backend sign-off** on the spec before any mobile HTTP code.
3. **Shared HTTP client** at `lib/core/network/` against the locked spec — `X-Request-Id` and `Idempotency-Key` headers, network/error mapping.
4. **Auth interceptor + refresh-token rotation** — the first feature, validates the chain end-to-end. Adds `flutter_secure_storage` (closes known-issues #4).
5. **Replace each `Fake*Repository` with a real implementation**, one feature at a time. Screens and controllers do not change.
6. **`bool hasPhoto` → `List<String> photoIds`** signature migration on every repository (closes known-issues #1).
7. **Live device integrations:** `mobile_scanner` for QR detection, `camera` for photo capture, `permission_handler` for camera permission flow.

### Future feature surfaces (per [`docs/06-architecture-future-proofing.md`](docs/06-architecture-future-proofing.md))

The web platform has 16+ feature surfaces; mobile V1 covers 5. Rough priority order for follow-on growth, *not building yet, just preparing for*:

1. **Allocations** — assign assets to people from mobile
2. **Asset Requests** — raise + approve from mobile
3. **Documents** — view/upload asset documents (warranties, invoices, manuals)
4. **Consumables** — track consumable stock from mobile
5. **Activity Log** — view per-asset activity history
6. **Procurement** — view status, approve from mobile
7. **Vendors** — lookup contact info during repair flow
8. **Reports** — dashboard summaries on mobile
9. **Dead Assets** — separate list view
10. **Audits (full)** — beyond the per-asset verify, see cycle-level progress
11. **Locations & Depts / User Management** — admin-only, low priority

The architectural prep:

- Per-feature `feature.dart` route registration (one line per feature added in `router.dart`)
- Composable `HomeScreen` with `HomeSection` widgets — V1 has only the scan CTA section, V1.1 adds others
- `ListScreenScaffold` template (already coming in Stage B) absorbs all list features
- Bottom-nav chrome lands in V1.1 when there are 2+ primary destinations

### V2 candidates (explicitly NOT for V1)

- Offline mode with background sync
- Multi-photo per upload (widget API is multi-ready; V1 capped at 1)
- Bulk audit verification
- Saved scan history
- Push notifications (FCM / APNs) for new repair updates
- Dark mode
- Bottom-nav (lands V1.1, full polish V2)

### V2 architectural changes that aren't being made now

Per [`docs/06-architecture-future-proofing.md`](docs/06-architecture-future-proofing.md):

- No plug-in system or feature flags — manual route registration is fine.
- No generic CRUD scaffold below `ListScreenScaffold` — over-abstraction.
- No state-machine library — hand-rolled `_allowedTransitions` is sufficient.
- No internationalisation — V1 is English-only.
- No DI library beyond Riverpod — Riverpod *is* the DI layer.

---

## 13. Contribution Guide

The full conventions live in [`docs/04-engineering-conventions.md`](docs/04-engineering-conventions.md). Read it before any code change. The summarised contract:

### Read order before any change

1. [`docs/01-product-overview.md`](docs/01-product-overview.md) — what the app is and isn't
2. [`docs/04-engineering-conventions.md`](docs/04-engineering-conventions.md) — the locked patterns
3. [`docs/05-visual-design-system.md`](docs/05-visual-design-system.md) — tokens and component primitives
4. [`docs/known-issues.md`](docs/known-issues.md) — open drift; don't accidentally fix something that's already scheduled

### Five hard rules

1. **Repository interface + concrete fake wired through a Provider.** Screens depend on the abstract type; only the provider names the impl.
2. **`AsyncNotifierProvider.family` keyed on entity id with `copyWithPrevious` refresh.** Screens render via `state.valueOrNull` + `state.isRefreshing` (Stage B) — not `state.when` (current Stage A pattern, being phased out).
3. **Tokens-only styling.** No `Color(0xFF…)`, no `EdgeInsets.all(N)` with raw numbers, no inline font sizes outside `lib/core/theme/`. Status conveyed by **colour AND text** via `StatusBadge`.
4. **Typed errors only.** Repos throw `AppError`. Screens render `error.userMessage`. Never expose codes to users.
5. **Don't add packages without confirming.** The V1 dependency list is the dependency list. Even version bumps (e.g. the `intl` SDK-pin fix) get a one-line flag before being applied.

### Code style

- `StatelessWidget` or `ConsumerWidget` by default. `StatefulWidget` / `ConsumerStatefulWidget` only for forms with `TextEditingController`.
- `const` constructors everywhere possible. The lint enforces it.
- Import shared widgets via the barrel: `import '../../../shared/widgets/widgets.dart';`
- Use Dart 3 features where natural — records, pattern matching, switch expressions, sealed classes.
- After any model change: `dart run build_runner build --delete-conflicting-outputs`.
- After any change: `dart analyze` clean; surface warnings before claiming done.

### What "done" means

- `dart analyze` clean (no warnings)
- All `*.freezed.dart` and `*.g.dart` regenerated and committed
- Every new public type documented with a doc comment if its purpose isn't obvious from the name
- The change is the **smallest possible diff** that solves the task — don't refactor adjacent code uninvited

### How we work

- **Before code:** list the files you'll touch.
- **During code:** small, focused diffs; one feature change at a time.
- **If you find pattern drift,** flag it before fixing. Add a one-bullet entry to `docs/known-issues.md` if it can't be fixed in the current PR.
- **If you want a new shared widget,** justify with 2+ use sites and propose the API before implementing.
- **If you want a new package,** ask first.
- **After code:** run `dart analyze`, report the result, then summarise what changed.

---

## 14. License

**No `LICENSE` file is currently present at the project root.**

This is a **proprietary** internal project for **1XL Ventures / Asset Tracker** platform. **Not licensed for external use.** A formal `LICENSE` will be added before any wider distribution (TestFlight closed track, Play closed track, internal pilot rollout — see roadmap).

If you've received this code as part of a contracted engagement, refer to your engagement agreement for the applicable terms.

---

## 15. Author

**Rahul Jadhav** — 1XL Ventures.

Built in collaboration with:

- **Claude (Anthropic)** — product / UX exploration, scaffolding, design system definition, documentation
- **Claude Code (Anthropic)** — in-IDE engineering, code generation, lint sweeps, refactor execution

The project is under active development. This README reflects the state at end of **Stage A** (token rebrand + theme cleanup) and the start of **Stage B** (Notion-direction visual redesign). The seven workflows scaffold cleanly end-to-end against fake repositories; the OpenAPI spec, the real backend integration, the camera plugin wiring, and the Stage B redesign sub-stages are the work ahead.

For questions, raise an issue in the repository or reach out via the contracted engagement channel.
