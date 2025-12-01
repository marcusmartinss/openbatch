# OpenBatch

Uma interface web segura e acessível para gerenciamento de jobs em clusters de Computação de Alto Desempenho (HPC) que utilizam **SLURM** em ambientes de nuvem privada.

O OpenBatch visa abstrair a complexidade da linha de comando, buscando oferecer um portal visual para pesquisadores e administradores submeterem cargas de trabalho, monitorarem recursos e gerenciarem arquivos.

---

## Arquitetura

O sistema segue uma arquitetura de três camadas, projetada para segurança e escalabilidade:

1.  **Frontend:** Desenvolvido em **React**. Comunica-se com o backend via API REST e WebSockets. O código roda no navegador do cliente e ajusta dinamicamente as conexões para o host correto.
2.  **Backend:** Desenvolvido em **Node.js**.
      - Atua como um *Gateway* seguro entre a web e o cluster.
      - Gerencia autenticação via **PAM** (integrado aos usuários Linux do sistema).
      - Executa comandos privilegiados com transição de contexto (`su`/`runuser`) para garantir que cada ação ocorra sob o UID/GID do usuário logado.
      - Utiliza `node-pty` para emulação de terminal via WebSocket.
3.  **Infraestrutura:**
      * **Gerenciador:** SLURM Workload Manager.
      * **Autenticação:** Munge.
      * **Isolamento:** Cgroups (v2) e Limites de Processos do Kernel.

---

## Funcionalidades

  - **Autenticação Integrada:** Login utilizando as credenciais de sistema do cluster (Linux/PAM/LDAP).
  - **Terminal Web:** Acesso total ao shell do usuário (`bash`) diretamente no navegador via [xterm.js](https://github.com/xtermjs/xterm.js).
  - **Monitoramento em Tempo Real:** Visualização de jobs (squeue), nós e recursos do cluster.
  - **Gestão de Módulos:** Upload seguro de arquivos `.zip` com varredura automática de **antivírus (ClamAV)** e extração automática no diretório do usuário.
  - **Submissão de Jobs:** Interface gráfica para criação de scripts `sbatch`.

-----

## Deploy Automatizado (Ansible)

Este projeto utiliza **Infraestrutura como Código (IaC)** para provisionar todo o ambiente, desde a configuração de rede até a aplicação.

### Pré-requisitos de Automação

  - Máquina de controle com **Ansible** instalado.
  - Acesso SSH às máquinas alvo (Manager e Workers).
  - Usuário com privilégios `sudo` nas máquinas alvo.

### 1\. Configuração do Inventário

Navegue até a pasta `ansible` e copie o exemplo:

```bash
cd ansible
cp inventory.example.ini inventory.ini
```

Edite o arquivo `inventory.ini` preenchendo os IPs e variáveis:

```ini
[slurm_controller]
# Defina o IP de conexão (ansible_host) e o IP estático desejado (static_ip)
manager0-tcc ansible_host=192.168.x.x interface_name=eth0 static_ip=192.168.122.10

[slurm_nodes]
worker0-tcc ansible_host=192.168.x.x interface_name=eth0 static_ip=192.168.122.11
worker1-tcc ansible_host=192.168.x.x interface_name=eth0 static_ip=192.168.122.12

[all:vars]
ansible_user=seu_usuario_ssh
# Defina uma senha forte para o banco de dados do Slurm
db_password="sua_senha_segura"
```

### 2\. Execução dos Playbooks

A implantação é dividida em 3 fases para garantir estabilidade:

**Fase 1: Rede Base**
Configura IPs estáticos e resolução de nomes (`/etc/hosts`) em todos os nós.

```bash
ansible-playbook 01-network-config.yaml --ask-become-pass
```

> *Nota: A conexão SSH pode cair momentaneamente durante a troca de IP.*

**Fase 2: Cluster SLURM**
Instala Munge, Slurm (Controller/DB/D), MariaDB e configura Cgroups e limites de segurança.

```bash
ansible-playbook 02-slurm-config.yaml --ask-become-pass
```

**Fase 3: Aplicação OpenBatch**
Instala Node.js, ClamAV, compila o frontend e configura o serviço systemd no Manager.

```bash
ansible-playbook 03-deploy-openbatch.yaml --ask-become-pass
```

-----

## Desenvolvimento e Execução Manual

Para rodar o projeto localmente ou desenvolver novas features.

### 1\. Pré-requisitos Locais

  - Node.js (v18+)
  - Compiladores C++ (`build-essential` ou equivalente)
  - Headers PAM (`libpam0g-dev`)

### 2\. Instalação

Clone o repositório e instale as dependências na pasta do projeto:

```bash
git clone https://github.com/marcusmartinss/openbatch.git
cd openbatch/openbatch
npm install
```

### 3\. Execução

#### Compilar o Frontend

Gera os arquivos estáticos na pasta `dist/`.

```bash
npm run build
```

#### Iniciar o Backend

Para que a autenticação PAM e a criação de terminais funcionem plenamente, o backend deve ter permissões elevadas (ou rodar como root).

```bash
sudo npm start
```

O terminal exibirá:

> `Servidor OpenBatch rodando em http://localhost:8080`

Acesse em seu navegador: **http://localhost:8080**

-----

## Segurança

O projeto segue práticas de **DevSecOps** e _Hardening_:

  - **Anti-Malware:** Todos os uploads passam por scan do ClamAV antes de serem processados.
  - **Validação de Input:** Verificação contra ataques "Zip Slip" e bloqueio de extensões executáveis perigosas.
  - **Proteção de Recursos:** Configuração de `limits.conf` para evitar _Fork Bombs_.
  - **Isolamento:** Jobs do Slurm rodam dentro de Cgroups dedicados.
