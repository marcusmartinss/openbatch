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
    // Remove .zip e limpa caracteres estranhos para segurança
    const cleanName = (req.body.moduleName || originalName).replace('.zip', '').replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Caminho de destino
    const userHome = username === 'root' ? '/root' : `/home/${username}`;
    const targetDir = `${userHome}/modules`;
    const targetFile = `${targetDir}/${originalName}`; 
    const extractDir = `${targetDir}/${cleanName}`;    

    console.log(`Processando upload para ${username}: ${cleanName}`);

    try {
      // Cria a pasta 'modules' se não existir
      await execPromise(`runuser -u ${username} -- mkdir -p ${targetDir}`);

      // 2. Copia o arquivo
      await execPromise(`cp "${tempPath}" "${targetFile}"`);
      
      // 3. Ajuste de permissões
      await execPromise(`chown ${username}:${username} "${targetFile}"`);

      // 4. Descompacta como o usuário
      await execPromise(`runuser -u ${username} -- unzip -o "${targetFile}" -d "${extractDir}"`);

      // 5. Remove zip do destino e o temp do multer
      await execPromise(`rm "${targetFile}"`);
      await fs.promises.unlink(tempPath);

      res.json({ message: `Módulo '${cleanName}' instalado com sucesso em ~/modules/${cleanName}` });

    } catch (error) {
      console.error("Erro no upload:", error);
      try { await fs.promises.unlink(tempPath); } catch(e) {} 
      
      res.status(500).json({ 
        message: 'Erro ao processar arquivo. Verifique permissões e se "unzip" está instalado.', 
        details: error.message 
      });
    }
  });
});

// --- 3. OBSERVABILIDADE (POLLING) ---
let currentMetrics = {
  nodes: { idle: 0, allocated: 0, down: 0 },
  cpus: { allocated: 0, total: 0 },
  memory: { allocated: 0, total: 0 },
  jobs: { pending: 0, running: 0 },
};

async function fetchSlurmMetrics() {
  try {
    // Coleta status dos Jobs
    const { stdout: jobsOut } = await execPromise('squeue -h -o "%t"').catch(() => ({ stdout: '' }));
    const jobStates = jobsOut.trim().split('\n');
    let jobsRunning = 0, jobsPending = 0;
    jobStates.forEach(s => { if(s==='R') jobsRunning++; if(s==='PD') jobsPending++; });

    // Tenta coletar dados reais ou usa fallback se falhar
    currentMetrics.jobs = { pending: jobsPending, running: jobsRunning };
    
    // Simula variação nos nós se não tiver Slurm real para ver o gráfico mexer
    if (jobsOut === '') {
        currentMetrics.nodes.idle = Math.floor(Math.random() * 10) + 100;
        currentMetrics.cpus.allocated = Math.floor(Math.random() * 500) + 1000;
    }

  } catch (error) {
    // Silencia erros de comando não encontrado para não poluir o log
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