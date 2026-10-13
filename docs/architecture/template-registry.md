# Template Registry And Dispatcher Rollout

## Registry Contract

- `onemail_common` manages the `Template` DynamoDB global table using the EmailStatusHistory module pattern: primary `eu-south-1`, replica `eu-central-1`, in dev, UAT and production.
- The sole partition key is `TemplateName` (String). There is no sort key, index, TTL, cache, lifecycle state or placeholder metadata.
- An item contains only `TemplateName`, `tenantName` and `lastModifiedDate` (successful-publication UTC ISO-8601 timestamp).
- The `onemail-template` pipeline writes metadata only in the primary region, after creating/verifying the immutable SES template and its tenant association in both required regions. Retirement removes both regional associations/templates before deleting metadata. No publisher Lambda or automatic backfill exists.
- Conditional pipeline writes/deletes must protect tenant ownership. SES and DynamoDB are not transactional; interrupted operations are resumed forward by the publishing pipeline.

## Publisher Permissions

- The common stack creates `oml-<d/u/p>-template-publish-role` only in the primary region and exposes `template_publish_role_arn`.
- OIDC trust accepts exactly `repo:pagopa/onemail-template:environment:<dev/uat/prod>` for the corresponding account. The existing account GitHub OIDC provider must already be present.
- Configure GitHub environment deployment branches to protected `main`; IAM environment subjects alone cannot enforce the branch. Require production environment reviewers. PR validation must not assume this role.
- SES permissions cover create/get/delete template, get tenant, list tenant resources/resource tenants, and create/delete template associations in both regions. There are no template-update, tenant-create, send-email or Lambda permissions.
- Tenant ARNs use existing configured `oml-<d/u/p>-tenant-<productFolder>` names. Template ARNs are restricted to each configured product's `<productFolder>_*` namespace; identities and configuration sets cannot be associated through this role.
- DynamoDB permits only GetItem/PutItem/DeleteItem on the primary `Template` table, with its required KMS decrypt/data-key permissions. The dispatcher receives only GetItem and KMS decrypt, not registry writes.

## Runtime And Replica Lag

- With checks enabled, every high/low priority template request (including dry-run) is checked after authenticated tenant configuration resolution and before attachment uploads, status writes or queue publication. Direct-body requests bypass the registry unchanged.
- The registry adapter always performs a strongly consistent GetItem against the primary writer in `eu-south-1`. It does not trust local replica presence or absence: a missing-item fallback alone would still accept stale records after retirement. Both dispatcher regions use the primary client; local development uses the existing local DynamoDB endpoint.
- The dedicated SDK client has at most three attempts, a 1-second connection timeout and a 3-second request timeout per attempt, plus SDK retry backoff. Primary unavailability fails closed with HTTP 503/D001 and a retry message, never a false 404. Missing templates return 404/R001; foreign-tenant templates return 401/T001.
- This trades cross-region latency and primary availability for authoritative ownership/retirement reads. Secondary-region ECS networking must reach the primary DynamoDB endpoint; a regional gateway endpoint alone is insufficient. No cloud networking changes are included here.
- Registry presence does not guarantee immediate SES visibility, and retirement is not atomic with requests already accepted or emails already queued. There is no drain protocol or immediate-retirement state flag.

## Activation And Rollback

1. Cloud engineering deploys the registry/IAM changes after review. Establish the required existing SES tenants and permissions in both regions, including missing dev/UAT secondary prerequisites; do not invent tenants for products absent from the environment catalog.
2. Developers/cloud engineering manually align existing SES templates and associations with three-field registry records. No runtime component inventories or backfills templates automatically.
3. Configure the template repository's protected environments and role ARN. Verify both-region publication/retirement and primary registry reachability before enabling checks.
4. Enable `template_registry_enabled=true` in the appropriate `onemail_app` deployment. Terraform injects `TEMPLATE_REGISTRY_ENABLED`, `AWS_TEMPLATE_DB_TABLE` (default `Template`) and `AWS_TEMPLATE_PRIMARY_REGION` (`eu-south-1`), and grants primary-table read permissions. The default remains false in every environment, including production; disabled deployments do not even resolve a new table data source.
5. For rollback, set `template_registry_enabled=false` and redeploy the task configuration. Keep the registry and publishing role; submissions revert to the previous behavior without deleting resources. Outside Terraform, leave `TEMPLATE_REGISTRY_ENABLED` unset or set it to `false`.

When enabled, `AWS_TEMPLATE_DB_TABLE` is required. `TEMPLATE_REGISTRY_ENABLED` accepts only `true` or `false`, and the primary-region setting accepts only `eu-south-1`. Invalid rollout configuration fails at startup.
