import type { IControl, Map as MapboxMap } from "mapbox-gl"

const LOCATE_ICON = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"></circle>
  <line x1="12" y1="2" x2="12" y2="5"></line>
  <line x1="12" y1="19" x2="12" y2="22"></line>
  <line x1="2" y1="12" x2="5" y2="12"></line>
  <line x1="19" y1="12" x2="22" y2="12"></line>
</svg>`

export class RecenterMapControl implements IControl {
  private container!: HTMLDivElement
  private button!: HTMLButtonElement
  private onClick: () => void

  constructor(onClick: () => void) {
    this.onClick = onClick
  }

  onAdd(_map: MapboxMap) {
    this.container = document.createElement("div")
    this.container.className = "mapboxgl-ctrl mapboxgl-ctrl-group"

    this.button = document.createElement("button")
    this.button.type = "button"
    this.button.className = "recenter-map-control"
    this.button.setAttribute("aria-label", "Recenter on my location")
    this.button.innerHTML = `<span class="recenter-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#333;">${LOCATE_ICON}</span>`
    this.button.addEventListener("click", () => this.onClick())

    this.container.appendChild(this.button)
    return this.container
  }

  onRemove() {
    this.container.parentNode?.removeChild(this.container)
  }

  setState(opts: { locating?: boolean; centered?: boolean }) {
    this.button.classList.toggle("recenter-locating", !!opts.locating)
    this.button.classList.toggle("recenter-centered", !!opts.centered)
  }
}
