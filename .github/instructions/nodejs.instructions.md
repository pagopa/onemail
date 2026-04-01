---
description: Node.js project standards with DDD-oriented layering, early returns, and deterministic test practices.
applyTo: "**/*.js,**/*.cjs,**/*.mjs,**/*.ts,**/*.tsx"
---

# Node.js Instructions

## Mandatory rules
- Treat work as project-oriented (modules/services/handlers), not script-oriented.
- Apply DDD boundaries: keep domain decisions in domain modules, not transport adapters.
- Keep framework and infrastructure wiring in outer layers (controllers/handlers/adapters).
- Use ubiquitous language for domain-level names and errors.
- Add a concise purpose comment for new/changed core modules when intent is not obvious.
- Use emoji logs for key runtime states when logging is touched.
- Prefer early return and guard clauses.
- Keep code readable with straightforward control flow.
- Add unit tests for testable logic.

## Testing defaults
- Use built-in `node:test` + `node:assert/strict`.
- Prefer BDD-like structure (`describe`/`it` where available).
- Keep tests deterministic and isolated.
- For modify tasks with existing tests: change implementation first, run existing tests, and update tests only for intentional behavior changes.

## Reference implementation
- For module and test examples, use `.github/skills/tech-ai-project-nodejs/SKILL.md`.

# Project Architecture & Coding Conventions

You are an expert Node.js and TypeScript developer. When generating code, answering questions, or refactoring for this workspace, you MUST strictly adhere to the following conventions:

## 1. File and Folder Naming (Crucial)
- **Folders:** Always use lowercase, kebab-case, and plural words (e.g., `controllers`, `services`, `repositories`, `middlewares`).
- **Files:** Always use lowercase, camelCase, and append the specific layer suffix, except for files under configs and utils folders.
  - Routes: `*.route.ts` (e.g., `email.route.ts`)
  - Controllers: `*.controller.ts` (e.g., `email.controller.ts`)
  - Services: `*.service.ts` (e.g., `email.service.ts`)
  - Repositories: `*.repository.ts` (e.g., `email.repository.ts`)
  - Types/Interfaces: `*.type.ts` (e.g., `bulk-send-result.type.ts`)
  - DTOs/Zod schemas: `*.dto.ts`
- **Never** use PascalCase or kebab-case or snake_case for file names.

## 2. Type and Interface Naming
- Inside the code, `type`, `interface`, `class`, and `enum` names MUST be PascalCase (e.g., `BulkSendResult`, `SendEmailInput`).
- Global declarations go into `.d.ts` files, but business logic types go into `.type.ts` files.

## 3. Tech Stack & Libraries
- **Logging:** Always use `@aws-lambda-powertools/logger` imported from the internal `common` package and configured in `config/logger.ts` file. Do NOT use `console.log`.
- **Validation:** Always use `zod` for request payload validation and environment variable parsing.
- **Database/Infrastructure:** Abstract all external SDK client configuration (like DynamoDB, SQS, SES) into `connectors` folder and their calls/methods into the `repositories` layer. Do not put them in the `services` layer.

## 4. API Design
- Always design RESTful endpoints. If returning a collection, use plural nouns (e.g., `/emails/statuses?requestId=123` or `/emails/events`).

## 5. Monorepo Awareness
- We use Turborepo and pnpm workspaces. When suggesting dependency installations, use `pnpm add` or `pnpm add -D` with the `--filter` flag if applicable. Before executing any pnpm command, check if an alias for the command is already listed in the root `package.json`.

## 6. Package Structure

All application packages live under `src/onemail/`. All packages have a `om-` suffix like `om-lambda-sender`. There is also a shared library package `om-common` for cross-cutting concerns and shared types. An example structure is shown below, but the exact folder and file names may vary based on the domain and functionality of each package:

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
- `app.ts` is always the entry point (Lambda handler or Express bootstrap); keep it thin.
- `connectors/` holds only SDK client instantiation — no business logic.
- `repositories/` calls connectors and returns domain objects — no HTTP or Lambda coupling.
- `services/` contains business logic — never imports connectors directly.
- `config/env.ts` is the only place environment variables are read and validated with Zod.
- `config/logger.ts` creates and exports the singleton logger instance for the package.
