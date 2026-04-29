import { memo } from 'react';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';
import {
  Legend,
  Tooltip,
  TimeScale,
  LinearScale,
  LineElement,
  PointElement,
  CategoryScale,
  Chart as ChartJS,
} from 'chart.js';
import { CpuChartsProps } from '../../../../../interfaces/ContainerInterfaces';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale);

function CPUChartBase({ points }: CpuChartsProps) {
  const data = {
    labels: points.map((point) => point.time),
    datasets: [
      {
        label: 'CPU (%)',
        data: points.map((point) => point.value),
        borderWidth: 2,
        pointRadius: 3,
        borderColor: '#f79a05',
        backgroundColor: '#f79a05',
        fill: true,
        pointRadiusHover: 5,
        tension: 0.25,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context: any) => `CPU: ${context.parsed.y.toFixed(1)}%` } },
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'second', tooltipFormat: 'HH:mm:ss', displayFormats: { second: 'HH:mm:ss' } },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 20,
          maxTicksLimit: 8,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        suggestedMax: 100,
        ticks: { callback: (value: any) => `${value}%` },
        grid: { color: 'rgba(255,255,255,0.07)' },
      },
    },
  };

  return <Line data={data} options={options} />;
}

export const CPUChart = memo(CPUChartBase);
