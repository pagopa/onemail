# om-common

Shared types and utilities for OneMail services.

## Usage

Import what you need from the package:

```typescript
import type { EmailStatusHistoryItem } from 'om-common/types';
```

## Adding om-common to a new sub-project

1. Add the dependency in `package.json`

```json
"dependencies": {
  "om-common": "workspace:*"
}
```

2. Add a project reference in `tsconfig.build.json`

```json
{
  "references": [{ "path": "../om-common/tsconfig.build.json" }]
}
```

3. Use `tsc --build` in the build script, to ensures om-common is compiled before the consuming package during build.

```json
"scripts": {
  "build": "tsc --build <tsconfig-file>"
}
```

4. Use the `local` condition when running locally with `tsx`. This allows `tsx` to resolve `om-common` imports directly from source, without requiring a prior build.

```json
"scripts": {
  "dev": "tsx watch -C local src/app.ts"
}
```

## Adding a new module to om-common

For each new folder added under `src/` (e.g. `src/constants/`), add the corresponding entry in the `exports` field of `om-common/package.json`:

```json
"exports": {
  "./constants": {
    "local": "./src/constants/index.ts",
    "types": "./dist/constants/index.d.ts",
    "default": "./dist/constants/index.js"
  }
}
```

- `local`: used by `tsx -C local` in local development — points directly to the TypeScript source
- `types`: used by TypeScript for type checking — points to the compiled `.d.ts`
- `default`: used at runtime — points to the compiled `.js`
