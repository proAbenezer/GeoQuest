-- Route photos (Phase B add-on).
--
-- A "route" is not a first-class table in GeoQuest — it's a comment thread over
-- a start→end pin pair, and the map draws the path for every such thread. So a
-- route's optional photo lives as a nullable image_url on the comment that
-- starts the route conversation (target_type = 'route'). Pins already carry
-- their own image_url; this column lets a route post carry one too. The server
-- only accepts image_url for route-target comments (replies and pin/location
-- comments stay text-only).
ALTER TABLE "comments" ADD COLUMN "image_url" text;
