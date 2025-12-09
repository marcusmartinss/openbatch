import 'dotenv/config'
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
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

const port = 8080;
const BLOCKED_USERS = ['root', 'daemon', 'bin', 'sys', 'sync', 'games', 'man', 'lp', 'mail', 'news', 'uucp', 'proxy', 'www-data', 'backup', 'list', 'irc', 'gnats', 'nobody'];
const BLOCKED_EXTENSIONS = ['.exe', '.dll', '.so', '.bin'];

const app = express();
const upload = multer({ dest: '/tmp/' });

app.use(cors());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

const server = http.createServer(app);

// --- 1. LOGIN ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Campos obrigatórios.' });

    if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.status(200).json({ message: 'Login DEV.', token });
    }

    if (BLOCKED_USERS.includes(username.toLowerCase())) return res.status(403).json({ message: 'Usuário bloqueado.' });

    try {
        pamAuthenticate({ username, password }, (err) => {
        if (err) {
            console.error(`Erro PAM ${username}:`, err);
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Sucesso.', token });
        });
    } catch (e) {
        res.status(500).json({ message: "Erro interno PAM." });
    }
});

// --- 2. ENDPOINT DE UPLOAD DE MÓDULOS ---
app.post('/api/upload', upload.single('file'), (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
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

// --- 3. OBSERVABILIDADE ---
let currentMetrics = {
    nodes: { idle: 0, allocated: 0, down: 0, total: 0 },
    cpus: { allocated: 0, total: 0 },
    memory: { allocated: 0, total: 0 },
    jobs: { pending: 0, running: 0 },
};

async function fetchMetrics() {
try {
    // A. Jobs (squeue)
    const { stdout: jobsOut } = await execPromise('squeue -h -o "%t"').catch(() => ({ stdout: '' }));
    if (jobsOut) {
        const lines = jobsOut.trim().split('\n');
        let r = 0, p = 0;
        lines.forEach(l => { if(l==='R') r++; if(l==='PD') p++; });
        currentMetrics.jobs = { running: r, pending: p };
    }

    // B. Nodes & CPUs (sinfo)
    // Coleta: Estado (%T), CPUs (%c), Memória (%m)
    // Exemplo de saída: "idle 40 128000"
    const { stdout: sinfoOut } = await execPromise('sinfo -h -o "%T %c %m"').catch(() => ({ stdout: '' }));
    
    if (sinfoOut) {
        let idle = 0, alloc = 0, down = 0;
        let totalCpus = 0;
        let allocCpus = 0;
        let totalMem = 0;
        let allocMem = 0; // Estimativa baseada em nós alocados

        const lines = sinfoOut.trim().split('\n');
        
        lines.forEach(line => {
            if (!line.trim()) return;
            const parts = line.split(/\s+/); // Separa por espaços
            const state = parts[0];
            const cpus = parseInt(parts[1]) || 0;
            const memMB = parseInt(parts[2]) || 0;

            totalCpus += cpus;
            totalMem += memMB;

            if (state.includes('idle')) {
                idle++;
            } else if (state.includes('alloc') || state.includes('mix')) {
                alloc++;
                allocCpus += cpus; // Simplificação: se o nó está alocado, contamos seus CPUs
                allocMem += memMB;
            } else if (state.includes('down') || state.includes('drain') || state.includes('fail')) {
                down++;
            }
        });

        // Converte Memória para GB para facilitar a leitura
        const totalMemGB = Math.round(totalMem / 1024);
        const allocMemGB = Math.round(allocMem / 1024);

        currentMetrics.nodes = { idle, allocated: alloc, down, total: lines.length };
        currentMetrics.cpus = { allocated: allocCpus, total: totalCpus };
        currentMetrics.memory = { allocated: allocMemGB, total: totalMemGB };
    }

} catch (e) {
    // Em caso de erro (ex: comando sinfo não encontrado no dev), mantemos os valores antigos ou zeros
    console.error("Erro ao coletar métricas:", e.message);
}
}

// Inicia o polling a cada 5 segundos
setInterval(fetchMetrics, 5000);
// Executa imediatamente ao iniciar
fetchMetrics();

app.get('/api/metrics', (req, res) => res.json(currentMetrics));

// --- 4. WEBSOCKET (TERMINAL & JOBS) ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
const url = new URL(req.url, `http://${req.headers.host}`);
const token = url.searchParams.get('token');
const type = url.searchParams.get('type') || 'shell';

if (!token) return ws.close(1008, 'Token ausente');

jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return ws.close(1008, 'Token inválido');
    const username = decoded.username;

    // --- EXECUÇÃO DE JOB (Executa e mostra log) ---
    if (type === 'job') {
    console.log(`Job iniciado por ${username}`);
    
    // Espera o payload JSON com o script/comando
    ws.on('message', async (msg) => {
        try {
        const data = JSON.parse(msg);
        const { payload, type: jobType } = data; // 'command' ou 'script'
        
        ws.send(`>>> Recebido ${jobType}. Preparando execução...\r\n`);

        const timestamp = Date.now();
        const scriptName = `job_${timestamp}.sh`;
        const userHome = username === 'admin' ? '/tmp' : `/home/${username}`;
        const scriptDir = `${userHome}/.openbatch_jobs`;
        const scriptPath = `${scriptDir}/${scriptName}`;

        // Cria via root, move para usuário
        const tempFile = `/tmp/${scriptName}`;
        await fs.promises.writeFile(tempFile, payload);
        await execPromise(`runuser -u ${username} -- mkdir -p ${scriptDir}`);
        await execPromise(`cp "${tempFile}" "${scriptPath}"`);
        await execPromise(`chown ${username}:${username} "${scriptPath}"`);
        await execPromise(`chmod +x "${scriptPath}"`);
        await fs.promises.unlink(tempFile);

        ws.send(`>>> Script salvo em: ${scriptPath}\r\n`);
        ws.send(`>>> Executando...\r\n\r\n`);

        // Define o comando. Se 'command', executa direto no bash? 
        // Melhor prática: Sempre executar o script salvo para garantir ambiente.
        let cmd = 'bash';
        let args = ['-c', scriptPath];

        if (username !== 'admin') {
            cmd = 'su';
            // Executa como o usuário login shell
            args = ['-', username, '-c', scriptPath];
        }

        const jobProcess = pty.spawn(cmd, args, {
            name: 'xterm-color', cols: 80, rows: 30,
            cwd: userHome, env: process.env
        });

        jobProcess.onData(d => { if (ws.readyState === ws.OPEN) ws.send(d); });
        jobProcess.onExit(() => { 
            if (ws.readyState === ws.OPEN) {
            ws.send('\r\n>>> Execução finalizada.\r\n');
            ws.close(); 
            }
        });
        
        ws.on('close', () => { try { jobProcess.kill(); } catch(e){} });

        } catch (e) {
        ws.send(`\r\nErro ao processar job: ${e.message}\r\n`);
        ws.close();
        }
    });
    return;
    }

    // --- TERMINAL INTERATIVO ---
    try {
    let shell = 'bash';
    let args = [];
    if (username !== 'admin') { shell = 'su'; args = ['-', username]; }

    const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-color', cols: 80, rows: 30,
        cwd: process.env.HOME, env: process.env
    });
    
    ptyProcess.onData(data => { if (ws.readyState === ws.OPEN) ws.send(data); });
    ws.on('message', data => { ptyProcess.write(data.toString()); });
    ws.on('close', () => { try { ptyProcess.kill(); } catch(e) {} });
    } catch (e) {
    ws.close();
    }
});
});

server.listen(port, () => console.log(`Backend rodando na porta ${port}`));