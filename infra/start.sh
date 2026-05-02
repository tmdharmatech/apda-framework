#!/usr/bin/env bash
# APDA Stack — Inicialização (LiteLLM + Prometheus + Grafana + llama-server)
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$INFRA_DIR")"
LOG_DIR="$PROJECT_ROOT/.apda/logs"
PID_DIR="$PROJECT_ROOT/.apda/pids"
CONFIG_FILE="$PROJECT_ROOT/.apda/config.json"

mkdir -p "$LOG_DIR" "$PID_DIR"

# ── Carregar .env se existir ──────────────────────────────────────────────────
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

log()  { echo -e "${BOLD}[APDA]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}$*${NC}"; }

wait_for_port() {
    local port=$1 name=$2 max_wait=${3:-30} count=0
    while ! nc -z localhost "$port" 2>/dev/null; do
        sleep 1
        count=$((count + 1))
        [ "$count" -ge "$max_wait" ] && fail "$name nao respondeu na porta $port apos ${max_wait}s"
        echo -ne "\r${YELLOW}Aguardando $name (porta $port)...${NC} ${count}s"
    done
    echo -e "\r${GREEN}[OK]${NC} $name disponivel na porta $port           "
}

is_running() {
    local pidfile="$PID_DIR/$1.pid"
    [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null
}

save_pid() { echo "$2" > "$PID_DIR/$1.pid"; }

echo -e "
${CYAN}${BOLD}
 █████╗ ██████╗ ██████╗  █████╗
██╔══██╗██╔══██╗██╔══██╗██╔══██╗
███████║██████╔╝██║  ██║███████║
██╔══██║██╔═══╝ ██║  ██║██╔══██║
██║  ██║██║     ██████╔╝██║  ██║
╚═╝  ╚═╝╚═╝     ╚═════╝ ╚═╝  ╚═╝
${NC}${BOLD}Artefatos Pedagogicos Digitais Abertos${NC}
${BLUE}Stack: LiteLLM + Prometheus + Grafana + llama-server${NC}
"

# ── Configuracao ──────────────────────────────────────────────────────────────

step "Lendo configuracao"

LLAMA_BINARY="${LLAMA_BINARY:-llama-server}"
MODEL_3B="${MODEL_3B:-}"
MODEL_1B="${MODEL_1B:-}"
MARITACA_API_KEY="${MARITACA_API_KEY:-}"
LITELLM_PORT="${LITELLM_PORT:-4000}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9090}"
GRAFANA_PORT="${GRAFANA_PORT:-3001}"
LLAMA_PORT_3B="${LLAMA_PORT_3B:-8091}"
LLAMA_PORT_1B="${LLAMA_PORT_1B:-8092}"
LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-apda-master-key}"
GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-mude-esta-senha}"

if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    _val=$(jq -r '.llama_binary // .llamaBinary // empty' "$CONFIG_FILE" 2>/dev/null)
    [ -n "$_val" ] && LLAMA_BINARY="$_val"
    _val=$(jq -r '.model_3b // .modelPath // empty' "$CONFIG_FILE" 2>/dev/null)
    [ -n "$_val" ] && [ -z "$MODEL_3B" ] && MODEL_3B="$_val"
    _val=$(jq -r '.model_1b // empty' "$CONFIG_FILE" 2>/dev/null)
    [ -n "$_val" ] && MODEL_1B="$_val"
    _val=$(jq -r '.maritaca_api_key // .maritacaApiKey // empty' "$CONFIG_FILE" 2>/dev/null)
    [ -n "$_val" ] && MARITACA_API_KEY="$_val"
    ok "Configuracao carregada de $CONFIG_FILE"
fi

# ── Pre-requisitos ────────────────────────────────────────────────────────────

step "Verificando pre-requisitos"

check_cmd() {
    if command -v "$1" &>/dev/null; then ok "$1 encontrado"
    else warn "$1 nao encontrado — $2"; fi
}

check_cmd docker   "Necessario para Prometheus e Grafana"
check_cmd litellm  "Instale com: pip install litellm"
check_cmd python3  "Necessario para metricas customizadas"
check_cmd nc       "Necessario para health checks (netcat)"

# ── llama-server 3B ───────────────────────────────────────────────────────────

step "Iniciando llama-server (modelo 3B)"

if [ -z "$MODEL_3B" ]; then
    warn "MODEL_3B nao definido. Pulando llama-server 3B."
elif is_running "llama-3b"; then
    ok "llama-server 3B ja esta rodando"
else
    if ! command -v "$LLAMA_BINARY" &>/dev/null; then
        LLAMA_BINARY=$(find /home -name "llama-server" -type f 2>/dev/null | head -1 || true)
        [ -z "$LLAMA_BINARY" ] && warn "llama-server nao encontrado. Pulando."
    fi
    if [ -n "$LLAMA_BINARY" ] && [ -f "$MODEL_3B" ]; then
        log "Iniciando llama-server 3B na porta $LLAMA_PORT_3B..."
        "$LLAMA_BINARY" -m "$MODEL_3B" --port "$LLAMA_PORT_3B" -ngl 99 --log-prefix \
            > "$LOG_DIR/llama-3b.log" 2>&1 &
        save_pid "llama-3b" $!
        wait_for_port "$LLAMA_PORT_3B" "llama-server 3B" 60
    else
        warn "Modelo 3B nao encontrado em: $MODEL_3B"
    fi
fi

# ── llama-server 1B (opcional) ────────────────────────────────────────────────

step "Iniciando llama-server (modelo 1B — opcional)"

if [ -z "$MODEL_1B" ]; then
    warn "MODEL_1B nao definido. Pulando llama-server 1B."
elif is_running "llama-1b"; then
    ok "llama-server 1B ja esta rodando"
elif [ -n "$LLAMA_BINARY" ] && [ -f "$MODEL_1B" ]; then
    log "Iniciando llama-server 1B na porta $LLAMA_PORT_1B..."
    "$LLAMA_BINARY" -m "$MODEL_1B" --port "$LLAMA_PORT_1B" -ngl 99 \
        > "$LOG_DIR/llama-1b.log" 2>&1 &
    save_pid "llama-1b" $!
    wait_for_port "$LLAMA_PORT_1B" "llama-server 1B" 60
else
    warn "Modelo 1B nao encontrado. Pulando."
fi

# ── Gerar LiteLLM config ─────────────────────────────────────────────────────

step "Gerando configuracao do LiteLLM"

LITELLM_CONFIG="$PROJECT_ROOT/.apda/litellm_config.yaml"
MODELS_YAML=""

if nc -z localhost "$LLAMA_PORT_3B" 2>/dev/null; then
    MODELS_YAML+="
  - model_name: apda-local-3b
    litellm_params:
      model: openai/apda-local-3b
      api_base: http://localhost:${LLAMA_PORT_3B}/v1
      api_key: fake
"
fi

if nc -z localhost "$LLAMA_PORT_1B" 2>/dev/null; then
    MODELS_YAML+="
  - model_name: apda-local-1b
    litellm_params:
      model: openai/apda-local-1b
      api_base: http://localhost:${LLAMA_PORT_1B}/v1
      api_key: fake
"
fi

if [ -n "$MARITACA_API_KEY" ]; then
    MODELS_YAML+="
  - model_name: sabia-professor
    litellm_params:
      model: maritalk/sabia-4
      api_key: ${MARITACA_API_KEY}
"
fi

if [ -z "$MODELS_YAML" ]; then
    warn "Nenhum modelo disponivel. Adicionando placeholder."
    MODELS_YAML="
  - model_name: apda-placeholder
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: fake
"
fi

cat > "$LITELLM_CONFIG" <<EOF
model_list:
${MODELS_YAML}

router_settings:
  routing_strategy: least-busy
  num_retries: 3
  retry_after: 5
  allowed_fails: 3
  cooldown_time: 30

general_settings:
  master_key: "${LITELLM_MASTER_KEY}"
  store_model_in_db: false

litellm_settings:
  success_callback: ["prometheus"]
  failure_callback: ["prometheus"]
  service_callback: ["prometheus"]
  cache: false
  request_timeout: 120
  drop_params: true

environment_variables:
  PROMETHEUS_URL: "http://localhost:${PROMETHEUS_PORT}"
EOF

ok "LiteLLM config gerado em $LITELLM_CONFIG"

# ── LiteLLM Proxy ────────────────────────────────────────────────────────────

step "Iniciando LiteLLM Proxy"

if is_running "litellm"; then
    ok "LiteLLM ja esta rodando"
else
    command -v litellm &>/dev/null || fail "litellm nao encontrado. Instale com: pip install litellm"
    log "Iniciando LiteLLM na porta $LITELLM_PORT..."
    litellm --config "$LITELLM_CONFIG" --port "$LITELLM_PORT" --detailed_debug \
        > "$LOG_DIR/litellm.log" 2>&1 &
    save_pid "litellm" $!
    wait_for_port "$LITELLM_PORT" "LiteLLM Proxy" 45
fi

# ── Prometheus + Grafana ──────────────────────────────────────────────────────

step "Iniciando Prometheus e Grafana"

if ! command -v docker &>/dev/null; then
    warn "Docker nao encontrado. Pulando Prometheus e Grafana."
else
    cd "$INFRA_DIR"
    if docker compose version &>/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &>/dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        warn "docker-compose nao encontrado. Pulando."
        COMPOSE_CMD=""
    fi

    if [ -n "${COMPOSE_CMD:-}" ]; then
        log "Subindo containers..."
        $COMPOSE_CMD up -d --remove-orphans > "$LOG_DIR/docker.log" 2>&1
        wait_for_port "$PROMETHEUS_PORT" "Prometheus" 30
        wait_for_port "$GRAFANA_PORT" "Grafana" 30
        ok "Containers iniciados"
    fi
fi

# ── Metricas customizadas ────────────────────────────────────────────────────

step "Iniciando exportador de metricas customizadas"

if is_running "metrics-exporter"; then
    ok "Exportador ja esta rodando"
else
    python3 "$PROJECT_ROOT/scripts/metrics_exporter.py" \
        > "$LOG_DIR/metrics-exporter.log" 2>&1 &
    save_pid "metrics-exporter" $!
    ok "Exportador de metricas iniciado (porta 8000)"
fi

# ── Health Check ──────────────────────────────────────────────────────────────

step "Health Check"

check_port() {
    local port=$1 name=$2 url=$3
    if nc -z localhost "$port" 2>/dev/null; then ok "$name -> $url"
    else warn "$name -> nao disponivel na porta $port"; fi
}

echo ""
check_port "$LITELLM_PORT"    "LiteLLM Proxy"    "http://localhost:${LITELLM_PORT}"
check_port "$PROMETHEUS_PORT" "Prometheus"        "http://localhost:${PROMETHEUS_PORT}"
check_port "$GRAFANA_PORT"    "Grafana"           "http://localhost:${GRAFANA_PORT}"
check_port 8000               "Metricas APDA"     "http://localhost:8000/metrics"
[ -n "$MODEL_3B" ] && check_port "$LLAMA_PORT_3B" "llama-server 3B" "http://localhost:${LLAMA_PORT_3B}"
[ -n "$MODEL_1B" ] && check_port "$LLAMA_PORT_1B" "llama-server 1B" "http://localhost:${LLAMA_PORT_1B}"

echo -e "
${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${BOLD}APDA Stack iniciado${NC}

${BOLD}Endpoints:${NC}
  LiteLLM API     ->  http://localhost:${LITELLM_PORT}/v1
  LiteLLM UI      ->  http://localhost:${LITELLM_PORT}/ui
  Prometheus      ->  http://localhost:${PROMETHEUS_PORT}
  Grafana         ->  http://localhost:${GRAFANA_PORT}
                     usuario: admin / senha: (ver GRAFANA_ADMIN_PASSWORD no .env)
  Metricas APDA   ->  http://localhost:8000/metrics

${BOLD}Autenticacao LiteLLM:${NC}
  Bearer: (ver LITELLM_MASTER_KEY no .env)

${BOLD}Para encerrar:${NC}
  node src/cli.js stack stop
  # ou: infra/stop.sh
${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
"
