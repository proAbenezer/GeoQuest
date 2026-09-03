-- Data-only migration: mirror legacy accepted connections so every friendship
-- is symmetric (both directions `status = 'accepted'`) — the invariant the
-- mutual-accept DM gate and the People tab rely on. Connections were previously
-- one-way follows, so an accepted row A→B had no B→A counterpart. Idempotent:
-- the NOT EXISTS guard skips pairs that already have their mirror (including
-- ones this insert creates), so re-running is safe.
INSERT INTO "connections" ("follower_id", "followee_id", "created_at", "status")
SELECT "followee_id", "follower_id", "created_at", 'accepted'
FROM "connections"
WHERE "status" = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM "connections" c2
    WHERE c2."follower_id" = "connections"."followee_id"
      AND c2."followee_id" = "connections"."follower_id"
  );
