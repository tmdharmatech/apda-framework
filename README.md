# Pipeline APDA (Artefatos Pedagógicos Digitais Abertos)

Este repositório contém um pipeline local para criação de **Artefatos Pedagógicos Digitais Abertos (APDA)** a partir de documentos educacionais. O fluxo combina extração de texto, anonimização de PII, geração de JSON pedagógico por LLM local e validação por JSON Schema.

O objetivo operacional é permitir que documentos em `entrada/` sejam transformados em artefatos estruturados em `saida/`, mantendo rastreabilidade nos logs e revisão humana obrigatória antes de qualquer uso final.

## Início Rápido

```bash
npm install
python -m venv .venv
pip install -r requirements.txt
# Para workflows com Privacy Filter neural (opcional, ~2GB):
# pip install -r requirements-neural.txt
node src/cli.js doctor
node src/cli.js onboard
```

Para executar um workflow específico:

```bash
node src/cli.js run --file entrada/arquivo.docx --workflow docx-to-apda-json
```

Para validar um artefato já gerado:

```bash
node src/cli.js validate saida/artefato.apda.json
node src/cli.js validate saida/artefato.apda.json --json
```

Use `--dry-run` para revisar os comandos sem carregar modelos nem executar o pipeline:

```bash
node src/cli.js onboard --dry-run
node src/cli.js run --file entrada/arquivo.docx --workflow docx-to-apda-json --dry-run
```

## Requisitos

### Ambiente

- Node.js `>=20`
- Python com `.venv`
- Dependências Python instaladas por `requirements.txt`
- `llama-server` disponível para a etapa de geração por LLM
- Modelos locais em `modelos/`

### Hardware de Referência

- GPU: AMD Radeon RX 580 (8 GB VRAM)
- Backend: `llama.cpp` com suporte a Vulkan
- VRAM observada: aproximadamente 2.4 GB a 3.8 GB dependendo do contexto e modelo

### Modelos Recomendados

- **Qwen2.5 3B (Q4_K_M)**: modelo padrão para geração de artefatos, com bom equilíbrio entre velocidade e adesão ao schema.
- **Qwen3 4B (Q4_K_M)**: opção para validação de qualidade e melhor separação semântica em contextos complexos.
- **OpenAI Privacy Filter**: modelo usado na etapa de anonimização neural.

## Instalação

Instale as dependências JavaScript:

```bash
npm install
```

Crie o ambiente Python e instale os módulos necessários:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Dependências neurais (opcional)

Os workflows com **Privacy Filter neural** (`privacy-filter`, `neural`) requerem `torch` e `transformers`, que somam ~2GB de download e dependem de GPU (CPU como fallback lento).

Instale apenas se for usar anonimização neural:

```bash
pip install -r requirements-neural.txt
```

Workflows sem GPU funcionam perfeitamente com apenas `requirements.txt`:

| Workflow | `requirements.txt` | `requirements-neural.txt` |
|---|---|---|
| fast, regex-anon | ✅ suficiente | não necessário |
| privacy-filter (neural) | ✅ + | ✅ obrigatório |

O comando `doctor` detecta automaticamente quais módulos estão instalados e avisa quando `requirements-neural.txt` é necessário para um workflow.

Verifique o ambiente:

```bash
node src/cli.js doctor
node src/cli.js doctor --json
```

Para testar como pacote local:

```bash
npm pack --dry-run
npm link
apda doctor
```

## Uso pela CLI

O comando principal interativo guia seleção de GPU, modelo `.gguf`, arquivo de entrada, workflow compatível e URL do `llama-server`:

```bash
node src/cli.js
node src/cli.js onboard
```

Se instalado via `npm link`, use:

```bash
apda
apda onboard
```

Comandos principais:

```bash
node src/cli.js doctor
node src/cli.js list-gpus
node src/cli.js list-models
node src/cli.js list-inputs
node src/cli.js workflows --file entrada/arquivo.docx
node src/cli.js run --file entrada/arquivo.docx --workflow docx-to-apda-json
node src/cli.js runs
node src/cli.js runs show <id>
node src/cli.js validate saida/artefato.apda.json
```

O onboarding salva escolhas locais em `.apda/config.json`, que não deve ser versionado. A CLI reutiliza os scripts Python existentes como motor de processamento.

## Workflows

Workflows granulares disponíveis:

```text
extract-only
docx-to-text
xlsx-to-text
pdf-to-text
anonymize-privacy-filter
generate-apda-json
validate-apda-json
txt-to-apda-json
docx-to-apda-json
xlsx-to-apda-json
pdf-to-apda-json
```

Exemplos:

```bash
node src/cli.js run --file entrada/arquivo_teste.docx --workflow extract-only
node src/cli.js run --file saida/arquivo_teste.texto_extraido.txt --workflow anonymize-privacy-filter
node src/cli.js run --file saida/arquivo_teste.opf_anonimizado.txt --workflow generate-apda-json
node src/cli.js run --file saida/arquivo_teste.apda.json --workflow validate-apda-json
```

## Servidor Local

O comando `server` gerencia um `llama-server` iniciado pela CLI:

```bash
node src/cli.js server status
node src/cli.js server command
node src/cli.js server start
node src/cli.js server stop
```

Quando iniciado por `server start`, o PID e o log ficam registrados em `.apda/server.json` e `.apda/llama-server.log`.

Para apontar para outro endpoint:

```bash
APDA_LLAMA_BASE_URL=http://127.0.0.1:8091 node src/cli.js onboard
```

Para subir manualmente um servidor equivalente:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m modelos/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  --port 8091 \
  -ngl 99
```

## WebUI

A interface visual local reutiliza os módulos da CLI e expõe uma API JSON em `/api/`:

```bash
node src/cli.js web
node src/cli.js web --port 8090
```

Com `npm link`:

```bash
apda web
apda web --port 8090
```

Páginas disponíveis:

- **Executar** (`/run.html`): wizard para selecionar arquivo, escolher workflow, configurar e acompanhar a execução em tempo real via Server-Sent Events.
- **Diagnóstico** (`/doctor.html`): equivalente visual do `doctor`.
- **Servidor** (`/server.html`): gerenciamento do `llama-server`.
- **Artefatos** (`/index.html`): visualizador dos arquivos `.apda.json` gerados, com validação de schema integrada.
- **Benchmarks** (`/benchmarks.html`): painel comparativo de modelos.
- **Histórico** (`/history.html`): equivalente visual do `runs`, com detalhe de cada execução e auditoria do JSON.

## Stack de Observabilidade (LiteLLM + Prometheus + Grafana)

O stack de observabilidade adiciona proxy de modelos com fallback automático, métricas de qualidade e um dashboard em tempo real.

### Requisitos extras

- Docker (para Prometheus e Grafana)
- `pip install litellm prometheus-client`

### Comandos

```bash
node src/cli.js stack start          # inicia todo o stack
node src/cli.js stack status         # verifica o estado dos serviços
node src/cli.js stack status --json  # estado em JSON
node src/cli.js stack logs           # últimas linhas do log do LiteLLM
node src/cli.js stack logs litellm   # log de um serviço específico
node src/cli.js stack stop           # encerra tudo
```

Ou diretamente pelos scripts:

```bash
infra/start.sh
infra/stop.sh
```

### Endpoints do Stack

| Serviço | URL | Credenciais |
|---|---|---|
| LiteLLM API | http://localhost:4000/v1 | Bearer apda-master-key |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | admin / apda2025 |
| Métricas APDA | http://localhost:8000/metrics | — |

### Usando o proxy LiteLLM nos workflows

Para rotear a geração de artefatos via LiteLLM (com métricas automáticas):

```bash
node src/cli.js run --file entrada/arquivo.docx --workflow docx-to-apda-json --litellm
```

Ou via variável de ambiente:

```bash
APDA_LITELLM=1 node src/cli.js run --file entrada/arquivo.docx --workflow docx-to-apda-json
```

### Modelos disponíveis via LiteLLM

| Nome lógico | Modelo real | Quando usar |
|---|---|---|
| `apda-local-3b` | Qwen2.5-3B local | Produção municipal |
| `apda-local-1b` | Qwen2.5-1.5B local | Hardware muito limitado |
| `sabia-professor` | Sabiá-4 via API | Geração do dataset ouro |

O proxy faz fallback automático: se o 3B não estiver disponível, usa o 1B.

### Métricas coletadas

O dashboard Grafana é provisionado automaticamente e inclui:

- Total de pipelines concluídos e artefatos processados
- Taxa de JSON válido por modelo
- Alertas de PII detectados na saída
- Latência do pipeline por percentil (p50 / p95 / p99)
- Tempo e volume de entrada/saída por step
- Campos inventados por tipo de artefato (alucinação)
- Revisões humanas pendentes e taxa de aprovação
- Custo acumulado por modelo (Sabiá API)

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `MODEL_3B` | — | Caminho para o modelo GGUF 3B |
| `MODEL_1B` | — | Caminho para o modelo GGUF 1B (opcional) |
| `LLAMA_BINARY` | `llama-server` | Caminho para o binário llama-server |
| `MARITACA_API_KEY` | — | Chave da API Maritaca |
| `LITELLM_PORT` | `4000` | Porta do proxy LiteLLM |
| `LITELLM_MASTER_KEY` | `apda-master-key` | Chave de autenticação do proxy |

## Pipeline Python Direto

Também é possível executar os scripts sem passar pela CLI:

```bash
.venv/bin/python scripts/01_extrair_texto.py
.venv/bin/python scripts/04_privacy_filter_anonimizar.py --input saida/arquivo.txt --output saida/anonimo.txt
.venv/bin/python scripts/05_gerar_artefato_3b.py --input saida/anonimo.txt --output saida/artefato.json
```

Para usar o proxy LiteLLM diretamente no script:

```bash
.venv/bin/python scripts/05_gerar_artefato_3b.py \
  --input saida/anonimo.txt --output saida/artefato.json \
  --litellm --municipio paulo-afonso
```

## Validação e Testes

Para validar um JSON APDA:

```bash
node src/cli.js validate saida/artefato.apda.json
node src/cli.js validate saida/artefato.apda.json --json
```

Para rodar a suíte automatizada:

```bash
npm test
```

Os testes usam `node:test` e não exigem modelo pesado nem `llama-server` ativo.

## Histórico de Execuções

Cada workflow executado por `run` ou pelo onboarding registra status, tempos, entrada, saídas e erro quando houver:

```bash
node src/cli.js runs
node src/cli.js runs show <id>
```

Os registros ficam em `.apda/runs/` e não devem ser versionados.

## Arquitetura do Pipeline

O pipeline é dividido em etapas modulares:

1. **Extração de texto** (`scripts/01_extrair_texto.py`): suporta `.docx`, `.xlsx`, `.xls` e `.pdf`.
2. **Anonimização por regras** (`scripts/02_anonimizar_texto.py`): aplica máscaras determinísticas para e-mails, telefones, CPFs, CEPs e datas.
3. **Filtro de privacidade avançado** (`scripts/04_privacy_filter_anonimizar.py`): usa o modelo OpenAI Privacy Filter via Hugging Face para detectar nomes próprios e entidades sensíveis em contexto narrativo.
4. **Geração de artefatos** (`scripts/05_gerar_artefato_3b.py`): integra com `llama-server` para transformar o texto anonimizado em JSON estruturado conforme o schema APDA.
5. **Validação de schema**: verifica o artefato final contra `schemas/artefato_pedagogico.schema.json`.

## Privacidade

A anonimização combina:

- **Detecção neural** via Privacy Filter.
- **Memória local** para propagar entidades detectadas e evitar vazamentos em citações indiretas.
- **Fallbacks por regex** para padrões como e-mail, telefone, CPF, CEP e datas.
- **Normalização de metadados** para remover nomes de arquivos e pastas dos prompts enviados ao LLM.
- **Revisão humana obrigatória**: todo artefato gerado é marcado com `status: pendente_revisao` e `validacao_humana.necessaria: true`.

## Estrutura do Projeto

- `entrada/`: documentos originais.
- `saida/`: textos extraídos, textos anonimizados e artefatos JSON finais.
- `scripts/`: scripts Python do pipeline (inclui `metrics_exporter.py`).
- `schemas/`: contratos de dados em JSON Schema.
- `logs/`: rastreabilidade das etapas executadas.
- `src/`: CLI, detectores, workflows e servidor WebUI.
- `frontend/`: páginas estáticas da WebUI.
- `infra/`: Docker Compose, Prometheus e Grafana para observabilidade.
- `.apda/`: configuração, histórico e PIDs locais, não versionados.

---

Este projeto faz parte do ambiente de pesquisa e desenvolvimento do pipeline APDA.
