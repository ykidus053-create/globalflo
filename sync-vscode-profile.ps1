#!/usr/bin/env pwsh
# Copies workspace VS Code profile into the user scope and installs standard extensions.

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$workspaceSettings = Join-Path $scriptRoot ".vscode\settings.json"
$userSettingsDir = Join-Path $env:APPDATA "Code\User"
$userSettingsFile = Join-Path $userSettingsDir "settings.json"

if (-not (Test-Path $workspaceSettings)) {
    Write-Error "Workspace settings not found at $workspaceSettings"
    exit 1
}

New-Item -ItemType Directory -Path $userSettingsDir -Force | Out-Null
Copy-Item $workspaceSettings $userSettingsFile -Force

$extensions = @(
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-toolsai.jupyter",
    "ms-python.black-formatter",
    "ms-python.isort",
    "ms-vscode.cpptools",
    "eamodio.gitlens",
    "ms-azuretools.vscode-docker",
    "ms-vscode-remote.remote-containers",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "streetsidesoftware.code-spell-checker",
    "hediet.vscode-drawio",
    "ms-vscode.vscode-typescript-next",
    "redhat.vscode-yaml"
)

foreach ($ext in $extensions) {
    code --install-extension $ext --force
}
