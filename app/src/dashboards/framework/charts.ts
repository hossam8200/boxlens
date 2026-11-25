// ECharts helpers for dashboard routes. Each builder takes a target element
// and option overrides and returns a chart instance the caller can dispose on
// unmount. All builders apply the coastal-glass theme colours, are responsive
// (resize on container change), and disable non-essential animations on
// prefers-reduced-motion. Lazy-imported via `echarts` so each route that uses
// charts gets its own async chunk.
import type { EChartsOption, ECharts } from 'echarts';

const prefersReducedMotion =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const COMMON_GRID = {
  left: 48,
  right: 18,
  top: 24,
  bottom: 36,
  containLabel: true,
};

const AXIS_LINE = { lineStyle: { color: '#94a3b8' } };
const AXIS_LABEL = { color: '#5b6b85', fontSize: 11 };

function baseTooltip(): Record<string, unknown> {
  return {
    trigger: 'axis',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(15,40,80,0.12)',
    borderWidth: 1,
    textStyle: { color: '#0f2240', fontSize: 12 },
    extraCssText: 'backdrop-filter: blur(6px); border-radius:10px; box-shadow:0 6px 18px -6px rgba(15,40,80,0.25);',
  };
}

async function init(target: HTMLElement): Promise<ECharts> {
  const echarts = await import('echarts');
  return echarts.init(target, undefined, { renderer: 'canvas' });
}

/** Resize observer hook so charts grow/shrink with their card. */
function attachResize(chart: ECharts): () => void {
  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => chart.resize())
      : null;
  if (ro) ro.observe(chart.getDom());
  const onWin = (): void => chart.resize();
  window.addEventListener('resize', onWin);
  return () => {
    ro?.disconnect();
    window.removeEventListener('resize', onWin);
  };
}

export interface LineSeries {
  name: string;
  data: number[];
  /** Hex colour; defaults to a palette colour. */
  color?: string;
}

/** Stacked or overlaid line chart. `labels` aligns with each series.data. */
export async function lineChart(
  target: HTMLElement,
  labels: string[],
  series: LineSeries[],
  opts: { area?: boolean; stack?: boolean } = {},
): Promise<{ chart: ECharts; dispose: () => void }> {
  const chart = await init(target);
  const palette = ['#0f766e', '#0891b2', '#2563eb', '#d97706', '#dc2626', '#7c3aed'];
  const option: EChartsOption = {
    color: palette,
    animation: !prefersReducedMotion,
    grid: COMMON_GRID,
    tooltip: baseTooltip() as unknown as NonNullable<EChartsOption['tooltip']>,
    legend: {
      top: 0,
      right: 8,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#5b6b85', fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: AXIS_LINE,
      axisLabel: AXIS_LABEL,
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: AXIS_LABEL,
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.18)' } },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: false,
      stack: opts.stack ? 'total' : undefined,
      areaStyle: opts.area
        ? {
            opacity: 0.18,
            color: s.color ?? palette[i % palette.length],
          }
        : undefined,
      lineStyle: { width: 2.5, color: s.color },
      itemStyle: { color: s.color },
      data: s.data,
    })),
  };
  chart.setOption(option);
  const detach = attachResize(chart);
  return {
    chart,
    dispose: () => {
      detach();
      chart.dispose();
    },
  };
}

/** Vertical bar chart, optionally grouped/stacked. */
export async function barChart(
  target: HTMLElement,
  labels: string[],
  series: LineSeries[],
  opts: { horizontal?: boolean; stack?: boolean } = {},
): Promise<{ chart: ECharts; dispose: () => void }> {
  const chart = await init(target);
  const palette = ['#0f766e', '#0891b2', '#2563eb', '#d97706', '#dc2626', '#7c3aed'];
  const option: EChartsOption = {
    color: palette,
    animation: !prefersReducedMotion,
    grid: COMMON_GRID,
    tooltip: { ...baseTooltip(), trigger: 'axis', axisPointer: { type: 'shadow' } } as unknown as NonNullable<EChartsOption['tooltip']>,
    legend: {
      top: 0,
      right: 8,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#5b6b85', fontSize: 11 },
    },
    xAxis: opts.horizontal
      ? { type: 'value', axisLine: { show: false }, axisLabel: AXIS_LABEL, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.18)' } } }
      : { type: 'category', data: labels, axisLine: AXIS_LINE, axisLabel: AXIS_LABEL, axisTick: { show: false } },
    yAxis: opts.horizontal
      ? { type: 'category', data: labels, axisLine: AXIS_LINE, axisLabel: AXIS_LABEL, axisTick: { show: false } }
      : { type: 'value', axisLine: { show: false }, axisLabel: AXIS_LABEL, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.18)' } } },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: opts.stack ? 'total' : undefined,
      barMaxWidth: 36,
      itemStyle: { color: s.color ?? palette[i % palette.length], borderRadius: opts.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
      data: s.data,
    })),
  };
  chart.setOption(option);
  const detach = attachResize(chart);
  return { chart, dispose: () => { detach(); chart.dispose(); } };
}

/** Donut chart from labelled slices. `totalLabel` shown in the centre. */
export async function donutChart(
  target: HTMLElement,
  slices: { name: string; value: number; color?: string }[],
  centreLabel?: string,
): Promise<{ chart: ECharts; dispose: () => void }> {
  const chart = await init(target);
  const palette = ['#16a34a', '#d97706', '#dc2626', '#2563eb', '#7c3aed', '#64748b'];
  const option: EChartsOption = {
    color: palette,
    animation: !prefersReducedMotion,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderColor: 'rgba(15,40,80,0.12)',
      borderWidth: 1,
      textStyle: { color: '#0f2240', fontSize: 12 },
      extraCssText: 'backdrop-filter: blur(6px); border-radius:10px;',
    } as unknown as NonNullable<EChartsOption['tooltip']>,
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: '#5b6b85', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 700, color: '#0f2240' },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(15,40,80,0.25)' },
        },
        data: slices.map((s) => ({
          name: s.name,
          value: s.value,
          itemStyle: s.color ? { color: s.color } : undefined,
        })),
      },
    ],
    graphic: centreLabel
      ? {
          type: 'text',
          left: 'center',
          top: '40%',
          style: { text: centreLabel, fontSize: 16, fontWeight: 700, fill: '#0f2240' },
        }
      : undefined,
  };
  chart.setOption(option);
  const detach = attachResize(chart);
  return { chart, dispose: () => { detach(); chart.dispose(); } };
}

/** Gauge chart 0–100, used for risk scores. */
export async function gaugeChart(
  target: HTMLElement,
  value: number,
  opts: { max?: number; label?: string; unit?: string } = {},
): Promise<{ chart: ECharts; dispose: () => void }> {
  const chart = await init(target);
  const max = opts.max ?? 100;
  const ratio = value / max;
  const color = ratio < 0.34 ? '#16a34a' : ratio < 0.67 ? '#d97706' : '#dc2626';
  const option: EChartsOption = {
    animation: !prefersReducedMotion,
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max,
        radius: '92%',
        center: ['50%', '58%'],
        progress: { show: true, width: 14, roundCap: true, itemStyle: { color } },
        pointer: { show: false },
        axisLine: { roundCap: true, lineStyle: { width: 14, color: [[1, 'rgba(148,163,184,0.18)']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, '28%'], color: '#5b6b85', fontSize: 12 },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-6%'],
          formatter: `{value}${opts.unit ?? ''}`,
          color: '#0f2240',
          fontSize: 22,
          fontWeight: 800,
        },
        data: [{ value, name: opts.label ?? '' }],
      },
    ],
  };
  chart.setOption(option);
  const detach = attachResize(chart);
  return { chart, dispose: () => { detach(); chart.dispose(); } };
}
