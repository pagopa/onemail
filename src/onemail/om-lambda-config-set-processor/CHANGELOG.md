# om-lambda-config-set-processor

## 1.7.2

### Patch Changes

- d0e10ad: increase alarm threashold

## 1.7.1

### Patch Changes

- 3f73437: Code refactor improvement
- 9650858: handle missing email record and fix lambda event partial failure
- Updated dependencies [3f73437]
  - om-common@1.6.1

## 1.7.0

### Minor Changes

- 49b8abb: add blacklist common type & set processor update

### Patch Changes

- c2bc009: add blacklist checks in ecs dispatcher, update put blacklist obj in lambda set processor
- Updated dependencies [49b8abb]
- Updated dependencies [c2bc009]
  - om-common@1.6.0

## 1.6.12

### Patch Changes

- 7afe555: add tls tenant config option and add starttls error and mail loop to no retryable softbounce

## 1.6.11

### Patch Changes

- Updated dependencies [a460b00]
  - om-common@1.5.0

## 1.6.10

### Patch Changes

- 42c8ed8: Lambdas and ECS deploy eu-central

## 1.6.9

### Patch Changes

- 46a05a5: add tenantname and clientid dimensions, add alarm and dashboards

## 1.6.8

### Patch Changes

- a23dd9c: Config set processor internal max retry

## 1.6.7

### Patch Changes

- Updated dependencies [6905e55]
  - om-common@1.4.6

## 1.6.6

### Patch Changes

- 2d7fca9: config-set-processor error handling
- Updated dependencies [2d7fca9]
  - om-common@1.4.5

## 1.6.5

### Patch Changes

- Updated dependencies [4dac33f]
  - om-common@1.4.4

## 1.6.4

### Patch Changes

- Updated dependencies [b0856e4]
  - om-common@1.4.3

## 1.6.3

### Patch Changes

- 0d2fad2: add rendering failure event ses and no retryable soft bounces
- Updated dependencies [0d2fad2]
  - om-common@1.4.2

## 1.6.2

### Patch Changes

- 61d74fb: add test lambda-config-set-processor

## 1.6.1

### Patch Changes

- Updated dependencies [b826d85]
  - om-common@1.4.1

## 1.6.0

### Minor Changes

- ae6a79d: refactor sesMessageId to providerMessageId to make it agnostic to the provider used to send emails

### Patch Changes

- Updated dependencies [ae6a79d]
  - om-common@1.4.0

## 1.5.2

### Patch Changes

- Updated dependencies [cd262f4]
  - om-common@1.3.0

## 1.5.1

### Patch Changes

- f9eef79: Rendering failure event handling

## 1.5.0

### Minor Changes

- defc523: Skip update if current and new state are equal to QUEUED

## 1.4.3

### Patch Changes

- bcd64ba: Reject event handling

## 1.4.2

### Patch Changes

- Updated dependencies [1cc0f21]
  - om-common@1.2.1

## 1.4.1

### Patch Changes

- cb90a06: avoid delivered status post complaint/bounce

## 1.4.0

### Minor Changes

- e3aefad: refactor config-set-processor to implement retry scheduling handled by ses

## 1.3.1

### Patch Changes

- 869c0be: fix processor input validation and remove duplicate env var

## 1.3.0

### Minor Changes

- 0a10a3e: Update metrics handling

### Patch Changes

- Updated dependencies [0a10a3e]
  - om-common@1.2.0

## 1.2.2

### Patch Changes

- 0d7f3f0: Bump lodash-es from 4.17.23 to 4.18.1

## 1.2.1

### Patch Changes

- 398f5a5: pnpm dependencies update and pnpm config fix
- Updated dependencies [398f5a5]
  - om-common@1.1.1

## 1.2.0

### Minor Changes

- 6eebbc4: Add implementation of retry policy for Soft Bounces and handling for Complaints

### Patch Changes

- Updated dependencies [6eebbc4]
  - om-common@1.1.0

## 1.1.2

### Patch Changes

- 180d469: standardize folder and file naming conventions
- Updated dependencies [180d469]
  - om-common@1.0.5

## 1.1.1

### Patch Changes

- Updated dependencies [545f2fa]
  - om-common@1.0.4

## 1.1.0

### Minor Changes

- 58d9a5a: Add lambda post configuration set
