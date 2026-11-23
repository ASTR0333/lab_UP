$ErrorActionPreference = 'Stop'

$initialPassword = $env:MSSQL_SA_PASSWORD
Push-Location -LiteralPath $PSScriptRoot
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker was not found. Install and start Docker Desktop first.'
    }
    docker compose version --short | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required.' }
    $dockerPlatform = docker info --format '{{.OSType}}/{{.Architecture}}'
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and try again.' }
    if ($dockerPlatform -notlike 'linux/*') { throw 'Switch Docker Desktop to Linux containers.' }
    if ($dockerPlatform -notin @('linux/x86_64', 'linux/amd64')) {
        Write-Warning 'SQL Server uses linux/amd64 emulation on this machine. Microsoft does not support this configuration.'
    }

    $envFile = Join-Path $PSScriptRoot '.env'
    if (-not $env:MSSQL_SA_PASSWORD -and -not (Test-Path -LiteralPath $envFile)) {
        $env:MSSQL_SA_PASSWORD = 'ComposePlaceholder_A9!'
        $dbId = docker compose ps --all --quiet db
        if ($LASTEXITCODE -ne 0) { throw 'Could not look up the Compose database container.' }

        if ($dbId) {
            $containerEnv = docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' $dbId
            if ($LASTEXITCODE -ne 0) { throw 'Could not read existing database configuration.' }
            $passwordLine = $containerEnv | Where-Object { $_.StartsWith('MSSQL_SA_PASSWORD=') } | Select-Object -First 1
            if (-not $passwordLine) { throw 'Set MSSQL_SA_PASSWORD to the existing sa password and rerun the installer.' }
            $env:MSSQL_SA_PASSWORD = $passwordLine.Substring('MSSQL_SA_PASSWORD='.Length)
        } else {
            $composeConfig = docker compose config --format json | ConvertFrom-Json
            if ($LASTEXITCODE -ne 0) { throw 'Could not read the Compose project configuration.' }
            $existingVolume = docker volume ls --quiet --filter "label=com.docker.compose.project=$($composeConfig.name)" --filter 'label=com.docker.compose.volume=mssql_data'
            if ($LASTEXITCODE -ne 0) { throw 'Could not check for an existing SQL Server volume.' }
            if ($existingVolume) {
                $securePassword = Read-Host 'Enter the existing SQL Server sa password' -AsSecureString
                $address = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
                try {
                    $env:MSSQL_SA_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($address)
                } finally {
                    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($address)
                }
                if (-not $env:MSSQL_SA_PASSWORD) { throw 'The existing SQL Server volume requires its original sa password.' }
            } else {
                $randomBytes = New-Object byte[] 18
                $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
                try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
                $newPassword = 'Aa9_!' + [BitConverter]::ToString($randomBytes).Replace('-', '').ToLowerInvariant()
                $stream = [IO.File]::Open($envFile, [IO.FileMode]::CreateNew)
                try {
                    $line = [Text.Encoding]::ASCII.GetBytes("MSSQL_SA_PASSWORD=$newPassword`n")
                    $stream.Write($line, 0, $line.Length)
                } finally {
                    $stream.Dispose()
                }
                Remove-Item Env:MSSQL_SA_PASSWORD
            }
        }
    }

    docker compose up -d --build --wait --wait-timeout 240
    if ($LASTEXITCODE -ne 0) {
        docker compose logs --tail 30 db db-init
        throw 'Installation failed. Check the Docker Compose output above.'
    }
    Write-Host 'Fasol is ready at http://localhost:8080'
    Write-Host 'SQL Server: db:1433 | Database: fasol | Login: sa'
    if (Test-Path -LiteralPath $envFile) { Write-Host 'The local password is in .env unless overridden by MSSQL_SA_PASSWORD.' }
    else { Write-Host 'Use your existing SQL Server sa password.' }
} finally {
    $env:MSSQL_SA_PASSWORD = $initialPassword
    Pop-Location
}
