// Where a LocalEvent row came from. Every row created through the admin CRUD is 'manual'.
// 'ai_suggested' is reserved for a future feature (an agent proposing events for the admin
// to review before saving) — no such flow exists yet, this enum value just keeps the
// schema/UI ready so that feature won't need another migration later.
export enum LocalEventSource {
  MANUAL = 'manual',
  AI_SUGGESTED = 'ai_suggested',
}
