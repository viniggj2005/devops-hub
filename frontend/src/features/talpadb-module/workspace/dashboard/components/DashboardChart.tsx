import { memo } from 'react';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';
import {
  Filler,
  Legend,
  Tooltip,
  TimeScale,
  LinearScale,
  LineElement,
  PointElement,
  CategoryScale,
  Chart as ChartJS,
} from 'chart.js';
import { useTheme } from '../../../../../hooks/use-theme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

export interface DashboardSample {
  time: number;
  [key: string]: number;
}

interface DashboardChartProps {
  title: string;
  samples: DashboardSample[];
  series: { key: string; label: string; color: string }[];
  decimals?: number;
}

function DashboardChartBase({ title, samples, series, decimals = 0 }: DashboardChartProps) {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? '#a1a1aa' : '#6b7280';

  const data = {
    datasets: series.map((item) => ({
      label: item.label,
      data: samples.map((sample) => ({ x: sample.time, y: sample[item.key] })),
      borderColor: item.color,
      backgroundColor: `${item.color}22`,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
    })),
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, boxHeight: 10, color: textColor, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (context: any) =>
            `${context.dataset.label}: ${Number(context.parsed.y).toFixed(decimals)}`,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'second', tooltipFormat: 'HH:mm:ss', displayFormats: { second: 'HH:mm:ss' } },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          color: textColor,
          font: { size: 10 },
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: textColor, font: { size: 10 }, precision: decimals ? undefined : 0 },
        grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
      },
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] p-4 h-64 flex flex-col">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{title}</h4>
      <div className="flex-1 min-h-0">
        {samples.length < 2 ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-400">
            Coletando amostras…
          </div>
        ) : (
          <Line data={data} options={options} />
        )}
      </div>
    </div>
  );
}

export const DashboardChart = memo(DashboardChartBase);
