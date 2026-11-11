# onemail - Agent Guide

## Repository

onemail is a centralized email service. The repository contains the Node.js/TypeScript application workspace under `src/onemail/` and Terraform infrastructure and operational scripts under `src/infra/`.

Follow the conventions of the package or module being changed. Use the applicable file-specific guidance in `.github/instructions/*`. Keep this guide focused on repository-wide context and practices.

## Working practices

- Keep changes limited to the requested behavior and preserve unrelated work already present in the working tree.
- Do not run destructive operations, deploy, or apply infrastructure changes without explicit authorization.
- Do not commit or push changes unless explicitly requested.
- Do not expose secrets in source code, logs, command output, or documentation.
- Update or add tests when behavior changes, and validate the affected area before reporting completion (but not for script, unless explicitly requested).

## Validation

- For application changes, use the relevant package scripts and root pnpm/Turbo scripts defined in `package.json`; prefer checks scoped to the affected package.
- For infrastructure changes, use the repository's Terraform scripts and validate the targeted module and environment. Review a plan before any apply.
- For shell changes, run `bash -n` on changed scripts and ShellCheck when available.

## Commit messages

Use Conventional Commits, following the repository's commitlint configuration. Format messages as `type(scope): summary` (scope is optional); keep the summary concise and describe the change rather than the branch.
