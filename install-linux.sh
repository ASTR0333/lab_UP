#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

command -v docker >/dev/null || fail 'Docker was not found. Install and start Docker first.'
docker compose version --short >/dev/null || fail 'Docker Compose v2 is required.'
docker_platform="$(docker info --format '{{.OSType}}/{{.Architecture}}')" || fail 'Start Docker and try again.'
case "$docker_platform" in
  linux/x86_64|linux/amd64) ;;
  linux/*) printf '%s\n' 'SQL Server uses linux/amd64 emulation on this machine. Microsoft does not support this configuration.' >&2 ;;
  *) fail 'Switch Docker to Linux containers.' ;;
esac

if [[ -z "${MSSQL_SA_PASSWORD:-}" && ! -e .env ]]; then
  export MSSQL_SA_PASSWORD='ComposePlaceholder_A9!'
  db_id="$(docker compose ps --all --quiet db)"
  if [[ -n "$db_id" ]]; then
    container_env="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$db_id")"
    MSSQL_SA_PASSWORD=''
    while IFS= read -r line; do
      case "$line" in
        MSSQL_SA_PASSWORD=*) MSSQL_SA_PASSWORD="${line#*=}"; break ;;
      esac
    done <<< "$container_env"
    [[ -n "$MSSQL_SA_PASSWORD" ]] || fail 'Set MSSQL_SA_PASSWORD to the existing sa password and rerun the installer.'
  else
    project="$(docker compose config | awk '$1 == "name:" && !found { print $2; found=1 }')"
    existing_volume="$(docker volume ls --quiet --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.volume=mssql_data')"
    if [[ -n "$existing_volume" ]]; then
      if [[ ! -t 0 ]]; then
        fail 'Set MSSQL_SA_PASSWORD to the existing sa password and rerun the installer.'
      fi
      read -rs -p 'Enter the existing SQL Server sa password: ' MSSQL_SA_PASSWORD
      printf '\n'
      [[ -n "$MSSQL_SA_PASSWORD" ]] || fail 'The existing SQL Server volume requires its original sa password.'
    else
      random_hex="$(od -An -N18 -tx1 /dev/urandom | tr -d '[:space:]')"
      [[ ${#random_hex} -eq 36 ]] || fail 'Could not generate the SQL Server password.'
      (umask 077; set -C; printf 'MSSQL_SA_PASSWORD=Aa9_!%s\n' "$random_hex" > .env)
      unset MSSQL_SA_PASSWORD
    fi
  fi
fi

if ! docker compose up -d --build --wait --wait-timeout 240; then
  docker compose logs --tail 30 db db-init
  fail 'Installation failed. Check the Docker Compose output above.'
fi
printf '%s\n' 'Fasol is ready at http://localhost:8080' 'SQL Server: db:1433 | Database: fasol | Login: sa'
if [[ -f .env ]]; then
  printf '%s\n' 'The local password is in .env unless overridden by MSSQL_SA_PASSWORD.'
else
  printf '%s\n' 'Use your existing SQL Server sa password.'
fi
