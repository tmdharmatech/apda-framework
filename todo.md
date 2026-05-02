# APDA Framework — Plano de Refatoração

Correções e melhorias organizadas por fases, da mais urgente à mais estratégica.
Cada fase pode ser executada independentemente e entregue como PR separado.

---

## Fase 1 — Eliminar duplicação Python (crítica)

**Motivação:** `post_json()`, `extract_json()`, `normalize_artifact()` e `_repair_truncated_json()` estão copiados em 4 scripts com variações sutis. Um bug corrigido em um script não se propaga aos outros. São ~400 linhas de código duplicado.

### Tarefas

- [ ] Criar pacote `scripts/lib/` com `__init__.py`
- [ ] Extrair `scripts/lib/llm_client.py` — `post_json()`, `extract_json()`, `_repair_truncated_json()` unificados a partir de `02_scan_segments.py`, `03_scan_xlsx.py`, `05_gerar_artefato_3b.py` e `07_gerar_de_manifesto.py`
- [ ] Extrair `scripts/lib/artifact.py` — `normalize_artifact()` unificado a partir de `05_gerar_artefato_3b.py` e `07_gerar_de_manifesto.py`
- [ ] Extrair `scripts/lib/paths.py` — constantes `BASE`, `SAIDA`, `LOGS` usadas em todos os scripts
- [ ] Extrair `scripts/lib/metrics.py` — `_push_metrics()` centralizado (hoje em `05_gerar_artefato_3b.py`)
- [ ] Atualizar todos os scripts para importar de `scripts.lib` em vez de definir localmente
- [ ] Verificar que nenhum script quebrou após a extração (`python -c "import scripts.lib.llm_client"`)

**Resultado esperado:** cada script Python cai de ~300 para ~80 linhas. Lógica de LLM testável isoladamente.

---

## Fase 2 — Testes automatizados (crítica)

**Motivação:** cobertura atual estimada em <15%. O arquivo mais complexo (`run-workflow.js`, 393 linhas) tem zero testes. Nenhum script Python é testado. O teste de workflows está desatualizado (espera 4 workflows para `.docx` mas existem 8+).

### Tarefas

- [ ] Corrigir `test/workflows.test.js` — atualizar contagens esperadas para refletir os 27 workflows atuais
- [ ] Adicionar testes unitários Python com `pytest`:
  - [ ] `test_llm_client.py` — `extract_json()` com respostas reais e malformadas
  - [ ] `test_artifact.py` — `normalize_artifact()` com campos faltantes, extras, inventados
  - [ ] `test_anonimizar.py` — `anonimizar()` com CPF, email, telefone, CEP, datas, nomes
- [ ] Adicionar teste de contrato: gerar artefato de exemplo e validar contra schema (garante que gerador e schema não divergem)
- [ ] Adicionar testes do orchestrator (`run-workflow.js`) com mocks dos scripts Python
- [ ] Adicionar testes de API para endpoints `/api/*` do web server
- [ ] Adicionar `pytest` ao `requirements.txt` (devDependencies)
- [ ] Criar script `npm run test:all` que rode `npm test` + `pytest` em sequência
- [ ] Configurar GitHub Actions CI rodando `test:all` a cada push

**Resultado esperado:** cobertura > 60% nas funções críticas. Regressões detectáveis antes do merge.

---

## Fase 3 — Runner data-driven e workflows composicionais (média)

**Motivação:** `run-workflow.js` tem 7 blocos if/else idênticos copiados para cada etapa. O registry tem 27 workflows definidos estaticamente por explosão combinatória de formato × anonimização × segmentação.

### Tarefas

#### 3a. Runner data-driven

- [ ] Criar mapa declarativo `STEP_REGISTRY` em `src/workflows/step-registry.js`:
  ```
  stepId → { script, argsFrom(context), outputKey }
  ```
- [ ] Refatorar `run-workflow.js` para iterar `workflow.steps` usando o registro em vez de if/else
- [ ] Mover lógica de `--litellm` / `--api-key` para o contexto do runner, não inline no bloco de `generate-artifact`
- [ ] Eliminar duplicação de `baseUrl` resolution (aparece 3x no mesmo arquivo)

#### 3b. Workflows composicionais

- [ ] Modelar workflows como composição de 3 eixos: `formato × anonimização × segmentação`
- [ ] Manter IDs existentes como aliases para retrocompatibilidade
- [ ] Gerar workflows automaticamente a partir das combinações válidas
- [ ] Ao adicionar novo formato (ex: `.odt`), zero workflows manuais necessários

**Resultado esperado:** adicionar novo step = 1 linha. Adicionar novo formato = 0 workflows manuais. `run-workflow.js` cai de ~393 para ~150 linhas.

---

## Fase 4 — Schema restritivo e validação completa (média)

**Motivação:** o schema atual aceita artefatos sem `anonimizacao`, sem campos em `conteudo_pedagogico`, e com propriedades arbitrárias. Isso invalida a promessa de qualidade da proposta ao MEC.

### Tarefas

- [ ] Adicionar `additionalProperties: false` em todos os objetos do schema
- [ ] Tornar `anonimizacao` campo obrigatório (a proposta exige anonimização antes de tudo)
- [ ] Definir campos mínimos obrigatórios em `conteudo_pedagogico` (pelo menos `objetivo_pedagogico`)
- [ ] Criar enum restritivo para `itens_mascarados` (`private_person`, `private_email`, `cpf`, `telefone`, `data`, `cep`, `nome_estudante`)
- [ ] Ativar validação do `manifesto_segmentos.schema.json` no step `scan-segments`
- [ ] Ajustar scripts geradores para cumprirem o schema restritivo
- [ ] Rodar todos os artefatos existentes em `saida/` contra o novo schema e documentar o que quebra

**Resultado esperado:** artefatos inválidos rejeitados em vez de aceitos silenciosamente. Conformidade com requisitos do Sandbox MEC.

---

## Fase 5 — Configuração centralizada e secrets (média)

**Motivação:** `baseUrl` é resolvida em 6+ lugares distintos (JS e Python). Credenciais como `apda-master-key` e `admin/apda2025` estão hardcoded no fonte. A proposta menciona LGPD.

### Tarefas

- [ ] Criar `src/lib/resolve-base-url.js` — função única para resolução de `baseUrl` com fallback chain
- [ ] Criar `scripts/lib/config.py` — equivalente Python para resolução de URL e API keys
- [ ] Substituir todas as 6+ ocorrências nos módulos JS e Python
- [ ] Mover credenciais para `.env` com valores padrão documentados:
  - `LITELLM_MASTER_KEY`
  - `GRAFANA_ADMIN_PASSWORD`
  - `MARITACA_API_KEY`
- [ ] Atualizar `infra/start.sh` e `infra/docker-compose.yml` para ler de `.env`
- [ ] Adicionar `.env.example` ao repositório com valores placeholder
- [ ] Verificar que `.env` está no `.gitignore`

**Resultado esperado:** mudança de porta ou credencial feita em 1 lugar. Nenhum secret no código versionado.

---

## Fase 6 — Separar dependências pesadas (baixa)

**Motivação:** `requirements.txt` puxa `torch` (~2GB) e `transformers` que são usados apenas pelo Privacy Filter neural. Instalar o framework exige baixar 2GB+ mesmo para quem vai usar somente `regex-anon`.

### Tarefas

- [ ] Criar `requirements-neural.txt` com `torch` e `transformers`
- [ ] Remover `torch` e `transformers` do `requirements.txt` principal
- [ ] Atualizar `doctor` para detectar e avisar: "Privacy Filter neural requer `pip install -r requirements-neural.txt`"
- [ ] Atualizar `python-env.js` para não falhar quando `torch`/`transformers` estão ausentes e o workflow não usa `privacy-filter`
- [ ] Documentar no README a separação

**Resultado esperado:** onboarding sem GPU cai de ~2GB+ para ~50MB de dependências. Workflows fast e regex-anon funcionam sem torch.

---

## Fase 7 — Métricas no runner (baixa)

**Motivação:** `metrics_exporter.py` tem 404 linhas com 20+ métricas definidas, mas apenas 1 script envia dados. Os 6 outros scripts não instrumentam nada.

### Tarefas

- [ ] Mover instrumentação de métricas para o runner Node.js (middleware)
- [ ] O runner já conhece: tempo de cada step, sucesso/falha, tamanho de entrada/saída
- [ ] Após cada step, o runner envia métricas ao exporter via HTTP POST
- [ ] Remover `_push_metrics()` dos scripts Python individuais
- [ ] Adicionar métricas de pipeline completo: tempo total, steps executados, workflow ID
- [ ] Garantir que o dashboard Grafana reflete todas as métricas efetivamente coletadas

**Resultado esperado:** observabilidade real cobrindo 100% dos steps, sem instrumentação manual em cada script.

---

## Fase 8 — CLI com registro de comandos (baixa)

**Motivação:** `cli.js` é uma cadeia de if/else que cresce a cada feature. Adicionar comando exige editar o monolito.

### Tarefas

- [ ] Criar padrão de registro de comandos:
  ```
  { name, aliases, description, options, handler }
  ```
- [ ] Cada comando em seu próprio módulo (`src/commands/*.js`)
- [ ] Help gerado automaticamente a partir dos registros
- [ ] Parsing de argumentos consistente (hoje cada comando re-parseia independentemente)
- [ ] Middleware de erro comum para todos os comandos

**Resultado esperado:** adicionar comando = criar arquivo + registrar. Help sempre atualizado.

---

## Fase 9 — Frontend modularizado (baixa)

**Motivação:** cada página HTML tem ~280 linhas de JavaScript inline, sem compartilhamento de código entre páginas, com função `esc()` de sanitização XSS reimplementada manualmente.

### Tarefas

- [ ] Extrair JavaScript inline para arquivos `.js` separados por página
- [ ] Criar `frontend/lib/api.js` — cliente HTTP compartilhado (`fetchJSON`, `postJSON`)
- [ ] Criar `frontend/lib/dom.js` — helpers DOM compartilhados (`esc()`, `createElement`, `renderTable`)
- [ ] Considerar DOMPurify para sanitização XSS em vez de `esc()` manual
- [ ] Manter arquitetura vanilla (sem framework, sem bundler) — alinhado com simplicidade do projeto

**Resultado esperado:** lógica compartilhada entre páginas. Sanitização XSS confiável.

---

## Fase 10 — Infraestrutura portável (baixa)

**Motivação:** `network_mode: host` no Docker Compose não funciona em macOS/Windows. `start.sh` com 307 linhas duplica lógica do `src/stack.js`.

### Tarefas

- [ ] Substituir `network_mode: host` por rede Docker bridge com mapeamento de portas explícito
- [ ] Adicionar healthchecks no `docker-compose.yml` para Prometheus e Grafana
- [ ] Avaliar consolidação de `infra/start.sh` e `src/stack.js` (eliminar duplicação de lógica)
- [ ] Testar stack no Docker Desktop (macOS/Windows) se houver acesso a essas plataformas
- [ ] Remover dependências não usadas do `package.json` (`ink-spinner`, `ink-task-list`)

**Resultado esperado:** stack funcional em Linux, macOS e Windows com Docker Desktop.

---

## Priorização sugerida para o Sandbox MEC

| Fase | Prioridade | Justificativa no contexto do edital |
|------|------------|--------------------------------------|
| 1 — Duplicação Python | Crítica | Auditabilidade — código duplicado é fonte de inconsistências |
| 2 — Testes | Crítica | Rastreabilidade e confiabilidade exigidas pelo MEC |
| 4 — Schema restritivo | Alta | Validação automática prometida na proposta |
| 5 — Secrets e config | Alta | Conformidade LGPD e governança de dados |
| 3 — Runner e workflows | Média | Manutenibilidade para escalar formatos e estratégias |
| 6 — Deps separadas | Média | Onboarding municipal com hardware limitado |
| 7 — Métricas | Baixa | Observabilidade prometida mas não urgente |
| 8 — CLI | Baixa | Qualidade de código, não afeta funcionalidade |
| 9 — Frontend | Baixa | Segurança (XSS), mas risco baixo em uso local |
| 10 — Infra portável | Baixa | Relevante se houver testes em ambientes diversos |
