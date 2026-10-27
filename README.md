# Docker Manager (Wails)

Aplicação desktop construída com [Wails](https://wails.io/) que une backend em Go e frontend em React + Vite para gerenciar containers Docker e hosts remotos a partir de uma única interface.


## Visão geral

A ferramenta permite autenticação de usuários, conexão segura a daemons Docker expostos com TLS, criação de sessões SSH e controle de containers, imagens e redes. Tudo é orquestrado por um backend em Go que usa SQLite para persistência e a SDK oficial do Docker para executar comandos.

## Funcionalidades principais

- **Autenticação e sessões**: gerenciamento de login e persistência de sessão com o `auth.ManagerStruct`. 
- **Credenciais Docker TLS**: cadastro e conexão de endpoints Docker (CA/Cert/Key), com criptografia de campos sensíveis antes de salvar no banco. 
- **Painel de containers**: iniciar, parar, pausar, remover e visualizar estatísticas em tempo real (CPU, memória, rede) dos containers conectados. 
- **Imagens Docker**: listar,filtrar, remover imagens rapidamente e buildar imagens remotamente.
- **Redes Docker**: visualização e gerenciamento básico das redes disponíveis. 
- **Terminais SSH**: criação de conexões SSH para servidores remotos e abertura de terminais interativos pela interface.
- **Vulpes (cliente de APIs)**: coleções, pastas e ambientes no estilo Postman, com requisições HTTP, gRPC (reflection ou arquivos `.proto`, unário e streaming), WebSocket e Socket.IO (v2, v3 e v4). Variáveis `{{nome}}` e autenticação herdada da pasta/coleção. Coleções e ambientes ficam criptografados no banco local.
  - **Importação**: coleções Postman v2.0/v2.1, ambientes e globals; exports do Insomnia v4 (JSON ou YAML) e v5 (YAML do Insomnia 10+), com pastas, autenticação, headers de pasta, ambientes, sub-ambientes, cookies, gRPC e WebSocket.
  - **Exportação**: para Postman v2.1 ou Insomnia v4, tanto coleções quanto ambientes.
  - **Cookies por coleção**: cookies recebidos via `Set-Cookie` (inclusive em redirecionamentos e no handshake de WebSocket/Socket.IO) são guardados na coleção da requisição e enviados nas próximas requisições que combinarem com domínio, path e `Secure`. A aba **Cookies** permite criar, editar e remover cookies manualmente.
  - **Abas**: arraste uma aba para reordená-la na barra ou solte-a sobre a requisição aberta para dividir a tela (até 4 painéis, como no terminal).

## $\textcolor{green}{\textsf{Features Futuras}}$
-  **Docker Compose**: suporte para visualização, gerenciamento de arquivos compose e gereciamentos de contêineres usando compose.
- **Uploads e assets**: suporte para carregar e salvar imagens base64 (por exemplo, avatares) pelo backend.
- **Configuração de Docker registry**: suporte para configuração de Docker registry para push e pull de imagens(docker registry privado ou docker hub).

## Arquitetura

- **Backend (Go 1.26)**
  - `main.go` inicia o app Wails v3, registra todos os handlers como serviços e cria a janela principal.
  - `src/desktop/` concentra a infraestrutura de janelas: eventos por janela, diálogos nativos e o serviço que destaca abas.
  - `app.go` mantém utilidades genéricas do app, como carregamento/gravação de imagens base64.
  - `src/handlers/` contém os controladores de domínio (Docker, Docker SDK, SSH, Terminal, Auth, User).
  - `src/models/` define os modelos persistidos em SQLite (por exemplo, `DockerCredentialsModel`).
  - `src/dtos/` agrupa DTOs usados pelo frontend, como `CreateDockerConnectionDto` e `StatsPayloadDto`.
  - `src/auth/` mantém a gestão de sessões e verificações de autorização.
  - `src/functions/` reúne helpers (validação de structs, tratamento de logs, cliente HTTP/TLS). 
  - `src/types/types.go` define tipos utilitários, como `EncryptedString` para armazenar dados sensíveis.

- **Frontend (React + Vite + Tailwind + Zustand)**
  - Estrutura em `frontend/src` com páginas de Containers, Imagens, Redes, Credenciais Docker, Login/Criação de conta e Terminal SSH.
  - Componentes protegidos por rota (`ProtectedRoute.tsx`) e estado global leve com Zustand.
  - Biblioteca Chart.js para gráficos e xterm.js para terminais interativos.

## $\textcolor{orange}{\textsf{Pré-requisitos}}$

- Go **1.26** ou superior (ver `go.mod`).
- Node.js **>= 20** e npm para o frontend (Vite).
- Docker instalado caso queira testar conexões locais.
- [Wails v3 CLI](https://v3.wails.io/getting-started/installation/) (`go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.34`).

## Como rodar em modo desenvolvimento

```bash
wails3 dev
```

O Wails instala as dependências do frontend, gera os bindings em `frontend/bindings`, sobe o dev server do Vite e abre a janela com hot reload. Para o editor reconhecer os bindings sem rodar o app, gere-os com `wails3 generate bindings -ts`.

## Build de produção

```bash
wails3 build
```

O binário é gerado em `bin/devops-hub` (`bin/devops-hub.exe` no Windows). Para gerar o instalador NSIS use `wails3 package`. No Ubuntu 22.04 compile com `wails3 build EXTRA_TAGS=gtk3` (GTK3 + WebKitGTK 4.1); versões mais novas usam GTK4 + WebKitGTK 6.0.

## Múltiplas janelas

As abas funcionam como as do Chrome:

- **Destacar:** botão ao lado do título da aba, menu do botão direito ou arrastar a aba para baixo da barra (ou para fora da janela). A nova janela reaproveita a sessão de quem a abriu.
- **Mesclar:** arraste a aba até a barra de abas de outra janela (ela fica destacada em azul) e solte. Nas janelas destacadas também há "Mover para a janela principal" no botão da aba e no menu do botão direito. Uma janela destacada fecha sozinha quando fica sem abas.
- **Isolamento:** conexões, terminais e repositório selecionado são de cada janela; fechar uma janela libera só os recursos dela. Fechar a janela principal encerra o aplicativo.

## Banco de dados

- Usa SQLite (via `github.com/glebarez/sqlite`).
- A inicialização é feita em `database.InitDb()` no startup do app.
- As credenciais Docker são armazenadas com campos criptografados (`EncryptedString`), reduzindo exposição de URLs e chaves privadas.

## Integração com Docker TLS

Para expor um daemon Docker em `tcp://<host>:2376` com certificados TLS válidos (CA/Cert/Key), siga o tutorial completo em [`Como criar credenciais para conexão com o daemon do docker`](mk/HowToGenerateDockerCredentials.md). Ele cobre geração de certificados, configuração do `daemon.json` e validação com `docker version`.

## Conexões SSH

O guia [`Como criar par de chaves para conexão ssh`](mk/HowtogenerateSshKeyToServer.md) mostra como gerar uma chave SSH segura para uso na tela de criação de conexão e no terminal embutido.

## Estrutura de comandos úteis

- Formatação do frontend: `npm run format`
- Preview dos assets gerados: `npm run preview`
- Dev server isolado do frontend: `npm run dev` (apenas interface, útil para ajustes de UI)

## Downloads
- [Windows](https://github.com/viniggj2005/docker-manager/releases/latest/download/Docker.Manager.exe)
- [linux](https://github.com/viniggj2005/docker-manager/releases/latest/download/Docker.Manager)
- [linux (Ubuntu 24.04)](https://github.com/viniggj2005/docker-manager/releases/latest/download/docker-manager-ubuntu24)

## Screenshots
## Screenshots

![Dashboard](./mk/images/dashboard.png)
![Docker Credentials](./mk/images/docker-credentials.png)
![Docker Images](./mk/images/docker-images.png)
![Network](./mk/images/network.png)
![Volume](./mk/images/volume.png)
![SSH Connection](./mk/images/ssh-connection.png)
![Terminal](./mk/images/terminal.png)
![Containers](./mk/images/containers.png)

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [`LICENSE`](LICENSE) para mais detalhes.
