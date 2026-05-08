# om-lambda-sender

## 1.6.5

### Patch Changes

- Updated dependencies [6905e55]
  - om-common@1.4.6

## 1.6.4

### Patch Changes

- 2d7fca9: config-set-processor error handling
- Updated dependencies [2d7fca9]
  - om-common@1.4.5

## 1.6.3

### Patch Changes

- 4dac33f: max retry handling for lambda sender
- Updated dependencies [4dac33f]
  - om-common@1.4.4

## 1.6.2

### Patch Changes

- b0856e4: Error handling imporvement
- Updated dependencies [b0856e4]
  - om-common@1.4.3

## 1.6.1

### Patch Changes

- 0d2fad2: add rendering failure event ses and no retryable soft bounces
- Updated dependencies [0d2fad2]
  - om-common@1.4.2

## 1.6.0

### Minor Changes

- c029e54: Setup DynamoDB global tables and kms replica

## 1.5.2

### Patch Changes

- 61d74fb: add test lambda-config-set-processor

## 1.5.1

### Patch Changes

- Updated dependencies [b826d85]
  - om-common@1.4.1

## 1.5.0

### Minor Changes

- ae6a79d: refactor sesMessageId to providerMessageId to make it agnostic to the provider used to send emails

### Patch Changes

- Updated dependencies [ae6a79d]
  - om-common@1.4.0

## 1.4.0

### Minor Changes

- cd262f4: add authentication

### Patch Changes

- Updated dependencies [cd262f4]
  - om-common@1.3.0

## 1.3.2

### Patch Changes

- f40a440: add test for sender and create common shared vitest configuration

## 1.3.1

### Patch Changes

- Updated dependencies [1cc0f21]
  - om-common@1.2.1

## 1.3.0

### Minor Changes

- 0a10a3e: Update metrics handling

### Patch Changes

- Updated dependencies [0a10a3e]
  - om-common@1.2.0

## 1.2.10

### Patch Changes

- 0d7f3f0: Bump lodash-es from 4.17.23 to 4.18.1

## 1.2.9

### Patch Changes

- 398f5a5: pnpm dependencies update and pnpm config fix
- Updated dependencies [398f5a5]
  - om-common@1.1.1

## 1.2.8

### Patch Changes

- Updated dependencies [6eebbc4]
  - om-common@1.1.0

## 1.2.7

### Patch Changes

- 180d469: standardize folder and file naming conventions
- Updated dependencies [180d469]
  - om-common@1.0.5

## 1.2.6

### Patch Changes

- 545f2fa: logs
- Updated dependencies [545f2fa]
  - om-common@1.0.4

## 1.2.5

### Patch Changes

- 58d9a5a: Add lambda post configuration set

## 1.2.4

### Patch Changes

- 7af43f2: low priority add reply to and default templateData

## 1.2.3

### Patch Changes

- 6d2d49a: handling dryRun scenarios saving simulator address to db

## 1.2.2

### Patch Changes

- 6af8fec: replace lodash with lodash-es for ESM porting

## 1.2.1

### Patch Changes

- 3306206: update all AWS SDK dependencies to same version + lambda zip package fix

## 1.2.0

### Minor Changes

- 55fd987: implement retry for batch status update and cloudwatch metrics

## 1.1.1

### Patch Changes

- acacd3e: Exclude pnpm internal files from ZIP archive to reduce size

## 1.1.0

### Minor Changes

- cff024f: Implement first version of working lambda-sender poc

### Patch Changes

- 0ad091d: project package and om-lambda-sender deploy action
- Updated dependencies [cff024f]
  - om-common@1.0.3

## 1.0.3

### Patch Changes

- ff2d332: add turborepo
- Updated dependencies [ff2d332]
  - om-common@1.0.2

## 1.0.2

### Patch Changes

- 0942337: Common package for shared types
- Updated dependencies [0942337]
  - om-common@1.0.1

## 1.0.1

### Patch Changes

- ba2b521: Initialize project structure and packages (dispatcher, sender, infra).
