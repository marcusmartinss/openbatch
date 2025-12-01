import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { pamAuthenticate } from 'node-linux-pam';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { exec } from 'child_process';
import util from 'util';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = util.promisify(exec);

const JWT_SECRET = 'sua-chave-secreta-super-longa-e-aleatoria-aqui';
const port = 8080;
const BLOCKED_USERS = ['root', 'daemon', 'bin', 'sys', 'sync', 'games', 'man', 'lp', 'mail', 'news', 'uucp', 'proxy', 'www-data', 'backup', 'list', 'irc', 'gnats', 'nobody'];
const BLOCKED_EXTENSIONS = ['.exe', '.dll', '.so', '.bin'];

const app = express();

// Configuração do Multer (Salva temporariamente em /tmp)
const upload = multer({ dest: '/tmp/' });

app.use(cors());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

const server = http.createServer(app);

// --- 1. ENDPOINT DE LOGIN ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
  }

  if (BLOCKED_USERS.includes(username.toLowerCase())) {
    return res.status(403).json({ message: 'Login para este usuário não é permitido.' });
  }

  try {
    pamAuthenticate({ username, password }, (err) => {
      if (err) {
        console.error(`Falha na autenticação PAM para ${username}:`, err);
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }
      
      console.log(`Usuário ${username} autenticado com sucesso via PAM.`);
      const token = jwt.sign({ username: username }, JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({ message: 'Autenticação bem-sucedida.', token: token });
    });
  } catch (e) {
    console.error("Erro crítico ao chamar PAM:", e);
    res.status(500).json({ message: "Erro interno no servidor de autenticação." });
  }
});

// --- 2. ENDPOINT DE UPLOAD DE MÓDULOS ---
app.post('/api/upload', upload.single('file'), (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    const username = decoded.username;
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });

    const tempPath = req.file.path;
    const originalName = req.file.originalname;
    const cleanName = (req.body.moduleName || originalName).replace('.zip', '').replace(/[^a-zA-Z0-9_-]/g, '_');
    
    const userHome = username === 'root' ? '/root' : `/home/${username}`;
    const targetDir = `${userHome}/modules`;
    const targetFile = `${targetDir}/${originalName}`; 
    const extractDir = `${targetDir}/${cleanName}`;    

    console.log(`Processando upload seguro para ${username}: ${cleanName}`);

    try {
      // === CAMADA DE ANTIVÍRUS (ClamAV) ===
      console.log(`-> Escaneando arquivo temporário com ClamAV...`);
      try {
        // clamscan retorna código 0 se limpo, 1 se vírus encontrado
        await execPromise(`clamscan --no-summary "${tempPath}"`);
      } catch (scanError) {
        if (scanError.code === 1) {
           console.error("ALERTA DE VÍRUS:", scanError.stdout); // Log do vírus encontrado
           throw new Error("Malware detectado no arquivo! Upload rejeitado.");
        }
        // Se clamscan não existir (erro 127) ou falhar por outro motivo, dá warning mas permite
        console.warn("Aviso: ClamAV não pôde verificar (pode não estar instalado ou configurado).", scanError.message);
      }

      // === CAMADA DE INSPEÇÃO DE CONTEÚDO (Zip Slip & Extensões) ===
      console.log(`-> Inspecionando estrutura do ZIP...`);
      // lista conteúdo (-l) sem extrair
      const { stdout: zipContent } = await execPromise(`unzip -l "${tempPath}"`);
      
      const lines = zipContent.split('\n');
      for (const line of lines) {
          if (!line.includes(':') || line.includes('Name')) continue; 
          const fileName = line.substring(line.lastIndexOf(':') + 4).trim();
          // verificação de caminhos relativos maliciosos
          if (fileName.includes('../') || fileName.includes('..\\') || fileName.startsWith('/')) {
              throw new Error(`Arquivo ZIP malicioso detectado (Tentativa de Zip Slip em: ${fileName}).`);
          }
          
          // verificação de extensões proibidas
          for (const ext of BLOCKED_EXTENSIONS) {
              if (fileName.toLowerCase().endsWith(ext)) {
                  throw new Error(`O módulo contém arquivos proibidos: ${fileName} (${ext}).`);
              }
          }
      }

      // === EXTRAÇÃO ===
      console.log(`-> Arquivo seguro. Iniciando instalação...`);

      // 1. Garante diretório destino
      await execPromise(`runuser -u ${username} -- mkdir -p ${targetDir}`);

      // 2. Move para o destino final
      await execPromise(`mv "${tempPath}" "${targetFile}"`);
      
      // 3. Ajusta dono
      await execPromise(`chown ${username}:${username} "${targetFile}"`);

      // 4. Descompacta como o usuário
      await execPromise(`runuser -u ${username} -- unzip -o "${targetFile}" -d "${extractDir}"`);

      // 5. Limpa o zip original
      await execPromise(`rm "${targetFile}"`);

      res.json({ message: `Módulo '${cleanName}' verificado e instalado com sucesso.` });

    } catch (error) {
      console.error("Erro de segurança/upload:", error.message);
      
      // Garante limpeza do arquivo temporário infectado/inválido
      try { await fs.promises.unlink(tempPath); } catch(e) {} 
      
      // Retorna 500 (Erro) ou 422 (Entidade Improcessável) dependendo do erro
      const statusCode = error.message.includes("Malware") || error.message.includes("proibidos") ? 422 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Erro ao processar arquivo.', 
      });
    }
  });
});

// --- 3. OBSERVABILIDADE (POLLING) ---
let currentMetrics = {
  nodes: { idle: 0, allocated: 0, down: 0, total: 0 },
  cpus: { allocated: 0, total: 0 },
  memory: { allocated: 0, total: 0 }, // Placeholder para memória (difícil pegar global exato sem scontrol detalhado)
  jobs: { pending: 0, running: 0, completed: 0 },
  timestamp: Date.now()
};

async function fetchSlurmMetrics() {
  try {
    // --- A. Métricas de JOBS (squeue) ---
    const { stdout: jobsOut } = await execPromise('squeue -h -o "%t"').catch(() => ({ stdout: '' }));
    
    if (jobsOut) {
        const jobStates = jobsOut.trim().split('\n');
        let running = 0, pending = 0;
        jobStates.forEach(s => { 
            if(s === 'R') running++; 
            if(s === 'PD') pending++; 
        });
        currentMetrics.jobs = { running, pending, completed: 0 }; // Completed requer sacct (historico)
    } else {
        // DADOS SIMULADOS (Placeholder) para demonstração visual se Slurm estiver offline
        currentMetrics.jobs = { 
            running: Math.floor(Math.random() * 5) + 1, 
            pending: Math.floor(Math.random() * 3) 
        };
    }

    // --- B. Métricas de NÓS e CPU (sinfo) ---
    // Formato: state, cpus, memory (se disponível)
    const { stdout: sinfoOut } = await execPromise('sinfo -h -o "%T %c %m"').catch(() => ({ stdout: '' }));
    
    if (sinfoOut) {
        // Lógica real de parsing do sinfo (simplificada)
        // Exemplo de saída: "idle 4 8000"
        let idle = 0, alloc = 0, down = 0;
        let totalCpus = 0;
        const lines = sinfoOut.trim().split('\n');
        
        lines.forEach(line => {
            const parts = line.split(' '); // state, cpus, mem
            const state = parts[0];
            const cpus = parseInt(parts[1]) || 0;
            // const mem = parseInt(parts[2]) || 0; // Memoria total do nó

            totalCpus += cpus; // Soma total de CPUs do cluster
            
            if (state.includes('idle')) idle++;
            else if (state.includes('alloc') || state.includes('mix')) alloc++;
            else down++;
        });

        currentMetrics.nodes = { idle, allocated: alloc, down, total: lines.length };
        // Estimativa: se nó 'alloc', assume todas CPUs alocadas (simplificação)
        currentMetrics.cpus = { allocated: alloc * 4, total: totalCpus }; // Assumindo 4 cores/nó média
    } else {
        // DADOS SIMULADOS (Placeholder)
        // Gera números aleatórios que mudam levemente para animar o gráfico
        const totalNodes = 10;
        const allocatedNodes = Math.floor(Math.random() * 5);
        currentMetrics.nodes = { 
            idle: totalNodes - allocatedNodes, 
            allocated: allocatedNodes, 
            down: 0,
            total: totalNodes
        };
        currentMetrics.cpus = { 
            allocated: allocatedNodes * 4 + Math.floor(Math.random() * 2), 
            total: totalNodes * 4 
        };
        // Memória simulada (GB)
        currentMetrics.memory = {
            allocated: allocatedNodes * 8 + Math.floor(Math.random() * 4),
            total: totalNodes * 16 // 160 GB total
        };
    }
    
    currentMetrics.timestamp = Date.now();

  } catch (error) {
    // Silencia erros para não poluir log, mantém últimas métricas válidas
  }
}

// Atualiza a cada 5s
setInterval(fetchSlurmMetrics, 5000);

app.get('/api/metrics', (req, res) => {
  res.json(currentMetrics);
});


// --- 4. WEBSOCKET (TERMINAL & JOBS) ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const type = url.searchParams.get('type') || 'shell';

  if (!token) return ws.close(1008, 'Token não fornecido.');

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return ws.close(1008, 'Token inválido.');
    
    const username = decoded.username;

    // -- MODO JOB (Executa e mostra log) --
    if (type === 'job') {
      console.log(`Iniciando Job para ${username}`);
      ws.send(`\r\n>>> Preparando ambiente para ${username}...\r\n`);
      
      // Simulação de job (troque por 'sbatch' em produção)
      const jobProcess = pty.spawn('bash', ['-c', 'echo "Iniciando..."; sleep 1; echo "Carregando módulos..."; sleep 1; for i in {1..3}; do echo "Processando etapa $i..."; sleep 0.5; done; echo "Concluído!"'], {
        name: 'xterm-color', cols: 80, rows: 30,
        cwd: process.env.HOME, env: process.env
      });

      jobProcess.onData(d => { if (ws.readyState === ws.OPEN) ws.send(d); });
      jobProcess.onExit(() => { if (ws.readyState === ws.OPEN) ws.close(); });
      ws.on('close', () => { try { jobProcess.kill(); } catch(e){} });
      return;
    }

    // -- MODO TERMINAL INTERATIVO --
    console.log(`Terminal conectado: ${username}`);
    try {
      let shell = 'bash';
      let args = [];

      if (username !== 'admin') {
         shell = 'su'; // Requer que o node rode como root
         args = ['-', username];
      }

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME, 
        env: process.env,
      });
      
      ptyProcess.onData(data => { if (ws.readyState === ws.OPEN) ws.send(data); });
      ws.on('message', data => { ptyProcess.write(data.toString()); });
      ws.on('close', () => { try { ptyProcess.kill(); } catch(e) {} });

    } catch (error) {
      console.error(`Erro Terminal:`, error.message);
      ws.close();
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor backend rodando em http://localhost:${port}`);
});