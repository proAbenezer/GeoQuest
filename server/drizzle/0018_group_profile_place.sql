-- Group profile + linked place (follow-up batch).
--
-- A group gains an optional avatar photo (image_url, uploaded the same way pin
-- photos are) and an optional linked place — the creator's own PUBLIC pin that
-- the group is about. Members (who may be direct-added and not otherwise follow
-- the creator) see that pin on the chat header and in the map's public-pins
-- feed. The FK is ON DELETE SET NULL so deleting the pin just unlinks it.
ALTER TABLE "groups" ADD COLUMN "image_url" text;
ALTER TABLE "groups" ADD COLUMN "pin_id" uuid REFERENCES "pins"("id") ON DELETE SET NULL;
