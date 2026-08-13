import type { IControl, Map as MapboxMap } from "mapbox-gl"

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
    this.button.setAttribute("aria-label", "Recenter on my location")
    this.button.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">◎</span>`
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
