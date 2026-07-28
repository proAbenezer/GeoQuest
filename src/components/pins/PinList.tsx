import { usePins } from "@/context/usePins"
import Pin from "./Pin"

const PinsList = ({ zoom }) => {
  const { pins } = usePins()
  return (
    <>
      {pins.map((pin) => (
        <Pin key={pin.id} pin={pin} zoom={zoom} />
      ))}
    </>
  )
}

export default PinsList
