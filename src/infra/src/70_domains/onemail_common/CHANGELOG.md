# infra-domains-onemail-common

## 1.15.0

### Minor Changes

- 4be5377: Ses identity creation env based

## 1.14.0

### Minor Changes

- 18e025f: Terraform modules version pinning and script symlink

## 1.13.1

### Patch Changes

- 0d2fad2: add rendering failure event ses and no retryable soft bounces

## 1.13.0

### Minor Changes

- c029e54: Setup DynamoDB global tables and kms replica
- c029e54: Global Tables and kms replica

## 1.12.0

### Minor Changes

- 20de9a8: AWS DynamoDB delete protection enabling

## 1.11.0

### Minor Changes

- ae6a79d: refactor sesMessageId to providerMessageId to make it agnostic to the provider used to send emails

## 1.10.0

### Minor Changes

- cd262f4: add authentication

## 1.9.0

### Minor Changes

- 9b7144b: Align SES configuration between envs

## 1.8.0

### Minor Changes

- ec483b4: Matched Event SES removal and Scheduler VPC Endpoint add

## 1.7.0

### Minor Changes

- d35259a: Remove env from tenant and config-set name

## 1.6.0

### Minor Changes

- 36d6594: Add Env vars to lambda config set processor and fix eventbridge rule

## 1.5.0

### Minor Changes

- fd7b3ac: Shared tenants json file and env vars for ECS and Lambda

## 1.4.0

### Minor Changes

- 402d456: AWS SES Tenants configuration

## 1.3.0

### Minor Changes

- ebaa5d4: Sqs visibility timeout to 60s

## 1.2.0

### Minor Changes

- 15d1b96: DynamoDB gsi for sesMessageId and SES ConfigurationSet event destination

## 1.1.2

### Patch Changes

- 2df41d4: standardize DynamoDB attribute names and hash keys

## 1.1.1

### Patch Changes

- 9d54f9f: Make SES DKIM DNS CNAME records region-specific

## 1.1.0

### Minor Changes

- e74abf3: AWS SES configuration and DNS records creation
