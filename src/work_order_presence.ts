import { z } from "zod";

export const followUpRequest = z.object({
  accountId: z.string().min(1),
  workOrderId: z.string().min(1),
  technicianId: z.string().min(1),
  dispatchStatus: z.enum(["assigned", "en_route", "on_site"]),
  photoRef: z.string().min(1),
  note: z.string().min(1).max(280),
});

export type FollowUpRequest = z.infer<typeof followUpRequest>;

export type PresenceMember = { client_id: string };

export function decideFollowUp(input: FollowUpRequest, members: PresenceMember[]) {
  const technicianOnline = members.some((member) => member.client_id === input.technicianId);
  return {
    technicianOnline,
    dispatchStatus: technicianOnline ? input.dispatchStatus : "assigned",
    photoVisibleToDispatcher: technicianOnline,
    followUp: technicianOnline ? "sent" : "queued_for_dispatch",
  } as const;
}

export function workspaceChannel(accountId: string) {
  return `field-service-${accountId}`;
}
