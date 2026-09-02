#!/usr/bin/env bash
# TEMP probe — reverse-geocode Mapbox at Addis Ababa click point (9.021693, 38.837770).
set -u
ENVFILE="/home/proabeni/Projects/GeoQuest/frontend/.env"
TOKEN=$(sed -n 's/^VITE_MAPBOX_TOKEN=//p' "$ENVFILE" | tr -d '"' | tr -d "'" | xargs)
B="https://api.mapbox.com"
V6="$B/search/geocode/v6/reverse?longitude=38.837770&latitude=9.021693"
V5="$B/geocoding/v5/mapbox.places/38.837770,9.021693.json"
curl -s --max-time 20 "$V6&limit=10&access_token=$TOKEN" -o /tmp/v6_none.json
curl -s --max-time 20 "$V6&types=address,street,locality,neighborhood,place&limit=10&access_token=$TOKEN" -o /tmp/v6_fine.json
curl -s --max-time 20 "$V6&types=district&limit=10&access_token=$TOKEN" -o /tmp/v6_district.json
curl -s --max-time 20 "$V6&types=poi&limit=10&access_token=$TOKEN" -o /tmp/v6_poi.json
curl -s --max-time 20 "$V5?types=poi,address&limit=5&access_token=$TOKEN" -o /tmp/v5_poi.json
curl -s --max-time 20 "$V5?limit=5&access_token=$TOKEN" -o /tmp/v5_none.json
python3 - <<'PY'
import json
for name in ["v6_none","v6_fine","v6_district","v6_poi","v5_poi","v5_none"]:
    try:
        d = json.load(open(f"/tmp/{name}.json"))
    except Exception as e:
        print(f"== {name}  PARSE_ERR {e}"); continue
    if d.get("message"):
        print(f"== {name}  ERROR_MESSAGE: {d.get('message')}"); continue
    feats = d.get("features") or []
    print(f"== {name}  features: {len(feats)}")
    for f in feats:
        p = f.get("properties", {})
        ft = p.get("feature_type") or (f.get("place_type") or [None])[0]
        namev = p.get("name") or p.get("name_preferred") or f.get("text")
        g = f.get("geometry", {}).get("coordinates")
        if isinstance(g, list) and g and isinstance(g[0], list):
            g = "<linestring>"
        ctx = ""
        c = p.get("context") or {}
        if isinstance(c, dict):
            for key in ("district","locality","neighborhood","place"):
                if c.get(key): ctx += f" {key}:{c[key].get('name','')}"
        print(f"    ft={ft}  name={namev!r} coords={g} ctx:{ctx}")
PY
