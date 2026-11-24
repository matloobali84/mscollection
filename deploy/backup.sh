#!/bin/sh
set -eu
umask 077
backup_path="${BACKUP_DIR:-.data/production-backups}/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "$backup_path"
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_dump -U mscollection -d mscollection --format=custom > "$backup_path/database.dump"
docker compose --env-file .env.production -f compose.production.yaml exec -T api tar -C /app/.data/media -czf - . > "$backup_path/media.tar.gz"
printf 'Database and media backup written to %s\n' "$backup_path"
