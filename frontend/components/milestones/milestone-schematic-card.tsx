"use client"

import { useTranslations } from "next-intl"

import { ItemIcon } from "@/components/item-icon"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useFormatDateTime } from "@/hooks/use-format-datetime"
import type { MilestoneSchematic } from "@/lib/api-types"
import {
  GAME_ITEM_CARD_ICON_SIZE,
  gameItemCardTitleClassName,
  gameItemCardTriggerClassName,
} from "@/lib/game-item-card"
import { schematicStatus } from "@/lib/milestone-layout"
import { cn } from "@/lib/utils"

type MilestoneSchematicCardProps = {
  schematic: MilestoneSchematic
  techTier: number
}

function statusClasses(status: ReturnType<typeof schematicStatus>): string {
  switch (status) {
    case "unlocked":
      return "border-emerald-500/60 bg-emerald-950 text-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
    case "locked":
      return "border-dashed border-muted-foreground/40 bg-muted text-muted-foreground"
    case "available":
      return "border-primary/70 bg-card text-foreground"
  }
}

export function MilestoneSchematicCard({
  schematic,
  techTier,
}: MilestoneSchematicCardProps) {
  const t = useTranslations("milestones")
  const { formatDateTime } = useFormatDateTime()
  const status = schematicStatus(schematic)
  const statusLabel = t(`status.${status === "unlocked" ? "unlocked" : status}`)
  const thumbnailClassName = schematic.recipes[0]?.iconClassName

  return (
    <div className="h-full w-full">
      <Popover>
        <PopoverTrigger
          className={cn(gameItemCardTriggerClassName, statusClasses(status))}
        >
          <span
            data-game-item-card-content=""
            className="flex w-full flex-col items-center justify-center gap-1.5"
          >
            <ItemIcon
              className={thumbnailClassName}
              size={GAME_ITEM_CARD_ICON_SIZE}
            />
            <span className={gameItemCardTitleClassName}>{schematic.name}</span>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {statusLabel}
            </Badge>
          </span>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-72">
          <PopoverHeader>
            <PopoverTitle>{schematic.name}</PopoverTitle>
            <PopoverDescription>
              {t("tierLabel", { tier: techTier })}
            </PopoverDescription>
          </PopoverHeader>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{statusLabel}</Badge>
          </div>
          {schematic.purchasedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("unlockedAt", { date: formatDateTime(schematic.purchasedAt) })}
            </p>
          ) : null}
          {schematic.recipes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("recipes")}
              </p>
              <div className="flex flex-wrap gap-1">
                {schematic.recipes.map((recipe) => (
                  <Badge
                    key={recipe.className}
                    variant="secondary"
                    className="gap-1"
                  >
                    <ItemIcon className={recipe.iconClassName} size={14} />
                    {recipe.name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
