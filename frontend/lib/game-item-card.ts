/** Shared visual contract for milestone schematic cards and research node cards. */

export const GAME_ITEM_CARD_MIN_WIDTH_PX = 172
export const GAME_ITEM_CARD_ICON_SIZE = 48
export const GAME_ITEM_CARD_PAD_Y_PX = 16

export const GAME_ITEM_CARD_CONTENT_SELECTOR = "[data-game-item-card-content]"

export const gameItemCardTriggerClassName =
  "flex h-full w-full min-h-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-center text-sm font-medium transition-colors hover:brightness-95"

export const gameItemCardTitleClassName =
  "w-full text-pretty break-words leading-snug"
