#!/usr/bin/env bash

# Run ./scripts/setup-pre-commit-hooks.sh from the root of the repo to setup pre-commit hooks

# Print a leading blank line for readability
printf "\n"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
RESET='\033[0m'

# Check if required tools are installed
if ! command -v node &> /dev/null; then
    printf "\n${RED}%s${RESET}\n" "Error: Node.js is not installed. Please install from https://nodejs.org/ - current version in .nvmrc"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    printf "\n${RED}%s${RESET}\n" "Error: pnpm is not installed. Please install from https://pnpm.io/installation"
    exit 1
fi

if ! command -v pre-commit &> /dev/null; then
    printf "\n${RED}%s${RESET}\n" "Error: pre-commit is not installed. Run: pip install pre-commit"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    printf "\n${RED}%s${RESET}\n" "Error: terraform is not installed. Please install from https://www.terraform.io/downloads"
    exit 1
fi

if ! command -v terraform-docs &> /dev/null; then
    printf "\n${RED}%s${RESET}\n" "Error: terraform-docs is not installed. Please install from https://terraform-docs.io/user-guide/installation/"
    exit 1
fi

pre-commit install --install-hooks || printf "\n${RED}%s${RESET}\n" "Warning: could not install pre-commit hooks"
pre-commit install --hook-type commit-msg --install-hooks || printf "\n${RED}%s${RESET}\n" "Warning: could not install commit-msg hook"

printf "\n${GREEN}%s${RESET}\n" "Pre-commit hooks are now active, try launching: pre-commit run --hook-stage pre-commit -a"
