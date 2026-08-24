#!/usr/bin/env bash
# Déploie/met à jour smartrek-h2o sur le NAS.
# Usage : bash deploy.sh
# Ou en une ligne depuis SSH, sans rien cloner :
#   curl -fsSL https://raw.githubusercontent.com/OXYDER/smartrek-h2o/main/deploy.sh | bash

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/OXYDER/smartrek-h2o/main"
DEPLOY_DIR="${SMARTREK_DEPLOY_DIR:-$HOME/smartrek-h2o-deploy}"

mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

echo "→ Récupération du docker-compose.yml le plus récent..."
curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml

echo "→ Pull de la dernière image depuis GHCR..."
docker compose pull

echo "→ Redémarrage du conteneur..."
docker compose up -d

echo "→ Nettoyage des anciennes images inutilisées..."
docker image prune -f

echo "→ Statut :"
docker compose ps

echo "→ Test de santé..."
sleep 3
if curl -fsS http://localhost:8091/health > /dev/null; then
  echo "✓ smartrek-h2o est en ligne (http://localhost:8091)"
else
  echo "✗ Échec du health check — vérifie les logs : docker compose -f \"$DEPLOY_DIR/docker-compose.yml\" logs -f"
  exit 1
fi
