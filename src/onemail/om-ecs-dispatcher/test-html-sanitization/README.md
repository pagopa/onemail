HTML Sanitization Check (local)

1. Put one or more HTML files into the folder `input/` (any file name, with `.txt` extension)

2. Run the check script from the repository root:
    ```bash
      pnpm exec tsx -C local src/onemail/om-ecs-dispatcher/test-html-sanitization/testSanitizeHtml.ts
    ```
   The script processes every `.txt` file found in `input/`.

3. Read the result for each file:
  - `[<file>] HTML check passed: not sanitized` means no meaningful sanitization changes were detected.
  - `[<file>] HTML check failed: sanitized` means meaningful changes were detected.

4. If a file's check fails, compare the generated files in its dedicated subfolder:
  - `outputs/<file>/original.html`
  - `outputs/<file>/sanitized.html`

5. Show a unified diff:
    ```bash
      diff -u src/onemail/om-ecs-dispatcher/test-html-sanitization/outputs/<file>/original.html src/onemail/om-ecs-dispatcher/test-html-sanitization/outputs/<file>/sanitized.html
    ```
