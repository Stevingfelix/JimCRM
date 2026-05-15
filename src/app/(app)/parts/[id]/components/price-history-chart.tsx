"use client";

type SellPoint = { date: string; price: number; customer: string };
type CostPoint = { date: string; price: number; vendor: string };

interface PriceHistoryChartProps {
  sellPrices: SellPoint[];
  costPrices: CostPoint[];
}

function toTimestamp(d: string): number {
  return new Date(d).getTime();
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function PriceHistoryChart({
  sellPrices,
  costPrices,
}: PriceHistoryChartProps) {
  const totalPoints = sellPrices.length + costPrices.length;
  if (totalPoints < 2) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Not enough price data to show a trend
      </p>
    );
  }

  // Collect all timestamps and prices for axis scaling
  const allDates = [
    ...sellPrices.map((p) => toTimestamp(p.date)),
    ...costPrices.map((p) => toTimestamp(p.date)),
  ];
  const allPrices = [
    ...sellPrices.map((p) => p.price),
    ...costPrices.map((p) => p.price),
  ];

  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const maxPrice = Math.max(...allPrices) * 1.1;

  // Chart area within the viewBox
  const W = 600;
  const H = 200;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const dateRange = maxDate - minDate || 1; // avoid division by zero

  function x(ts: number): number {
    return pad.left + ((ts - minDate) / dateRange) * plotW;
  }

  function y(price: number): number {
    return pad.top + plotH - (price / maxPrice) * plotH;
  }

  function polyline(
    points: Array<{ date: string; price: number }>,
  ): string {
    return points
      .map((p) => `${x(toTimestamp(p.date))},${y(p.price)}`)
      .join(" ");
  }

  // Grid lines (4 horizontal)
  const gridLines = [0.25, 0.5, 0.75, 1.0].map((frac) => ({
    price: maxPrice * frac,
    yPos: y(maxPrice * frac),
  }));

  const minDateLabel = formatDate(new Date(minDate).toISOString());
  const maxDateLabel = formatDate(new Date(maxDate).toISOString());

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Price history chart"
      >
        {/* Grid lines */}
        {gridLines.map((g) => (
          <g key={g.price}>
            <line
              x1={pad.left}
              y1={g.yPos}
              x2={W - pad.right}
              y2={g.yPos}
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
            <text
              x={pad.left - 4}
              y={g.yPos + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={9}
            >
              ${g.price.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        <text
          x={pad.left}
          y={H - 4}
          textAnchor="start"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {minDateLabel}
        </text>
        <text
          x={W - pad.right}
          y={H - 4}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {maxDateLabel}
        </text>

        {/* $0 label */}
        <text
          x={pad.left - 4}
          y={pad.top + plotH + 3}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={9}
        >
          $0
        </text>

        {/* Sell prices (blue) */}
        {sellPrices.length >= 2 && (
          <polyline
            points={polyline(sellPrices)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
          />
        )}
        {sellPrices.map((p, i) => (
          <circle
            key={`sell-${i}`}
            cx={x(toTimestamp(p.date))}
            cy={y(p.price)}
            r={3}
            fill="#3b82f6"
          >
            <title>
              {formatDate(p.date)} - {p.customer} - ${p.price.toFixed(2)}
            </title>
          </circle>
        ))}

        {/* Cost prices (green) */}
        {costPrices.length >= 2 && (
          <polyline
            points={polyline(costPrices)}
            fill="none"
            stroke="#10b981"
            strokeWidth={1.5}
          />
        )}
        {costPrices.map((p, i) => (
          <circle
            key={`cost-${i}`}
            cx={x(toTimestamp(p.date))}
            cy={y(p.price)}
            r={3}
            fill="#10b981"
          >
            <title>
              {formatDate(p.date)} - {p.vendor} - ${p.price.toFixed(2)}
            </title>
          </circle>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
          Sell price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" />
          Vendor cost
        </span>
      </div>
    </div>
  );
}
