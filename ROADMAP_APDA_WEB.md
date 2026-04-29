# Roadmap APDA Web

Roadmap de migração e implementação do comando `apda web` — interface visual local do pipeline APDA.

## Contexto

O pipeline APDA possui uma CLI interativa robusta (`apda doctor`, `apda server`, `apda onboard`, `apda run`, `apda runs`, `apda validate`) implementada como pacote npm em `src/`.

Existem dois arquivos HTML de geração anterior em `frontend/` que cobrem a visualização de resultados:

- `frontend/index.html`: visualizador de artefatos `.apda.json` gerados.
- `frontend/benchmarks.html`: painel de benchmark comparativo de modelos.

Esses arquivos dependem de arquivos estáticos servidos por servidor externo e não se integram com a CLI. O objetivo deste roadmap é unificá-los em uma WebUI local completa, servida pelo comando `apda web`, sem duplicar a lógica já implementada em `src/`.

## Objetivo

Implementar `apda web` como um servidor HTTP local que:

- Reutiliza todos os módulos existentes de `src/` como camada de lógica.
- Expõe uma API JSON em `/api/` consumida pelo frontend.
- Serve arquivos estáticos de `frontend/` sem dependência de servidor externo.
- Oferece uma experiência visual acessível para equipes técnicas municipais com baixa familiaridade com terminal.
- Integra as páginas existentes (`index.html`, `benchmarks.html`) com novas páginas operacionais.

## Fluxo alvo da WebUI

```
Diagnóstico → Servidor → Arquivo + Workflow → Execução → Resultado → Histórico
```

## Princípios de implementação

- Nenhum framework de frontend (React, Vue, Svelte): manter vanilla HTML, CSS e JavaScript.
- Nenhuma duplicação de lógica: `src/web.js` importa e chama os módulos existentes.
- Python continua como motor de processamento invocado pelos runners existentes.
- Design system dos HTMLs existentes (variáveis CSS, cards, badges, barras) reaproveitado via `frontend/shared.css`.
- Servidor HTTP em Node.js puro ou dependência mínima.
- Server-Sent Events para progresso de execução em tempo real.
- Dados e histórico locais permanecem fora do git.

---

## Fase 1 — Servidor HTTP e API base

Status: concluída.

Prioridade: alta.

### Objetivo

Criar a infraestrutura do servidor web que serve arquivos estáticos e expõe a API JSON, reutilizando os módulos existentes de `src/`.

### Entregas

- Criar `src/web.js` com servidor HTTP local em Node.js.
- Registrar o comando `apda web [--port 3000]` em `src/cli.js`.
- Servir arquivos de `frontend/` como estáticos a partir da raiz da requisição.
- Implementar roteador simples para os endpoints `/api/*`.
- Criar `src/api/` com os seguintes módulos:
  - `doctor.js`: `GET /api/doctor` → chama `buildDoctorReport()`.
  - `server.js`: `GET /api/server/status`, `POST /api/server/start`, `POST /api/server/stop`.
  - `environment.js`: `GET /api/gpus`, `GET /api/models`, `GET /api/inputs`.
  - `workflows.js`: `GET /api/workflows` (com filtro `?file=`), `POST /api/run`, `GET /api/run/stream` (SSE).
  - `runs.js`: `GET /api/runs`, `GET /api/runs/:id`.
  - `artifacts.js`: `GET /api/artifacts` — varre `saida/` por `*.apda.json` e retorna lista com metadados.
  - `benchmarks.js`: `GET /api/benchmarks` — lê `benchmarks/benchmarks.json`.
  - `validate.js`: `POST /api/validate` — chama `validateArtifactFile()`.
- Abrir o navegador automaticamente ao subir (`open` ou `xdg-open`).
- Exibir a URL local no terminal ao iniciar.

### Critérios de pronto

- `apda web` sobe sem erro e exibe `http://localhost:3000` no terminal.
- `GET /api/doctor` retorna o mesmo JSON que `apda doctor --json`.
- Arquivos estáticos de `frontend/` são servidos corretamente.
- Servidor encerra ao pressionar Ctrl+C.

### Comandos esperados

```bash
apda web
apda web --port 8090
```

---

## Fase 2 — Design system compartilhado e migração dos HTMLs existentes

Status: concluída.

Prioridade: alta.

### Objetivo

Extrair o CSS comum dos dois HTMLs existentes, criar navegação unificada e migrar os arquivos para consumir a nova API.

### Entregas

- Criar `frontend/shared.css` com as variáveis CSS, reset, layout base, tipografia, cards, badges, barras, chips e media queries extraídos de `index.html` e `benchmarks.html`.
- Criar `frontend/nav.js` com o componente de navegação injetado em todas as páginas:

```
[Executar]  [Diagnóstico]  [Servidor]  [Artefatos]  [Benchmarks]  [Histórico]
```

- Migrar `frontend/index.html`:
  - Substituir `/frontend/manifest.json` por `GET /api/artifacts`.
  - Substituir link para `/frontend/benchmarks.html` pelo item de navegação.
  - Referenciar `shared.css` e `nav.js`.
  - Remover CSS duplicado.
- Migrar `frontend/benchmarks.html`:
  - Substituir `/benchmarks/benchmarks.json` por `GET /api/benchmarks`.
  - Referenciar `shared.css` e `nav.js`.
  - Remover CSS duplicado.
- Remover a dependência de `python3 -m http.server` mencionada na mensagem de erro do `index.html`.

### Critérios de pronto

- `index.html` e `benchmarks.html` funcionam servidos pelo `apda web` sem erro.
- Navegação entre as duas páginas funciona.
- Design visual idêntico ao anterior.
- Nenhum CSS duplicado entre os arquivos.

---

## Fase 3 — Página de diagnóstico do ambiente

Status: concluída.

Prioridade: alta.

### Objetivo

Criar a versão visual do `apda doctor` acessível pelo navegador, útil para equipes técnicas municipais que precisam verificar se o ambiente está pronto antes de executar.

### Arquivo

`frontend/doctor.html`

### Entregas

- Consumir `GET /api/doctor`.
- Exibir seções:
  - Python: versão, scripts presentes, módulos instalados (com indicação visual de ausentes).
  - GPUs detectadas.
  - Modelos `.gguf` disponíveis (com nome e tamanho).
  - Modelo padrão configurado.
  - Binário `llama-server`: localizado ou não.
  - Endpoint configurado: livre, ocupado ou respondendo como API compatível.
  - Arquivos em `entrada/`.
  - Próximas ações recomendadas em destaque.
- Indicar visualmente o que está OK, o que está com problema e o que está ausente (usar as classes `ok`, `warn`, `risk` do design system).
- Botão "Recarregar diagnóstico".
- Exibir o comando sugerido para subir o `llama-server` manualmente quando aplicável.

### Critérios de pronto

- Página carrega e exibe diagnóstico completo equivalente ao `apda doctor`.
- Diferencia visualmente itens OK de itens com problema.
- Próximas ações são visíveis em destaque.

---

## Fase 4 — Página de gerenciamento do servidor

Status: concluída.

Prioridade: alta.

### Arquivo

`frontend/server.html`

### Objetivo

Permitir que o usuário visualize o estado do `llama-server` e o gerencie diretamente pelo navegador, sem precisar do terminal.

### Entregas

- Consumir `GET /api/server/status`.
- Exibir:
  - Status atual: inativo, ativo externo ou gerenciado pela CLI (com PID).
  - URL do endpoint configurado.
  - Modelo em uso.
  - Comando resolvido para subida manual.
- Botão "Iniciar servidor" (chama `POST /api/server/start`):
  - Desabilitar durante a subida.
  - Exibir progresso enquanto aguarda o endpoint ficar pronto.
  - Atualizar status ao finalizar.
- Botão "Encerrar servidor" (chama `POST /api/server/stop`):
  - Disponível apenas quando servidor gerenciado pela CLI está ativo.
  - Confirmar antes de encerrar.
- Polling automático do status a cada 5 segundos.
- Exibir últimas linhas do log `.apda/llama-server.log` quando disponível.

### Critérios de pronto

- Usuário consegue subir e encerrar o `llama-server` sem abrir o terminal.
- Status é atualizado automaticamente.
- Erros de inicialização são exibidos na página.

---

## Fase 5 — Página de execução de workflows

Status: concluída.

Prioridade: alta.

### Arquivo

`frontend/run.html`

### Objetivo

Criar a versão visual do `apda onboard` — o fluxo principal de uso para equipes não técnicas: selecionar arquivo, escolher workflow, executar e ver o resultado.

### Entregas

- Passo 1 — Seleção de arquivo:
  - Consumir `GET /api/inputs`.
  - Lista de arquivos com nome, extensão e data.
  - Campo de busca para filtrar.
- Passo 2 — Seleção de workflow:
  - Consumir `GET /api/workflows?file=<caminho>` ao selecionar arquivo.
  - Exibir apenas workflows compatíveis com a extensão.
  - Descrição de cada workflow (etapas envolvidas).
- Passo 3 — Configuração:
  - Campo editável de URL do `llama-server` (pré-preenchido com o valor de `.apda/config.json`).
  - Indicação visual se o servidor está disponível ou não.
  - Opção de modo dry-run.
- Passo 4 — Execução com progresso em tempo real:
  - Botão "Executar".
  - Conectar a `GET /api/run/stream` via EventSource (SSE).
  - Exibir etapas em tempo real: extraindo → anonimizando → gerando → validando.
  - Indicar etapa atual, etapa concluída e etapa com erro.
- Passo 5 — Resultado:
  - Exibir arquivos gerados com links para visualização.
  - Link direto para o artefato no visualizador (`index.html`).
  - Botão "Executar novo arquivo".

### Critérios de pronto

- Usuário consegue executar o workflow completo `docx-to-apda-json` sem abrir o terminal.
- Progresso em tempo real é exibido durante a execução.
- Erro em qualquer etapa é exibido com mensagem clara.
- Artefato gerado é acessível diretamente ao final.

---

## Fase 6 — Página de histórico de execuções

Status: concluída.

Prioridade: média.

### Arquivo

`frontend/history.html`

### Objetivo

Criar a versão visual do `apda runs` — auditabilidade e rastreabilidade das execuções passadas.

### Entregas

- Consumir `GET /api/runs`.
- Exibir tabela com:
  - ID da execução.
  - Status (`ok`, `error`, `dry-run`, `running`).
  - Workflow executado.
  - Arquivo de entrada.
  - Duração.
  - Data e hora.
- Clicar em uma linha abre o detalhe da execução (consumir `GET /api/runs/:id`):
  - Etapas executadas.
  - Arquivos gerados com links.
  - Métricas de tokens e tempo quando disponíveis.
  - Mensagem de erro quando houver.
  - JSON bruto expansível para auditoria.
- Filtro por status e workflow.
- Botão de recarregar.

### Critérios de pronto

- Histórico equivalente ao `apda runs` é visível no navegador.
- Detalhe de cada execução é acessível com um clique.
- Falhas são destacadas visualmente.

---

## Fase 7 — Validação visual de artefatos

Status: concluída.

Prioridade: média.

### Objetivo

Integrar a validação de artefatos diretamente no visualizador (`index.html`) e expor via API.

### Entregas

- Adicionar botão "Validar" no painel de detalhe do artefato em `index.html`.
- Chamar `POST /api/validate` com o caminho do artefato.
- Exibir resultado: OK com ícone verde ou lista de erros por campo com keyword e valor problemático.
- Indicar no card de status se o artefato foi validado pelo schema.
- Suportar também upload de JSON local para validação imediata.

### Critérios de pronto

- Usuário consegue validar qualquer artefato diretamente na WebUI.
- Erros de schema são exibidos por campo, com mensagem compreensível.

---

## Fase 8 — Polimento e empacotamento

Status: concluída.

Prioridade: baixa.

### Objetivo

Consolidar a WebUI como entrega estável e documentada.

### Entregas

- Testar todas as páginas em diferentes tamanhos de tela (responsividade já presente no design system).
- Tratar estados de carregamento, erro e lista vazia em todas as páginas.
- Adicionar `apda web` na lista de comandos do `package.json`.
- Documentar o comando no `README.md`.
- Registrar a conclusão da Fase 7 do `ROADMAP_APDA_ONBOARDING.md`.
- Adicionar entrada no `CHANGELOG.md`.

### Critérios de pronto

- `apda web` funciona em instalação limpa após `npm link`.
- Todas as páginas têm tratamento de erro visível.
- Documentação atualizada.

---

## Ordem de implementação recomendada

1. Fase 1 — Servidor HTTP e API base.
2. Fase 2 — Design system e migração dos HTMLs existentes.
3. Fase 5 — Página de execução (maior valor para usuários não técnicos).
4. Fase 3 — Página de diagnóstico.
5. Fase 4 — Página do servidor.
6. Fase 6 — Histórico.
7. Fase 7 — Validação integrada.
8. Fase 8 — Polimento e empacotamento.

## Estrutura de arquivos ao final

```
src/
  cli.js               (atualizado com apda web)
  web.js               (criado — Fase 1)
  lib/
    http.js            (criado — Fase 1: readBody, respond)
  api/
    doctor.js          (criado — Fase 1)
    server-api.js      (criado — Fase 1)
    environment.js     (criado — Fase 1)
    workflows-api.js   (criado — Fase 1, inclui SSE)
    runs.js            (criado — Fase 1)
    artifacts.js       (criado — Fase 1)
    benchmarks.js      (criado — Fase 1)
    validate.js        (criado — Fase 1)

frontend/
  shared.css           (novo — Fase 2: design system extraído)
  nav.js               (novo — Fase 2: navegação injetada)
  index.html           (migrado — Fase 2)
  benchmarks.html      (migrado — Fase 2)
  doctor.html          (novo — Fase 3)
  server.html          (novo — Fase 4)
  run.html             (novo — Fase 5)
  history.html         (novo — Fase 6)
```

## Dependências adicionais previstas

- Nenhuma dependência de frontend (sem React, Vue, Svelte, Tailwind).
- Possível adição de dependência mínima para o servidor HTTP caso o módulo nativo `node:http` gere complexidade excessiva no roteamento e na entrega de estáticos (ex.: `serve-handler` ou equivalente).
- Server-Sent Events: suportado nativamente por `node:http` e `EventSource` no browser, sem biblioteca adicional.
