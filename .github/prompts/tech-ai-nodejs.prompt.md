---
description: Create or modify Node.js/TypeScript application components with DDD boundaries and tests
name: TechAINodejs
agent: agent
argument-hint: action=<create|modify> component_type=<service|controller|repository|connector|dto|type|middleware|module> component_name=<name> purpose=<purpose> [target_path=<path>]
---

# Node.js Project Task

## Context
Create or modify Node.js/TypeScript application components with DDD boundaries, early-return flow, and test coverage.

## Required inputs
- **Action**: ${input:action:create,modify}
- **Component type**: ${input:component_type:service,controller,repository,connector,dto,type,middleware,module}
- **Component name**: ${input:component_name}
- **Purpose**: ${input:purpose}
- **Target path**: ${input:target_path:src/onemail}

## Instructions
1. Use the skill in `.github/skills/tech-ai-project-nodejs/SKILL.md`.
2. Reuse repository naming and folder conventions from `.github/instructions/nodejs.instructions.md`.
3. Keep DDD boundaries explicit:
   - domain rules in domain-level modules
   - orchestration in service modules
   - I/O/SDK logic in connectors or repositories
4. Use early return and guard clauses.
5. Keep all code comments, logs, and exceptions in English.
6. Use `@aws-lambda-powertools/logger` via the internal `om-common` package; never use `console.log`.
7. Use `zod` for request payload validation and environment variable parsing.
8. If `action=modify`, preserve existing behavior unless explicit changes are requested.
9. If `action=modify` and tests already exist, run existing tests before editing test files.
10. Add or update deterministic **Vitest** unit tests only after the first test run, and only for intentional behavior changes or uncovered new behavior.

## Minimal example
- Input: `action=create component_type=service component_name=emailStatus purpose="Resolve email delivery status from SES events"`
- Expected output:
  - New/updated TypeScript component with DDD-aligned boundaries and guard clauses.
  - Deterministic `node:test` tests aligned with repository style.
  - No unintended behavioral drift outside requested changes.

## Validation
- Run lint/type checks: `pnpm turbo lint` or `pnpm tsc --noEmit` for the affected package.
- Run relevant unit tests for the changed package.
