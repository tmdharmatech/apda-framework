# Changelog

Registro das decisoes tecnicas, testes e achados do ambiente local do pipeline APDA.

## 2026-04-28 — WebUI local (`apda web`)

### Implementacao da Fase 7: interface visual completa do pipeline

Comando `apda web` implementado como servidor HTTP Node.js puro (`src/web.js`) servindo frontend vanilla e API JSON em `/api/`. Nenhum framework de frontend. Nenhuma duplicacao de logica: todos os modulos de `src/` sao reutilizados diretamente pela API.

#### Arquitetura

- `src/web.js`: roteador HTTP com suporte a arquivos estaticos de `frontend/`, API JSON em `/api/*` e abertura automatica do navegador.
- `src/lib/http.js`: utilitarios `readBody` e `respond` para evitar dependencia circular.
- `src/api/`: 8 modulos de API — `doctor.js`, `server-api.js`, `environment.js`, `workflows-api.js`, `runs.js`, `artifacts.js`, `benchmarks.js`, `validate.js`.
- `frontend/shared.css`: design system centralizado (variaveis CSS, cards, badges, chips, barras, media queries).
- `frontend/nav.js`: navegacao global injetada dinamicamente em todas as paginas.

#### Paginas implementadas

- `frontend/run.html`: wizard de 5 passos (arquivo → workflow → config → execucao SSE → resultado). Execucao assincrona com `POST /api/run` retornando `runId` imediatamente; progresso via `GET /api/run/stream` (Server-Sent Events). SSE resiliente: aguarda ate 9s pelo registro ser criado (race condition eliminada). Compativel com resposta sincrona de servidor nao reiniciado.
- `frontend/doctor.html`: diagnostico visual equivalente ao `apda doctor`. Python, GPUs, modelos, llama-server, inputs, acoes sugeridas.
- `frontend/server.html`: gerenciamento do `llama-server` com botoes Iniciar/Encerrar, barra de progresso de subida, polling automatico e visualizacao do log ao vivo.
- `frontend/index.html`: visualizador de artefatos `.apda.json` com validacao de schema integrada (`POST /api/validate`), badges de validacao na sidebar e suporte a drag-and-drop de JSON local.
- `frontend/benchmarks.html`: painel de benchmark migrado para `GET /api/benchmarks` com estados de erro e lista vazia.
- `frontend/history.html`: historico equivalente ao `apda runs` com tabela filtavel (status, workflow, busca), painel lateral de detalhe, metricas de tokens, JSON bruto para auditoria.

#### Decisoes tecnicas

- `POST /api/run` retorna `{ runId }` imediatamente (202 Accepted) e dispara o workflow em background. SSE monitora o arquivo de registro em `.apda/runs/<runId>.json` com poll de 600ms.
- `runId` pre-gerado no handler da API e passado para `runWorkflow` via `options.runId`, garantindo que o frontend rastreie o ID correto antes do registro ser gravado.
- SSE nao fecha imediatamente quando registro nao e encontrado — implementa retry de ate 15 ciclos (9s) para cobrir a latencia de I/O da criacao do arquivo.
- `src/runs.js` exporta `makeRunId` para ser reutilizado pela API sem criar ID divergente.

#### Pacote npm atualizado

- Script `web` adicionado: `npm run web`.
- `frontend/` adicionado ao campo `files` para distribuicao do pacote.

## 2026-04-28

### Empacotamento do framework como pacote npm e CLI interativa

Objetivo:

- Transformar o framework APDA de scripts Python avulsos em uma experiencia operacional guiada, empacotada como pacote npm local com CLI interativa e preparacao para WebUI.
- Tornar o pipeline acessivel para equipes tecnicas municipais sem exigir conhecimento direto de Python ou `llama.cpp`.

#### Estrutura do pacote npm

Arquivo `package.json` criado com:

- Nome: `@apda/onboarding`.
- Versao: `0.1.0`.
- Tipo: ESM (`"type": "module"`).
- Binario: `apda` apontando para `src/cli.js`.
- Engine minima: Node.js 20.
- Dependencias de producao:
  - `@inquirer/prompts` para menus e perguntas interativas no terminal.
  - `ajv` com suporte a JSON Schema draft 2020-12 para validacao de artefatos.
- Campo `files` para distribuicao do pacote:
  - `src/` (toda a CLI).
  - `schemas/` (schema do artefato pedagogico).
  - `README.md`.
  - `requirements.txt`.
  - Scripts Python essenciais: `scripts/01_extrair_texto.py`, `scripts/04_privacy_filter_anonimizar.py`, `scripts/05_gerar_artefato_3b.py`.

Scripts npm disponiveis: `doctor`, `list-inputs`, `list-models`, `list-gpus`, `test`.

Para testar como pacote local:

```bash
npm link
apda
apda doctor
```

#### Arquitetura de modulos da CLI

A CLI foi organizada em camadas independentes dentro de `src/`:

- `src/cli.js`: ponto de entrada principal; roteamento de todos os comandos.
- `src/detectors/`:
  - `gpu.js`: detecta dispositivos Vulkan e GPU disponiveis.
  - `models.js`: busca arquivos `.gguf` em `modelos/`, `models/` e cache do LM Studio.
  - `input-files.js`: lista arquivos suportados em `entrada/`.
  - `llama-binary.js`: localiza o binario `llama-server` em caminhos conhecidos e config local.
  - `llama-server.js`: testa se um endpoint responde como API compativel com OpenAI.
  - `python-env.js`: detecta Python, `.venv`, scripts obrigatorios e modulos instalados.
- `src/lib/`:
  - `config.js`: leitura e escrita de `.apda/config.json`.
  - `paths.js`: resolucao do diretorio raiz do projeto.
  - `command.js`: utilitarios para construir e executar comandos shell.
- `src/runners/`:
  - `llama-server-process.js`: subida do `llama-server` em background, aguardo do endpoint, formatacao do comando.
- `src/workflows/`:
  - `registry.js`: registro central de workflows com filtro por extensao de arquivo.
  - `run-workflow.js`: execucao sequencial de etapas com suporte a `--dry-run`.
- `src/schema/`:
  - `validate.js`: validacao de artefatos via AJV com mensagens de erro estruturadas por campo.

#### Comando apda doctor

Diagnostica o ambiente completo antes de qualquer execucao.

Itens verificados:

- Python e versao.
- Scripts APDA obrigatorios presentes.
- Modulos Python instalados (`PyMuPDF`, `torch`, `transformers`, `python-docx`, `pandas`, `openpyxl`).
- GPUs detectadas via Vulkan.
- Modelos `.gguf` encontrados.
- Modelo padrao salvo em `.apda/config.json`.
- Binario `llama-server` localizado.
- Endpoint configurado:
  - porta livre;
  - porta ocupada por outro processo;
  - API compativel com OpenAI respondendo.
- Arquivos de entrada disponiveis.
- Sugestao de proximo passo por categoria de problema.

Saidas:

```bash
apda doctor
apda doctor --json
```

#### Comando apda server

Gerencia o ciclo de vida do `llama-server` iniciado pela CLI.

Subcomandos implementados:

- `apda server status`: estado atual (inativo, ativo externo, gerenciado pela CLI).
- `apda server status --json`: relatorio estruturado.
- `apda server command`: exibe o comando resolvido sem subir o servidor.
- `apda server start`: sobe o servidor em background, registra PID em `.apda/server.json` e log em `.apda/llama-server.log`, aguarda o endpoint ficar pronto.
- `apda server stop`: encerra o processo registrado.

Decisao tecnica:

- A CLI diferencia servidor gerenciado (PID registrado) de servidor externo ja ativo.
- O encerramento e explicitamente confirmado para evitar deixar VRAM presa sem querer.

#### Comando apda onboard (fluxo interativo principal)

Fluxo guiado passo a passo usando `@inquirer/prompts`:

1. Selecao de GPU (com destaque para o ultimo usado).
2. Selecao de modelo `.gguf` (com tamanho em disco).
3. Selecao de arquivo em `entrada/`.
4. Selecao de workflow compativel com o arquivo.
5. Confirmacao ou ajuste da URL do `llama-server`.
6. Verificacao do endpoint:
   - Se disponivel: prossegue direto.
   - Se indisponivel: opcoes de subir automaticamente, mostrar comando ou continuar em dry-run.
7. Confirmacao de execucao ou dry-run.
8. Execucao do workflow.
9. Opcao de encerrar o servidor ao final se foi a CLI que subiu.

Configuracao salva automaticamente em `.apda/config.json` apos o onboarding.

#### Registry de workflows granulares

11 workflows registrados em `src/workflows/registry.js`, cada um com extensoes de entrada aceitas e sequencia de etapas:

- `extract-only`: extracao de texto para `.docx`, `.xlsx`, `.xls`, `.pdf`.
- `docx-to-text`: DOCX para texto extraido.
- `xlsx-to-text`: XLSX/XLS para texto extraido.
- `pdf-to-text`: PDF para texto extraido.
- `anonymize-privacy-filter`: TXT para texto filtrado pelo Privacy Filter.
- `generate-apda-json`: TXT anonimizado para JSON APDA.
- `validate-apda-json`: validacao de JSON APDA existente.
- `txt-to-apda-json`: TXT -> Privacy Filter -> JSON -> validacao.
- `docx-to-apda-json`: DOCX -> texto -> Privacy Filter -> JSON -> validacao (workflow completo).
- `xlsx-to-apda-json`: XLSX -> texto -> Privacy Filter -> JSON -> validacao.
- `pdf-to-apda-json`: PDF -> texto -> Privacy Filter -> JSON -> validacao.

A CLI exibe apenas os workflows compativeis com o arquivo selecionado.

Decisao tecnica:

- Os workflows reutilizam arquivos intermediarios ja existentes em `saida/`.
- O `--dry-run` imprime os comandos Python sem executar etapas pesadas.

#### Comando apda run

Executa um workflow diretamente via linha de comando, sem o fluxo interativo.

```bash
apda run --file entrada/arquivo.docx --workflow docx-to-apda-json
apda run --file entrada/arquivo.docx --workflow docx-to-apda-json --dry-run
apda run --file saida/arquivo.opf_anonimizado.txt --workflow generate-apda-json --base-url http://127.0.0.1:8091
```

#### Historico de execucoes

Cada execucao registrada automaticamente em `.apda/runs/<id>.json` com:

- Identificador unico baseado em timestamp e sufixo aleatorio.
- Status: `running`, `ok`, `dry-run`, `error`.
- Arquivo de entrada, workflow, opcoes.
- Arquivos de saida por etapa.
- Tempos de inicio, fim e duracao em ms.
- Mensagem de erro quando houver.

```bash
apda runs
apda runs show <id>
```

Decisao tecnica:

- `.apda/` permanece fora do git.
- Falhas tambem sao registradas para rastreabilidade.

#### Validacao por JSON Schema com AJV

Migrado de validacao manual para `ajv` com suporte a JSON Schema draft 2020-12.

`schemas/artefato_pedagogico.schema.json` e a fonte unica de verdade.

Mensagens de erro exibem:

- Caminho do campo com problema (ex.: `conteudo_pedagogico.barreiras[0]`).
- Keyword violada.
- Valores esperados quando disponiveis.

```bash
apda validate saida/artefato.json
apda validate saida/artefato.json --json
```

#### Suite de testes automatizados

Runner nativo `node:test` sem dependencias externas. Nenhum modelo pesado nem `llama-server` ativo necessario.

Cobertura implementada em `test/`:

- `workflows.test.js`: registry de workflows, filtro por extensao, IDs unicos.
- `llama-server-process.test.js`: montagem do comando `llama-server` com caminhos com espacos, acentos e parenteses.
- `input-files.test.js`: detector de arquivos com caracteres especiais nos nomes.
- `validate.test.js`: validacao AJV com artefato valido e artefato invalido; verificacao de mensagem de erro por campo.
- `cli.test.js`: CLI end-to-end para `dry-run` e rejeicao de workflow incompativel com o arquivo.

```bash
npm test
```

#### Validacao ponta a ponta do workflow docx-to-apda-json


Saidas geradas em `saida/`:

- `*.opf_anonimizado.txt` (saida do Privacy Filter).
- `*.opf_anonimizado.txt.metadata.json` (metadados da anonimizacao).
- `*.apda.json` (artefato pedagogico estruturado).
- `*.apda.json.metadata.json` (metadados da geracao).
- `*.apda.json.raw.txt` (resposta bruta do LLM).

Resultado:

- JSON valido contra o schema.
- Nenhum vazamento dos nomes testados detectado.
- `validacao_humana.necessaria` marcado como `true`.
- `status` marcado como `pendente`.

### Fase seguinte prevista: WebUI local (apda web)

A Fase 7 do roadmap preve a criacao de `apda web`, uma interface visual local que reutiliza os mesmos modulos da CLI.

Fluxo previsto:

```
Ambiente -> Modelo -> Arquivo -> Workflow -> Execucao -> Resultado
```

Criterios de pronto para a WebUI:

- Nao duplicar logica de workflow (reutilizar `src/workflows/`).
- Mostrar progresso em tempo real e arquivos gerados.
- Permitir validar um artefato pela interface.
- Ser utilizavel por equipes tecnicas municipais com baixa familiaridade com terminal.

Decisao tecnica:

- npm continua como camada de experiencia e orquestracao.
- Python continua como motor de processamento enquanto for pragmatico.
- A WebUI e o proximo passo natural apos a estabilizacao da CLI.

## 2026-04-27

### Estrutura inicial inspecionada

- Projeto localizado em `/home/eu/apda-pipeline`.
- Estrutura encontrada:
  - `entrada/`: arquivos originais a processar.
  - `saida/`: textos extraidos, textos anonimizados e artefatos gerados.
  - `logs/`: logs de extracao e anonimizacao.
  - `modelos/`: reservado para modelos locais do pipeline.
  - `schemas/`: schemas JSON.
  - `scripts/`: scripts de processamento.
- Arquivos principais encontrados:
  - `scripts/01_extrair_texto.py`
  - `scripts/02_anonimizar_texto.py`
  - `schemas/artefato_pedagogico.schema.json`

### Scripts existentes avaliados

- `01_extrair_texto.py`
  - Extrai texto de `.docx`, `.xlsx`, `.xls` e `.pdf`.
  - Salva `*.texto_extraido.txt` em `saida/`.
  - Registra log em `logs/extracao_texto.json`.
- `02_anonimizar_texto.py`
  - Lê `*.texto_extraido.txt`.
  - Aplica regras por regex para e-mail, telefone, CPF, data, CEP e alguns campos de nome.
  - Salva `*.texto_anonimizado.txt` em `saida/`.
  - Registra log em `logs/anonimizacao_regras.json`.
- `artefato_pedagogico.schema.json`
  - Define o formato do Artefato Pedagogico Digital Aberto.
  - Campos principais: `tipo_artefato`, `origem`, `conteudo_pedagogico`, `anonimizacao`, `metadados_processamento`, `validacao_humana`.

### Dependencias Python

- A primeira execucao da extracao falhou por ausencia de dependencias:
  - `fitz` / `PyMuPDF`
  - `python-docx`
  - `pandas`
  - `openpyxl`
- O Python do sistema bloqueou instalacao direta por PEP 668.
- Decisao tecnica:
  - Criado ambiente virtual local em `/home/eu/apda-pipeline/.venv`.
  - Dependencias instaladas no `.venv`:
    - `PyMuPDF`
    - `python-docx`
    - `pandas`
    - `openpyxl`

### Arquivos de entrada processados


Formatos:

- 2 arquivos `.xlsx`
- 2 arquivos `.docx`

### Extracao de texto

Comando executado:

```bash
/home/eu/apda-pipeline/.venv/bin/python /home/eu/apda-pipeline/scripts/01_extrair_texto.py
```

Resultado:

- 4 arquivos processados com sucesso.
- Saidas geradas em `saida/`:
  - `*.texto_extraido.txt`
- Log gerado:
  - `logs/extracao_texto.json`

Caracteres extraidos registrados:


### Anonimizacao por regras

Comando executado:

```bash
/home/eu/apda-pipeline/.venv/bin/python /home/eu/apda-pipeline/scripts/02_anonimizar_texto.py
```

Resultado:

- 4 arquivos `*.texto_anonimizado.txt` gerados em `saida/`.
- Log gerado:
  - `logs/anonimizacao_regras.json`

Itens mascarados segundo o log:

  - `data`
  - `telefone`
  - `telefone`
  - `data`
  - `email`
  - `telefone`
  - `data`
  - `telefone`

Achado:

- A anonimizacao por regras ainda nao remove todos os nomes proprios.
- O nome de aluno permaneceu em alguns textos e tambem nos nomes de arquivos.
- Decisao tecnica:
  - Antes de usar LLM em lote, a etapa de anonimização precisa ser reforcada.
  - Metadados enviados ao LLM, incluindo nome de arquivo, tambem precisam ser normalizados/anonimizados.

### Modelos locais encontrados

Modelos relevantes localizados fora do projeto, em cache do LM Studio:

- Qwen3 4B:
  - `/home/eu/.lmstudio/models/lmstudio-community/Qwen3-4B-GGUF/Qwen3-4B-Q4_K_M.gguf`
  - Tamanho: aproximadamente 2.4 GB
- Qwen2.5 3B:
  - `/home/eu/.lmstudio/models/local/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf`
  - Tamanho: aproximadamente 1.8 GB

Tambem foi encontrada pasta de metadados do Qwen3 4B:

- `/home/eu/.lmstudio/hub/models/qwen/qwen3-4b`

### Ambiente GPU

Backend usado:

- `llama.cpp` com Vulkan.

Binarios usados:

- `/home/eu/ai/llama.cpp/build-vulkan/bin/llama-bench`
- `/home/eu/ai/llama.cpp/build-vulkan/bin/llama-cli`
- `/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server`

Dispositivos Vulkan detectados:

- `Vulkan0`: AMD Radeon Vega 3 Graphics
- `Vulkan1`: AMD Radeon RX 580 2048SP, 8 GB VRAM

Decisao tecnica:

- Usar `Vulkan1` para os testes de inferencia, pois corresponde a RX 580 dedicada.

### Benchmark Qwen3 4B na RX 580

Comando base:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-bench \
  -m /home/eu/.lmstudio/models/lmstudio-community/Qwen3-4B-GGUF/Qwen3-4B-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -p 512 \
  -n 128 \
  -r 3 \
  -o md
```

Resultado:

- `pp512`: 301.92 +/- 3.05 tokens/s
- `tg128`: 25.08 +/- 0.04 tokens/s

Leitura tecnica:

- O modelo coube na RX 580 com offload total.
- A geracao ficou utilizavel, mas significativamente mais lenta que o 3B.

### Benchmark Qwen2.5 3B na RX 580

Comando base:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-bench \
  -m /home/eu/.lmstudio/models/local/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -p 512 \
  -n 128 \
  -r 3 \
  -o md
```

Resultado:

- `pp512`: 436.99 +/- 1.06 tokens/s
- `tg128`: 58.06 +/- 1.06 tokens/s

Comparacao:

- Qwen3 4B Q4_K_M:
  - `pp512`: 301.92 tokens/s
  - `tg128`: 25.08 tokens/s
- Qwen2.5 3B Q4_K_M:
  - `pp512`: 436.99 tokens/s
  - `tg128`: 58.06 tokens/s

Leitura tecnica:

- O 3B foi cerca de 2.3x mais rapido na geracao token a token.
- A RX 580 nao tem aceleracoes modernas como matrix cores, int dot ou fp16 rapido no backend detectado.
- Modelos menores e arquiteturas mais favoraveis ao backend Vulkan tendem a se beneficiar mais nessa GPU.

### Teste inicial do LLM no pipeline

Objetivo:

- Testar se o Qwen2.5 3B consegue transformar texto anonimizado em artefato JSON conforme o schema.

Arquivo usado:

- `saida/estudante_teste 5º Ano(1).texto_anonimizado.txt`

Primeiras tentativas:

- `llama-cli` com `--json-schema-file`.
- Saida apresentou problemas praticos:
  - impressao de banner/prompt junto com a resposta;
  - modo interativo apos a geracao;
  - repeticao de itens em arrays;
  - JSON incompleto quando o limite de tokens era atingido.

Decisao tecnica:

- Para integracao do pipeline, preferir `llama-server` com chamada HTTP local em vez de `llama-cli`.
- Usar JSON schema restrito para limitar arrays e reduzir repeticao.

### Teste com llama-server, contexto 8192

Servidor temporario:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m /home/eu/.lmstudio/models/local/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -c 8192 \
  --host 127.0.0.1 \
  --port 8081 \
  --log-disable
```

Resultado da chamada HTTP:

- JSON valido: sim
- Arquivo gerado:
- Tempo total: 18.76 s
- Prompt: 425.9 tokens/s
- Geracao: 41.0 tokens/s
- Tokens gerados: 658
- Uso reportado de VRAM:
  - aproximadamente 2.4 GiB no processo

Achado:

- O modelo gerou JSON estruturalmente valido.
- O conteudo pedagogico foi aproveitavel.
- Houve vazamento de nome proprio porque o texto anonimizado/metadados ainda continham identificadores.

Acao tomada:

- O artefato de teste foi corrigido manualmente para mascarar nomes.
- O servidor temporario da porta `8081` foi encerrado.

### Teste com contexto dobrado, 16384

Objetivo:

- Verificar viabilidade de usar `-c 16384` no Qwen2.5 3B para um unico aluno/documento.

Servidor temporario:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m /home/eu/.lmstudio/models/local/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -c 16384 \
  --host 127.0.0.1 \
  --port 8082 \
  --log-disable
```

Arquivo usado:

- `saida/estudante_teste 5º Ano(1).texto_anonimizado.txt`

Pre-processamento adicional de teste:

- Foi aplicada uma camada temporaria de mascaramento no prompt para nomes conhecidos do arquivo.
- Ainda assim, o nome original do arquivo foi inicialmente passado no metadado do prompt, o que causou vazamento no JSON.

Resultado:

- JSON valido: sim
- Arquivo gerado:
- Tempo total: 18.514 s
- Prompt: 428.5 tokens/s
- Geracao: 42.9 tokens/s
- Tokens de prompt: 1253
- Tokens gerados: 668

Leitura tecnica:

- `-c 16384` foi viavel na RX 580 para documento individual pequeno.
- O aumento de contexto nao degradou a geracao neste teste.
- Para um unico aluno/documento pequeno, o 3B com contexto 16384 e aceitavel.

Achado critico:

- O LLM copiou nome proprio quando o nome apareceu em metadados do prompt, especialmente `nome_arquivo` e `responsavel`.
- Decisao tecnica:
  - O pipeline deve anonimizar nao so o texto extraido, mas tambem nomes de arquivos, nomes de abas, caminhos, metadados e qualquer campo auxiliar enviado ao LLM.

Acao tomada:

- O artefato de teste foi corrigido manualmente:
  - `nome_arquivo` passou a usar `[NOME_REMOVIDO]`.
  - `responsavel` foi definido como `null`.
- Validacao posterior:
  - JSON permaneceu valido.
  - Nomes proprios testados nao permaneceram no arquivo final corrigido.
- O servidor temporario da porta `8082` foi encerrado.

### Teste com dois estudantes no mesmo prompt, contexto 16384

Objetivo:

- Verificar se o Qwen2.5 3B consegue gerar dois artefatos pedagogicos em uma unica chamada usando `-c 16384`.

Servidor temporario:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m /home/eu/.lmstudio/models/local/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -c 16384 \
  --host 127.0.0.1 \
  --port 8083 \
  --log-disable
```

Arquivos usados:

- `saida/estudante_teste 5º Ano(1).texto_anonimizado.txt`

Pre-processamento adicional:

- Nomes conhecidos dos dois arquivos foram mascarados antes de envio ao LLM.
- Os nomes de arquivo enviados ao LLM foram normalizados para:

Resultado:

- JSON valido: sim
- Estrutura gerada: array com 2 objetos
- Arquivo gerado:
- Tempo total: 34.576 s
- Prompt: 420.0 tokens/s
- Geracao: 44.4 tokens/s
- Tokens de prompt: 2544
- Tokens gerados: 1264
- Vazamento dos nomes testados:
  - nao detectado para `Pedro`, `Henrique`, `Costa`, `Jenifer`, `Micaele`, `Viana`

Achado de qualidade:

- Embora o JSON tenha sido valido e sem vazamento dos nomes testados, houve mistura semantica entre os dois estudantes e repeticao de barreiras.
- O primeiro artefato recebeu sinais que parecem pertencer ao segundo estudante.
- Decisao tecnica:
  - Evitar gerar multiplos estudantes no mesmo prompt para producao.
  - Preferir uma chamada por estudante/bloco pedagogico, mesmo quando o contexto comporta mais de um documento.
  - Se houver lote, exigir pos-validacao que compare evidencias do bloco de origem com cada campo extraido.

### Teste com Qwen3 4B, dois estudantes no mesmo prompt, contexto 16384

Objetivo:

- Repetir o teste de dois estudantes no mesmo prompt usando Qwen3 4B para comparar com o Qwen2.5 3B.

Servidor temporario:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m /home/eu/.lmstudio/models/lmstudio-community/Qwen3-4B-GGUF/Qwen3-4B-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -c 16384 \
  --host 127.0.0.1 \
  --port 8084 \
  --log-disable
```

Arquivos usados:

- `saida/estudante_teste 5º Ano(1).texto_anonimizado.txt`

Resultado:

- JSON valido: sim
- Estrutura gerada: array com 2 objetos
- Arquivo gerado:
- Tempo total: 59.152 s
- Prompt: 257.8 tokens/s
- Geracao: 21.7 tokens/s
- Tokens de prompt: 2544
- Tokens gerados: 1068
- Vazamento dos nomes testados:
  - nao detectado para `Pedro`, `Henrique`, `Costa`, `Jenifer`, `Micaele`, `Viana`

Comparacao com Qwen2.5 3B no mesmo teste:

- Qwen2.5 3B:
  - 34.576 s
  - 420.0 tokens/s no prompt
  - 44.4 tokens/s na geracao
  - apresentou mistura semantica mais evidente entre estudantes
- Qwen3 4B:
  - 59.152 s
  - 257.8 tokens/s no prompt
  - 21.7 tokens/s na geracao
  - separou melhor os estudantes, mas ainda apresentou inconsistencias de qualidade

Achados de qualidade:

- O 4B reduziu a mistura semantica entre os dois estudantes em relacao ao 3B.
- Ainda ocorreram problemas:
  - termo em espanhol (`apoyo individualizado`);
  - `validacao_humana.necessaria` como `false` enquanto `status` ficou `pendente`;
  - `risco_reidentificacao` como `nao_avaliado`;
  - campos de metadados inventados, como data de processamento.
- Decisao tecnica:
  - O 4B pode ser util para comparar qualidade, mas e significativamente mais lento na RX 580.
  - Mesmo com melhoria de separacao, o lote com multiplos estudantes no mesmo prompt continua exigindo revisao e validacao automatica adicional.
  - A recomendacao operacional permanece: uma chamada por estudante/bloco pedagogico.

### Reteste de um estudante com contexto 8192 e medicao de VRAM

Objetivo:

- Repetir a geracao de JSON para um unico estudante usando `-c 8192` e capturar o consumo de VRAM dos modelos 3B e 4B.

Arquivo usado:

- `saida/estudante_teste 5º Ano(1).texto_anonimizado.txt`

Pre-processamento adicional:

- Nomes conhecidos do estudante foram mascarados antes de envio ao LLM.

#### Qwen2.5 3B, c8192

Servidor temporario:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m /home/eu/.lmstudio/models/local/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -c 8192 \
  --host 127.0.0.1 \
  --port 8086
```

Consumo de VRAM reportado:

- Total projetado: 2423 MiB
- Modelo: 1834.82 MiB
- KV cache: 288.00 MiB
- Compute: 300.75 MiB
- Slots paralelos automaticos: 4

Resultado da geracao:

- JSON valido: sim
- Arquivo gerado:
- Tempo total: 18.618 s
- Prompt: 432.9 tokens/s
- Geracao: 42.3 tokens/s
- Tokens de prompt: 1215
- Tokens gerados: 667
- Vazamento dos nomes testados:
  - nao detectado para `Pedro`, `Henrique`, `Costa`, `Jenifer`, `Micaele`, `Viana`

#### Qwen3 4B, c8192

Servidor temporario:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m /home/eu/.lmstudio/models/lmstudio-community/Qwen3-4B-GGUF/Qwen3-4B-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -c 8192 \
  --host 127.0.0.1 \
  --port 8087
```

Consumo de VRAM reportado:

- Total projetado: 3829 MiB
- Modelo: 2375.91 MiB
- KV cache: 1152.00 MiB
- Compute: 301.75 MiB
- Slots paralelos automaticos: 4

Resultado da geracao:

- JSON valido: sim
- Arquivo gerado:
- Tempo total: 18.930 s
- Prompt: 299.7 tokens/s
- Geracao: 33.7 tokens/s
- Tokens de prompt: 1215
- Tokens gerados: 500
- Vazamento dos nomes testados:
  - nao detectado para `Pedro`, `Henrique`, `Costa`, `Jenifer`, `Micaele`, `Viana`

Comparacao direta:

- Qwen2.5 3B usou cerca de 2.37 GiB de VRAM e gerou a 42.3 tokens/s.
- Qwen3 4B usou cerca de 3.74 GiB de VRAM e gerou a 33.7 tokens/s.
- Com `-c 8192`, o 4B consumiu aproximadamente 1.4 GiB a mais de VRAM que o 3B.
- O 4B foi mais lento, mas gerou menos tokens para completar a resposta neste teste.

Achado de qualidade:

- Ambos geraram JSON valido e sem vazamento dos nomes testados.
- O 3B marcou `validacao_humana.necessaria` como `true` e `status` como `pendente`, mais alinhado ao protocolo de cautela.
- O 4B marcou `validacao_humana.necessaria` como `false` e `status` como `pendente`, uma inconsistencia a ser corrigida por validacao automatica ou regra de negocio.

### Avaliacao sobre os arquivos XLSX

Observacao:

- Os `.xlsx` extraidos geraram textos muito grandes:
  - aproximadamente 3.46 milhoes de caracteres;
  - aproximadamente 3.54 milhoes de caracteres.

Conclusao tecnica:

- Nao e recomendado enviar um `.xlsx` inteiro como texto unico para o LLM.
- Mesmo com `-c 16384`, o conteudo total nao cabe no contexto util do modelo.
- A extracao atual via `df.to_string()` gera muito ruido: espacos, celulas vazias, tabelas largas e repeticoes.

Decisao tecnica proposta:

- Processar `.xlsx` de forma estruturada:
  - ler abas;
  - identificar blocos por aluno, data, registro ou unidade pedagogica;
  - remover colunas/linhas vazias;
  - anonimizar cada bloco;
  - gerar um artefato por aluno, registro ou bloco pedagogico;
  - validar JSON;
  - marcar para revisao humana.

### Memoria e execucao local

Resumo documentado:

- VRAM:
  - deve receber pesos do modelo, KV cache e buffers de computacao.
  - e o recurso mais importante para velocidade.
- RAM:
  - ajuda com mmap, cache do sistema, estruturas do processo e fallback.
  - nao substitui VRAM em desempenho.
- Disco:
  - armazena o `.gguf`.
  - influencia carregamento, mas menos a velocidade de geracao depois do modelo carregado.

Exemplo observado no teste do 3B:

- Modelo em VRAM: aproximadamente 1.8 GiB.
- Contexto e buffers tambem alocados em VRAM.
- Total do processo no teste com `-c 8192`: aproximadamente 2.4 GiB na RX 580.

Decisao tecnica:

- Qwen2.5 3B Q4_K_M e o melhor candidato inicial para o pipeline local na RX 580.
- Qwen3 4B pode ser usado para comparacao de qualidade, mas tem custo de geracao maior.

## Decisoes tecnicas atuais

- Usar Qwen2.5 3B Q4_K_M como modelo padrao inicial para testes locais.
- Usar `llama-server` para integracao programatica em vez de `llama-cli`.
- Usar RX 580 via `-dev Vulkan1`.
- Usar offload total com `-ngl 99`.
- Para documentos individuais pequenos, `-c 16384` e viavel.
- Para XLSX grandes, nao enviar o arquivo inteiro ao LLM.
- Gerar artefatos por blocos pequenos: aluno, aba, registro ou unidade pedagogica.
- Reforcar anonimização antes de escalar:
  - conteudo;
  - nomes de arquivos;
  - nomes de abas;
  - caminhos;
  - metadados auxiliares;
  - campos enviados no prompt.
- Validacao humana deve permanecer obrigatoria enquanto houver risco de reidentificacao ou interpretacao pedagogica sensivel.

## Pendencias recomendadas

- Melhorar `scripts/02_anonimizar_texto.py` para nomes proprios e metadados.
- Criar script de segmentacao de `.xlsx` por aluno/registro/aba.
- Criar script de chamada ao `llama-server` para gerar artefatos em lote.
- Criar validacao automatica contra `schemas/artefato_pedagogico.schema.json`.
- Criar relatorio de risco de reidentificacao por artefato.
- Registrar metricas por execucao:
  - modelo;
  - contexto;
  - tokens de prompt;
  - tokens gerados;
  - tempo;
  - tokens/s;
  - status JSON;
  - status de anonimização.

## 2026-04-27 - Integracao inicial do OpenAI Privacy Filter

Objetivo:

- Baixar e configurar o OpenAI Privacy Filter para testar a anonimização local antes da chamada ao Qwen2.5 3B.

Arquivos adicionados:

- `modelos/openai-privacy-filter/`
  - modelo baixado do Hugging Face `openai/privacy-filter`;
  - arquivos usados: `config.json`, `model.safetensors`, `tokenizer.json`, `tokenizer_config.json`, `viterbi_calibration.json`, `README.md`;
  - tamanho local observado: aproximadamente 2.7 GiB.
- `scripts/04_privacy_filter_anonimizar.py`
  - aplica o OpenAI Privacy Filter em arquivos `.texto_extraido.txt`;
  - gera `.opf_anonimizado.txt`;
  - grava metadados de execução e rótulos detectados;
  - inclui fallback por regex;
  - inclui memoria local de `private_person` para propagar nomes detectados no restante do documento.
- `scripts/05_gerar_artefato_3b.py`
  - chama o `llama-server` local via API OpenAI-compatible;
  - usa o Qwen2.5 3B para gerar JSON a partir do texto anonimizado pelo Privacy Filter;
  - salva resposta bruta e metadados;
  - aplica pós-processamento determinístico para limitar arrays, normalizar categorias de anonimização e forçar revisão humana pendente.

Dependencias instaladas no `.venv`:

- `torch`
- `transformers`
- `huggingface_hub`
- `safetensors`
- `accelerate`

Observacao tecnica:

- O pacote padrao do PyTorch para Linux instalou bibliotecas CUDA, mesmo a maquina usando GPU AMD/RX 580 para o `llama.cpp`.
- O Privacy Filter foi executado em CPU (`torch.cuda.is_available() = False`).
- Tamanho observado do `.venv` apos instalacao: aproximadamente 5.0 GiB.

Teste do Privacy Filter:

Comando:

```bash
.venv/bin/python scripts/04_privacy_filter_anonimizar.py \
```

Resultado:

- Arquivo gerado:
- Metadados:
- Tempo da etapa Privacy Filter: 22.384 s.
- Caracteres de entrada: 3786.
- Spans detectados diretamente: 6.
- Substituicoes propagadas por memoria local de pessoa: 2.
- Categorias finais registradas:
  - `private_person`: 7 ocorrencias/propagacoes;
  - `private_phone`: 1 ocorrência.
- Busca por nomes conhecidos no texto anonimizado:
  - nao detectou `Pedro`, `Henrique`, `Costa`, `Jenifer`, `Micaele`, `Viana`, `Edjane`, `Gomes`.

Achado importante:

- A correcao aplicada foi criar uma memoria local de entidades `private_person` detectadas no documento e propagar as mesmas expressoes pelo texto.
- Essa abordagem aumenta recall, mas pode mascarar entidades institucionais ou geograficas em excesso.

Decisao tecnica:

- Para APDA, o Privacy Filter deve ser tratado como camada forte de PII, mas nao como anonimização completa.
- O pipeline deve combinar:
  - Privacy Filter;
  - regras deterministicas;
  - memoria local de entidades;
  - normalizacao de metadados;
  - validacao contra vazamento;
  - revisao humana.

Teste com Qwen2.5 3B usando texto filtrado pelo Privacy Filter:

Servidor temporario:

```bash
/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server \
  -m /home/eu/.lmstudio/models/local/Qwen2.5-3B-Instruct-Q4_K_M/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -dev Vulkan1 \
  -ngl 99 \
  -c 8192 \
  --host 127.0.0.1 \
  --port 8091
```

Consumo de VRAM reportado pelo servidor:

- Total projetado: 2423 MiB.
- Modelo: 1834 MiB.
- KV cache: 288 MiB.
- Compute: 300 MiB.
- Slots paralelos automaticos: 4.

Comando de geracao:

```bash
.venv/bin/python scripts/05_gerar_artefato_3b.py \
  --base-url http://127.0.0.1:8091 \
  --max-tokens 1100
```

Resultado final:

- Arquivo gerado:
- Resposta bruta:
- Metadados:
- JSON valido: sim.
- Tempo da geracao final: 13.405 s.
- Tokens de prompt: 1618.
- Tokens gerados: 553.
- Total de tokens: 2171.
- Busca por nomes conhecidos no JSON e na resposta bruta:
  - nao detectou `Pedro`, `Henrique`, `Costa`, `Jenifer`, `Micaele`, `Viana`, `Edjane`, `Gomes`.

Tentativa intermediaria:

- Com `max_tokens` maior, o 3B gerou conteudo pedagogico aproveitavel, mas repetiu `[PRIVATE_PERSON]` em `anonimizacao.itens_mascarados` ate produzir JSON invalido.
- A solucao aplicada foi:
  - reforcar no prompt que `itens_mascarados` deve conter categorias unicas;
  - reduzir `max_tokens`;
  - aplicar pos-processamento deterministico no script.

Conclusao do teste:

- A combinacao `Privacy Filter + memoria local + Qwen2.5 3B` reduziu o risco de vazamento observado nos testes anteriores.
- O custo adicional da etapa Privacy Filter foi cerca de 22 s em CPU para um documento pequeno.
- A geracao pelo 3B permaneceu viavel e rapida na RX 580.
- O ponto critico passa a ser calibrar recall/precision da anonimização e evitar excesso de mascara em dados institucionais ou geograficos.
