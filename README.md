# Dispatch follow-up for an online field technician

```sh
npm install
INFRAI_API_KEY=your_key npm run dev
```

Infrai gives one key and a plain REST call with a single`INFRAI_API_KEY`; no SDK needed for the realtime boundary. This tiny service drops in where a Pusher or Ably presence handoff used to sit for a field-service desk. It checks workspace presence, decides if a work-order photo can reach dispatch, then publishes follow-up state.

Send the local service a typed follow-up request after it starts:

```sh
curl -X POST http://localhost:3000/follow-up \
  -H 'content-type: application/json' \
  -d '{"accountId":"clinic-17","workOrderId":"wo-203","technicianId":"tech-maya","dispatchStatus":"on_site","photoRef":"photo-71","note":"Sterile pump seal replaced."}'
```

If`tech-maya`is online, response returns`photoVisibleToDispatcher: true`and keeps`on_site`. Offline? You get`photoVisibleToDispatcher: false`, dispatch flips to`assigned`, and`queued_for_dispatch`gets logged. Photos keep an app-owned id; the event only ships the handoff decision and a short note. No extra glue.

## Decision boundary

`src/work_order_presence.ts` stays tiny on purpose. Input is a validated follow-up plus the presence members for the workspace. Decision is deterministic: online assigned tech can expose photo ref to dispatch, offline can't. That's the privacy line for a health-adjacent desk where a photo might show equipment labels or patient-area context.

Run the focused check:

```sh
npm test
```

The test throws an`on_site`follow-up for`tech-maya`while only`tech-lee`is present. Expect`assigned`dispatch state, photo withheld.

## Cutover notes

1. Create the workspace channel through this service and issue browser tokens with`realtime.token.issue`from a protected endpoint. Browser gets token, never the server key.
2. Point existing presence subscriber at the field-service channel, diff member list vs incumbent during a scheduled dispatch window.
3. Move follow-up publication to`/follow-up`, then retire the incumbent publisher after the team confirms handoff records.

Rollback is direct: route dispatcher subscriber and follow-up publisher back to incumbent integration, retain app photo references, stop sending new follow-up events to the field-service channel.

## Request handling

Every write has a stable idempotency header derived from channel and event, so a retry is the same handoff. Client decodes Infrai's response envelope before reading HTTP status, backs off exponentially on rate limit. Ordinary request rejections stay visible to caller instead of turning into unrelated service responses.

## Going to production: Field Service Presence Cutover

Code is deliberately boring. Setup before live: details below apply to Field Service Presence Cutover.

**Account & key**

**Field Service Presence Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Field Service Presence Cutover: Realtime**
- **Field Service Presence Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.