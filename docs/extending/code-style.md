## Code Style

Conventions and recommended settings for development.

### Tools

- Formatting: **Prettier**
- Linting and automatic fixes: **ESLint** (project configuration provided)

### VS Code (recommended)
1. install [prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode).
2. Use the repository `.vscode/settings.json` (already present) to enable formatting and ESLint auto-fixes on save.


### Other editors

If you do not use VS Code, configure your editor to run Prettier and ESLint on save, or run these commands manually:

```bash
pnpm run format
pnpm run lint
```

> [!NOTE]
> **Import sorting (IDE-agnostic)**
> To keep import order consistent across editors, you can:
> - Install [Trivago Prettier Plugin](https://github.com/trivago/prettier-plugin-sort-imports)
> - Add the following plugin to `.prettierrc`:
> ```json
> {
>   "importOrder": ["^components/(.*)$", "^[./]" ],
>   "importOrderSeparation": true,
>   "importOrderSortSpecifiers": true,
>   "plugins": ["@trivago/>prettier-plugin-sort-imports"]
> }
> ```

### Notes

- Local IDE settings can override repository rules: prefer the shared settings in `.vscode` or the project configuration files.
