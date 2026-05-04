PROPOSTA PARA PARTICIPAÇÃO NO SANDBOX REGULATÓRIO DE IA NA EDUCAÇÃO — MEC

APDA Framework — Artefatos Pedagógicos Digitais Abertos

Framework aberto para transformação, anonimização e estruturação interoperável de artefatos pedagógicos rudimentares em datasets municipais padronizados


---

1. Informações sobre a entidade interessada

1.1 Denominação da pessoa jurídica

Nome da entidade proponente: [preencher]
CNPJ: [preencher]
Natureza jurídica: [startup / empresa de tecnologia / empresa do setor educacional / outra]
Endereço: [preencher]
Município/UF: [preencher]
E-mail institucional: [preencher]
Telefone: [preencher]
Sítio eletrônico: [preencher, se houver]

1.2 Representante legal

Nome do representante legal: [preencher]
CPF: [preencher]
Cargo/função: [preencher]
E-mail: [preencher]
Telefone: [preencher]

O representante legal indicado possui poderes para representar a entidade proponente no âmbito do Edital de Chamamento Público para participação no Piloto do Ambiente Regulatório Experimental em Inteligência Artificial na Educação — Sandbox Regulatório, responsabilizando-se pela veracidade das informações prestadas, pelo recebimento de comunicações oficiais e pela interlocução institucional com o Ministério da Educação e a Comissão de Sandbox.



---

2. Descrição da equipe atuante no projeto

A equipe do projeto será composta por perfis multidisciplinares, reunindo competências em ciência de dados, inteligência artificial, engenharia de software, educação especial inclusiva, governança de dados, proteção de dados pessoais e avaliação pedagógica.

2.1 Responsável técnico

Nome: [preencher]
Formação: [preencher]
Experiência relevante: Ciência de Dados, Mineração de Dados Educacionais, Inteligência Artificial aplicada à educação, governança de dados educacionais e desenvolvimento de soluções digitais para redes públicas de ensino.

2.2 Perfis previstos na equipe

A equipe técnica e pedagógica poderá incluir:

1. Coordenação técnica do projeto
Responsável pela arquitetura geral do APDA Framework, integração dos módulos, definição dos workflows e supervisão das entregas técnicas.


2. Especialista em Ciência de Dados e Mineração de Dados Educacionais
Responsável pela modelagem dos dados, definição dos schemas, métricas de qualidade, avaliação dos datasets e análise de padrões educacionais.


3. Engenheiro(a) de Machine Learning / IA
Responsável pela seleção, benchmark, fine-tuning, destilação supervisionada por dados e avaliação dos modelos de IA utilizados no projeto.


4. Desenvolvedor(a) de software / backend
Responsável pela implementação dos scripts, APIs, CLI, WebUI, logs, validações e empacotamento técnico da solução.


5. Especialista em Educação Especial Inclusiva / AEE
Responsável por validar a pertinência pedagógica dos campos, categorias, artefatos, estratégias e estruturas produzidas pelo framework.


6. Especialista em LGPD e governança de dados
Responsável por orientar anonimização, minimização de dados, controle de riscos, descarte seguro e documentação de conformidade.


7. Revisor(a) humano(a) / avaliador(a) pedagógico(a)
Responsável pela validação dos artefatos estruturados, verificação de erros semânticos, checagem de vazamento de dados e aprovação dos exemplos que comporão o dataset ouro.



2.3 Parcerias técnico-científicas previstas

A proposta poderá contar com colaboração técnico-científica de instituições públicas de ensino, pesquisa e inovação, em especial para:

benchmark de modelos abertos;

curadoria de dataset;

fine-tuning e destilação supervisionada;

avaliação de riscos;

validação pedagógica;

formação de estudantes e profissionais;

produção de documentação técnica aberta.


O projeto buscará interlocução com instituições como Institutos Federais, universidades públicas e laboratórios de pesquisa em ciência de dados, inteligência artificial, informática na educação, engenharia de software e educação inclusiva.


---

3. Descrição da infraestrutura física e tecnológica

A entidade proponente dispõe ou buscará dispor de infraestrutura compatível com a execução do projeto, considerando que o MEC não fornecerá recursos técnicos, financeiros ou infraestrutura tecnológica para os projetos selecionados.

3.1 Infraestrutura física

A execução inicial do projeto poderá ocorrer em ambiente próprio da entidade proponente, com possibilidade de apoio de parceiros institucionais para atividades de validação, testes técnicos, benchmark e capacitação.

3.2 Infraestrutura computacional

A infraestrutura tecnológica prevista contempla:

estações locais para desenvolvimento, testes e inferência;

ambiente Linux para execução de scripts e pipelines;

uso de modelos quantizados em formato GGUF;

execução local via llama.cpp, Vulkan e/ou CPU;

possibilidade de uso de máquinas com CUDA em instituições parceiras para fine-tuning e destilação;

repositório Git para versionamento do código-fonte;

armazenamento local e controlado para dados anonimizados;

ferramentas de validação por JSON Schema;

logs de execução e trilhas de auditoria;

módulos de CLI e WebUI para onboarding e operação.


3.3 Infraestrutura de IA

A arquitetura técnica utilizará preferencialmente modelos abertos ou open-weight, com foco em:

OCR e parsing documental;

anonimização e detecção de dados pessoais;

estruturação semântica em JSON;

validação automática;

geração de logs e evidências;

fine-tuning leve por LoRA/QLoRA, quando aplicável;

exportação para formatos portáveis como GGUF.



---

4. Descrição da estrutura de governança da entidade interessada

A governança do projeto será organizada em camadas, com separação clara entre coordenação institucional, desenvolvimento técnico, validação pedagógica, governança de dados e supervisão humana.

4.1 Princípios de governança

O APDA Framework será conduzido com base nos seguintes princípios:

proteção integral de direitos educacionais;

privacidade e proteção de dados pessoais;

minimização e anonimização de dados;

supervisão humana obrigatória;

rastreabilidade de todas as etapas;

transparência metodológica;

auditabilidade;

abertura de código e documentação;

interoperabilidade;

não substituição de profissionais da educação;

não realização de decisões automatizadas sobre estudantes.


4.2 Comitê interno de acompanhamento

Será instituído um comitê interno de acompanhamento do projeto, composto por representantes das áreas técnica, pedagógica e de governança de dados. Esse comitê terá como atribuições:

acompanhar a execução do projeto;

aprovar alterações relevantes na arquitetura;

monitorar riscos;

validar protocolos de anonimização;

revisar métricas de desempenho;

acompanhar testes;

supervisionar a documentação;

deliberar sobre incidentes ou inconsistências.


4.3 Supervisão humana

Todas as saídas geradas pelo APDA Framework serão classificadas como artefatos pendentes de validação humana, não podendo ser utilizadas como decisão final automática. O framework não realizará diagnóstico, classificação de estudantes, recomendação obrigatória de atendimento, substituição de docentes ou definição automática de direitos educacionais.


---

5. Projeto de Solução de IA — Anexo IV


---

5.1 Título da solução de IA

APDA Framework — Artefatos Pedagógicos Digitais Abertos

Subtítulo: Framework aberto para transformação, anonimização e estruturação interoperável de artefatos pedagógicos rudimentares em datasets municipais padronizados.


---

5.2 Principal área de aplicação da solução de IA

A solução se enquadra prioritariamente nas seguintes áreas previstas no Anexo IV do edital:

Inclusão digital e acessibilidade;

Gestão educacional;

Apoio pedagógico complementar;

Integração e análise de dados educacionais;

Interoperabilidade;

Inovação pública digital;

Redução de desigualdades.


O APDA Framework tem como foco inicial a educação especial inclusiva, especialmente os registros relacionados ao Atendimento Educacional Especializado — AEE, estudos de caso, diários pedagógicos, planos de atendimento, relatórios, planilhas e demais artefatos utilizados por redes municipais de ensino.


---

5.3 Como a solução se beneficiará da participação no Sandbox Regulatório
A participação no Sandbox Regulatório do MEC é estratégica para o APDA Framework em cinco dimensões que não podem ser substituídas por desenvolvimento técnico isolado.

1. Validação do pipeline de anonimização como condição de uso público
O problema técnico central do APDA envolve documentos que contêm dados altamente sensíveis: nomes de crianças com deficiência, hipóteses diagnósticas, informações familiares, histórico escolar, laudos e descrições de barreiras de aprendizagem. A anonimização não é uma etapa do pipeline — é a condição que torna todo o restante eticamente possível.
O ambiente regulatório experimental permitirá testar, sob supervisão técnica do MEC, se o pipeline multicamadas de anonimização adotado pelo APDA — combinando regras determinísticas, modelos neurais de detecção de PII e revisão humana obrigatória — é suficientemente robusto para uso em escala municipal. Essa validação regulatória tem valor que nenhum teste laboratorial isolado pode substituir: ela produz evidência reconhecida pelo próprio regulador sobre a adequação do framework às exigências da LGPD e do ECA Digital no contexto da educação especial.

2. Produção de evidência sobre o problema técnico central
O Sandbox oferece a condição ideal para documentar empiricamente o problema que o APDA resolve: a heterogeneidade real dos formatos de documentação pedagógica entre municípios. Em ambiente supervisionado, com dados sintéticos e anonimizados de diferentes configurações municipais, será possível medir com precisão o quanto os formatos variam, como o modelo de inferência de estrutura implícita responde a essa variação e quais são os limites de generalização do framework para formatos nunca observados no treinamento.
Esses dados são uma contribuição científica inédita — não existem estudos publicados sobre a variabilidade de formatos de documentação pedagógica em redes municipais brasileiras — e são exatamente o tipo de evidência que o MEC precisa para formular diretrizes de padronização mínima compatíveis com a realidade operacional dos municípios.

3. Diálogo regulatório sobre o marco de interoperabilidade com a EducaDados
A Portaria 269/2026 institui a EducaDados mas delega ao MEC a definição dos conjuntos mínimos de dados e padrões técnicos que as redes municipais deverão adotar. O APDA, como framework de entrada dessa infraestrutura — convertendo documentos municipais heterogêneos em dados estruturados compatíveis — tem interesse direto e legítimo nessa definição.
A participação no Sandbox cria canal formal de diálogo com a Comissão técnica responsável pela EducaDados no momento em que esses padrões ainda estão sendo definidos. O schema APDA pode informar e ser informado por esses padrões — criando alinhamento desde a origem em vez de adaptação posterior. Esse diálogo não é possível fora de um ambiente regulatório estruturado.

4. Construção de evidência para escalabilidade estadual e nacional
A visão de longo prazo do APDA prevê uma família de modelos em diferentes tamanhos, adequados a diferentes níveis de infraestrutura: desde municípios com hardware básico até servidores regionais de consórcios municipais e APIs estaduais disponibilizadas por governos como o da Bahia para toda a rede municipal. Essa escalabilidade requer evidência de que o framework funciona de forma confiável, auditável e segura em condições reais.
O Sandbox produz exatamente esse tipo de evidência — reconhecida institucionalmente pelo MEC — que viabiliza conversas com governos estaduais, consórcios e organismos de financiamento público sobre a adoção da arquitetura em escala. Sem essa validação, o APDA é uma solução técnica promissora. Com ela, é uma política pública em teste.

5. Alinhamento com o Plano Brasileiro de Inteligência Artificial e o ecossistema nacional de inovação pública
O APDA foi concebido em alinhamento com os princípios do Plano Brasileiro de Inteligência Artificial: uso ético, soberania tecnológica, redução de desigualdades e abertura de código. A participação no Sandbox posiciona o framework dentro do ecossistema formal de inovação pública em IA do MEC, criando visibilidade institucional junto a atores — secretarias estaduais, Institutos Federais, universidades públicas, organismos de fomento — que são os parceiros naturais para as próximas fases do projeto.
O Sandbox não é o destino do APDA. É a condição para que o APDA chegue onde precisa chegar: nas secretarias municipais de educação de municípios que ainda registram em papel o atendimento de crianças com deficiência — e que merecem infraestrutura à altura do trabalho que já fazem.


---

5.4 TRL — Technology Readiness Level da solução

A solução encontra-se em estágio inicial de desenvolvimento, compatível com o requisito do edital de que as soluções estejam em fase inicial e utilizem dados anonimizados .

TRL estimado: TRL 4 a TRL 5.

Justificativa

O projeto já possui:

definição conceitual do framework;

arquitetura inicial do pipeline;

testes locais com modelos GGUF;

benchmark inicial em ambiente computacional limitado;

schema preliminar de saída em JSON;

protótipos de extração, anonimização e geração de artefatos;

validação inicial de modelos pequenos executando localmente;

plano de evolução para destilação supervisionada e fine-tuning.


Ainda será necessário, no contexto do Sandbox:

ampliar o conjunto de testes;

consolidar dataset ouro validado;

realizar avaliação pedagógica;

formalizar a Avaliação de Impacto Algorítmico;

testar a solução com diferentes tipos de artefatos;

validar o framework em ambiente controlado;

documentar métricas, riscos e salvaguardas.



---

5.5 Componentes arquiteturais e modelos de IA utilizados
O APDA Framework é composto por módulos independentes, auditáveis e interoperáveis, organizados em um fluxo técnico de transformação de artefatos pedagógicos rudimentares em dados estruturados. O desafio central que o framework endereça não é a simples extração de texto — é a compreensão de esquemas implícitos variáveis, problema técnico ainda sem solução consolidada no contexto da gestão educacional pública brasileira.
Redes municipais de ensino desenvolveram, ao longo do tempo, sistemas próprios de organização pedagógica: planilhas Excel com estruturas heterogêneas, formulários Word com campos livres, diários em papel digitalizado via fotografia. Cada município construiu sua própria ontologia pedagógica informal, funcional para o trabalho cotidiano dos profissionais de AEE, mas opaca para qualquer sistema de informação padronizado. Uma planilha do município A pode reunir, em uma única aba, o Estudo de Caso, o PAEE e os registros de atendimento de um mesmo aluno — separados por cores de fundo, células mescladas e quebras visuais que um sistema convencional de extração de texto simplesmente descarta.
O APDA Framework foi concebido especificamente para enfrentar essa heterogeneidade estrutural como condição de operação, não como exceção.

5.5.1 Módulo de ingestão multiformato
Responsável por receber e identificar arquivos de entrada nos formatos predominantes nas redes municipais:
planilhas Excel (.xlsx, .xls) com estruturas heterogêneas e múltiplos artefatos por aba; documentos Word (.docx) com campos livres, formulários e narrativas mistas; PDFs gerados por sistemas próprios ou digitalizados a partir de documentos físicos; imagens de documentos capturadas por dispositivos móveis; diários de AEE, estudos de caso, planos de atendimento e relatórios pedagógicos em qualquer combinação dos formatos acima.

5.5.2 Módulo de extração com preservação de contexto estrutural
Este é o módulo que diferencia fundamentalmente o APDA de pipelines genéricos de extração de documentos.
Para documentos com estrutura visual implícita — especialmente planilhas —, a extração de texto bruto é insuficiente. Um professor de AEE que utiliza cor de fundo azul para delimitar o Estudo de Caso e cor verde para o PAEE está codificando informação estrutural que não existe no texto, mas que é essencial para a correta separação e classificação dos artefatos.
O módulo preservará e converterá esses sinais visuais em representação textual estruturada, transmitida ao modelo de linguagem como contexto explícito:
cor de fundo e bordas de células como indicadores de seção; células mescladas como delimitadores de blocos semânticos; quebras de linha e espaçamento como separadores de artefatos; cabeçalhos e labels como indicadores de tipo de campo; posição relativa de regiões como indicador de hierarquia.
Ferramentas previstas: openpyxl para planilhas, python-docx para documentos Word, PyMuPDF e Docling para PDFs, Tesseract e PaddleOCR para documentos digitalizados.

5.5.3 Módulo de inferência de estrutura implícita
Responsável pela tarefa central do framework: identificar, a partir da representação estruturada do documento, quais artefatos pedagógicos estão presentes, onde cada um começa e termina, e como seus campos se mapeiam para o schema APDA — independentemente do formato específico do município de origem.
O módulo operará por raciocínio encadeado explícito, no qual o modelo identifica as seções presentes antes de extrair os campos de cada artefato. Esse raciocínio intermediário é parte do processo de treinamento e compõe o dataset ouro do projeto.
A variabilidade de formatos entre municípios é tratada como recurso central de treinamento: quanto maior a diversidade de estruturas no dataset, maior a capacidade de generalização do modelo para formatos ainda não observados. O objetivo não é memorizar o formato de um município específico, mas aprender o padrão cognitivo pelo qual professores de AEE organizam informação pedagógica intuitivamente — padrão que se mantém reconhecível mesmo quando a representação formal varia.
Este problema — compreensão de esquemas implícitos em documentos heterogêneos para extração de informação — corresponde ao campo de pesquisa conhecido como Heterogeneous Document Understanding, com trabalhos recentes de instituições como Microsoft (SpreadsheetLLM, 2024) e Google. O APDA representa uma instância desse problema em domínio inédito: a documentação pedagógica da educação especial inclusiva em municípios brasileiros, para a qual não existe solução publicada.

5.5.4 Módulo de anonimização multicamadas
Responsável por remover, mascarar ou generalizar dados pessoais e sensíveis antes de qualquer processamento pelo módulo de inferência. A anonimização precede obrigatoriamente a estruturação — nenhum dado pessoal identificável é transmitido ao modelo de linguagem.
O módulo combinará: regras determinísticas e expressões regulares para identificadores diretos como CPF, telefone, e-mail e CEP; modelos especializados em detecção de PII para nomes próprios e entidades em contexto narrativo; memória local para propagação consistente de entidades detectadas ao longo do documento; dicionários controlados de escolas, bairros e profissionais locais; classificação de risco de reidentificação por artefato; revisão humana obrigatória antes da incorporação ao dataset.

5.5.5 Módulo de destilação supervisionada por dados
O projeto adota uma estratégia de destilação por dados para a construção do dataset ouro e o desenvolvimento do modelo especializado. Modelos de maior capacidade — incluindo modelos brasileiros como a família Sabiá da Maritaca AI, especializados em contexto educacional e jurídico brasileiro — são utilizados como modelos professores para a geração de anotações estruturais iniciais sobre documentos anonimizados.
Essas saídas não são incorporadas automaticamente ao dataset. Cada exemplo gerado pelo modelo professor é submetido a validação automática por schema e, obrigatoriamente, à revisão por especialista em educação especial inclusiva antes de integrar o dataset ouro.
Essa abordagem produz dois resultados simultâneos: um dataset de alta qualidade em português brasileiro, com compreensão de contexto educacional nacional; e evidências mensuráveis de melhoria iterativa com supervisão humana documentada — exatamente o tipo de dado que o ambiente regulatório experimental do Sandbox visa produzir.

5.5.6 Módulo de fine-tuning do modelo-aluno
Com base no dataset ouro validado, será treinado um modelo-aluno compacto utilizando técnicas de adaptação de baixo rank (LoRA ou QLoRA), viabilizando execução em infraestrutura limitada compatível com a realidade dos municípios brasileiros de pequeno porte.
O projeto prevê o desenvolvimento de uma família de modelos em diferentes tamanhos, cada um adequado a um nível de infraestrutura distinto: modelos ultraleves para execução em hardware básico de secretaria sem GPU dedicada; modelos intermediários para servidores regionais compartilhados entre consórcios de municípios; modelos maiores para eventual disponibilização via API por governos estaduais para toda a rede municipal.
Os modelos treinados serão exportados em formato GGUF, compatível com execução local via llama.cpp sem dependência de infraestrutura de nuvem, garantindo operação em municípios com conectividade limitada e eliminando a transmissão de dados pedagógicos para servidores externos.

5.5.7 Módulo de validação e auditoria
Responsável por validar JSON contra o schema APDA; verificar campos obrigatórios e consistência semântica entre artefatos do mesmo aluno; identificar possível vazamento de dados pessoais nas saídas; registrar logs completos de cada etapa do pipeline; gerar trilha de auditoria por documento processado; marcar todas as saídas como pendentes de validação humana.

5.5.8 Módulo de onboarding via CLI e WebUI
Protótipo de interface de operação desenvolvido para equipes técnicas municipais sem especialização em inteligência artificial, oferecendo: diagnóstico automático do ambiente computacional disponível; identificação de modelos compatíveis presentes na máquina; seleção guiada de workflow por tipo de arquivo; execução monitorada com registro de métricas; histórico de processamentos para auditoria; interface web local sem dependência de servidor externo.
---

5.6 Objetivos da solução de IA

Objetivo geral

Desenvolver e testar um framework aberto, modular e auditável de inteligência artificial para transformar artefatos pedagógicos rudimentares em dados estruturados, anonimizados e interoperáveis, contribuindo para a qualificação da gestão educacional municipal, especialmente no contexto da educação especial inclusiva.

Objetivos específicos

1. Digitalizar e estruturar registros pedagógicos dispersos em formatos como Word, Excel, PDF, imagens e papel físico.


2. Criar um schema JSON aberto para representação de artefatos pedagógicos digitais.


3. Implementar fluxo de anonimização multicamadas antes da estruturação dos dados.


4. Desenvolver mecanismos de validação automática e revisão humana.


5. Avaliar modelos abertos para geração de JSON pedagógico estruturado.


6. Produzir dataset ouro a partir de exemplos anonimizados e validados.


7. Realizar destilação supervisionada por dados e fine-tuning de modelo-aluno compacto.


8. Exportar modelos ou adaptadores em formatos portáveis, quando aplicável.


9. Garantir rastreabilidade, auditabilidade e logs em todas as etapas.


10. Produzir documentação técnica aberta para replicação por municípios, universidades, Institutos Federais e startups.




---

5.7 Benefícios da solução de IA para a sociedade
O APDA Framework enfrenta uma contradição estrutural silenciosa nas redes municipais de ensino brasileiras: profissionais de educação especial desenvolveram, ao longo de anos, sistemas funcionais de organização pedagógica — planilhas com lógica própria, formulários com estrutura interna, registros que codificam conhecimento real sobre cada aluno. Essa inteligência existe. Ela é real. Ela orienta decisões pedagógicas cotidianas de professores de AEE em centenas de municípios.
O problema é que ela é invisível para o Estado.
Invisível para o Censo Escolar, que não consegue processar uma planilha Excel com estrutura implícita. Invisível para o FUNDEB, que distribui recursos com base em dados que municípios sem maturidade digital não conseguem declarar adequadamente. Invisível para os Decretos 12.686 e 12.773 de 2025, que exigem avaliação pedagógica estruturada de estudantes com necessidades especiais mas não encontram infraestrutura capaz de registrá-la. Invisível para a EducaDados, que só pode integrar o que já está em formato interoperável.
O APDA Framework é uma camada de tradução entre a inteligência informal dos profissionais de AEE e a infraestrutura formal do Estado brasileiro. Não substitui essa inteligência — lê, respeita e traduz para uma linguagem que sistemas públicos conseguem processar, preservar e usar como base para políticas públicas.
Os benefícios concretos dessa tradução são os seguintes.

1. Tornar municípios visíveis para políticas públicas baseadas em dados
Municípios de pequeno porte no interior do Brasil são sistematicamente sub-representados em bases de dados educacionais nacionais, não por falta de trabalho pedagógico, mas por falta de infraestrutura para registrá-lo em formato processável. O APDA converte registros que hoje existem apenas em planilhas locais em dados estruturados, anonimizados e interoperáveis, criando a condição mínima para que esses municípios existam nas estatísticas que orientam políticas públicas federais e estaduais.

2. Tornar crianças visíveis para o sistema de proteção de direitos
Estudantes com deficiência matriculados em municípios sem capacidade de documentação estruturada são, na prática, invisíveis para os sistemas de monitoramento de inclusão educacional. Não aparecem nos indicadores do INEP. Não são contados nas metas do PNE. Não geram evidência para avaliações de política pública. O APDA cria a infraestrutura mínima para que esses estudantes existam como dado — o primeiro passo para que existam como sujeito de direito dentro do sistema.

3. Viabilizar recursos que municípios têm direito mas não conseguem acessar
O FUNDEB estabelece fator de ponderação para estudantes com deficiência matriculados em escolas com Atendimento Educacional Especializado. Municípios que não conseguem documentar adequadamente esses atendimentos perdem recursos a que têm direito constitucional. O impacto financeiro é direto e mensurável: a estruturação dos registros pedagógicos pelo APDA cria a documentação necessária para que municípios reivindiquem corretamente esses recursos no Censo Escolar, com efeito imediato sobre o orçamento da educação local.

4. Viabilizar conformidade regulatória sem exigir infraestrutura de alto custo
Os Decretos 12.686 e 12.773 de 2025 estabelecem obrigações concretas de avaliação e documentação pedagógica para estudantes com necessidades especiais, sem exigência de laudo médico. Municípios pequenos enfrentam o paradoxo de ter obrigação regulatória sem ter infraestrutura para cumpri-la. O APDA resolve esse paradoxo oferecendo uma solução que opera em hardware básico, sem conectividade contínua, sem custo de licenciamento e sem dependência de fornecedor externo — tornando a conformidade acessível para municípios que hoje não têm alternativa.

5. Preparar redes municipais para a EducaDados sem ruptura operacional
A Portaria 269/2026, que regulamenta a Infraestrutura Nacional de Dados da Educação, estabelece padrões de interoperabilidade que redes municipais precisarão atender progressivamente. Exigir que municípios migrem imediatamente para novos sistemas é inviável. O APDA oferece uma transição gradual: os profissionais continuam usando os instrumentos que já conhecem — suas planilhas, seus formulários — enquanto o framework converte essas saídas em dados compatíveis com os padrões da EducaDados. A transformação acontece na camada técnica, não na rotina pedagógica.

6. Produzir o primeiro dataset estruturado de educação especial inclusiva municipal brasileira
Não existe hoje nenhuma base de dados pública, anonimizada e estruturada de registros reais de AEE em municípios brasileiros. O dataset ouro produzido pelo APDA — validado por especialistas em educação inclusiva, irreversivelmente anonimizado e documentado com trilha de auditoria completa — é um bem público de valor científico e político inédito. Ele viabiliza pesquisa acadêmica sobre práticas de inclusão, avaliação de políticas públicas, formação de professores e desenvolvimento de novas ferramentas educacionais baseadas em evidência empírica real.

7. Estabelecer soberania tecnológica na digitalização da educação especial
O framework é integralmente open source, executa localmente sem dependência de infraestrutura de nuvem estrangeira, utiliza modelos abertos e, na camada de destilação, prioriza modelos brasileiros especializados em contexto educacional e jurídico nacional. Os modelos treinados pelo projeto são exportados em formatos portáveis que qualquer município, universidade, Instituto Federal ou organização da sociedade civil pode utilizar, adaptar e melhorar. O conhecimento pedagógico dos professores de AEE brasileiros, uma vez traduzido e estruturado, permanece como patrimônio público nacional — não como ativo de nenhum fornecedor privado.

8. Criar infraestrutura replicável para outros domínios da gestão pública municipal
A capacidade de compreender esquemas implícitos em documentos heterogêneos — o problema técnico central do APDA — não é exclusiva da educação especial. Secretarias municipais de saúde, assistência social e habitação enfrentam o mesmo desafio: registros funcionais, dispersos, não padronizados, invisíveis para sistemas de informação nacionais. A metodologia desenvolvida pelo APDA é generalizável. O framework pode se tornar infraestrutura de digitalização para a gestão pública municipal brasileira muito além do seu escopo inicial — começando pela dor mais urgente, a educação especial inclusiva, e expandindo para onde a necessidade existir.


---

5.8 Riscos mapeados e medidas de mitigação

Risco 1 — Vazamento de dados pessoais ou sensíveis

Descrição: Artefatos pedagógicos podem conter nomes, laudos, diagnósticos, endereços, documentos, informações familiares ou dados de saúde.

Mitigação:

anonimização antes da estruturação;

regras determinísticas para PII;

modelos especializados em detecção de dados pessoais;

dicionários locais de escolas, bairros e profissionais;

revisão humana;

classificação de risco de reidentificação;

logs de anonimização;

descarte seguro de dados brutos.


Risco 2 — Reidentificação indireta

Descrição: Mesmo sem nome, combinações como escola, turma, deficiência rara ou localidade pequena podem permitir reidentificação.

Mitigação:

generalização de campos sensíveis;

remoção de granularidade excessiva;

avaliação de risco por artefato;

revisão humana obrigatória;

bloqueio de publicação de exemplos com risco alto.


Risco 3 — Alucinação ou invenção de campos

Descrição: Modelos de linguagem podem gerar dados não presentes no documento.

Mitigação:

instruções explícitas para não inventar;

uso de campos nulos quando ausentes;

validação por schema;

comparação com texto-fonte;

revisão humana;

métricas de fidelidade ao documento.


Risco 4 — Mistura semântica entre estudantes ou artefatos

Descrição: Em documentos com múltiplos estudantes ou múltiplos registros, o modelo pode misturar informações.

Mitigação:

segmentação prévia por estudante ou artefato;

processamento de uma unidade por vez;

detecção de múltiplos sujeitos;

validação de consistência;

rejeição de saídas ambíguas.


Risco 5 — Viés discriminatório

Descrição: O modelo pode reproduzir termos, categorias ou inferências inadequadas sobre deficiência, aprendizagem ou vulnerabilidade.

Mitigação:

curadoria pedagógica;

revisão por especialistas em educação inclusiva;

diretrizes de linguagem não discriminatória;

avaliação de vieses;

restrição de inferências diagnósticas;

proibição de classificação automática de estudantes.


Risco 6 — Uso indevido da solução

Descrição: O framework pode ser usado para automatizar decisões educacionais sem supervisão.

Mitigação:

documentação clara de limites de uso;

marcação das saídas como pendentes de validação humana;

ausência de módulo decisório;

termos de uso;

logs;

comunicação explícita de que a solução não substitui profissionais da educação.



---

5.9 Coleta e tratamento dos dados

A coleta de dados no âmbito do projeto será restrita a artefatos pedagógicos previamente autorizados, preferencialmente fictícios, sintéticos, públicos ou anonimizados.

5.9.1 Fontes de dados previstas

documentos pedagógicos fictícios;

artefatos sintéticos gerados para teste;

planilhas sem identificação pessoal;

documentos anonimizados;

estudos de caso sem dados identificáveis;

diários de AEE previamente sanitizados;

exemplos validados por equipe pedagógica.


5.9.2 Tratamento dos dados

O tratamento seguirá as seguintes etapas:

1. ingestão do arquivo;


2. extração de texto ou tabela;


3. anonimização;


4. checagem de risco;


5. estruturação em JSON;


6. validação automática;


7. revisão humana;


8. armazenamento controlado;


9. descarte ou arquivamento seguro dos dados brutos;


10. documentação de logs e metadados.




---

5.10 Uso de dados pessoais ou apenas dados anonimizados

No âmbito do Sandbox, a solução será projetada para utilizar dados anonimizados, em conformidade com o requisito de elegibilidade previsto no edital .

Quando artefatos originais contiverem dados pessoais, estes serão tratados apenas em ambiente controlado e com finalidade exclusiva de anonimização, não compondo o dataset final nem os exemplos públicos do projeto.

O dataset final do APDA Framework será composto por:

textos anonimizados;

estruturas JSON sem identificação pessoal;

metadados técnicos;

logs de processamento;

registros de validação;

exemplos sintéticos ou irreversivelmente anonimizados.



---

5.11 Medidas para proteger direitos fundamentais dos titulares dos dados

Serão adotadas as seguintes medidas:

minimização de dados;

anonimização prévia;

supressão de identificadores diretos;

generalização de identificadores indiretos;

revisão humana;

controle de acesso;

registro de logs;

descarte seguro;

documentação de riscos;

avaliação de impacto algorítmico;

proibição de decisões automatizadas;

transparência sobre finalidade e limites da solução;

proteção integral de estudantes, professores e profissionais da educação.



---

5.12 Informação aos proprietários dos dados sobre uso para treinar solução de IA

O projeto adotará como princípio que nenhum dado pessoal identificável será utilizado para treinamento.

Nos casos em que artefatos reais forem utilizados para desenvolvimento ou avaliação, serão observados os seguintes procedimentos:

autorização institucional;

uso de dados anonimizados;

comunicação clara sobre finalidade;

exclusão de dados identificáveis;

validação de anonimização antes de qualquer uso;

documentação da origem dos dados;

uso preferencial de dados sintéticos ou fictícios;

vedação de uso de dados brutos sensíveis em treinamento.



---

5.13 Transparência e explicabilidade do modelo

A solução será explicável e auditável por desenho.

A explicabilidade não será tratada como simples interpretação interna do modelo, mas como combinação de:

schema JSON público;

campos padronizados;

logs de processamento;

identificação do modelo utilizado;

versão do prompt;

versão do pipeline;

metadados de origem;

status de validação;

indicação de campos extraídos e campos ausentes;

marcação de confiança;

possibilidade de revisão humana;

documentação dos limites do sistema.


O APDA Framework não produzirá decisões finais sobre estudantes. Sua função será estruturar artefatos pedagógicos em formato interoperável, preservando a possibilidade de conferência humana.


---

5.14 Métricas de performance do modelo

As métricas serão avaliadas em conjuntos de teste compostos por artefatos anonimizados, fictícios ou sintéticos.

5.14.1 Métricas técnicas

taxa de JSON válido;

aderência ao JSON Schema;

percentual de campos obrigatórios preenchidos corretamente;

taxa de campos inventados;

taxa de campos ausentes;

tempo médio de processamento por artefato;

tokens por segundo;

uso de memória;

compatibilidade com CPU, Vulkan e GPU;

taxa de falhas por tipo de arquivo.


5.14.2 Métricas de privacidade

ocorrência de vazamento de nomes;

ocorrência de vazamento de CPF, telefone, endereço ou e-mail;

risco de reidentificação;

percentual de artefatos bloqueados por risco alto;

acurácia da anonimização.


5.14.3 Métricas pedagógicas

fidelidade ao conteúdo original;

pertinência das categorias pedagógicas;

qualidade da identificação de barreiras;

qualidade da identificação de estratégias;

separação correta entre estudantes ou registros;

necessidade média de correção humana.


5.14.4 Métricas comparativas

Serão comparados modelos base e modelos ajustados, incluindo:

modelo base sem fine-tuning;

modelo-aluno após fine-tuning;

diferentes famílias de modelos;

diferentes tamanhos de contexto;

diferentes níveis de quantização.



---

5.15 Mecanismos de mitigação de viés na curadoria e treinamento

A mitigação de viés será incorporada desde a curadoria do dataset.

Serão adotadas as seguintes estratégias:

uso de exemplos diversos de artefatos;

revisão por especialistas em educação inclusiva;

remoção de linguagem discriminatória;

não utilização de categorias diagnósticas como rótulos decisórios;

proibição de inferência automática sobre deficiência;

balanceamento de tipos de artefatos;

avaliação de saídas por grupo de vulnerabilidade quando aplicável;

documentação dos critérios de inclusão e exclusão;

comparação entre saídas de modelos diferentes;

registro de erros recorrentes;

revisão humana de amostras sensíveis.



---

5.16 Avaliação da presença de viés discriminatório no modelo treinado

A presença de viés será avaliada por meio de testes controlados e revisão qualitativa.

Procedimentos previstos

1. Criação de conjunto de testes com artefatos sintéticos variados.


2. Avaliação de linguagem discriminatória.


3. Verificação de inferências indevidas sobre deficiência.


4. Testes de sensibilidade com variações de contexto social, territorial e pedagógico.


5. Revisão por especialistas.


6. Registro de padrões de erro.


7. Ajuste de prompts, dataset ou modelo.


8. Reavaliação após ajustes.



O modelo será considerado inadequado para uso se apresentar tendências sistemáticas de classificação indevida, linguagem discriminatória, inferência diagnóstica ou recomendações educacionais automatizadas.


---

5.17 Plano de testes sugerido

O plano de testes será dividido em cinco fases.

Fase 1 — Testes laboratoriais com dados fictícios

validação do pipeline de ingestão;

leitura de diferentes formatos;

geração de JSON;

validação por schema;

testes de logs;

testes de anonimização.


Fase 2 — Testes com dados sintéticos e anonimizados

ampliação da diversidade dos artefatos;

comparação entre modelos;

avaliação de vazamento;

avaliação de alucinação;

testes de separação semântica.


Fase 3 — Destilação supervisionada por dados

uso de modelo-professor para gerar JSON inicial;

revisão humana;

formação de dataset ouro;

documentação de critérios de aprovação.


Fase 4 — Fine-tuning do modelo-aluno

seleção de modelo compacto;

treinamento leve com LoRA/QLoRA;

exportação para GGUF;

benchmark em infraestrutura limitada;

comparação com modelo base.


Fase 5 — Avaliação em ambiente controlado

testes com artefatos reais anonimizados;

validação pedagógica;

avaliação de risco;

documentação de evidências;

relatório técnico;

plano de ajustes;

preparação para eventual replicação.





