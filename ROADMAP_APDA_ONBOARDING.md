# Roadmap APDA Onboarding CLI/WebUI

Este roadmap organiza os proximos passos para transformar o pacote npm em uma interface local de operacao do pipeline APDA.

## Objetivo

Construir uma experiencia guiada para diagnosticar ambiente, selecionar GPU/modelo/arquivo, subir `llama-server`, executar workflows APDA, validar resultados e futuramente expor o mesmo fluxo em WebUI local.

## Estado atual

- CLI npm inicial criada em `src/cli.js`.
- `apda` abre onboarding interativo.
- Onboarding seleciona GPU, modelo `.gguf`, arquivo de entrada e workflow.
- Onboarding pode subir `llama-server` automaticamente e encerrar ao final.
- `run --dry-run` mostra os comandos sem executar pipeline.
- Workflow `docx-to-apda-json` foi validado ponta a ponta com Qwen2.5 3B.
- Configuracao local salva em `.apda/config.json`.

## Fase 1 - Diagnostico robusto

Status: concluida no prototipo atual.

Prioridade: alta.

Entregas:

- Melhorar `apda doctor`.
- Detectar binario `llama-server`.
- Mostrar modelo padrao salvo em `.apda/config.json`.
- Verificar se a porta configurada esta livre, ocupada ou respondendo como API compativel.
- Sugerir comando exato para subir o servidor manualmente.
- Validar Python, `.venv`, scripts obrigatorios e dependencias principais.

Comandos esperados:

```bash
apda doctor
apda doctor --json
```

Criterios de pronto:

- `doctor` explica claramente o que esta pronto, faltando ou inconsistente.
- Saida humana e saida JSON existem.
- Mensagens indicam proximas acoes concretas.

Implementado:

- `apda doctor` com saida humana.
- `apda doctor --json` com relatorio estruturado.
- Deteccao de binario `llama-server`.
- Deteccao do modelo padrao em `.apda/config.json`.
- Inspecao do endpoint configurado e classificacao da porta.
- Comando sugerido para subir `llama-server`.
- Checagem de Python, scripts obrigatorios e modulos principais.

## Fase 2 - Gerenciamento do servidor

Status: concluida no prototipo atual.

Prioridade: alta.

Entregas:

- Criar comando `apda server`.
- Permitir testar, subir e parar `llama-server`.
- Reusar modelo e URL salvos na configuracao.
- Exibir comando resolvido antes de iniciar.
- Registrar PID quando a CLI subir o servidor em background.

Comandos esperados:

```bash
apda server status
apda server start
apda server stop
apda server command
```

Criterios de pronto:

- Usuario consegue operar o servidor sem sair da CLI.
- CLI diferencia servidor gerenciado pela APDA de servidor externo ja ativo.
- Encerramento evita deixar VRAM presa sem querer.

Implementado:

- `apda server status`.
- `apda server status --json`.
- `apda server command`.
- `apda server start`.
- `apda server stop`.
- Registro local de PID em `.apda/server.json`.
- Log do servidor em `.apda/llama-server.log`.
- Validacao de endpoint antes/depois da subida.

## Fase 3 - Workflows granulares

Status: concluida no prototipo atual.

Prioridade: alta.

Entregas:

- Separar workflows completos em etapas menores.
- Permitir executar somente extracao, anonimizacao, geracao ou validacao.
- Permitir reusar arquivos intermediarios ja existentes.
- Melhorar nomes e descricoes dos workflows na interface interativa.

Workflows previstos:

```text
extract-only
anonymize-privacy-filter
generate-apda-json
validate-apda-json
docx-to-text
txt-to-apda-json
docx-to-apda-json
xlsx-to-apda-json
pdf-to-apda-json
```

Criterios de pronto:

- CLI mostra apenas workflows compativeis com o arquivo selecionado.
- `dry-run` funciona para todos os workflows.
- Cada etapa gera saidas previsiveis em `saida/`.

Implementado:

- `extract-only`.
- `docx-to-text`.
- `xlsx-to-text`.
- `pdf-to-text`.
- `anonymize-privacy-filter`.
- `generate-apda-json`.
- `validate-apda-json`.
- `txt-to-apda-json`.
- `docx-to-apda-json`.
- `xlsx-to-apda-json`.
- `pdf-to-apda-json`.
- Reuso de arquivos intermediarios em `saida/`.
- `dry-run` validado para etapas individuais.

## Fase 4 - Historico de execucoes

Status: concluida no prototipo atual.

Prioridade: media.

Entregas:

- Salvar metadados de cada execucao em `.apda/runs/`.
- Registrar arquivo de entrada, workflow, modelo, GPU, tempos, status e arquivos gerados.
- Criar comando para listar historico.
- Permitir abrir/ver detalhes de uma execucao anterior.

Comandos esperados:

```bash
apda runs
apda runs show <id>
```

Criterios de pronto:

- Cada execucao tem identificador estavel.
- Falhas tambem sao registradas.
- Historico nao entra no git.

Implementado:

- Registro automatico de execucoes em `.apda/runs/`.
- Status `running`, `ok`, `dry-run` e `error`.
- Entrada, workflow, opcoes, etapas, saidas, tempos e erro quando houver.
- `apda runs` para listar execucoes recentes.
- `apda runs show <id>` para abrir o JSON completo de uma execucao.
- `.apda/` permanece fora do git.

## Fase 5 - Validacao baseada em JSON Schema

Status: concluida no prototipo atual.

Prioridade: media.

Entregas:

- Trocar validador manual por `ajv`.
- Usar diretamente `schemas/artefato_pedagogico.schema.json`.
- Melhorar mensagens de erro com caminho do campo.
- Expor validacao em modo humano e JSON.

Comandos esperados:

```bash
apda validate saida/artefato.json
apda validate saida/artefato.json --json
```

Criterios de pronto:

- Erros de schema indicam campo, regra violada e valor problemático quando possivel.
- Schema passa a ser a fonte unica de verdade.

Implementado:

- Validador migrado para `ajv` com suporte a JSON Schema draft 2020-12.
- `schemas/artefato_pedagogico.schema.json` usado como fonte unica de verdade.
- `apda validate <arquivo>`.
- `apda validate <arquivo> --json`.
- Erros humanos com caminho do campo.
- Erros estruturados com `path`, `keyword`, `schemaPath` e `params`.

## Fase 6 - Testes automatizados

Status: concluida no prototipo atual.

Prioridade: media.

Entregas:

- Adicionar runner de testes Node.
- Testar detectores de GPU, modelos, entradas e `llama-server`.
- Testar registry de workflows.
- Testar `dry-run`.
- Testar montagem de comando do servidor.
- Testar validacao de artefato.

Comandos esperados:

```bash
npm test
```

Criterios de pronto:

- Testes rodam sem modelo pesado.
- Testes nao exigem `llama-server` ativo.
- Casos com caminhos contendo espacos e acentos sao cobertos.

Implementado:

- Runner nativo `node --test`.
- Script `npm test`.
- Testes de registry de workflows.
- Testes de montagem de comando do `llama-server`.
- Testes de detector de arquivos com espacos, acentos e parenteses.
- Testes de validacao AJV com artefato valido e invalido.
- Testes de CLI para `dry-run` e rejeicao de workflow incompativel.

## Fase 7 - WebUI local

Status: concluida.

Entregas implementadas:

- Comando `apda web [--port N]` registrado na CLI.
- Servidor HTTP Node.js puro em `src/web.js` servindo `frontend/` como estáticos.
- API JSON em `/api/` reutilizando todos os módulos de `src/` sem duplicação.
- Server-Sent Events em `GET /api/run/stream` para progresso em tempo real.
- Design system compartilhado em `frontend/shared.css` e navegação global em `frontend/nav.js`.
- Paginas implementadas:
  - `frontend/run.html`: wizard de execucao (arquivo → workflow → config → progresso SSE → resultado).
  - `frontend/doctor.html`: diagnostico visual equivalente ao `apda doctor`.
  - `frontend/server.html`: gerenciamento do `llama-server` com log ao vivo.
  - `frontend/index.html`: visualizador de artefatos com validacao de schema integrada.
  - `frontend/benchmarks.html`: painel de benchmark.
  - `frontend/history.html`: historico de execucoes com detalhe e auditoria JSON.
- Navegador abre automaticamente ao iniciar o servidor.

Comandos:

```bash
apda web
apda web --port 8090
npm run web
```

Criterios de pronto atingidos:

- WebUI nao duplica logica de workflow.
- Interface mostra progresso em tempo real e arquivos gerados.
- Usuario consegue validar um artefato pela interface.
- Todas as paginas tem tratamento de erro e estado vazio visivel.

## Ordem recomendada

1. Melhorar `doctor`.
2. Criar `apda server`.
3. Quebrar workflows em etapas menores.
4. Adicionar historico de execucoes.
5. Migrar validacao para `ajv`.
6. Adicionar testes automatizados.
7. Iniciar WebUI local.

## Principios de implementacao

- Manter npm como camada de experiencia e orquestracao.
- Manter Python como motor de processamento enquanto for pragmatico.
- Evitar downloads automaticos pesados sem confirmacao explicita.
- Sempre oferecer `--dry-run` para operacoes caras.
- Preservar privacidade: dados, logs e historico local devem ficar fora do git.
