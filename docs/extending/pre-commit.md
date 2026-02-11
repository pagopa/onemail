# Pre-commit hooks configuration

## Overview

The repository includes a `.pre-commit-config.yaml` file and a setup script that checks prerequisites and installs hooks. The configured hooks cover general checks (trailing whitespace, end-of-file fixer, etc.), Terraform validations and Node/TypeScript checks such as `eslint`, `prettier`, and `tsc`. There is also a `commit-msg` hook that uses `commitlint` to validate commit messages according to Conventional Commits.

## Prerequisites

- `git`
- `node` (we recommend using the version specified in `.nvmrc`)
- `pnpm`
- `pre-commit` ([installation](https://pre-commit.com/#install))

## Setup script

The repository contains a setup script:

- `scripts/setup-pre-commit-hooks.sh`

Run it directly or via the package script:

```bash
# from the repository root
bash ./scripts/setup-pre-commit-hooks.sh

# or
pnpm setup:hooks
```

> [!NOTE]
> After changing the configuration you need to run the installation command again.
