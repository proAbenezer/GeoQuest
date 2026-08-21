// MapPage.tsx
import MapView from "@/components/maps/MapView"
import { useEffect } from "react"
const MapPage = () => {
useEffect(() => {
  // Force remove borders after map loads
  const removeBorders = () => {
    document.querySelectorAll('.mapboxgl-map, .mapboxgl-canvas-container, .mapboxgl-canvas, .map-wrapper, .map-container')
      .forEach(el => {
        el.style.border = 'none';
        el.style.outline = 'none';
        el.style.boxShadow = 'none';
        el.style.borderStyle = 'none';
        el.style.borderWidth = '0';
      });
  };
  
  // Run immediately and after a delay
  removeBorders();
  setTimeout(removeBorders, 500);
  setTimeout(removeBorders, 1000);
}, []);
  return <MapView />
}

export default MapPage
