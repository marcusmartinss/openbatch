# Openbatch

Uma interface web simples e moderna para gerenciar jobs e acessar terminais em clusters de Computação de Alto Desempenho (HPC) que utilizam o SLURM.

Este projeto abstrai a complexidade da linha de comando, oferecendo um portal visual para submeter, monitorar e gerenciar trabalhos computacionais.

## Funcionalidades

- **Autenticação Segura:** Login integrado com os usuários do sistema Linux do cluster (via PAM).

- **Submissão de Jobs:** Envie trabalhos para a fila do SLURM em poucos cliques ou usando um editor de script integrado.

- **Gestão de Dependências:** Envie arquivos .zip diretamente para seu diretório home no cluster.

- **Terminal Web Integrado:** Acesso ao shell do usuário do nó de gerenciamento através do navegador, usando xterm.js.

## Como executar?

### 1. Pré-requisitos no Servidor

Certifique-se de que o ambiente (o nó mestre do cluster) tenha:

- Node.js instalado.
- Ferramentas de compilação.
- Biblioteca de desenvolvimento do PAM.

### 2. Instalação e Execução

#### Clone o repositório e instale as dependências:

```bash
git clone https://github.com/marcusmartinss/openbatch.git
cd openbatch
npm install
```

#### Compile a interface (Frontend):

Este comando cria a pasta dist/ com a versão otimizada do site.

```bash
npm run build
```

#### Inicie o servidor (Backend):


É necessário usar sudo para que o servidor possa criar terminais para os usuários do sistema.

```bash
npm run build
```

O terminal deverá exibir a mensagem: `Servidor HTTP e WebSocket rodando em http://localhost:8080.`

### 3. Acesso

Abra seu navegador e acesse a aplicação em:

http://localhost:8080
