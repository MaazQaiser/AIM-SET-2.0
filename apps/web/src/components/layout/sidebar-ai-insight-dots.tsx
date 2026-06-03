/** Dot matrix footer — Figma node 146:15661 (37 columns × 7 dots). */
const DOT_R = 1.43731;
const COL_W = 2.875;
const COL_GAP = 4.791;
const HEIGHT = 48.869;

type Dot = readonly [y: number, fill: string];
type ColumnVariant = readonly Dot[];

const COLUMN_VARIANTS = {
  4954: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7687, "#D9D9D9"], [24.4343, "#D9D9D9"], [32.1, "#D9D9D9"], [39.7657, "#D9D9D9"], [47.4313, "#D9D9D9"]] as const,
  4957: [[1.43731, "#D9D9D9"], [9.10295, "#D9D9D9"], [16.7686, "#D9D9D9"], [24.4342, "#D9D9D9"], [32.1001, "#D9D9D9"], [39.7658, "#D9D9D9"], [47.4314, "#D9D9D9"]] as const,
  4959: [[1.43731, "#D9D9D9"], [9.10295, "#D9D9D9"], [16.7686, "#D9D9D9"], [24.4342, "#D9D9D9"], [32.1001, "#D9D9D9"], [39.7658, "#D9D9D9"], [47.4314, "#D9D9D9"]] as const,
  4966: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7686, "#D9D9D9"], [24.4345, "#D9D9D9"], [32.0998, "#D9D9D9"], [39.7658, "#D9D9D9"], [47.4311, "#D9D9D9"]] as const,
  4971: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7686, "#D9D9D9"], [24.4345, "#D9D9D9"], [32.0998, "#D9D9D9"], [39.7658, "#D9D9D9"], [47.4311, "#D9D9D9"]] as const,
  4973: [[1.43731, "#9C9999"], [9.10298, "#9C9999"], [16.7686, "#9C9999"], [24.4345, "#9C9999"], [32.0998, "#9C9999"], [39.7658, "#9C9999"], [47.4311, "#9C9999"]] as const,
  4974: [[1.43731, "#D9D9D9"], [9.10298, "#A1A1A1"], [16.7687, "#A1A1A1"], [24.4343, "#A1A1A1"], [32.1, "#D9D9D9"], [39.7657, "#D9D9D9"], [47.4313, "#D9D9D9"]] as const,
  4975: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7687, "#A1A1A1"], [24.4343, "#A1A1A1"], [32.1, "#D9D9D9"], [39.7657, "#D9D9D9"], [47.4313, "#D9D9D9"]] as const,
  4976: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7687, "#D9D9D9"], [24.4343, "#A1A1A1"], [32.1, "#D9D9D9"], [39.7657, "#D9D9D9"], [47.4313, "#D9D9D9"]] as const,
  4980: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7686, "#D9D9D9"], [24.4345, "#D9D9D9"], [32.0998, "#D9D9D9"], [39.7658, "#D9D9D9"], [47.4311, "#D9D9D9"]] as const,
  4982: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7686, "#D9D9D9"], [24.4345, "#D9D9D9"], [32.0998, "#D9D9D9"], [39.7658, "#D9D9D9"], [47.4311, "#D9D9D9"]] as const,
  4987: [[1.43731, "#D9D9D9"], [9.10298, "#D9D9D9"], [16.7686, "#D9D9D9"], [24.4345, "#D9D9D9"], [32.0998, "#D9D9D9"], [39.7658, "#D9D9D9"], [47.4311, "#D9D9D9"]] as const,
} as const satisfies Record<string, ColumnVariant>;

const COLUMN_ORDER = [
  "4954", "4954", "4957", "4954", "4959", "4954", "4954", "4954", "4954", "4954",
  "4954", "4966", "4954", "4954", "4954", "4954", "4971", "4954", "4973", "4974",
  "4975", "4976", "4954", "4954", "4954", "4980", "4954", "4982", "4954", "4954",
  "4954", "4954", "4987", "4954", "4954", "4954", "4954",
] as const;

const WIDTH = COLUMN_ORDER.length * COL_W + (COLUMN_ORDER.length - 1) * COL_GAP;

export function SidebarAiInsightDots({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="278.851"
      height="48.869"
      viewBox="0 0 278.851 48.869"
      fill="none"
      aria-hidden
    >
      {COLUMN_ORDER.map((variantId, colIndex) => {
        const ox = colIndex * (COL_W + COL_GAP) + DOT_R;
        return COLUMN_VARIANTS[variantId].map(([y, fill]) => (
          <circle key={`${variantId}-${colIndex}-${y}`} cx={ox} cy={y} r={DOT_R} fill={fill} />
        ));
      })}
    </svg>
  );
}
