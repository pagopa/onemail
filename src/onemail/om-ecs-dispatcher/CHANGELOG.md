# om-ecs-dispatcher

## 1.10.3

### Patch Changes

- Updated dependencies [0d2fad2]
  - om-common@1.4.2

## 1.10.2

### Patch Changes

- b826d85: improve metrics flushing logic to handle no stored metrics case
- Updated dependencies [b826d85]
  - om-common@1.4.1

## 1.10.1

### Patch Changes

- Updated dependencies [ae6a79d]
  - om-common@1.4.0

## 1.10.0

### Minor Changes

- cd262f4: add authentication

### Patch Changes

- Updated dependencies [cd262f4]
  - om-common@1.3.0

## 1.9.1

### Patch Changes

- f40a440: add test for sender and create common shared vitest configuration

## 1.9.0

### Minor Changes

- 1cc0f21: Add metrics flushing and dispatcher metrics tracking

### Patch Changes

- Updated dependencies [1cc0f21]
  - om-common@1.2.1

## 1.8.0

### Minor Changes

- dde8d37: Add number of attempts to /status route

## 1.7.0

### Minor Changes

- 0a10a3e: Update metrics handling

### Patch Changes

- Updated dependencies [0a10a3e]
  - om-common@1.2.0

## 1.6.7

### Patch Changes

- 50b0d0b: fix yaml override conflicts lock file
- 96ad737: add vitest and ecs dispatcher ut

## 1.6.6

### Patch Changes

- 0d7f3f0: Bump lodash-es from 4.17.23 to 4.18.1

## 1.6.5

### Patch Changes

- 042de61: remove .npmrc reference from dockerfile

## 1.6.4

### Patch Changes

- 398f5a5: pnpm dependencies update and pnpm config fix
- Updated dependencies [398f5a5]
  - om-common@1.1.1

## 1.6.3

### Patch Changes

- Updated dependencies [6eebbc4]
  - om-common@1.1.0

## 1.6.2

### Patch Changes

- 180d469: standardize folder and file naming conventions
- Updated dependencies [180d469]
  - om-common@1.0.5

## 1.6.1

### Patch Changes

- 545f2fa: logs
- Updated dependencies [545f2fa]
  - om-common@1.0.4

## 1.6.0

### Minor Changes

- ab7b401: handle low priority address duplication + sendingInfo max size to 10

## 1.5.9

### Patch Changes

- ea67eaf: Align AWS OpenAPI and API Gateway template synchronization script.

## 1.5.8

### Patch Changes

- 58d9a5a: Add lambda post configuration set

## 1.5.7

### Patch Changes

- 7af43f2: low priority add reply to and default templateData

## 1.5.6

### Patch Changes

- 6d2d49a: handling dryRun scenarios saving simulator address to db

## 1.5.5

### Patch Changes

- 6af8fec: replace lodash with lodash-es for ESM porting

## 1.5.4

### Patch Changes

- 3306206: update all AWS SDK dependencies to same version + lambda zip package fix

## 1.5.3

### Patch Changes

- d7b628e: Dispatcher improvement - api response code and input constraints, health check

## 1.5.2

### Patch Changes

- 9bb8bc8: Fix deploy dispatcher action - env matrix

## 1.5.1

### Patch Changes

- ebeac02: Fix ecs dispatcher deploy action
- abd1a80: Deploy action

## 1.5.0

### Minor Changes

- 119d94b: Add new get email status api

## 1.4.0

### Minor Changes

- d6f6e6a: add sqs event handling in ecs-dispatcher

## 1.3.2

### Patch Changes

- 0ad091d: project package and om-lambda-sender deploy action
- cff024f: Implement first version of working lambda-sender poc
- Updated dependencies [cff024f]
  - om-common@1.0.3

## 1.3.1

### Patch Changes

- ff2d332: add turborepo
- Updated dependencies [ff2d332]
  - om-common@1.0.2

## 1.3.0

### Minor Changes

- 23440a4: add sanitazion for html in high priority

## 1.2.1

### Patch Changes

- 8cf478c: Fix DynamoDB local docker compose

## 1.2.0

### Minor Changes

- fcba10b: add dryRun check and low priority route

## 1.1.2

### Patch Changes

- 0942337: Common package for shared types
- Updated dependencies [0942337]
  - om-common@1.0.1

## 1.1.1

### Patch Changes

- 8662283: openapi

## 1.1.0

### Minor Changes

- 4e640bb: Data model: DTO and EmailStatus db table

## 1.0.2

### Patch Changes

- 01001cc: first dispatcher POC

## 1.0.1

### Patch Changes

- ba2b521: Initialize project structure and packages (dispatcher, sender, infra).
