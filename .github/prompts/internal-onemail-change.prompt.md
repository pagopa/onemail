---
description: Plan and execute repo-specific changes in onemail using the repository's actual Terraform domain modules, pnpm workspace, and GitHub Actions conventions
name: internal-onemail-change
agent: internal-onemail-repo-specialist
argument-hint: area=<infra|workflow|dispatcher|lambda-sender|shared-node|mixed> change=<summary> [paths=<comma-separated>]
---

# OneMail Repo Task

## Context
Use this prompt when a change must follow the real `onemail` repository layout instead of only generic Terraform, workflow, Node.js, or script guidance.

## Required inputs
- **Area**: ${input:area:infra,workflow,dispatcher,lambda-sender,shared-node,mixed}
- **Change**: ${input:change}
- **Relevant paths**: ${input:paths}

## Instructions
1. Read `.github/skills/internal-onemail-repo-context/SKILL.md` before editing files.
2. Ground naming, module choice, validation commands, and examples on the closest real files under `.github/workflows`, `.github/actions`, `src/infra`, and `src/onemail`.
3. Preserve the existing Terraform domain-module layout under `src/infra/src/*`, especially `70_domains/onemail_app` and `70_domains/onemail_common`.
4. Reuse the existing environment matrix and workflow behavior already implemented by `.github/actions/env-matrix/action.yml`.
5. When Node.js packages are touched, use the scripts already declared in the root workspace or target package `package.json`.
6. Keep repo-specific guidance grounded on current packages: `om-common`, `om-ecs-dispatcher`, and `om-lambda-sender`.
7. Report the target files used as grounding evidence plus the validation commands you ran.

## Minimal example
- Input: `area=infra change="Update the OneMail app domain stack to add a variable consumed by the existing terraform-plan workflow" paths=src/infra/src/70_domains/onemail_app`
- Expected output:
  - Changes grounded on the closest files in `src/infra/src/70_domains/onemail_app` and the matching workflow or composite action.
  - Existing environment and region behavior preserved.
  - Relevant Terraform and repository validation commands executed and reported.

## Validation
- Run `bash .github/scripts/validate-copilot-customizations.sh --scope root --mode strict` after changing Copilot assets.
- Run the area-specific validation commands listed in `.github/skills/internal-onemail-repo-context/SKILL.md`.
