// lib/notify.ts
// In-app notification emitter.
//
// Insertions are best-effort BY DESIGN: an event must never fail the primary
// write that triggered it, so callers invoke notify() after their own insert
// succeeds and never depend on its result. Guests are never recipients — every
// event targets a registered user, so a null/absent recipient short-circuits
// before any query runs.
import { db } from "../db/index.ts"
import { notifications } from "../db/schema.ts"

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "comment_vote"
  | "place_unlock"
  | "message"
  | "follow"
  | "group_added"
  | "group_message"

export async function notify(args: {
  recipientUserId: string | null | undefined
  actorUserId?: string | null
  type: NotificationType
  /** Comment id | place id | conversation id — the event's target. */
  refId?: string | null
  /** Denormalized snippet shown in the popup (place name, comment body, …). */
  context?: string | null
}): Promise<void> {
  const {
    recipientUserId,
    actorUserId = null,
    type,
    refId = null,
    context = null,
  } = args
  if (!recipientUserId) return
  try {
    await db.insert(notifications).values({
      recipientUserId,
      actorUserId,
      type,
      refId,
      context,
    })
  } catch (err) {
    console.error("Failed to enqueue notification:", err)
  }
}
