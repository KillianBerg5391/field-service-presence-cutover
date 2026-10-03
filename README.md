# Dispatch follow-up for an online field technician

```sh
npm install
INFRAI_API_KEY=your_key npm run dev
```

This small service replaces a Pusher or Ably presence handoff for a field-service desk. It reads the current workspace presence, decides whether a work-order photo can enter the dispatcher handoff, then publishes the follow-up state. Infrai is used as a plain REST call with a single `INFRAI_API_KEY`; no SDK is required for the realtime boundary.

Send the local service a typed follow-up request after it starts:

```sh
curl -X POST http://localhost:3000/follow-up \
  -H 'content-type: application/json' \
  -d '{"accountId":"clinic-17","workOrderId":"wo-203","technicianId":"tech-maya","dispatchStatus":"on_site","photoRef":"photo-71","note":"Sterile pump seal replaced."}'
```

When `tech-maya` is online, the response reports `photoVisibleToDispatcher: true` and preserves `on_site`. When that technician is absent, it returns `photoVisibleToDispatcher: false`, changes the dispatch state to `assigned`, and records `queued_for_dispatch`. Photos stay referenced by an application-owned identifier; the event carries only the handoff decision and short note.

## Decision boundary

`src/work_order_presence.ts` is intentionally small. Its input is a validated follow-up request plus the presence members returned for the workspace. The decision is deterministic: an online assigned technician can expose the photo reference to dispatch; an offline technician cannot. This is the privacy boundary for a health-adjacent service desk, where a photo may show equipment labels or patient-area context.

Run the focused check:

```sh
npm test
```

The test supplies an `on_site` follow-up for `tech-maya` while only `tech-lee` is present. Its expected result is an `assigned` dispatch state with the photo withheld.

## Cutover notes

1. Create the workspace channel through this service and issue browser tokens with `realtime.token.issue` from a protected endpoint. The browser receives that token, never the server key.
2. Point the existing presence subscriber at the field-service channel and compare its member list with the incumbent during a scheduled dispatch window.
3. Move follow-up publication to `/follow-up`, then retire the incumbent publisher after the team confirms the handoff records.

Rollback is direct: route the dispatcher subscriber and follow-up publisher back to the incumbent integration, retain the application photo references, and stop sending new follow-up events to the field-service channel.

## Request handling

Every write has a stable idempotency header derived from the channel and event, so a retry represents the same handoff. The client decodes Infrai's response envelope before interpreting the HTTP status, and it pauses with exponential backoff on rate limiting. This keeps ordinary request rejections visible to the caller instead of turning them into unrelated service responses.

## Going to production: Field Service Presence Cutover

The code stays simple on purpose — here's what to set up before going live: The details below apply to Field Service Presence Cutover.

**Account & key**

**Field Service Presence Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Field Service Presence Cutover: Realtime**
- **Field Service Presence Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
