import test from "node:test";
import assert from "node:assert/strict";
import { decideFollowUp } from "../src/work_order_presence.js";

test("an offline technician keeps the photo out of the dispatch handoff", () => {
  const decision = decideFollowUp({
    accountId: "clinic-17",
    workOrderId: "wo-203",
    technicianId: "tech-maya",
    dispatchStatus: "on_site",
    photoRef: "photo-71",
    note: "Sterile pump seal replaced.",
  }, [{ client_id: "tech-lee" }]);

  assert.deepEqual(decision, {
    technicianOnline: false,
    dispatchStatus: "assigned",
    photoVisibleToDispatcher: false,
    followUp: "queued_for_dispatch",
  });
});
