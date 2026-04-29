# Pipeline APDA (Artefatos Pedagógicos Digitais Abertos)

Este repositório contém o pipeline de processamento para a criação de **Artefatos Pedagógicos Digitais Abertos (APDA)**. O sistema foca na extração de dados de documentos educacionais, anonimização rigorosa de PII (Informações Pessoais Identificáveis) e geração de estruturas pedagógicas em JSON utilizando modelos de linguagem (LLM) executados localmente.

## 🚀 Arquitetura do Pipeline

O pipeline é dividido em etapas modulares para garantir a segurança dos dados e a qualidade pedagógica:

1.  **Extração de Texto (`scripts/01_extrair_texto.py`)**: Suporta formatos `.docx`, `.xlsx`, `.xls` e `.pdf`.
2.  **Anonimização por Regras (`scripts/02_anonimizar_texto.py`)**: Aplica máscaras determinísticas (Regex) para e-mails, telefones, CPFs, CEPs e datas.
3.  **Filtro de Privacidade Avançado (`scripts/04_privacy_filter_anonimizar.py`)**: Utiliza o modelo `OpenAI Privacy Filter` via Hugging Face para detecção de nomes próprios e entidades sensíveis em contexto narrativo, com propagação de memória local para garantir que nomes citados ao longo do texto sejam consistentemente removidos.
4.  **Geração de Artefatos (`scripts/05_gerar_artefato_3b.py`)**: Integração com `llama-server` para transformar o texto anonimizado em um objeto JSON estruturado seguindo o schema oficial do APDA.

## 🛠️ Requisitos Técnicos

### Hardware (Base de Testes)
*   **GPU**: AMD Radeon RX 580 (8 GB VRAM).
*   **Backend**: `llama.cpp` com suporte a **Vulkan**.
*   **VRAM**: Aproximadamente 2.4 GB a 3.8 GB dependendo do contexto e modelo.

### Modelos de IA Recomendados
*   **Qwen2.5 3B (Q4_K_M)**: Modelo padrão para geração de artefatos. Apresenta o melhor equilíbrio entre velocidade (~42 tokens/s na RX 580) e adesão ao schema JSON.
*   **Qwen3 4B (Q4_K_M)**: Usado para validação de qualidade e melhor separação semântica em contextos complexos.
*   **OpenAI Privacy Filter**: Modelo de ~2.7 GB usado na etapa de anonimização neural.

## 📂 Estrutura do Projeto

*   `entrada/`: Documentos originais (Planilhas de frequência, Diários de Classe, Relatórios AEE).
*   `saida/`: Resultados do processamento (Textos extraídos, textos anonimizados e artefatos JSON finais).
*   `scripts/`: Código fonte do pipeline em Python.
*   `schemas/`: Definições de contrato de dados (JSON Schema do APDA).
*   `logs/`: Rastreabilidade de cada etapa (quais itens foram mascarados, tempo de execução, métricas de tokens).

## 🛡️ Compromisso com a Privacidade

A anonimização é o pilar central deste projeto. O pipeline combina:
*   **Detecção Neural**: Via Privacy Filter.
*   **Memória Local**: Propagação de entidades detectadas para evitar vazamentos em citações indiretas.
*   **Normalização de Metadados**: Nomes de arquivos e pastas são removidos dos prompts enviados ao LLM.
*   **Revisão Humana**: Todo artefato gerado é marcado com `status: pendente` e `validacao_humana: true` por padrão.

## 📖 Como Executar

### Onboarding via CLI npm

Este repositório também inclui um protótipo de pacote npm para descoberta do ambiente e orquestração dos workflows APDA.

Comandos principais:

```bash
node src/cli.js
node src/cli.js doctor
node src/cli.js doctor --json
node src/cli.js onboard
node src/cli.js onboard --dry-run
node src/cli.js server status
node src/cli.js server start
node src/cli.js server stop
node src/cli.js server command
node src/cli.js runs
node src/cli.js runs show <id>
node src/cli.js list-gpus
node src/cli.js list-models
node src/cli.js list-inputs
node src/cli.js workflows --file entrada/arquivo.docx
node src/cli.js workflows --file saida/arquivo.apda.json
node src/cli.js run --file entrada/arquivo.docx --workflow docx-to-apda-json --dry-run
node src/cli.js run --file saida/arquivo.apda.json --workflow validate-apda-json
node src/cli.js validate saida/artefato.json
node src/cli.js validate saida/artefato.json --json
npm test
```

Para testar como pacote local:

```bash
npm pack --dry-run
npm link
apda
apda doctor
apda doctor --json
apda server status
apda server start
apda server stop
apda server command
apda runs
apda runs show <id>
apda validate saida/artefato.json --json
apda onboard --dry-run
apda web
apda web --port 8090
```

Para rodar a suite automatizada:

```bash
npm test
```

Os testes usam `node:test` e nao exigem modelo pesado nem `llama-server` ativo.

O comando `apda` abre a interface interativa principal. Ela guia a seleção de GPU, modelo `.gguf`, arquivo em `entrada/`, workflow compatível e URL do `llama-server`. Se o servidor local não estiver ativo, a CLI pode subir o `llama-server` automaticamente com o modelo escolhido, aguardar o endpoint ficar pronto e encerrar o processo ao final. As escolhas são salvas localmente em `.apda/config.json`, que não deve ser versionado. A CLI usa os scripts Python existentes como motor de processamento.

O comando `apda doctor` diagnostica Python, dependências, GPUs, modelos, arquivos de entrada, binário `llama-server`, endpoint configurado e sugere o comando exato para subir o servidor manualmente.

O comando `apda server` gerencia um `llama-server` iniciado pela CLI:

```bash
apda server status
apda server command
apda server start
apda server stop
```

Quando iniciado por `apda server start`, o PID e o log ficam registrados em `.apda/server.json` e `.apda/llama-server.log`.

O comando `apda runs` lista o historico local de execucoes. Cada workflow executado por `apda run` ou pelo onboarding registra status, tempos, entrada, saidas e erro quando houver:

```bash
apda runs
apda runs show <id>
```

Os registros ficam em `.apda/runs/` e nao devem ser versionados.

O comando `apda validate` usa diretamente o JSON Schema em `schemas/artefato_pedagogico.schema.json`. Use `--json` para obter erros estruturados com campo, keyword e parametros do schema:

```bash
apda validate saida/artefato.json
apda validate saida/artefato.json --json
```

O comando `apda web` sobe uma interface visual local acessível pelo navegador, sem dependência de servidor externo. Ela reutiliza todos os módulos da CLI e expõe uma API JSON em `/api/`. Ao iniciar, abre o navegador automaticamente em `http://localhost:3000`:

```bash
apda web
apda web --port 8090
```

A WebUI oferece as seguintes páginas:

- **Executar** (`/run.html`): wizard para selecionar arquivo, escolher workflow, configurar e acompanhar a execução em tempo real via Server-Sent Events.
- **Diagnóstico** (`/doctor.html`): equivalente visual do `apda doctor`.
- **Servidor** (`/server.html`): gerenciamento do `llama-server` — iniciar, encerrar e monitorar o log.
- **Artefatos** (`/index.html`): visualizador dos arquivos `.apda.json` gerados, com validação de schema integrada.
- **Benchmarks** (`/benchmarks.html`): painel comparativo de modelos.
- **Histórico** (`/history.html`): equivalente visual do `apda runs`, com detalhe de cada execução e auditoria do JSON.

Use `--dry-run` para revisar os comandos sem carregar modelos nem executar o pipeline:

```bash
apda onboard --dry-run
apda run --file "entrada/arquivo_teste.docx" --workflow docx-to-apda-json --dry-run
```

Workflows granulares disponiveis:

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
apda run --file "entrada/arquivo_teste.docx" --workflow extract-only
apda run --file "saida/arquivo_teste.texto_extraido.txt" --workflow anonymize-privacy-filter
apda run --file "saida/arquivo_teste.opf_anonimizado.txt" --workflow generate-apda-json
apda run --file "saida/arquivo_teste.apda.json" --workflow validate-apda-json
```

Variável opcional para apontar para outro `llama-server`:

```bash
APDA_LLAMA_BASE_URL=http://127.0.0.1:8091 apda onboard
```

Se preferir subir o servidor manualmente, use um comando equivalente a:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m modelos/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  --port 8091 \
  -ngl 99
```

### Pipeline Python direto

1.  Instale as dependências:
    ```bash
    pip install -r requirements.txt
    ```
2.  Inicie o servidor local do modelo (ex: Qwen2.5 3B):
    ```bash
    llama-server -m models/qwen2.5-3b-instruct.gguf --port 8081 -ngl 99
    ```
3.  Execute o pipeline:
    ```bash
    python scripts/01_extrair_texto.py
    python scripts/04_privacy_filter_anonimizar.py --input saida/arquivo.txt --output saida/anonimo.txt
    python scripts/05_gerar_artefato_3b.py --input saida/anonimo.txt --output saida/artefato.json
    ```

---
*Este projeto faz parte do ambiente de pesquisa e desenvolvimento do pipeline APDA.*
