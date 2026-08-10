#!/usr/bin/env bash
# pi-workspace installer
# Install via: curl -fsSL https://pi-workspace.brandonxiang.top/install.sh | bash
set -euo pipefail

log()  { printf '\033[0;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33mWarning:\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[0;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"

install_node_macos() {
  if have brew; then
    log "Installing Node.js via Homebrew"
    brew install node
  else
    err "Node.js not found and Homebrew is not installed.
  Install Node.js from https://nodejs.org (LTS recommended), or install
  Homebrew first: https://brew.sh"
  fi
}

install_node_linux() {
  if have apt-get; then
    log "Installing Node.js via NodeSource (apt)"
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif have dnf; then
    log "Installing Node.js via dnf"
    sudo dnf install -y nodejs
  elif have yum; then
    log "Installing Node.js via yum"
    sudo yum install -y nodejs
  elif have pacman; then
    log "Installing Node.js via pacman"
    sudo pacman -S --noconfirm nodejs npm
  elif have apk; then
    log "Installing Node.js via apk"
    sudo apk add nodejs npm
  else
    err "Node.js not found and no supported package manager detected.
  Install Node.js from https://nodejs.org (LTS recommended) and re-run this script."
  fi
}

# ───── Node.js ─────

if have node && have npm; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -lt 18 ]; then
    warn "Node.js $(node -v) detected, but pi-workspace requires Node.js >= 18."
    case "$OS" in
      Darwin) install_node_macos ;;
      Linux)  install_node_linux ;;
      *)      err "Please upgrade Node.js to >= 18: https://nodejs.org" ;;
    esac
  else
    log "Node.js $(node -v) found"
  fi
else
  log "Node.js not found, installing..."
  case "$OS" in
    Darwin) install_node_macos ;;
    Linux)  install_node_linux ;;
    *)      err "Unsupported OS: $OS. Install Node.js from https://nodejs.org and re-run this script." ;;
  esac
fi

have node && have npm || err "Node.js / npm installation did not complete. Please install manually from https://nodejs.org"

# ───── pi-workspace ─────

log "Installing pi-workspace globally"
npm install -g pi-workspace

log "Installed! Run it with:"
echo ""
echo "  pi-workspace"
echo ""
