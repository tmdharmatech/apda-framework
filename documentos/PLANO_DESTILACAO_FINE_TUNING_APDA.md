# Plano operacional de destilacao e fine-tuning do APDA Framework

Este documento descreve uma abordagem pratica para executar as etapas de destilacao supervisionada e fine-tuning de modelos no contexto do APDA Framework, com foco na transformacao de artefatos pedagogicos rudimentares em JSON APDA valido, anonimizado, auditavel e pedagogicamente revisavel.

## 1. Definir a unidade de trabalho

Antes de treinar qualquer modelo, e necessario definir qual sera a menor unidade de entrada processada pelo sistema.

Recomendacao inicial:

- 1 aluno em 1 artefato;
- 1 aba de planilha por vez;
- 1 relatorio ou documento por vez;
- nunca uma pasta inteira como entrada direta de treino.

Essa separacao reduz o risco de mistura semantica entre estudantes, facilita a validacao humana e torna as metricas mais confiaveis.

Formato de entrada recomendado:

```json
{
  "tipo_arquivo": "xlsx",
  "template_origem": "diario_aee_municipio_x_v1",
  "texto_extraido": "...",
  "tabelas_extraidas": [],
  "instrucoes": "Gerar APDA JSON sem inventar campos."
}
```

Formato de saida esperado:

```json
{
  "manifesto": {},
  "apda": {},
  "campos_ausentes": [],
  "evidencias": []
}
```

## 2. Criar uma taxonomia antes do dataset

Antes da destilacao, deve existir uma versao inicial e controlada de:

- tipos de artefato;
- campos obrigatorios;
- campos opcionais;
- categorias pedagogicas;
- tipos de dado sensivel;
- regras de anonimimizacao;
- schema JSON APDA.

Sem essa taxonomia, cada anotador e cada modelo-professor tende a produzir um padrao diferente, dificultando a avaliacao e o treinamento.

## 3. Destilacao supervisionada

Neste projeto, destilacao supervisionada significa usar um modelo-professor de maior capacidade para gerar uma primeira versao estruturada dos artefatos, seguida de validacao automatica e revisao humana. O objetivo nao e confiar cegamente no professor, mas acelerar a producao de exemplos candidatos ao dataset ouro.

Fluxo pratico:

1. Extrair texto, tabelas e metadados com o APDA Framework.
2. Anonimizar antes de enviar ao modelo-professor, especialmente se ele for uma API externa.
3. Solicitar ao modelo-professor que:
   - identifique o tipo de artefato;
   - segmente por estudante ou registro;
   - gere APDA JSON;
   - liste evidencias textuais usadas;
   - marque campos ausentes como `null`;
   - nao infira diagnostico;
   - nao invente informacoes ausentes.
4. Validar a saida com JSON Schema.
5. Rodar checagem de dados pessoais remanescentes.
6. Submeter a saida a revisao humana.
7. Incorporar ao dataset ouro somente exemplos aprovados ou corrigidos.

Formato recomendado para exemplos de treino supervisionado:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "Voce transforma artefatos pedagogicos anonimizados em JSON APDA valido. Nao invente dados."
    },
    {
      "role": "user",
      "content": "Texto extraido: ... Schema APDA: ..."
    },
    {
      "role": "assistant",
      "content": "{\"tipo_artefato\":\"diario_aee\"}"
    }
  ]
}
```

## 4. Fazer benchmark antes do fine-tuning

Antes de treinar, e recomendavel testar modelos base nos mesmos exemplos. O objetivo e medir se o problema exige fine-tuning ou se pode ser resolvido com prompt, schema e validacao.

Modelos candidatos para benchmark:

- Qwen;
- Llama;
- Gemma;
- Phi;
- SmolLM ou equivalente compacto.

Metricas minimas:

- taxa de JSON valido;
- aderencia ao schema;
- campos inventados;
- campos corretos;
- campos ausentes;
- vazamento de dados pessoais;
- separacao correta por aluno;
- tempo por artefato;
- custo por 1.000 documentos.

O fine-tuning so deve avancar se o modelo base estiver errando de forma recorrente e corrigivel por exemplos supervisionados.

## 5. Fine-tuning com LoRA ou QLoRA

Para a primeira versao, recomenda-se supervised fine-tuning com LoRA ou QLoRA, nao full fine-tuning. Essa abordagem reduz custo, memoria e risco operacional.

Configuracao inicial sugerida:

- 500 a 1.000 exemplos ouro para prova de conceito;
- 3.000 a 10.000 exemplos para um modelo util;
- 20.000 ou mais exemplos diversos para maior robustez;
- LoRA rank `16` ou `32`;
- 2 a 4 epocas;
- validacao separada por municipio, template e tipo de artefato;
- versionamento do modelo base, adapter, dataset e schema.

Divisao recomendada dos dados:

- treino: templates conhecidos;
- validacao: templates conhecidos com exemplos novos;
- teste dificil: templates de municipios ou redes nao vistos durante o treino.

O teste dificil e essencial para medir generalizacao real.

## 6. Exportacao e inferencia

Apos o treinamento:

1. Testar o adapter LoRA no ambiente PyTorch.
2. Mesclar o adapter ao modelo base, quando aplicavel.
3. Converter para GGUF para inferencia local com `llama.cpp`.
4. Quantizar em Q4, Q5 e Q8.
5. Comparar qualidade, tempo e uso de memoria.

Para producao municipal, e recomendavel manter duas rotas:

- modelo maior em servidor central, para maior qualidade;
- modelo GGUF menor local, para execucao offline ou de baixo custo.

## 7. O que nao deve ser delegado ao modelo

O modelo nao deve ser treinado para:

- decidir direito educacional;
- diagnosticar deficiencia;
- recomendar atendimento obrigatorio;
- substituir validacao pedagogica;
- fazer anonimimizacao sozinho;
- operar arquivos diretamente sem validacao externa.

O papel do modelo deve ser transformar conteudo pedagogico extraido em estrutura APDA. O framework deve continuar responsavel por extracao, anonimimizacao, validacao, logs, auditoria e governanca.

## 8. Entregaveis esperados da campanha com secretarias

Para cada secretaria municipal ou estadual, solicitar:

- templates vazios;
- exemplos ficticios preenchidos;
- glossario local;
- instrucoes de preenchimento;
- tipos de artefatos usados;
- exemplos de campos problemáticos;
- indicacao se o material e ficticio, anonimizado ou real;
- autorizacao institucional de uso para pesquisa, desenvolvimento e avaliacao.

O principal ativo criado pela campanha sera o dataset ouro pedagogico, brasileiro, versionado, validado e juridicamente limpo. O fine-tuning deve ser tratado como consequencia desse ativo, nao como ponto de partida.
