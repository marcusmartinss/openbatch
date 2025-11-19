import React, { useState, useEffect } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

// Opções padrão para os gráficos de barras
const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y', 
  plugins: {
    legend: {
      display: false, 
    },
    title: {
      display: true,
      font: { size: 14, family: "'Segoe UI', sans-serif" },
      color: '#E0E0E0',
      align: 'start',
      padding: { bottom: 20 }
    },
  },
  scales: {
    x: {
      ticks: { color: '#94A3B8', font: { size: 10 } },
      grid: { color: 'rgba(224, 224, 224, 0.1)' },
    },
    y: {
      ticks: { color: '#E0E0E0', font: { size: 11 } },
      grid: { display: false },
    },
  },
};

// Opções para o gráfico circular
const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: '#E0E0E0',
        boxWidth: 12,
        padding: 15,
        font: { size: 11 }
      },
    },
    title: {
      display: true,
      text: 'Status dos Nós',
      font: { size: 14, family: "'Segoe UI', sans-serif" },
      color: '#E0E0E0',
      align: 'start',
      padding: { bottom: 20 }
    },
  },
};

function Observability() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics');
        if (!response.ok) throw new Error('Falha na API');
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error('Erro ao buscar métricas, usando mock:', error);
        setMetrics(getMockData());
      }
    };

    // Polling a cada 5 segundos para dados em tempo real
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const getMockData = () => ({
    nodes: { idle: 120, allocated: 75, down: 5 },
    cpus: { allocated: 3000, total: 4800 },
    memory: { allocated: 12000, total: 24000 }, 
    jobs: { pending: 150, running: 320 },
  });

  if (!metrics) {
    return <div className="loading">Carregando métricas...</div>;
  }

  // Dados dos Gráficos
  const nodeData = {
    labels: ['Ociosos', 'Alocados', 'Inativos'],
    datasets: [{
      data: [metrics.nodes.idle, metrics.nodes.allocated, metrics.nodes.down],
      backgroundColor: ['#38BDF8', '#F59E0B', '#EF4444'], // Cores mais modernas
      borderWidth: 0,
      hoverOffset: 4
    }],
  };

  const cpuData = {
    labels: [''], 
    datasets: [
      { label: 'Alocadas', data: [metrics.cpus.allocated], backgroundColor: '#F59E0B', borderRadius: 4 },
      { label: 'Livres', data: [metrics.cpus.total - metrics.cpus.allocated], backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 4 },
    ],
  };
  
  const cpuOpts = JSON.parse(JSON.stringify(barOptions));
  cpuOpts.plugins.title.text = `CPUs (${metrics.cpus.allocated} / ${metrics.cpus.total})`;
  cpuOpts.scales.x.stacked = true;
  cpuOpts.scales.y.stacked = true;

  const memData = {
    labels: [''],
    datasets: [
      { label: 'Usada (GB)', data: [metrics.memory.allocated], backgroundColor: '#8B5CF6', borderRadius: 4 },
      { label: 'Livre (GB)', data: [metrics.memory.total - metrics.memory.allocated], backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 4 },
    ],
  };

  const memOpts = JSON.parse(JSON.stringify(barOptions));
  memOpts.plugins.title.text = `Memória (${metrics.memory.allocated}GB / ${metrics.memory.total}GB)`;
  memOpts.scales.x.stacked = true;
  memOpts.scales.y.stacked = true;

  const jobData = {
    labels: ['Pendentes', 'Executando'],
    datasets: [{
      label: 'Jobs',
      data: [metrics.jobs.pending, metrics.jobs.running],
      backgroundColor: ['#F59E0B', '#10B981'],
      borderRadius: 4,
      barThickness: 100
    }],
  };
  
  const jobOpts = JSON.parse(JSON.stringify(barOptions));
  jobOpts.indexAxis = 'x'; 
  jobOpts.plugins.title.text = 'Fila de Jobs';
  jobOpts.plugins.legend.display = false;

  return (
    <div className="observability-grid">
      <div className="chart-container">
        <Doughnut data={nodeData} options={doughnutOptions} />
      </div>
      <div className="chart-container">
        <Bar data={cpuData} options={cpuOpts} />
      </div>
      <div className="chart-container">
        <Bar data={memData} options={memOpts} />
      </div>
      <div className="chart-container">
        <Bar data={jobData} options={jobOpts} />
      </div>
    </div>
  );
}

export default Observability;