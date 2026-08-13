import { Source, Layer } from "react-map-gl/mapbox"

const BRAND_COLOR = "#00B47B"

export default function PlacesLayers({ geojson }: { geojson: GeoJSON.FeatureCollection }) {
  return (
    <Source id="places" type="geojson" data={geojson}>
      {/* Locked leaves — fog fill */}
      <Layer
        id="places-locked-fill"
        type="fill"
        filter={["all", ["==", ["get", "state"], "locked"], ["==", ["get", "isLeaf"], true]]}
        paint={{ "fill-color": "#6b7280", "fill-opacity": 0.5 }}
      />
      {/* Opened ancestors — outline only, never fill (see note in MapView history) */}
      <Layer
        id="places-opened-outline"
        type="line"
        filter={["all", ["==", ["get", "state"], "opened"], ["==", ["get", "isLeaf"], false]]}
        paint={{
          "line-color": BRAND_COLOR,
          "line-width": ["step", ["get", "adminLevel"], 1, 2, 1.5, 3, 2],
        }}
      />
      {/* Unlocked leaves — no fill (fully interactable, raw map shows through),
          but a faint seam so adjacent unlocked places don't visually merge
          into one blob. Deliberately subtle: thin + low opacity + white,
          distinct from the bolder brand-colored ancestor outline above. */}
      <Layer
        id="places-unlocked-leaf-outline"
        type="line"
        filter={["all", ["==", ["get", "state"], "unlocked"], ["==", ["get", "isLeaf"], true]]}
        paint={{
          "line-color": "#ffffff",
          "line-width": 1,
          "line-opacity": 0.35,
        }}
      />
    </Source>
  )
}
