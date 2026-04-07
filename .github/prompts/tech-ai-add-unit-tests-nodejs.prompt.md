---
description: Add or improve unit tests for Node.js/TypeScript code
name: TechAIAddUnitTestsNodejs
agent: agent
argument-hint: target_file=<path> [test_framework=node:test]
---

# Add Node.js Unit Tests

## Context
Add or improve unit tests for an existing Node.js/TypeScript module while preserving repository conventions.

## Required inputs
- **Target file**: ${input:target_file}
- **Test framework**: ${input:test_framework:node:test}

## Instructions

1. Use the skill in `.github/skills/tech-ai-project-nodejs/SKILL.md`.
2. Inspect `${input:target_file}` and identify testable behavior.
3. Add or update tests covering:
   - happy path
   - input validation and guard clauses
   - relevant edge cases
4. Keep tests deterministic and isolated (no network calls in unit scope).
5. Use built-in `node:test` + `node:assert/strict` with BDD-like `describe`/`it` structure.
6. Prefer readability and simple assertions over complex test abstractions.
7. Use clear `given_when_then` naming for test cases.
8. If external dependencies need mocking, use `node:test` built-in mocking utilities.

## Minimal example
- Input: `target_file=src/onemail/om-lambda-sender/src/services/email.service.ts`
- Expected output:
  - Tests covering success, validation, and edge behavior.
  - Deterministic assertions and no network calls.

## Validation
- Run tests with `pnpm turbo test` or `node --test` for the target package.
- Report which test cases were added and why.
