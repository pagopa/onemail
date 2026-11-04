---
description: Node.js project standards with DDD-oriented layering, early returns, and deterministic test practices.
applyTo: "**/*.js,**/*.cjs,**/*.mjs,**/*.ts,**/*.tsx"
---

# Node.js Instructions

## Mandatory rules
- Apply these architecture rules to application modules, not standalone CLI, maintenance, or benchmark scripts.
- For non-trivial business features, keep domain decisions in domain modules rather than transport adapters.
- Keep framework and infrastructure wiring in outer layers (controllers/handlers/adapters).
- Use ubiquitous language for domain-level names and errors.
- Add a concise purpose comment for new/changed core modules when intent is not obvious.
- Use the project's logger for application code; add emoji only to human-facing log messages when they improve runtime visibility.
- Prefer early return and guard clauses.
- Keep code readable with straightforward control flow.
- Add unit tests for testable logic.

## Testing defaults
- Use **Vitest** as the test framework (`describe`, `it`, `expect`, `vi` from `vitest`).
- Keep tests deterministic and isolated.
- Use `vi.hoisted` to declare mock refs, then `vi.mock` with static imports of the subject under test.
- If a mock (e.g. logger mock) is applied globally via `setupFiles`, never add a specific logger mock in test files.
- Each test configures only the mocks it needs, directly on the hoisted refs.
- Place tests under `<package>/tests/`; helpers and fixtures and setup under `<package>/tests/__helpers__/`; shared test utilities and config under `testing/`.
- For modify tasks with existing tests: edit implementation first, run existing tests, then update tests only for intentional behavior changes.

## Reference implementation
- For module and test examples, use `.github/skills/tech-ai-project-nodejs/SKILL.md`.

# Project Architecture & Coding Conventions

You are an expert Node.js and TypeScript developer. When generating code, answering questions, or refactoring for this workspace, you MUST strictly adhere to the following conventions:

## 1. File and Folder Naming (Crucial)
- **Folders:** Use lowercase names and follow the conventions of the package being changed; use plural names for collections where that matches nearby code.
- **Files:** Follow nearby naming conventions, using `camelCase` and a layer suffix where established. Do not rename unrelated existing files as part of a feature change.
  - Routes: `*.route.ts` (e.g., `email.route.ts`)
  - Controllers: `*.controller.ts` (e.g., `email.controller.ts`)
  - Services: `*.service.ts` (e.g., `email.service.ts`)
  - Repositories: `*.repository.ts` (e.g., `email.repository.ts`)
  - Types/Interfaces: `*.type.ts` (e.g., `bulkSendResult.type.ts`)
  - DTOs/Zod schemas: `*.dto.ts`
- **Never** use PascalCase or kebab-case or snake_case for file names.

## 2. Type and Interface Naming
- Inside the code, `type`, `interface`, `class`, and `enum` names MUST be PascalCase (e.g., `BulkSendResult`, `SendEmailInput`).
- Global declarations go into `.d.ts` files, but business logic types go into `.type.ts` files.

## 3. Tech Stack & Libraries
- **Logging:** In application packages, use the logger configured by that package (typically `@aws-lambda-powertools/logger` from `om-common`); avoid `console.log` in application code.
- **Validation:** Use the package's established validation library (currently Zod) for request payloads and environment variables.
- **Database/Infrastructure:** In application packages, keep external SDK client configuration in `connectors` and data-access operations in `repositories`; do not call SDK clients directly from `services`.

## 4. API Design
- For HTTP APIs, follow the existing API style and use REST conventions where appropriate. Use plural nouns for collection endpoints (e.g., `/emails/events`).

## 5. Monorepo Awareness
- We use Turborepo and pnpm workspaces. When suggesting dependency installations, use `pnpm add` or `pnpm add -D` with the `--filter` flag if applicable. Before executing any pnpm command, check if an alias for the command is already listed in the root `package.json`.

## 6. Package Structure

Deployable application packages live under `src/onemail/` and use the `om-` prefix, such as `om-lambda-sender`. `om-common` is a shared library with its own package entry point. The structure below is a guide for application packages, not a requirement to reshape existing packages or standalone scripts:

### (`om-<name>`)
```
om-<name>/
  src/
    app.ts                      # Lambda entry point (handler export)
    config/
      env.ts                    # Zod-parsed environment variables
      logger.ts                 # Logger instance (uses om-common logger)
    connectors/
      <service>.connector.ts    # AWS SDK client setup (DynamoDB, SES, CloudWatch, …)
    dtos/
      <domain>.dto.ts           # Zod schemas for event/message payloads
    errors/
      <name>.error.ts           # Domain-specific error classes
    middlewares/                # Lambda middleware (if any)
      <name>.middleware.ts
    repositories/
      <domain>.repository.ts    # Data-access methods, calls connectors only
    routes/
      <domain>.route.ts         # Express router wiring
      index.ts                  # Root router aggregator  
    services/
      <domain>.service.ts       # Business logic, calls repositories only
    types/
      <name>.type.ts            # Package-local TypeScript types/interfaces
    utils/                      # Package-local constants and pure helpers
      constants.ts
```

### Key rules derived from the structure
- For deployable application packages, keep the configured entry point (typically `app.ts`) thin. Shared libraries such as `om-common` use their package-defined entry points.
- `connectors/` holds only SDK client instantiation — no business logic.
- `repositories/` calls connectors and returns domain objects — no HTTP or Lambda coupling.
- `services/` contains business logic — never imports connectors directly.
- `config/env.ts` is the only place environment variables are read and validated with Zod.
- `config/logger.ts` creates and exports the singleton logger instance for the package.
