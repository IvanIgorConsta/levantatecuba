#!/bin/bash
# =============================================================================
# Backup automático de imágenes de noticias
# Ejecutar: ./scripts/backup-media.sh
# Cron recomendado: 0 */6 * * * /var/www/levantatecuba/scripts/backup-media.sh
# =============================================================================

set -e

# Configuración
APP_DIR="/var/www/levantatecuba"
MEDIA_DIR="$APP_DIR/public/media"
BACKUP_BASE="/var/backups/levantatecuba"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE/media_$DATE"
LATEST_LINK="$BACKUP_BASE/media_latest"
LOG_FILE="$BACKUP_BASE/backup.log"
MAX_BACKUPS=7  # Mantener últimos 7 backups

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_BASE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Iniciando backup de media..."

# Verificar que existe el directorio de media
if [ ! -d "$MEDIA_DIR" ]; then
    log "ERROR: Directorio de media no encontrado: $MEDIA_DIR"
    exit 1
fi

# Contar archivos antes del backup
FILE_COUNT=$(find "$MEDIA_DIR" -type f | wc -l)
DIR_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1)

log "Archivos a respaldar: $FILE_COUNT ($DIR_SIZE)"

# Usar rsync incremental (solo copia archivos nuevos/modificados)
if [ -L "$LATEST_LINK" ] && [ -d "$(readlink -f "$LATEST_LINK")" ]; then
    log "Usando backup incremental desde: $(readlink -f "$LATEST_LINK")"
    rsync -a --link-dest="$LATEST_LINK" "$MEDIA_DIR/" "$BACKUP_DIR/"
else
    log "Creando backup completo (primera vez)"
    rsync -a "$MEDIA_DIR/" "$BACKUP_DIR/"
fi

# Actualizar enlace simbólico al último backup
rm -f "$LATEST_LINK"
ln -s "$BACKUP_DIR" "$LATEST_LINK"

# Limpiar backups antiguos (mantener solo los últimos N)
BACKUP_COUNT=$(ls -dt "$BACKUP_BASE"/media_2* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    log "Limpiando backups antiguos (manteniendo últimos $MAX_BACKUPS)..."
    ls -dt "$BACKUP_BASE"/media_2* | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -rf
fi

# Verificar backup
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
BACKUP_FILES=$(find "$BACKUP_DIR" -type f | wc -l)

log "Backup completado: $BACKUP_DIR"
log "Tamaño: $BACKUP_SIZE, Archivos: $BACKUP_FILES"
log "========================================="

echo ""
echo "✅ Backup completado exitosamente"
echo "   Ubicación: $BACKUP_DIR"
echo "   Último backup: $LATEST_LINK"
