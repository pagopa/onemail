---
name: internal-onemail-repo-context
description: Repository-specific topology, naming patterns, and validation guidance for working in the onemail repository.
---

# OneMail Repo Context

## When to use
- Changes that depend on the real `onemail` repository layout across `.github/workflows`, `.github/actions`, `src/infra`, and `src/onemail`.
- Repository-local Copilot customizations that must stay aligned with OneMail naming, environment, and validation patterns.
- Mixed work that crosses Terraform domain modules, composite GitHub Actions, and the pnpm Node.js workspace.

## Repository map
- `.github/workflows/*.yml` and `.github/workflows/*.yaml` define plan and apply flows for `core`, `network`, `onemail_app`, and `onemail_common`, plus repository code review.
- `.github/actions/env-matrix/action.yml` defines the environment matrix used by Terraform workflows.
- `.github/actions/terraform-plan/action.yml` and `.github/actions/terraform-apply/action.yml` provide reusable workflow behavior for infrastructure changes.
- `src/infra/src/0_IAM`, `src/infra/src/10_network`, `src/infra/src/20_core`, `src/infra/src/30_security`, and `src/infra/src/70_domains/*` contain Terraform modules and stacks.
- `src/infra/src/70_domains/onemail_app` and `src/infra/src/70_domains/onemail_common` are the main domain-specific infrastructure paths already wired to dedicated workflows.
- `src/onemail/om-common` contains shared Node.js types and utilities.
- `src/onemail/om-ecs-dispatcher` is the dispatcher service with its own build, OpenAPI generation, lint, format, and type-check scripts.
- `src/onemail/om-lambda-sender` is the sender Lambda package with its own build, lint, format, and type-check scripts.

## Grounded conventions
- Reuse the existing environment matrix already defined in `.github/actions/env-matrix/action.yml`: `dev`, `uat`, and `prod`, all targeting `eu-south-1`.
- Preserve the Terraform domain-module routing already expressed by workflows such as `.github/workflows/terraform-plan-onemail-app.yml` and `.github/workflows/terraform-plan-onemail-common.yml`.
- Keep Terraform naming aligned with existing locals such as `project = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"` in `src/infra/src/70_domains/onemail_app/99_locals.tf`.
- Prefer changes inside the existing `src/infra/src/<domain>` structure instead of creating parallel Terraform layouts.
- Keep Node.js validation aligned with the repository code-review workflow: `pnpm install --frozen-lockfile`, `pnpm run lint:check`, `pnpm run format:check`, and `pnpm run type-check`.
- When package-scoped work is enough, use the target package scripts already declared in `src/onemail/om-common/package.json`, `src/onemail/om-ecs-dispatcher/package.json`, or `src/onemail/om-lambda-sender/package.json`.
- Preserve pinned GitHub Action SHAs with adjacent release comments when workflow `uses:` entries are changed.

## Validation by area
- Copilot assets: `bash .github/scripts/validate-copilot-customizations.sh --scope root --mode strict`
- Terraform:
  - `terraform fmt -recursive`
  - `terraform validate` from each touched Terraform module or stack directory
- Workspace Node.js changes:
  - `pnpm install --frozen-lockfile`
  - `pnpm run lint:check`
  - `pnpm run format:check`
  - `pnpm run type-check`
- Package-local Node.js changes:
  - run the target package `build`, `lint:check`, `format:check`, or `type-check` scripts when defined
- Workflows and composite actions:
  - run the Copilot validator
  - keep action inputs and workflow module names aligned with the existing `.github/actions/*` and `.github/workflows/*` files

## Grounding checklist
- Inspect the closest workflow, composite action, Terraform module, or package file before inventing names, examples, or validation steps.
- If multiple patterns exist, narrow the change to the specific path family you inspected instead of writing repo-wide generic guidance.
- Stop and report missing grounding when the target area does not have a stable pattern yet.

## Validation
- Run `bash .github/scripts/validate-copilot-customizations.sh --scope root --mode strict` after changing repository-local Copilot assets.
- Run the relevant area-specific checks from the "Validation by area" section.