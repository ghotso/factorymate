"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { ItemIcon } from "@/components/item-icon"
import { ResearchNodeCard } from "@/components/research/research-node"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ResearchNode } from "@/lib/api-types"
import { GAME_ITEM_CARD_CONTENT_SELECTOR } from "@/lib/game-item-card"
import {
  RESEARCH_CELL_HEIGHT,
  RESEARCH_CELL_WIDTH,
  computeBounds,
  computeEdges,
  gridColumn,
  gridRow,
  hasLayoutData,
  researchCellHeightForContent,
} from "@/lib/research-layout"

type ResearchTreeCanvasProps = {
  nodes: ResearchNode[]
  treeName: string
}

export function ResearchTreeCanvas({ nodes, treeName }: ResearchTreeCanvasProps) {
  const t = useTranslations("research")
  const gridRef = useRef<HTMLDivElement>(null)
  const [cellHeight, setCellHeight] = useState(RESEARCH_CELL_HEIGHT)

  const layout = useMemo(() => {
    if (!hasLayoutData(nodes)) {
      return null
    }
    const bounds = computeBounds(nodes)
    if (!bounds) {
      return null
    }
    const cols = bounds.maxX - bounds.minX + 1
    const rows = bounds.maxY - bounds.minY + 1
    const width = cols * RESEARCH_CELL_WIDTH
    const height = rows * cellHeight
    const edges = computeEdges(nodes, bounds, RESEARCH_CELL_WIDTH, cellHeight)
    return { bounds, cols, rows, width, height, edges }
  }, [nodes, cellHeight])

  useLayoutEffect(() => {
    const root = gridRef.current
    if (!root || !layout) {
      return
    }

    const measure = () => {
      const contents = root.querySelectorAll(GAME_ITEM_CARD_CONTENT_SELECTOR)
      let maxContent = 0
      contents.forEach((el) => {
        maxContent = Math.max(maxContent, (el as HTMLElement).scrollHeight)
      })
      const next = researchCellHeightForContent(maxContent)
      setCellHeight((prev) => (prev === next ? prev : next))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    return () => ro.disconnect()
  }, [nodes, layout])

  if (!layout) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {t("layoutPending")}
          </CardContent>
        </Card>
        <ul className="space-y-2">
          {nodes.map((node) => (
            <li
              key={node.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 font-medium">
                <ItemIcon className={node.cost[0]?.className} size={20} />
                {node.name}
              </span>
              <Badge variant="outline">{node.state}</Badge>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-lg border bg-muted/20 p-4">
      <div
        className="relative"
        style={{
          width: layout.width,
          height: layout.height,
          minWidth: layout.width,
        }}
        aria-label={treeName}
      >
        <svg
          className="pointer-events-none absolute inset-0 text-muted-foreground"
          width={layout.width}
          height={layout.height}
          aria-hidden
        >
          {layout.edges.map((edge) => (
            <line
              key={edge.key}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="currentColor"
              strokeWidth={2}
              strokeOpacity={0.45}
            />
          ))}
        </svg>

        <div
          ref={gridRef}
          className="relative z-10 grid"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, ${RESEARCH_CELL_WIDTH}px)`,
            gridTemplateRows: `repeat(${layout.rows}, ${cellHeight}px)`,
            width: layout.width,
            height: layout.height,
          }}
        >
          {nodes.map((node) => {
            if (!node.coordinates) {
              return null
            }
            return (
              <div
                key={node.id}
                className="flex h-full min-h-0 items-stretch justify-center p-2"
                style={{
                  gridColumn: gridColumn(node.coordinates.x, layout.bounds),
                  gridRow: gridRow(node.coordinates.y, layout.bounds),
                }}
              >
                <ResearchNodeCard node={node} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
