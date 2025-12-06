#!/bin/bash
# =============================================================================
# Restaurar imágenes desde backup
# Uso: ./scripts/restore-media.sh [backup_dir]
# Sin argumentos: usa el último backup
# =============================================================================

set -e

APP_DIR="/var/www/levantatecuba"
MEDIA_DIR="$APP_DIR/public/media"
BACKUP_BASE="/var/backups/levantatecuba"
LATEST_LINK="$BACKUP_BASE/media_latest"

# Determinar qué backup usar
if [ -n "$1" ]; then
    BACKUP_DIR="$1"
else
    if [ -L "$LATEST_LINK" ]; then
        BACKUP_DIR=$(readlink -f "$LATEST_LINK")
    else
        echo "❌ No se encontró backup. Especifica la ruta del backup."
        echo "   Backups disponibles:"
        ls -dt "$BACKUP_BASE"/media_2* 2>/dev/null || echo "   (ninguno)"
        exit 1
    fi
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup no encontrado: $BACKUP_DIR"
    exit 1
fi

echo "🔄 Restaurando desde: $BACKUP_DIR"
echo ""

# Contar archivos
BACKUP_FILES=$(find "$BACKUP_DIR" -type f | wc -l)
CURRENT_FILES=$(find "$MEDIA_DIR" -type f 2>/dev/null | wc -l)

echo "   Archivos en backup: $BACKUP_FILES"
echo "   Archivos actuales: $CURRENT_FILES"
echo ""

read -p "¿Continuar con la restauración? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 0
fi

# Restaurar usando rsync (solo archivos faltantes, no sobrescribe existentes)
echo "📥 Restaurando archivos faltantes..."
rsync -av --ignore-existing "$BACKUP_DIR/" "$MEDIA_DIR/"

NEW_FILES=$(find "$MEDIA_DIR" -type f | wc -l)
RESTORED=$((NEW_FILES - CURRENT_FILES))

echo ""
echo "✅ Restauración completada"
echo "   Archivos restaurados: $RESTORED"
echo "   Total actual: $NEW_FILES"
