#!/usr/bin/env python3
"""
APDA Framework — Exportador de Métricas Customizadas
Expõe métricas do pipeline na porta 8000 para coleta pelo Prometheus.
Implementa todas as métricas definidas na seção 5.14 do documento do Sandbox.
"""

import json
import time
import threading
from pathlib import Path
from http.server import HTTPServer
from prometheus_client import (
    Counter, Histogram, Gauge, Summary,
    make_wsgi_app, generate_latest, CONTENT_TYPE_LATEST,
    CollectorRegistry, REGISTRY
)
from prometheus_client.core import GaugeMetricFamily
import logging

logging.basicConfig(
    level=logging.INFO,
    format='[APDA-Metrics] %(asctime)s %(levelname)s %(message)s'
)
log = logging.getLogger(__name__)

# =============================================================================
# DEFINIÇÃO DAS MÉTRICAS — seção 5.14 do documento Sandbox
# =============================================================================

# --- 5.14.1 Métricas Técnicas ---

artefatos_processados = Counter(
    'apda_artefatos_processados_total',
    'Total de artefatos pedagógicos processados pelo pipeline',
    ['workflow', 'formato_entrada', 'municipio', 'modelo']
)

json_valido = Counter(
    'apda_json_valido_total',
    'Artefatos cujo JSON de saída passou na validação de schema',
    ['workflow', 'modelo', 'municipio']
)

json_invalido = Counter(
    'apda_json_invalido_total',
    'Artefatos cujo JSON de saída falhou na validação de schema',
    ['workflow', 'modelo', 'motivo']
)

campos_obrigatorios_ausentes = Counter(
    'apda_campos_obrigatorios_ausentes_total',
    'Ocorrências de campos obrigatórios ausentes na saída',
    ['campo', 'tipo_artefato', 'modelo']
)

campos_inventados = Counter(
    'apda_campos_inventados_total',
    'Campos gerados pelo modelo sem correspondência no documento fonte (alucinação)',
    ['tipo_artefato', 'modelo', 'municipio']
)

tempo_processamento = Histogram(
    'apda_tempo_processamento_segundos',
    'Tempo total de processamento por artefato (extração + anonimização + geração)',
    ['workflow', 'formato_entrada', 'modelo'],
    buckets=[1, 2, 5, 10, 20, 30, 60, 120, 300]
)

falhas_por_formato = Counter(
    'apda_falhas_total',
    'Falhas no processamento por tipo de arquivo',
    ['formato_entrada', 'etapa', 'motivo']
)

# --- 5.14.2 Métricas de Privacidade ---

vazamento_pii = Counter(
    'apda_vazamento_pii_total',
    'Ocorrências de PII detectadas na saída após anonimização',
    ['tipo_pii', 'municipio', 'etapa']
)

artefatos_bloqueados_privacidade = Counter(
    'apda_artefatos_bloqueados_privacidade_total',
    'Artefatos bloqueados por risco alto de reidentificação',
    ['motivo', 'municipio']
)

acuracia_anonimizacao = Histogram(
    'apda_acuracia_anonimizacao',
    'Taxa de anonimização bem-sucedida por documento (0-1)',
    ['municipio', 'tipo_documento'],
    buckets=[0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0]
)

entidades_detectadas_pii = Counter(
    'apda_entidades_pii_detectadas_total',
    'Entidades PII detectadas e mascaradas na etapa de anonimização',
    ['tipo_entidade', 'camada']  # camada: regex | neural | revisao_humana
)

# --- 5.14.3 Métricas Pedagógicas ---

fidelidade_conteudo = Histogram(
    'apda_fidelidade_conteudo',
    'Score de fidelidade ao conteúdo original (avaliação humana, 0-1)',
    ['tipo_artefato', 'modelo'],
    buckets=[0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0]
)

separacao_semantica_correta = Counter(
    'apda_separacao_semantica_correta_total',
    'Casos onde múltiplos artefatos no mesmo documento foram corretamente separados',
    ['tipo_documento', 'num_artefatos']
)

separacao_semantica_incorreta = Counter(
    'apda_separacao_semantica_incorreta_total',
    'Casos de mistura semântica entre estudantes ou artefatos',
    ['tipo_documento', 'modelo']
)

correcoes_humanas = Counter(
    'apda_correcoes_humanas_total',
    'Correções aplicadas por revisores humanos após geração',
    ['campo_corrigido', 'tipo_artefato']
)

# --- Métricas de Revisão Humana ---

revisoes_pendentes = Gauge(
    'apda_revisoes_pendentes',
    'Artefatos aguardando validação humana',
    ['municipio']
)

revisoes_concluidas = Counter(
    'apda_revisoes_concluidas_total',
    'Revisões humanas concluídas',
    ['resultado', 'municipio']  # resultado: aprovado | reprovado | corrigido
)

aprovados_revisao_humana = Counter(
    'apda_aprovados_revisao_humana_total',
    'Artefatos aprovados sem correção na revisão humana',
    ['modelo', 'tipo_artefato']
)

# --- 5.14.4 Métricas Comparativas ---

benchmark_modelo = Gauge(
    'apda_benchmark_taxa_json_valido',
    'Taxa de JSON válido por modelo em conjunto de teste padrão',
    ['modelo', 'versao', 'quantizacao']
)

benchmark_latencia = Gauge(
    'apda_benchmark_latencia_p95_segundos',
    'Latência p95 por modelo em conjunto de teste padrão',
    ['modelo', 'hardware']
)

# =============================================================================
# COLETOR DE MÉTRICAS DO SISTEMA DE ARQUIVOS
# Lê os arquivos de log do pipeline para atualizar Gauges
# =============================================================================

RUNS_DIR = Path(__file__).resolve().parent.parent / '.apda' / 'runs'

class APDARuntimeCollector:
    """Lê o diretório de runs para atualizar métricas dinâmicas."""

    def collect(self):
        if not RUNS_DIR.exists():
            return

        pendentes_por_municipio = {}

        for run_file in RUNS_DIR.glob('*.json'):
            try:
                run = json.loads(run_file.read_text())
                municipio = run.get('municipio', 'desconhecido')

                if run.get('status') == 'pendente_revisao':
                    pendentes_por_municipio[municipio] = \
                        pendentes_por_municipio.get(municipio, 0) + 1

            except Exception:
                continue

        for municipio, count in pendentes_por_municipio.items():
            revisoes_pendentes.labels(municipio=municipio).set(count)


# =============================================================================
# FUNÇÕES DE INSTRUMENTAÇÃO — usar nos scripts do pipeline
# =============================================================================

class APDAMetrics:
    """
    Interface de instrumentação para os scripts Python do pipeline APDA.

    Uso nos scripts existentes:
        from scripts.metrics_exporter import APDAMetrics
        m = APDAMetrics()

        with m.tempo_workflow('docx-to-apda-json', 'xlsx', 'apda-local-3b'):
            resultado = processar_documento(arquivo)

        m.registrar_resultado(resultado, municipio='paulo-afonso')
    """

    def tempo_workflow(self, workflow: str, formato: str, modelo: str):
        return tempo_processamento.labels(
            workflow=workflow,
            formato_entrada=formato,
            modelo=modelo
        ).time()

    def registrar_resultado(
        self,
        resultado: dict,
        municipio: str = 'desconhecido',
        workflow: str = 'unknown',
        modelo: str = 'unknown',
        formato: str = 'unknown'
    ):
        artefatos_processados.labels(
            workflow=workflow,
            formato_entrada=formato,
            municipio=municipio,
            modelo=modelo
        ).inc()

        if resultado.get('json_valido'):
            json_valido.labels(
                workflow=workflow,
                modelo=modelo,
                municipio=municipio
            ).inc()
        else:
            json_invalido.labels(
                workflow=workflow,
                modelo=modelo,
                motivo=resultado.get('motivo_invalido', 'desconhecido')
            ).inc()

        for campo in resultado.get('campos_inventados', []):
            campos_inventados.labels(
                tipo_artefato=resultado.get('tipo_artefato', 'unknown'),
                modelo=modelo,
                municipio=municipio
            ).inc()

        for pii in resultado.get('pii_detectado_saida', []):
            vazamento_pii.labels(
                tipo_pii=pii.get('tipo', 'unknown'),
                municipio=municipio,
                etapa='saida'
            ).inc()

        for entidade in resultado.get('entidades_anonimizadas', []):
            entidades_detectadas_pii.labels(
                tipo_entidade=entidade.get('tipo', 'unknown'),
                camada=entidade.get('camada', 'unknown')
            ).inc()

    def registrar_revisao_humana(
        self,
        resultado: str,
        municipio: str,
        modelo: str,
        tipo_artefato: str
    ):
        revisoes_concluidas.labels(
            resultado=resultado,
            municipio=municipio
        ).inc()

        if resultado == 'aprovado':
            aprovados_revisao_humana.labels(
                modelo=modelo,
                tipo_artefato=tipo_artefato
            ).inc()

    def registrar_benchmark(
        self,
        modelo: str,
        versao: str,
        quantizacao: str,
        taxa_json_valido: float,
        latencia_p95: float,
        hardware: str = 'rx580-vulkan'
    ):
        benchmark_modelo.labels(
            modelo=modelo,
            versao=versao,
            quantizacao=quantizacao
        ).set(taxa_json_valido)

        benchmark_latencia.labels(
            modelo=modelo,
            hardware=hardware
        ).set(latencia_p95)


# =============================================================================
# SERVIDOR HTTP
# =============================================================================

_metrics_instance = APDAMetrics()


def _handle_push(environ):
    """Aceita POST /push com JSON para registrar métricas de processos externos."""
    try:
        content_length = int(environ.get('CONTENT_LENGTH', 0))
        body = environ['wsgi.input'].read(content_length)
        data = json.loads(body)

        action = data.get('action', 'resultado')
        if action == 'resultado':
            _metrics_instance.registrar_resultado(
                resultado=data.get('resultado', {}),
                municipio=data.get('municipio', 'desconhecido'),
                workflow=data.get('workflow', 'unknown'),
                modelo=data.get('modelo', 'unknown'),
                formato=data.get('formato', 'unknown'),
            )
        elif action == 'tempo':
            tempo_processamento.labels(
                workflow=data.get('workflow', 'unknown'),
                formato_entrada=data.get('formato', 'unknown'),
                modelo=data.get('modelo', 'unknown'),
            ).observe(data.get('elapsed', 0))

        return b'{"ok":true}', '200 OK'
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e)}).encode(), '400 Bad Request'


class MetricsHandler:
    def __init__(self, environ, start_response):
        self.environ = environ
        self.start_response = start_response

    def __iter__(self):
        path = self.environ.get('PATH_INFO', '/')
        method = self.environ.get('REQUEST_METHOD', 'GET')

        if path == '/metrics':
            output = generate_latest()
            status = '200 OK'
            headers = [('Content-Type', CONTENT_TYPE_LATEST)]
        elif path == '/health':
            output = b'{"status":"ok","service":"apda-metrics"}'
            status = '200 OK'
            headers = [('Content-Type', 'application/json')]
        elif path == '/push' and method == 'POST':
            output, status = _handle_push(self.environ)
            headers = [('Content-Type', 'application/json')]
        else:
            output = b'APDA Metrics Exporter\n/metrics\n/health\n/push (POST)\n'
            status = '200 OK'
            headers = [('Content-Type', 'text/plain')]

        self.start_response(status, headers)
        yield output


def run_server(port: int = 8000):
    from wsgiref.simple_server import make_server, WSGIServer
    import socketserver

    class SilentWSGIServer(WSGIServer):
        def log_message(self, *args): pass

    server = make_server('0.0.0.0', port, MetricsHandler,
                         server_class=SilentWSGIServer)
    log.info(f"Exportador de métricas APDA iniciado em http://0.0.0.0:{port}/metrics")
    server.serve_forever()


if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    # Inicia coletor de runtime em background
    collector = APDARuntimeCollector()

    def update_runtime_metrics():
        while True:
            try:
                collector.collect()
            except Exception as e:
                log.warning(f"Erro ao atualizar métricas de runtime: {e}")
            time.sleep(30)

    t = threading.Thread(target=update_runtime_metrics, daemon=True)
    t.start()

    run_server(port)
