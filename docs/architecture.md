# Architecture

## 1. Purpose

This repository owns `onemail`, a centralized email delivery and management platform for PagoPA products.

## 2. System overview

`onemail` is a `pnpm`/`turbo` monorepo that combines runtime services, shared TypeScript packages, and Terraform-based AWS infrastructure.

- Application packages live under `src/onemail/`.
- Infrastructure layer packages live under `src/infra/src/`.
- The main synchronous entrypoint is the ECS dispatcher service.
- Asynchronous processing is handled by Lambda services.
- Shared types and utilities are centralized in `om-common`.
- CI/CD is split across validation, OpenAPI sync checks, security gates, targeted deploy workflows, and Terraform plan/apply flows.

ASCII overview:

```text
Clients / producers
  -> om-ecs-dispatcher (HTTP/API surface)
  -> queues / AWS services
  -> om-lambda-sender + om-lambda-config-set-processor

Shared code: om-common

Terraform layers
  -> IAM / network / core / security / domains
```

## 3. Current vs intended architecture

| Area | Current architecture | Intended architecture | Status | Evidence |
| --- | --- | --- | --- | --- |
| Repository shape | Monorepo with application packages and Terraform layer packages in the same workspace. | Not explicitly documented. | Evidenced | `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| Runtime split | Dispatcher ECS service plus Lambda workers for sending and SES config-set processing. | Not explicitly documented. | Evidenced | `src/onemail/om-ecs-dispatcher/package.json`, `src/onemail/om-lambda-sender/package.json`, `src/onemail/om-lambda-config-set-processor/package.json` |
| Shared code | Shared types and utilities live in `om-common`. | Not explicitly documented. | Evidenced | `src/onemail/om-common/package.json`, runtime package manifests |
| API contract | Dispatcher route/DTO changes are expected to keep OpenAPI artifacts synchronized. | Not explicitly documented. | Evidenced | `.github/workflows/openapi-sync-check.yml`, `package.json`, `README.md` |
| Infrastructure flow | Terraform is managed through layer-specific workflows instead of one global stack pipeline. | Not explicitly documented. | Evidenced | `.github/workflows/terraform-plan-core.yml`, `.github/workflows/terraform-apply-*.yml` |

## 4. Technology stack

| Area | Technology | Status | Evidence |
| --- | --- | --- | --- |
| Language | TypeScript | Documented | `README.md`, runtime package manifests |
| Runtime | Node.js | Evidenced | `package.json`, runtime package manifests, `.nvmrc` referenced by `README.md` |
| Framework | Express | Documented | `README.md`, `src/onemail/om-ecs-dispatcher/package.json` |
| Validation / schema | Zod | Documented | `README.md`, `src/onemail/om-ecs-dispatcher/package.json`, Lambda package manifests |
| AWS integration | AWS SDK v3, AWS Lambda Powertools, Middy | Evidenced | `src/onemail/om-lambda-sender/package.json`, `src/onemail/om-lambda-config-set-processor/package.json`, `src/onemail/om-common/package.json` |
| Build | pnpm workspaces + turbo | Evidenced | `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| Test | Vitest | Documented | `README.md`, runtime package manifests |
| IaC / Deploy | Terraform | Documented | `README.md`, `.github/workflows/terraform-plan-core.yml` |
| Automation | GitHub Actions | Documented | `README.md`, `.github/workflows/*.yml` |

## 5. Repository map

| Path | Responsibility | Notes |
| --- | --- | --- |
| `src/onemail/` | Runtime application packages | Contains dispatcher, Lambda services, shared package, and testing support. |
| `src/onemail/om-common/` | Shared types and utilities | Reused by multiple runtime services. |
| `src/onemail/om-ecs-dispatcher/` | ECS-hosted HTTP/API dispatcher | Owns route/DTO surface and OpenAPI generation. |
| `src/onemail/om-lambda-sender/` | Email sending Lambda | Asynchronous email delivery component. |
| `src/onemail/om-lambda-config-set-processor/` | SES config-set processing Lambda | Asynchronous configuration-processing component. |
| `src/onemail/testing/` | Cross-service testing support | Present in the repo structure; inspect before large test refactors. |
| `src/infra/src/0_IAM/` | IAM infrastructure layer | Workspace package for Terraform-managed IAM concerns. |
| `src/infra/src/10_network/` | Network infrastructure layer | Workspace package for Terraform-managed networking concerns. |
| `src/infra/src/20_core/` | Core infrastructure layer | Workspace package for Terraform-managed core platform concerns. |
| `src/infra/src/30_security/` | Security infrastructure layer | Workspace package for Terraform-managed security concerns. |
| `src/infra/src/70_domains/` | Domain-specific infrastructure area | Exact role is not fully evidenced from inspected files. |
| `scripts/` | Operational and packaging scripts | Includes package/deploy helpers and tenant seeding. |
| `.github/workflows/` | CI/CD and operational automation | Includes validation, security, deploy, OpenAPI, and Terraform flows. |
| `docs/` | Supporting docs and diagrams | Contains architecture image and contributor guidance. |

## 6. Architectural boundaries

### Runtime services

- `om-ecs-dispatcher` is the main HTTP/API service and the repository surface that owns OpenAPI generation.
  - Status: Evidenced
  - Evidence: `src/onemail/om-ecs-dispatcher/package.json`, `README.md`, `.github/workflows/openapi-sync-check.yml`
- `om-lambda-sender` is the Lambda responsible for sending email requests to SES.
  - Status: Evidenced
  - Evidence: `src/onemail/om-lambda-sender/package.json`
- `om-lambda-config-set-processor` is the Lambda responsible for processing SES config sets.
  - Status: Evidenced
  - Evidence: `src/onemail/om-lambda-config-set-processor/package.json`

### Shared package boundary

- `om-common` owns shared types, repositories, utilities, and logging helpers.
  - Status: Evidenced
  - Evidence: `src/onemail/om-common/package.json`
- Runtime services consume `om-common` as a workspace dependency.
  - Status: Evidenced
  - Evidence: `src/onemail/om-ecs-dispatcher/package.json`, `src/onemail/om-lambda-sender/package.json`, `src/onemail/om-lambda-config-set-processor/package.json`

### Infrastructure boundary

- Terraform concerns are partitioned into workspace-visible layers under `src/infra/src/`.
  - Status: Evidenced
  - Evidence: `pnpm-workspace.yaml`, `src/infra/src/0_IAM/package.json`, `src/infra/src/10_network/package.json`, `src/infra/src/20_core/package.json`, `src/infra/src/30_security/package.json`
- The exact semantics of `70_domains` were not established by the inspected files.
  - Status: Unknown
  - Evidence: `src/infra/src/70_domains/`

### Operational boundary

- OpenAPI synchronization is a protected contract on dispatcher surface changes.
  - Status: Evidenced
  - Evidence: `.github/workflows/openapi-sync-check.yml`
- ECS deploys run behind reusable security gates by default.
  - Status: Evidenced
  - Evidence: `.github/workflows/deploy-ecs-dispatcher.yml`, `.github/workflows/security-gates.yml`
- Tenant onboarding includes DynamoDB seed data and follow-up Terraform apply flows.
  - Status: Evidenced
  - Evidence: `scripts/seed-tenant-config.sh`, `.github/workflows/terraform-apply-tenants.yml`

## 7. Dependency rules

### Allowed direction

- Runtime services may depend on `om-common`.
- Workspace-wide validation may depend on `turbo` task orchestration.
- Terraform apply/plan workflows may target individual layer packages.
- Dispatcher route/DTO changes may update OpenAPI artifacts owned by the dispatcher package.

### Avoid / forbidden

- Do not make `om-common` depend on service-specific code.
- Do not bypass OpenAPI artifact updates when dispatcher route/DTO changes affect the public API contract.
- Do not refactor Terraform layers into a different dependency model without also updating workflows and this file.
- Do not assume `70_domains` semantics without additional repository evidence.
- Do not weaken security-gate or deploy workflow behavior casually; those files are operationally sensitive.

## 8. Key flows

### Runtime flow

1. External callers or upstream producers reach `om-ecs-dispatcher`, the HTTP/API entrypoint.
2. The dispatcher validates and routes work using shared `om-common` utilities and AWS integrations.
3. Asynchronous processing continues through Lambda services such as `om-lambda-sender` and `om-lambda-config-set-processor`.
4. Tenant-specific configuration is persisted in DynamoDB and contributes to downstream behavior.

Evidence: `src/onemail/om-ecs-dispatcher/package.json`, `src/onemail/om-lambda-sender/package.json`, `src/onemail/om-lambda-config-set-processor/package.json`, `scripts/seed-tenant-config.sh`

### Build/test flow

1. Root build, test, lint, type-check, and format commands are orchestrated through `turbo`.
2. Package-local test commands run through Vitest.
3. `turbo` requires upstream builds before dependent tests.
4. Local OpenAPI generation/synchronization is driven from the dispatcher package and root scripts.

Evidence: `package.json`, `turbo.json`, `src/onemail/om-ecs-dispatcher/package.json`, `README.md`

### Deployment/operations flow

1. Terraform plan/apply is executed by layer-specific workflows.
2. ECS dispatcher deploys build a Docker image, push to ECR, render an ECS task definition, and deploy to the target cluster/service.
3. Security gates run before ECS deployment unless a controlled bypass path is used.
4. OpenAPI sync is enforced on PRs affecting dispatcher DTOs/routes.
5. Tenant-related changes trigger a workflow that applies common, app, and monitoring stacks.

Evidence: `.github/workflows/terraform-plan-core.yml`, `.github/workflows/deploy-ecs-dispatcher.yml`, `.github/workflows/security-gates.yml`, `.github/workflows/openapi-sync-check.yml`, `.github/workflows/terraform-apply-tenants.yml`

## 9. Configuration and environment

- Local development requires Node and pnpm; the Node version is tracked in `.nvmrc` and referenced by the README and deploy workflow.
  - Evidence: `README.md`, `.github/workflows/deploy-ecs-dispatcher.yml`
- Each package with `.env.example` expects a local `.env` copy for development.
  - Evidence: `README.md`
- Root scripts exist for packaging runtime artifacts and syncing OpenAPI templates.
  - Evidence: `package.json`, `scripts/package-sender.sh`, `scripts/package-config-set-processor.sh`, `scripts/syncOpenapiTemplateAI.sh`
- Terraform and deploy workflows assume GitHub-hosted AWS credentials via OIDC and environment-scoped variables.
  - Evidence: `.github/workflows/terraform-plan-core.yml`, `.github/workflows/deploy-ecs-dispatcher.yml`
- Tenant configuration seeding requires local AWS CLI credentials or AWS SSO.
  - Evidence: `scripts/seed-tenant-config.sh`

## 10. Testing and validation

| Change type | Suggested validation | Evidence |
| --- | --- | --- |
| Cross-package TypeScript changes | `pnpm test`, `pnpm type-check`, `pnpm lint:check` | `package.json`, `turbo.json` |
| Dispatcher changes | `pnpm test:dispatcher` and, if API surface changes, `pnpm run sync:openapi-template` | `package.json`, `.github/workflows/openapi-sync-check.yml` |
| Sender Lambda changes | `pnpm test:sender` | `package.json` |
| Config-set processor changes | `pnpm test:config-set-processor` | `package.json` |
| Formatting / contributor baseline | `pnpm format:check` and pre-commit hooks | `package.json`, `docs/extending/pre-commit.md` |
| Terraform layer changes | Run the corresponding `terraform-plan-*` workflow logic for the affected layer and environment | `.github/workflows/terraform-plan-core.yml`, related `terraform-plan-*.yml` workflows |
| ECS deploy workflow changes | Review `security-gates.yml` and `deploy-ecs-dispatcher.yml` together before merging | `.github/workflows/deploy-ecs-dispatcher.yml`, `.github/workflows/security-gates.yml` |

## 11. Architectural decisions visible in the repo

- Decision: Keep shared types and utilities in `om-common` instead of duplicating them across services.
  - Status: Evidenced
  - Evidence: `src/onemail/om-common/package.json`, runtime package manifests
  - Trade-off: Improves reuse, but makes `om-common` a high-impact shared surface.
  - Related ADR: None found

- Decision: Use `pnpm` workspaces and `turbo` as the canonical monorepo orchestration layer.
  - Status: Evidenced
  - Evidence: `package.json`, `pnpm-workspace.yaml`, `turbo.json`
  - Trade-off: Speeds consistent workspace operations, but hidden cross-package coupling becomes more dangerous.
  - Related ADR: None found

- Decision: Separate Terraform changes by layer and workflow instead of applying a single monolithic stack per change.
  - Status: Evidenced
  - Evidence: `.github/workflows/terraform-plan-core.yml`, `.github/workflows/terraform-apply-*.yml`
  - Trade-off: Narrows blast radius and review scope, but requires careful understanding of inter-layer dependencies.
  - Related ADR: None found

- Decision: Treat OpenAPI artifacts as a protected contract on dispatcher API changes.
  - Status: Evidenced
  - Evidence: `.github/workflows/openapi-sync-check.yml`, `package.json`, `README.md`
  - Trade-off: Keeps API documentation aligned, but adds extra workflow obligations on DTO/route changes.
  - Related ADR: None found

- Decision: Gate ECS deploys through a reusable security workflow by default.
  - Status: Evidenced
  - Evidence: `.github/workflows/deploy-ecs-dispatcher.yml`, `.github/workflows/security-gates.yml`
  - Trade-off: Improves release safety, but makes manual emergency paths operationally sensitive.
  - Related ADR: None found

## 12. AI-agent working rules

These rules are for Codex, GitHub Copilot Chat, GitHub Copilot Agent, and other AI coding agents.

- Read this file before structural, cross-file, or refactoring changes.
- Prefer existing repository patterns over new abstractions.
- Keep changes scoped to the user request.
- Do not introduce new frameworks, global conventions, or cross-cutting refactors without explicit approval.
- Do not change module boundaries, dependency direction, runtime flows, deployment flows, or validation commands without updating this file.
- If a requested change conflicts with this architecture, explain the conflict before editing.
- Do not treat this file as immutable. If the requested change intentionally changes architecture, propose the architecture update explicitly.
- For risky changes, produce a short plan before modifying files.
- Treat `src/onemail/om-common/`, `src/infra/src/`, `scripts/seed-tenant-config.sh`, and deployment/security/OpenAPI workflows as risky shared surfaces.
- When a change touches dispatcher routes or DTOs, assume OpenAPI contract validation is required unless evidence proves otherwise.

## 13. Last verified

- Date: 2026-04-30
- Agent/tool: GitHub Copilot
- Files inspected: README, root monorepo config, runtime package manifests, selected Terraform layer manifests, and key CI/CD workflows
- Commands considered/run: No build or test commands were run; validation evidence was taken from repository manifests and workflow definitions
- Confidence: Medium

## 14. Unknown / To verify

- Exact responsibility and dependency semantics of `src/infra/src/70_domains/`.
- Full dependency ordering across all Terraform layers beyond the workflows directly inspected.
- Whether `src/onemail/testing/` is only support infrastructure or also owns integration-test contracts that should be called out separately.
- Downstream consumers and blast radius of tenant config changes beyond the seeding/apply flows inspected.
