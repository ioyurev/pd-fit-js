# Project Architecture

## 5. Versioning and Migrations

### Schema version
Every persisted state (URL or `.pdfit` file) includes a `version` field.
The canonical current version is `CURRENT_VERSION` in `src/lib/migrations.ts`.

### Rules
- `CURRENT_VERSION` is incremented on **any** schema change.
- Each migration is a **pure function** `migrate_N_to_N+1(data) => data`.
- Migrations are registered in the `MIGRATIONS` record keyed by source version.
- `migrateToLatest(data)` applies all necessary migrations sequentially.
- If `data.version > MAX_SUPPORTED_VERSION`, an `UnsupportedVersionError` is thrown.
- Legacy data without a `version` field is treated as version `0`.

### Adding a new migration
1. Increment `CURRENT_VERSION`.
2. Add `migrate_N_to_N+1` function.
3. Register it in `MIGRATIONS[N]`.
4. Add tests in `migrations.test.ts`.
5. Update this section.

### Consumers
- `deserializeProject()` — `.pdfit` files
- `loadPersistedState()` — URL state
- Both use `migrateToLatest()` as the single entry point.
