---
name: tech-ai-code-review
description: Anti-pattern catalog for structured code reviews across Node.js, Bash, and Terraform.
---

# Code Review Skill

## When to use
- Performing structured code reviews on diffs or changed files.
- Validating compliance with repository conventions and security baselines.
- Checking for common anti-patterns before merge.

## Severity levels
- `Critical`: must-fix — security flaws, correctness bugs, data-loss risk.
- `Major`: high-risk — mandatory rule violations, unsafe defaults, missing validation.
- `Minor`: worthwhile — reduces technical debt or clarifies intent.
- `Nit`: style, naming, or small convention inconsistencies.

## Node.js / TypeScript anti-patterns

### Critical
- Hardcoded secrets, API keys, or credentials in source code.
- `eval()` or `Function()` constructor with untrusted input.
- Unsafe `child_process.exec()` with user-controlled strings (use `execFile` or parameterized invocation).
- SQL injection: string concatenation in queries instead of parameterized placeholders.
- Unhandled promise rejections in Lambda handlers or Express routes.

### Major
- `console.log` instead of `@aws-lambda-powertools/logger`.
- Excessive `any` types defeating TypeScript safety.
- Missing input validation on external payloads (should use `zod`).
- Business logic in connectors, controllers, or route handlers (violates DDD layering).
- Direct `process.env` reads outside `config/env.ts`.
- Missing error handling in async operations.

### Minor
- Unused imports or dead code.
- Inconsistent file naming (not matching `camelCase.layer.ts` convention).
- Missing purpose comment on non-obvious modules.
- Overly complex control flow (deeply nested conditions instead of early returns).

### Nit
- Inconsistent spacing or formatting fixable by linter.
- Variable names not using ubiquitous language.
- Import ordering inconsistencies.

## Bash anti-patterns

### Critical
- Hardcoded secrets or credentials.
- `eval` with user-controlled input.
- Unsafe temp files (use `mktemp`).
- Missing `set -euo pipefail`.

### Major
- Unquoted variable expansions (`$var` instead of `"$var"`).
- Missing dependency checks for external commands.
- `#!/bin/sh` instead of `#!/usr/bin/env bash`.
- Commands failing silently without error handling.

### Minor
- Missing purpose/usage header comment.
- No emoji logs for state transitions.
- Complex logic that should be extracted to a function.

### Nit
- Inconsistent indentation.
- Trailing whitespace.

## Terraform anti-patterns

### Critical
- Hardcoded secrets or credentials in `.tf` files.
- Wildcard IAM policies (`"Action": "*"` or `"Resource": "*"`).
- Missing state-locking configuration.

### Major
- Unpinned provider versions.
- Hardcoded environment-specific identifiers (account IDs, region names).
- Missing `lifecycle` blocks on stateful resources (databases, storage).
- Untyped or undocumented variables.

### Minor
- Missing `description` on variables and outputs.
- Resources not following naming conventions.
- Outputs that expose more than needed.

### Nit
- `terraform fmt` violations.
- Inconsistent block ordering within resources.

## Review checklist
- [ ] No hardcoded secrets.
- [ ] Least-privilege principle applied.
- [ ] Input validation at system boundaries.
- [ ] DDD layering respected (Node.js).
- [ ] Parameterized queries (SQL, SDK).
- [ ] Error handling covers failure paths.
- [ ] Tests cover new/changed behavior.
- [ ] Documentation updated for behavior changes.

## Validation
- Verify each finding is backed by concrete evidence in the diff.
- Confirm severity assignment matches the escalation rules in `copilot-code-review-instructions.md`.
- Check that repeated anti-patterns (3+ occurrences) are escalated one severity level.
