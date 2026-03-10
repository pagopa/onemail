# Full Repository Review

Date: `2026-03-10`

## Executive Summary

- Scope reviewed: `src/onemail`, `src/infra`, and `.github`
- Review style: read-only, evidence-based, architecture-aware
- Overall assessment: the repository has a strong structural foundation, but the implemented system is still materially behind the architecture it claims to represent
- Current maturity level:
  - repository organization: good
  - infrastructure decomposition: good
  - application readability: fair to good
  - production readiness of the email pipeline: low
  - behavioral confidence: low, mainly due to missing tests and incomplete end-to-end flow

The repository already shows the outline of a solid platform:

- an ECS-based dispatcher
- a Lambda-based sender
- shared types
- Terraform stacks split by platform domain
- CI/CD workflows for plan/apply and release

The central problem is not naming, formatting, or repo layout. The central problem is system integrity. The runtime path from API request to actual email delivery is not complete, and some parts of the public contract do not match either the data model or the deployed infrastructure.

If this repository is treated as a production-ready messaging system today, that would be an overstatement. If it is treated as a strong foundation that still needs one full vertical slice to be completed and hardened, that would be accurate.

## Validation Snapshot

The following non-mutating checks were executed during this review:

- `pnpm run lint:check`: passed
- `pnpm run format:check`: passed
- `pnpm run type-check`: passed
- `pnpm -r --if-present test`: ran, but only placeholder test scripts exist
- `terraform fmt -check -recursive src/infra/src`: passed
- `bash .github/scripts/validate-copilot-customizations.sh --scope root --mode strict`: passed
- `shellcheck -s bash src/infra/src/70_domains/onemail_app/terraform.sh src/infra/src/30_security/sops.sh`: warnings found in `terraform.sh`
- `terraform validate`: not run during this review

Interpretation:

- code style and typing are currently enforced
- repository-local Copilot configuration is in good shape
- runtime behavior is not being validated in CI in any meaningful way
- shell safety is still weaker than the repository standard suggests

## Architecture Overview

## Current Architecture Observed in the Repository

The repository describes and partially implements the following architecture:

1. `om-ecs-dispatcher` exposes HTTP endpoints and validates incoming email requests.
2. The dispatcher should classify requests by priority and push them into downstream processing.
3. Shared types in `om-common` define the persistence and message model.
4. `onemail_common` infrastructure creates DynamoDB and SQS primitives.
5. `onemail_app` infrastructure creates the private API Gateway, ECS service, and Lambda sender.
6. The sender Lambda should consume from SQS, send through SES, and update status history.

This is a reasonable architecture for an internal messaging platform. It separates ingestion from delivery, keeps write throughput decoupled from send throughput, and uses AWS-native components that are appropriate for the domain.

## What Is Good About the Architecture

- The split between ingestion and delivery is correct. Dispatcher and sender should be separate execution models.
- Using SQS as the decoupling boundary is the right choice for variable load and retry isolation.
- Using DynamoDB for email status tracking is acceptable if the access patterns are explicit and stable.
- The Terraform stack split by domain is understandable:
  - `0_IAM`
  - `10_network`
  - `20_core`
  - `30_security`
  - `70_domains/onemail_common`
  - `70_domains/onemail_app`
- Private API Gateway and VPC endpoints show good intent around network exposure.

## Main Architectural Gaps

### 1. The architecture exists more in shape than in behavior

The main diagram implied by the repository is better than the actual runtime implementation.

- The dispatcher does not publish to SQS:
  - [`email.service.ts`](../src/onemail/om-ecs-dispatcher/src/services/email.service.ts)
- The sender that infra deploys is a placeholder package:
  - [`env/dev/eu-south-1/terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/dev/eu-south-1/terraform.tfvars)
  - [`lambda/hello-nodejs/index.js`](../src/infra/src/70_domains/onemail_app/lambda/hello-nodejs/index.js)
- The real sender package exists but is not the deployed runtime:
  - [`om-lambda-sender/src/app.ts`](../src/onemail/om-lambda-sender/src/app.ts)

What this means architecturally:

- the system boundary is defined, but the internal responsibilities are not connected
- the repo risks accumulating “designed but not actually used” components
- operators and reviewers may assume guarantees that the system does not yet provide

Recommended architectural fix:

- complete one real vertical path before adding more capability
- choose a single truth for the delivery pipeline:
  - API accepts request
  - dispatcher validates and persists initial state
  - dispatcher emits queue message
  - sender consumes queue message
  - sender sends through SES
  - sender updates DynamoDB status history
- remove any placeholder infrastructure that is no longer part of the intended design

### 2. The status model is under-specified relative to the product promise

The data model implies request tracking and lifecycle history, but the actual query and update model is incomplete.

- Shared type says `requestId` is a GSI-style access key:
  - [`EmailStatusHistory.ts`](../src/onemail/om-common/src/types/EmailStatusHistory.ts)
- API documentation says `requestId` is used to check status:
  - [`common.dto.ts`](../src/onemail/om-ecs-dispatcher/src/dtos/email/common.dto.ts)
- Terraform table definitions do not include a GSI:
  - [`onemail_common/dev terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/dev/eu-south-1/terraform.tfvars)
  - [`onemail_common/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/prod/eu-south-1/terraform.tfvars)

Architectural consequence:

- the system speaks as if request-level tracking exists
- the storage layer does not support that promise
- future consumers will either build against a false assumption or bolt on ad hoc workarounds

Recommended architectural fix:

- choose the status lookup model explicitly
- if `requestId` is a public lookup key:
  - add a proper GSI
  - define response shape and query semantics
  - add a status endpoint
- if `requestId` is only an async acknowledgement token:
  - stop documenting it as a status retrieval mechanism until the query path exists

### 3. The architecture needs clearer ownership boundaries

Right now the repository has four overlapping truth sources:

- runtime code
- shared types
- Terraform variable shape
- README and OpenAPI descriptions

These are not fully aligned. That is an architecture problem, not just a documentation problem.

Recommended architectural fix:

- define one contract owner per concern:
  - request DTOs: application layer
  - persisted status model: shared types plus Terraform schema
  - delivery flow: runtime code plus infra
  - operational guarantees: docs and CI
- avoid publishing capability in docs before runtime and infra both support it

## Suggested Target Architecture

The cleanest medium-term target is:

1. Private API Gateway -> ECS dispatcher
2. Dispatcher validates request and derives `clientId` from authenticated context
3. Dispatcher writes an initial `Queued` record to DynamoDB
4. Dispatcher publishes a message to `high` or `low` SQS queue
5. Sender Lambda consumes SQS, resolves template/body, sends with SES
6. Sender updates the same DynamoDB record with `Dispatched`, `Delivered`, `Bounce`, and failure events
7. A status endpoint or internal query tool reads by `requestId` and/or `emailId`

Recommended improvements around this target:

- add DLQs for both SQS queues
- add idempotency handling around sender processing
- explicitly model transient vs terminal delivery failures
- use immutable artifacts for both ECS and Lambda deploys
- add CloudWatch metrics and structured logs at both dispatcher and sender boundaries

## Critical Findings

## 1. The end-to-end delivery flow is not implemented

Risk level: `Critical`

This is the most important issue in the repository.

Evidence:

- Dispatcher writes only to DynamoDB:
  - [`email.service.ts`](../src/onemail/om-ecs-dispatcher/src/services/email.service.ts)
- Lambda infra is attached to SQS event source mappings:
  - [`03_lambda.tf`](../src/infra/src/70_domains/onemail_app/03_lambda.tf)
- Environment tfvars deploy a placeholder Lambda artifact:
  - [`onemail_app/dev terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/dev/eu-south-1/terraform.tfvars)
  - [`onemail_app/uat terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/uat/eu-south-1/terraform.tfvars)
  - [`onemail_app/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/prod/eu-south-1/terraform.tfvars)
- Placeholder runtime code:
  - [`lambda/hello-nodejs/index.js`](../src/infra/src/70_domains/onemail_app/lambda/hello-nodejs/index.js)
- Real sender package is not wired into deployment:
  - [`om-lambda-sender/src/app.ts`](../src/onemail/om-lambda-sender/src/app.ts)

Why this is critical:

- the repository claims an asynchronous messaging architecture
- the runtime only persists records and stops there
- the deployed sender is not an actual sender
- the most important business promise, email delivery, is not implemented end to end

How to fix it:

1. Decide the canonical message envelope sent from dispatcher to SQS.
2. Add explicit SQS publishing in dispatcher service code.
3. Package and deploy the real `om-lambda-sender` build artifact.
4. Replace placeholder Lambda code and tfvars package paths.
5. Implement sender logic to:
   - parse queue messages
   - send with SES
   - update DynamoDB status
6. Add one end-to-end smoke path in CI or a deploy validation environment.

Recommended implementation order:

- first connect dispatcher to SQS
- then wire Lambda packaging to the actual sender package
- then implement real sender logic
- then add tests
- then remove placeholders

## 2. DynamoDB schema is inconsistent between local and cloud

Risk level: `Critical`

Evidence:

- Runtime writes `emailId`:
  - [`dbMapper.ts`](../src/onemail/om-ecs-dispatcher/src/utils/dbMapper.ts)
- Local table bootstrap uses `emailId`:
  - [`init-dynamodb-table.sh`](../src/onemail/om-ecs-dispatcher/docker/dynamodb-local/init-dynamodb-table.sh)
- Terraform environments use `EmailId`:
  - [`onemail_common/dev terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/dev/eu-south-1/terraform.tfvars)
  - [`onemail_common/uat terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/uat/eu-south-1/terraform.tfvars)
  - [`onemail_common/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/prod/eu-south-1/terraform.tfvars)

Why this is critical:

- local development is not representative of deployed behavior
- runtime writes can fail against real infrastructure
- the data model cannot be trusted across environments

How to fix it:

1. Choose a canonical attribute name.
2. Update:
   - shared type comments and naming guidance if needed
   - `dbMapper.ts`
   - local bootstrap scripts
   - all Terraform tfvars files
3. Add one integration test that writes an item against local DynamoDB using the exact deployed attribute names.
4. Add a static check or test fixture that compares expected runtime fields with Terraform table key definitions.

Suggested default:

- use `emailId` consistently in code and infrastructure, unless there is a strong external reason to preserve `EmailId`

## Major Findings

## 1. Low-priority batch writes can silently lose emails

Risk level: `Major`

Evidence:

- `BatchWriteCommand` results are not checked for `UnprocessedItems`
- the code explicitly acknowledges the missing retry logic with a TODO
- a success response is returned even if the batch may be incomplete

Relevant file:

- [`email.service.ts`](../src/onemail/om-ecs-dispatcher/src/services/email.service.ts)

Why this matters:

- DynamoDB batch writes are not all-or-nothing
- throttling and transient capacity pressure are normal conditions
- returning success without verifying full persistence creates silent data loss

How to fix it:

1. Capture the result of each `BatchWriteCommand`.
2. Merge and inspect `UnprocessedItems`.
3. Retry with bounded exponential backoff.
4. Fail the request if any items remain unprocessed after the retry budget.
5. Emit structured logs and counters for retry count and dropped items.

Implementation advice:

- isolate the retry logic into a dedicated persistence helper
- unit test:
  - full success
  - partial unprocessed then success after retry
  - persistent unprocessed leading to error

## 2. Public API contracts are inconsistent with implementation

Risk level: `Major`

Evidence:

- Routes document `202 Accepted`:
  - [`email.route.ts`](../src/onemail/om-ecs-dispatcher/src/routes/email.route.ts)
- Controllers return `200 OK`:
  - [`email.controller.ts`](../src/onemail/om-ecs-dispatcher/src/controllers/email.controller.ts)
- `replyTo` is accepted but not used:
  - [`emailLowPriority.dto.ts`](../src/onemail/om-ecs-dispatcher/src/dtos/email/emailLowPriority.dto.ts)
  - [`dbMapper.ts`](../src/onemail/om-ecs-dispatcher/src/utils/dbMapper.ts)
- `requestId` is documented as a status lookup key without storage support:
  - [`common.dto.ts`](../src/onemail/om-ecs-dispatcher/src/dtos/email/common.dto.ts)
  - [`onemail_common/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/prod/eu-south-1/terraform.tfvars)

Why this matters:

- integrations will code against false assumptions
- OpenAPI ceases to be a trustworthy source of truth
- dead fields like `replyTo` create long-term compatibility debt

How to fix it:

1. Decide whether the dispatcher is synchronous acknowledgement or accepted-for-async-processing.
2. If async:
   - return `202`
   - make OpenAPI and controllers match
3. Either implement `replyTo` end to end or remove it from the request schema.
4. Either implement `requestId` lookup support or reword the response documentation.
5. Add API contract tests that compare controller status codes with documented responses.

Recommended default:

- use `202 Accepted` because the design is clearly asynchronous

## 3. Terraform and deployment inputs are not deterministic enough

Risk level: `Major`

Evidence:

- Terraform remote modules use `ref=main`:
  - [`onemail_app/99_provider.tf`](../src/infra/src/70_domains/onemail_app/99_provider.tf)
  - [`20_core/09_ecr.tf`](../src/infra/src/20_core/09_ecr.tf)
  - [`10_network/11_nlb.tf`](../src/infra/src/10_network/11_nlb.tf)
- ECS image tags are mutable:
  - [`onemail_app/uat terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/uat/eu-south-1/terraform.tfvars)
  - [`onemail_app/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/prod/eu-south-1/terraform.tfvars)
- Lambda package path points to a local placeholder artifact path:
  - [`onemail_app/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/prod/eu-south-1/terraform.tfvars)

Why this matters:

- plan output can change without a repository change
- deploy reproducibility is weak
- rollback reliability is weak

How to fix it:

1. Pin all remote module sources to immutable tags or SHAs.
2. Replace `latest` image tags with immutable image versions or digests.
3. Build Lambda artifacts in CI and pass artifact version explicitly to Terraform.
4. Ensure environment tfvars refer to release outputs, not local placeholder files.

Recommended release pattern:

- app build produces immutable artifact metadata
- Terraform consumes only immutable artifact coordinates

## 4. Quality gates do not protect real behavior

Risk level: `Major`

Evidence:

- Dispatcher test script is a placeholder:
  - [`om-ecs-dispatcher/package.json`](../src/onemail/om-ecs-dispatcher/package.json)
- Sender test script is a placeholder:
  - [`om-lambda-sender/package.json`](../src/onemail/om-lambda-sender/package.json)
- Code review workflow still has unit tests commented out:
  - [`code-review.yml`](../.github/workflows/code-review.yml)

Why this matters:

- typing does not catch behavioral regressions
- async delivery systems fail in edge cases more often than in syntax
- critical logic is currently unguarded:
  - DTO validation
  - persistence mapping
  - batch retries
  - sender message parsing
  - status updates

How to fix it:

1. Add unit tests first for pure logic:
   - `dbMapper`
   - Zod schema constraints
   - retry helper behavior
2. Add service tests with mocked AWS SDK calls.
3. Add sender tests for:
   - good SQS message
   - malformed message
   - SES failure
   - idempotent update behavior
4. Enable test execution in `code-review.yml`.
5. Treat missing tests for delivery-path changes as a merge blocker.

## 5. Permissions are broader than necessary

Risk level: `Major`

Evidence:

- Release workflow has write permissions at workflow scope:
  - [`release.yaml`](../.github/workflows/release.yaml)
- IaC role is attached to `AdministratorAccess`:
  - [`01_iam_github.tf`](../src/infra/src/0_IAM/01_iam_github.tf)
- SES sender policy uses `resources = ["*"]`:
  - [`03_lambda.tf`](../src/infra/src/70_domains/onemail_app/03_lambda.tf)

Why this matters:

- the blast radius for CI mistakes is higher than needed
- least privilege is declared as a repo standard but not enforced in the most sensitive areas

How to fix it:

1. Scope workflow permissions per job instead of globally.
2. Replace `AdministratorAccess` with task-specific infra policies.
3. Narrow SES scope if account constraints allow it.
4. Review whether plan/apply roles can be further separated by stack.

## Minor Findings

## 1. Graceful shutdown is incomplete for ECS

Risk level: `Minor`

Evidence:

- dispatcher only handles `SIGINT`:
  - [`app.ts`](../src/onemail/om-ecs-dispatcher/src/app.ts)

Why this matters:

- ECS typically sends `SIGTERM`
- abrupt shutdowns increase risk during rolling deploys and connection draining

How to fix it:

- keep the server handle returned by `app.listen`
- handle both `SIGTERM` and `SIGINT`
- stop accepting new requests before exit

## 2. Placeholder runtime values remain in business data

Risk level: `Minor`

Evidence:

- hardcoded `clientIdMock`:
  - [`email.service.ts`](../src/onemail/om-ecs-dispatcher/src/services/email.service.ts)

Why this matters:

- production data written with placeholders creates cleanup and audit problems
- it also hides a missing architectural decision: how tenant or client identity is derived

How to fix it:

- derive `clientId` from auth context, API key metadata, or gateway identity mapping
- reject requests that cannot be attributed to a client

## 3. Shell helper quality is below the repo standard

Risk level: `Minor`

Evidence:

- `shellcheck` reports quoting and array issues in:
  - [`onemail_app/terraform.sh`](../src/infra/src/70_domains/onemail_app/terraform.sh)

Why this matters:

- these scripts are operational tools
- small quoting bugs in infra helpers become expensive when they hit real environments

How to fix it:

- fix all `SC2086` and `SC2124` cases
- standardize all Terraform helper scripts to the same safe shell pattern
- keep one canonical implementation and share it, instead of maintaining near-copies

## Category Review

## Architecture and Boundaries

Verdict: `Good decomposition, weak behavioral cohesion`

Strong points:

- the repository separates platform concerns sensibly
- the chosen AWS primitives match the messaging domain well
- there is a plausible long-term architecture here

Main issues:

- the dispatcher, queues, sender, and status store do not currently compose into one trustworthy system
- some boundaries are only nominal:
  - sender exists, but the deployed artifact is not the real sender
  - status model exists, but lookup semantics are not implemented
  - shared types describe relationships that infra does not support
- the architecture has not yet reached “single source of truth” maturity

How to proceed:

- stop adding new externally visible features until the existing core path is complete
- define the authoritative delivery contract and make all layers conform to it
- document only behavior that exists in code and infra together

## Application Code

Verdict: `Readable and structured, but still at an early service maturity level`

Strong points:

- controllers, routes, DTOs, and services are separated clearly
- Zod-based validation is a strong foundation
- code is relatively easy to review and reason about

Main issues:

- business guarantees are not yet encoded in the codebase
- persistence behavior is fragile in the presence of partial failure
- several values and branches still look like scaffolding rather than product code
- the sender package is effectively a stub from a behavior standpoint

How to proceed:

- introduce a small domain layer for request acceptance and delivery intent
- move AWS-specific persistence and queueing into adapter-level helpers
- make “accepted”, “queued”, “dispatched”, and “failed” explicit transitions
- add tests around failure paths before adding more endpoints

## Infrastructure and Terraform

Verdict: `Well organized stacks, but weak deployment rigor`

Strong points:

- stack layout is understandable and scalable
- network exposure is reasonably constrained
- module separation by platform layer is a good long-term choice

Main issues:

- mutable references reduce trust in plans and releases
- placeholder Lambda deploy path means infra can be green while product behavior is wrong
- data and messaging primitives do not yet express enough operational policy
- there is no visible DLQ strategy for queues

How to proceed:

- pin every deploy input that affects runtime
- connect Terraform only to build outputs that CI produced
- add DLQs, queue redrive policy, and explicit sender timeout/backoff reasoning
- run `terraform validate` per touched stack in CI, not only `fmt`

## CI/CD and Delivery

Verdict: `Clean workflow layout, insufficient quality enforcement`

Strong points:

- workflows are simple and readable
- action pinning is in place
- OIDC is used instead of static long-lived AWS keys

Main issues:

- CI mostly checks syntax, style, and types
- CI does not prove that email dispatch behavior works
- workflow guidance says `timeout-minutes` should be explicit, but current workflows do not define it
- release flow and infra flow are not tightly coupled to immutable artifacts

How to proceed:

- add unit and service tests to PR validation
- add explicit workflow timeouts
- make release outputs feed deploy inputs
- add a deployment smoke check for one controlled environment

## Security, Reliability, and Operability

Verdict: `Baseline-aware, not yet production-hardened`

Strong points:

- private API access pattern is appropriate
- VPC endpoint usage is thoughtful
- repo-level security baseline exists and is active for `.github`

Main issues:

- privilege scope is still broader than it should be
- failure handling is not robust in persistence and delivery paths
- observability is too minimal for a messaging system
- graceful shutdown and retry semantics are incomplete

How to proceed:

- reduce IAM permissions first where blast radius is highest
- define retry, DLQ, and poison-message handling clearly
- add structured logs and business metrics:
  - accepted requests
  - queued messages
  - send success
  - send failure
  - retry count
  - dropped/unprocessed writes

## Testing, Developer Experience, and Documentation

Verdict: `Good onboarding intent, low confidence in runtime correctness`

Strong points:

- local setup instructions exist
- formatting and linting are consistent
- repo structure is discoverable

Main issues:

- README and package descriptions imply a more complete system than the runtime currently delivers
- test commands exist but do not test anything useful
- local DynamoDB behavior is not aligned with the cloud schema
- some docs and contracts are ahead of the code

How to proceed:

- make the docs conservative and accurate
- replace placeholder tests with real coverage for core logic
- add one local integration recipe that mirrors the deployed storage contract exactly

## Suggested Fix Plan

## Phase 1: Restore System Integrity

Goal: make the main delivery path real.

- align DynamoDB key naming across code, local tooling, and Terraform
- implement SQS publishing in dispatcher
- deploy the real Lambda sender artifact
- make sender consume queue messages and update status
- remove placeholder Lambda references from Terraform

## Phase 2: Make Behavior Trustworthy

Goal: remove silent failure classes.

- add retry logic for `BatchWriteCommand`
- define idempotency for sender processing
- add DLQs and failure handling policy
- make request status semantics explicit

## Phase 3: Make Delivery Reproducible

Goal: reduce operational uncertainty.

- pin Terraform remote modules to immutable refs
- pin ECS and Lambda artifacts immutably
- connect release outputs to deploy inputs
- add `terraform validate` into CI where relevant

## Phase 4: Raise the Engineering Bar

Goal: make regressions harder to ship.

- add unit tests for DTOs and mappers
- add service tests for dispatcher logic
- add sender tests with mocked SES and SQS events
- enable test execution in PR workflow
- add architecture-level smoke checks

## Final Assessment

This repository is not weak. It is incomplete in the most important place.

The structure is better than many early-stage service repositories:

- the separation of concerns is good
- the infrastructure layout is good
- the CI/CD shape is good

But the core product promise, accepted email request becomes delivered email through a reliable asynchronous pipeline, is not yet supported by the actual code-and-infra combination stored here.

The highest-value move is not a broad refactor. It is to complete and harden one full vertical slice, then tighten contracts, tests, and deploy determinism around that slice.
