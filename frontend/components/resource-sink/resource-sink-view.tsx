"use client"

import { useCallback, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

import { IntervalPicker } from "@/components/interval-picker"
import { ItemIcon } from "@/components/item-icon"
import { TimeSeriesChart } from "@/components/time-series-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/api"
import {
  buildDateRangeQuery,
  isShortTimePreset,
  presetToDateRange,
  type DateRangePreset,
} from "@/lib/date-range"
import { formatNumber, formatPercent } from "@/lib/format"
import type {
  ResourceSinkHistoryResponse,
  ResourceSinkResponse,
} from "@/lib/api-types"
import type { ChartConfig } from "@/components/ui/chart"

type ResourceSinkViewProps = {
  initialStatus: ResourceSinkResponse
  initialHistory: ResourceSinkHistoryResponse["items"]
}

export function ResourceSinkView({
  initialStatus,
  initialHistory,
}: ResourceSinkViewProps) {
  const t = useTranslations("resourceSink")
  const tCharts = useTranslations("charts")
  const [status] = useState(initialStatus)
  const [interval, setInterval] = useState<DateRangePreset>("7d")
  const [history, setHistory] =
    useState<ResourceSinkHistoryResponse["items"]>(initialHistory)
  const [loadingChart, setLoadingChart] = useState(false)

  const loadHistory = useCallback(async (rangePreset: DateRangePreset) => {
    setLoadingChart(true)
    try {
      const range = presetToDateRange(rangePreset)
      const query = buildDateRangeQuery(range)
      const response = await apiFetch<ResourceSinkHistoryResponse>(
        `/resource-sink/history${query}`
      )
      setHistory(response.items)
    } catch {
      setHistory([])
    } finally {
      setLoadingChart(false)
    }
  }, [])

  const handleIntervalChange = (next: DateRangePreset) => {
    setInterval(next)
    void loadHistory(next)
  }

  const chartData = useMemo(
    () =>
      history.map((point) => ({
        timestamp: point.capturedAt,
        coupons: point.numCoupon,
        points: point.totalPoints,
      })),
    [history]
  )

  const couponsChartConfig = useMemo(
    () =>
      ({
        coupons: { label: t("charts.coupons"), color: "var(--chart-1)" },
      }) satisfies ChartConfig,
    [t]
  )

  const pointsChartConfig = useMemo(
    () =>
      ({
        points: { label: t("charts.points"), color: "var(--chart-2)" },
      }) satisfies ChartConfig,
    [t]
  )

  const chartContent =
    loadingChart ? (
      <p className="text-sm text-muted-foreground">{tCharts("loading")}</p>
    ) : chartData.length === 0 ? (
      <p className="text-sm text-muted-foreground">{tCharts("noData")}</p>
    ) : null

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("cards.coupons")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-3xl font-semibold tabular-nums">
              <ItemIcon className="Desc_ResourceSinkCoupon_C" size={28} />
              {status.numCoupon}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("cards.progress")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold tabular-nums">
              {formatPercent(status.percent)}
            </p>
            <Progress value={status.percent} aria-label={t("cards.progress")} />
            <p className="text-sm text-muted-foreground">
              {t("pointsToCoupon", { points: formatNumber(status.pointsToCoupon, 0) })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("cards.totalPoints")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {formatNumber(status.totalPoints, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex justify-end">
          <IntervalPicker value={interval} onChange={handleIntervalChange} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("charts.coupons")}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartContent ?? (
              <TimeSeriesChart
                data={chartData}
                config={couponsChartConfig}
                series={[{ key: "coupons" }]}
                compactTimeAxis={isShortTimePreset(interval)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("charts.points")}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartContent ?? (
              <TimeSeriesChart
                data={chartData}
                config={pointsChartConfig}
                series={[{ key: "points" }]}
                compactTimeAxis={isShortTimePreset(interval)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
