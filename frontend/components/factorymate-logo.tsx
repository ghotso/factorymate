import { cn } from "@/lib/utils"

type FactoryMateLogoProps = {
  variant?: "onDark" | "onLight"
  showWordmark?: boolean
  showVersion?: boolean
  versionLabel?: string
  shortVersionLabel?: string
  iconSize?: number
  className?: string
}

export function FactoryMateLogo({
  variant = "onDark",
  showWordmark = true,
  showVersion = false,
  versionLabel,
  shortVersionLabel,
  iconSize = 32,
  className,
}: FactoryMateLogoProps) {
  const factoryColor =
    variant === "onLight"
      ? "text-foreground"
      : "text-sidebar-foreground dark:text-white"

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        showVersion &&
          "group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-0.5",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-no-bg.svg"
        width={iconSize}
        height={iconSize}
        alt=""
        className="shrink-0"
      />
      {showWordmark ? (
        showVersion ? (
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span
              className="truncate text-sm font-semibold leading-tight"
              aria-hidden
            >
              <span className={factoryColor}>Factory</span>
              <span className="text-[#F2A03D]">Mate</span>
            </span>
            {versionLabel ? (
              <span
                className="truncate font-mono text-xs leading-tight text-muted-foreground"
                title={versionLabel}
              >
                {versionLabel}
              </span>
            ) : null}
          </div>
        ) : (
          <span
            className="truncate text-sm font-semibold leading-tight group-data-[collapsible=icon]:hidden"
            aria-hidden
          >
            <span className={factoryColor}>Factory</span>
            <span className="text-[#F2A03D]">Mate</span>
          </span>
        )
      ) : null}
      {showVersion && shortVersionLabel ? (
        <span
          className="hidden font-mono text-xs text-muted-foreground group-data-[collapsible=icon]:inline"
          title={versionLabel}
        >
          {shortVersionLabel}
        </span>
      ) : null}
    </div>
  )
}
