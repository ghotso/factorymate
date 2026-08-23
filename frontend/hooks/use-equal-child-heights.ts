"use client"

import { useLayoutEffect, useRef } from "react"

/** Stretch every direct child to the tallest sibling in the container. */
export function useEqualChildHeights<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const container = ref.current
    if (!container) {
      return
    }

    let lastWidth = -1
    let lastCount = -1

    const apply = () => {
      const children = Array.from(container.children) as HTMLElement[]
      const width = container.clientWidth
      if (width === lastWidth && children.length === lastCount) {
        return
      }

      for (const child of children) {
        child.style.minHeight = ""
      }
      const tallest = children.reduce(
        (max, child) => Math.max(max, child.offsetHeight),
        0
      )
      for (const child of children) {
        child.style.minHeight = tallest > 0 ? `${tallest}px` : ""
      }
      lastWidth = container.clientWidth
      lastCount = children.length
    }

    apply()

    const ro = new ResizeObserver(() => {
      if (container.clientWidth !== lastWidth) {
        apply()
      }
    })
    ro.observe(container)

    const mo = new MutationObserver(() => {
      lastCount = -1
      apply()
    })
    mo.observe(container, { childList: true })

    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  return ref
}
