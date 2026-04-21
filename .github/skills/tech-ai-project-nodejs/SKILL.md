---
name: tech-ai-project-nodejs
description: Create or modify Node.js/TypeScript application components using DDD boundaries, early returns, and deterministic test coverage.
---

# Node.js Project Skill

## When to use
- Services, controllers, repositories, connectors, and domain modules in Node.js/TypeScript applications.
- Refactoring or extending existing Node.js application components.
- Non-script TypeScript code that contains domain behavior.

## Mandatory rules
- Treat work as project-oriented (modules/services/handlers), not script-oriented.
- Apply DDD boundaries: domain decisions in domain modules, not transport adapters.
- Keep framework and infrastructure wiring in outer layers (controllers/handlers/adapters).
- Use ubiquitous language for domain-level names and errors.
- Add a concise purpose comment for new/changed modules when intent is not obvious.
- Prefer early return and guard clauses.
- Keep code readable with straightforward control flow.
- Add unit tests for testable logic.

## File and folder naming
- Folders: lowercase, kebab-case, plural (e.g., `controllers`, `services`, `repositories`).
- Files: lowercase, camelCase with layer suffix (e.g., `email.service.ts`, `bulkSendResult.type.ts`).
- Never use PascalCase, kebab-case, or snake_case for file names.

## Layer conventions
- `app.ts` — entry point (Lambda handler or Express bootstrap); keep it thin.
- `config/env.ts` — Zod-parsed environment variables; the only place env vars are read.
- `config/logger.ts` — singleton logger instance using `@aws-lambda-powertools/logger`.
- `connectors/` — AWS SDK client instantiation only; no business logic.
- `dtos/` — Zod schemas for event/message payloads.
- `errors/` — domain-specific error classes.
- `repositories/` — calls connectors and returns domain objects; no HTTP or Lambda coupling.
- `services/` — business logic; never imports connectors directly.
- `routes/` — Express router wiring.
- `types/` — package-local TypeScript types/interfaces.
- `utils/` — package-local constants and pure helpers.

## Testing
- Use **Vitest** as the test framework (`describe`, `it`, `expect`, `vi` from `vitest`).
- Keep tests deterministic and isolated.
- Declare mock refs with `vi.hoisted` at the top of the file, then call `vi.mock` and use static imports for the subject under test.
- If a mock (e.g. logger mock) is applied globally via `setupFiles`, never add a specific logger mock in test files.
- Each test configures only the mocks it needs directly on the hoisted refs.
- Prefer readability and simple assertions over complex test abstractions.
- Place tests under `<package>/tests/`; helpers and fixtures and setup under `<package>/tests/__helpers__/`; shared test utilities and config under `testing/`.
- For modify tasks with existing tests: edit implementation first, run existing tests, then update tests only for intentional behavior changes.

## Monorepo awareness
- Use `pnpm add` or `pnpm add -D` with `--filter` flag for dependency installations.
- Check root `package.json` for existing aliases before running pnpm commands.
