# Asset Scanner Mobile App — V1 UI Scaffold

Flutter scaffold for the Asset Scanner mobile app, covering all 17 screens defined
in the UX spec. UI-only: every repository is a fake in-memory implementation, so
the app boots and every flow is navigable without any backend.

## Stack

- Flutter (SDK ≥ 3.19) / Dart sound null safety
- `flutter_riverpod` for state
- `go_router` for navigation
- `freezed` + `json_serializable` for typed models
- `intl` for relative time formatting

## First-time setup

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

The `build_runner` step generates the `*.freezed.dart` and `*.g.dart` files for
every model. Run it whenever you change a `freezed` model. During active model
work, prefer `dart run build_runner watch --delete-conflicting-outputs`.

## Folder layout

```
lib/
├── main.dart
├── app/
│   ├── app.dart            # MaterialApp.router + theme
│   └── router.dart         # go_router config (all 17 routes)
├── core/
│   ├── theme/              # Design tokens + ThemeData factory
│   ├── errors/             # Typed error model (AppError)
│   ├── result/             # AsyncResult<T> (loading / data / error)
│   └── utils/              # Pure helpers (relative time, etc.)
├── shared/
│   └── widgets/            # The V1 component library (Section 6 of UX spec)
└── features/
    ├── auth/               # Login, Session expired
    ├── home/               # Home
    ├── scan/               # Scanner
    ├── asset/              # Asset details
    ├── photo/              # Photo capture, Photo preview
    ├── maintenance/        # Maintenance list, Log maintenance
    ├── repair/             # Repairs list, Repair detail, Raise repair, Add update sheet
    ├── recovery/           # Mark recovery
    ├── audit/              # Audit verification
    ├── settings/           # Settings
    └── permission/         # Camera permission rationale
```

Each feature follows the same internal layout:

```
features/<feature>/
├── data/         # Repository interface + fake implementation
├── domain/       # Freezed entities and enums
├── state/        # Riverpod controllers / providers
└── presentation/ # Screens + feature-local widgets
```

## What this scaffold deliberately does not do

- No real network calls. All repositories return canned in-memory data.
- No real authentication. The fake auth repository accepts any credentials.
- No camera / QR scanning. The Scanner and Photo Capture screens render their UI
  shell with a placeholder where the camera plugin would mount. Wiring
  `mobile_scanner` and `camera` is intentionally out of scope for this UI scaffold.
- No push notifications, no analytics, no crash reporting.

These are added when the backend / API contract is locked in (TRD §6).

## Adding a new screen

1. Create `lib/features/<feature>/presentation/<screen>_screen.dart` as a
   `ConsumerWidget` (or `StatelessWidget` if it has no state needs).
2. Register a route for it in `lib/app/router.dart`.
3. Compose it from existing widgets in `lib/shared/widgets/`. Lift a new shared
   widget only when it's used in 2+ places.
4. Pull data via a Riverpod provider from the matching `state/` folder. The
   provider should depend only on a repository interface — never a concrete impl.

## Adding a new model

1. Create the `freezed` source file in `lib/features/<feature>/domain/`.
2. Run `dart run build_runner build --delete-conflicting-outputs`.
3. Use the generated type in repositories and controllers.
