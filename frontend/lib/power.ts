import type { Circuit } from "@/lib/api-types"

/** Hide circuit groups where all displayed metrics are zero; tripped circuits stay visible. */
export function isCircuitVisible(circuit: Circuit): boolean {
  if (circuit.tripped) {
    return true
  }
  return (
    (circuit.powerCapacity ?? 0) > 0 ||
    (circuit.powerProduction ?? 0) > 0 ||
    (circuit.powerConsumed ?? 0) > 0 ||
    (circuit.batteryPercent ?? 0) > 0
  )
}

export function filterVisibleCircuits(circuits: Circuit[]): Circuit[] {
  return circuits.filter(isCircuitVisible)
}
