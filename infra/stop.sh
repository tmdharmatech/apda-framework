#!/usr/bin/env bash
# APDA Stack — Encerramento limpo
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$INFRA_DIR")"
PID_DIR="$PROJECT_ROOT/.apda/pids"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BOLD}[APDA]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

echo -e "\n${CYAN}${BOLD}Encerrando APDA Stack...${NC}\n"

stop_process() {
    local name="$1"
    local pidfile="$PID_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
        local pid; pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" && ok "$name encerrado (PID $pid)"
        else
            warn "$name nao estava rodando"
        fi
        rm -f "$pidfile"
    else
        warn "PID file nao encontrado para $name"
    fi
}

stop_process "llama-3b"
stop_process "llama-1b"
stop_process "litellm"
stop_process "metrics-exporter"

cd "$INFRA_DIR"
if command -v docker &>/dev/null; then
    if docker compose version &>/dev/null 2>&1; then
        docker compose down && ok "Containers Docker encerrados"
    elif command -v docker-compose &>/dev/null; then
        docker-compose down && ok "Containers Docker encerrados"
    fi
fi

echo -e "\n${GREEN}${BOLD}Stack encerrado com sucesso.${NC}\n"
