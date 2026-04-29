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
import { MemoryChartsProps } from '../../../../../interfaces/ContainerInterfaces';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale);

function MemoryChartBase({ percentPoints, usageMBPoints }: MemoryChartsProps) {
  const data = {
    labels: percentPoints.map((point) => point.time),
    datasets: [
      {
        label: 'Memória (%)',
        data: percentPoints.map((point) => point.value),
        borderWidth: 2,
        borderColor: '#ff4d4d',
        backgroundColor: '#ff4d4d',
        pointRadius: 3,
        tension: 0.25,
        fill: true,
        pointHoverRadius: 5,
      },
      {
        label: 'Uso (MB)',
        data: usageMBPoints.map((point) => point.value),
        borderWidth: 2,
        borderColor: '#4dff4d',
        backgroundColor: '#4dff4d',
        pointRadius: 3,
        tension: 0.25,
        fill: true,
        pointHoverRadius: 5,
        yAxisID: 'y1',
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (context: any) =>
            context.dataset.yAxisID === 'y1'
              ? `Uso: ${context.parsed.y.toFixed(1)} MB`
              : `Mem: ${context.parsed.y.toFixed(1)}%`,
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
      y1: {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: { callback: (value: any) => `${value} MB` },
      },
    },
  };

  return <Line data={data} options={options} />;
}

export const MemoryChart = memo(MemoryChartBase);
