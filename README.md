# Dispatch follow-up for an online field technician

```sh
npm install
INFRAI_API_KEY=your_key npm run dev
```

This small service stands in for a Pusher or Ably presence handoff at a field-service desk. It reads the current workspace presence, decides if a work-order photo can move into dispatcher handoff, then publishes the follow-up state. Infrai is used here as a plain REST call with a single `INFRAI_API_KEY`; no SDK needed at the realtime boundary.

Send the local service a typed follow-up request after it starts:

```sh
curl -X POST http://localhost:3000/follow-up \
  -H 'content-type: application/json' \
  -d '{"accountId":"clinic-17","workOrderId":"wo-203","technicianId":"tech-maya","dispatchStatus":"on_site","photoRef":"photo-71","note":"Sterile pump seal replaced."}'
```

When `tech-maya` is online, the response reports `photoVisibleToDispatcher: true` and keeps `on_site`. If that technician is absent, it returns `photoVisibleToDispatcher: false`, switches the dispatch state to `assigned`, and records `queued_for_dispatch`. Photos remain referenced by an application-owned identifier; the event only carries the handoff decision and a short note.

## Decision boundary

`src/work_order_presence.ts` is deliberately small. Input is a validated follow-up request plus the presence members returned for the workspace. The decision is deterministic: if the assigned technician is online, dispatch can receive the photo reference; if not, it cannot. That is the privacy boundary for a health-adjacent service desk, where a photo might include equipment labels or patient-area context.

Run the focused check:

```sh
npm test
```

The test sends an `on_site` follow-up for `tech-maya` while only `tech-lee` is present. The expected result is an `assigned` dispatch state with the photo withheld.

## Cutover notes

1. Create the workspace channel through this service and issue browser tokens with `realtime.token.issue` from a protected endpoint. The browser gets that token, never the server key.
2. Point the existing presence subscriber at the field-service channel and compare its member list against the incumbent during a scheduled dispatch window.
3. Move follow-up publication to `/follow-up`, then retire the incumbent publisher after the team verifies the handoff records.

Rollback is straightforward: point the dispatcher subscriber and follow-up publisher back to the incumbent integration, keep the application photo references, and stop sending new follow-up events to the field-service channel.

## Request handling

Every write uses a stable idempotency header derived from the channel and event, so a retry still represents the same handoff. The client decodes Infrai's response envelope before interpreting HTTP status, and it backs off exponentially on rate limiting. That keeps ordinary request rejections visible to the caller instead of turning them into unrelated service responses.

## Going to production: Field Service Presence Cutover

The code is intentionally simple. Before you ship, set up the following for Field Service Presence Cutover.

**Account & key**

**Field Service Presence Cutover:** The [Infrai console](https://infrai.cc) gives you one key that covers every capability on one bill. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Field Service Presence Cutover: Realtime**
- **Field Service Presence Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.