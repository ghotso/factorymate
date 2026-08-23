"use client"

import type { ReactNode } from "react"

import { useEqualChildHeights } from "@/hooks/use-equal-child-heights"
import { GAME_ITEM_CARD_MIN_WIDTH_PX } from "@/lib/game-item-card"

type GameItemCardGridProps = {
  children: ReactNode
}

export function GameItemCardGrid({ children }: GameItemCardGridProps) {
  const ref = useEqualChildHeights<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className="grid items-stretch gap-3"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${GAME_ITEM_CARD_MIN_WIDTH_PX}px, 1fr))`,
      }}
    >
      {children}
    </div>
  )
}
