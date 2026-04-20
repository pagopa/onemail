---
description: Add or improve unit tests for Node.js/TypeScript code
name: TechAIAddUnitTestsNodejs
agent: agent
argument-hint: target_file=<path> [test_framework=vitest]
---

# Add Node.js Unit Tests

## Context
Add or improve unit tests for an existing Node.js/TypeScript module while preserving repository conventions.

## Required inputs
- **Target file**: ${input:target_file}
- **Test framework**: ${input:test_framework:vitest}

## Instructions

1. Use the skill in `.github/skills/tech-ai-project-nodejs/SKILL.md`.
2. Inspect `${input:target_file}` and identify testable behavior.
3. Add or update tests covering:
   - happy path
   - input validation and guard clauses
   - relevant edge cases
4. Keep tests deterministic and isolated (no network calls in unit scope).
5. Use **Vitest** (`describe`, `it`, `expect`, `vi` from `vitest`) with BDD-like structure.
6. Use `vi.hoisted` to declare mock refs, then `vi.mock` and use static imports of the subject under test.
7. If a mock (e.g. logger mock) is applied globally via `setupFiles`, never add a specific logger mock in test files.
8. Each test configures only the mocks it needs directly on the hoisted refs.
9. Prefer readability and simple assertions over complex test abstractions.
10. Use clear `given_when_then` naming for test cases.
11. - Place tests under `<package>/tests/`; helpers and fixtures and setup under `<package>/tests/__helpers__/`; shared test utilities and config under `testing/`.

## Minimal example
- Input: `target_file=src/onemail/om-lambda-sender/src/services/email.service.ts`
- Expected output:
  - Tests covering success, validation, and edge behavior.
  - Deterministic assertions and no network calls.

## Validation
- Run tests with `pnpm --filter <package-name> test`.
- Report which test cases were added and why.
