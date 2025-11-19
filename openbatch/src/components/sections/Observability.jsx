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

const barOptions = {
  responsive: true,
  indexAxis: 'y',
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: true,
      font: {
        size: 16,
      },
      color: '#E0E0E0',
    },
  },
  scales: {
    x: {
      ticks: { color: '#E0E0E0' },
      grid: { color: 'rgba(224, 224, 224, 0.2)' },
    },
    y: {
      ticks: { color: '#E0E0E0' },
      grid: { display: false },
    },
  },
};

const doughnutOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#E0E0E0',
      },
    },
    title: {
      display: true,
      text: 'Status dos Nós',
      font: {
        size: 16,
      },
      color: '#E0E0E0',
    },
  },
};

function Observability() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    // Busca os dados da nossa API backend
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics');
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error('Erro ao buscar métricas:', error);
        // Em caso de falha, usamos dados mockados para desenvolvimento
        setMetrics(getMockData());
      }
    };

    fetchMetrics();
  }, []);

  // Função que retorna dados mockados
  const getMockData = () => ({
    nodes: { idle: 120, allocated: 75, down: 5 },
    cpus: { allocated: 3000, total: 4800 },
    memory: { allocated: 12000, total: 24000 },
    jobs: { pending: 150, running: 320 },
  });

  if (!metrics) {
    return <div className="loading">Carregando métricas...</div>;
  }

  // --- Processamento dos dados para os gráficos ---

  const nodeData = {
    labels: ['Ociosos', 'Alocados', 'Inativos'],
    datasets: [
      {
        data: [metrics.nodes.idle, metrics.nodes.allocated, metrics.nodes.down],
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)', // Ocioso (Verde/Azul)
          'rgba(255, 159, 64, 0.8)', // Alocado (Laranja)
          'rgba(255, 99, 132, 0.8)', // Inativo (Vermelho)
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const cpuData = {
    labels: [''],
    datasets: [
      {
        label: 'CPUs Alocadas',
        data: [metrics.cpus.allocated],
        backgroundColor: 'rgba(255, 159, 64, 0.8)',
        borderColor: 'rgba(255, 159, 64, 1)',
      },
      {
        label: 'CPUs Livres',
        data: [metrics.cpus.total - metrics.cpus.allocated],
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
      },
    ],
  };
  
  const cpuOptions = JSON.parse(JSON.stringify(barOptions));
  cpuOptions.plugins.title.text = `Utilização de CPUs (${metrics.cpus.allocated} / ${metrics.cpus.total})`;
  cpuOptions.scales.x.stacked = true;
  cpuOptions.scales.y.stacked = true;

  const memoryData = {
    labels: [''],
    datasets: [
      {
        label: 'Memória Alocada (GB)',
        data: [metrics.memory.allocated],
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
      },
      {
        label: 'Memória Livre (GB)',
        data: [metrics.memory.total - metrics.memory.allocated],
        backgroundColor: 'rgba(153, 102, 255, 0.8)',
        borderColor: 'rgba(153, 102, 255, 1)',
      },
    ],
  };

  const memoryOptions = JSON.parse(JSON.stringify(barOptions));
  memoryOptions.plugins.title.text = `Utilização de Memória (${metrics.memory.allocated}GB / ${metrics.memory.total}GB)`;
  memoryOptions.scales.x.stacked = true;
  memoryOptions.scales.y.stacked = true;


  const jobData = {
    labels: ['Pendentes', 'Em Execução'],
    datasets: [
      {
        label: 'Contagem de Jobs',
        data: [metrics.jobs.pending, metrics.jobs.running],
        backgroundColor: [
          'rgba(255, 206, 86, 0.8)', // Pendente (Amarelo)
          'rgba(75, 192, 192, 0.8)', // Em Execução (Verde/Azul)
        ],
        borderColor: [
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  const jobOptions = JSON.parse(JSON.stringify(barOptions));
  jobOptions.plugins.title.text = 'Fila de Jobs';
  jobOptions.indexAxis = 'x';
  jobOptions.scales.y.stacked = false;
  jobOptions.scales.x.stacked = false;


  return (
    <div className="observability-grid">
      <div className="chart-container">
        <Doughnut data={nodeData} options={doughnutOptions} />
      </div>
      <div className="chart-container">
        <Bar data={cpuData} options={cpuOptions} />
      </div>
      <div className="chart-container">
        <Bar data={memoryData} options={memoryOptions} />
      </div>
      <div className="chart-container">
        <Bar data={jobData} options={jobOptions} />
      </div>
    </div>
  );
}

export default Observability;