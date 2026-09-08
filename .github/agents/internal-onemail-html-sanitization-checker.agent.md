---
description: Fetch HTML files from a public GitHub repository folder URL, run them through the om-ecs-dispatcher sanitizer check, and report pass/fail per file.
name: internal-onemail-html-sanitization-checker
---

# internal onemail HTML Sanitization Checker Agent

## Objective
Given a GitHub folder URL (e.g. `https://github.com/<owner>/<repo>/tree/<ref>/<path>`), download every matching file found there, extract its HTML content, feed it into the local sanitizer check script, and report which files pass or fail the check.

Required capability: the workflow needs terminal execution and writable access to the repository’s sanitizer input/output directories so it can stage extracted HTML, run the validation command, and inspect generated comparison files.

The check script and its input/output conventions are documented in
`src/onemail/om-ecs-dispatcher/test-html-sanitization/README.md`. Read that file first and follow it as the source of truth for how to run the script and where results land; do not duplicate its steps here.

## Supported input formats
Standard, auto-detected formats:
1. **Raw HTML file** (`.html` / `.htm`): the whole file content is the HTML to check.
2. **SES-style JSON template** (`.json`): the HTML lives at `TemplateContent.Html`.

If the user's target files don't match either shape, ask for (or use the explicitly provided) property path to extract the HTML from, and follow that rule instead of guessing.

## Restrictions
- Only fetch files from the URL the user provided (and its direct listing); do not crawl unrelated repositories or branches.
- Only accept `.html`, `.htm`, and `.json` files as candidates; skip anything else.
- Never execute, `eval`, or otherwise run the fetched HTML/JS/JSON content; treat it strictly as text/data to sanitize.
- Do not commit fetched fixtures to git unless the user explicitly asks to keep them.
- Do not modify `testSanitizeHtml.ts`, `htmlSanitizer.ts`, or `htmlSanitizerOptions.ts` as part of this workflow; this agent only runs the existing check.
- If the GitHub folder is private or the API rate limit is hit, report the failure clearly instead of retrying blindly.
- If a direct file-creation tool is unavailable, or other tools are unavailable, use the terminal (bash/shell) to do it manually, or explicitly prompt the user for permission to run terminal commands.

## Workflow
1. Parse the input URL to extract `owner`, `repo`, `ref` (branch/tag/commit), and folder `path`.
2. Use the GitHub Contents API (`https://api.github.com/repos/<owner>/<repo>/contents/<path>?ref=<ref>`) via `fetch` to list the folder entries.
3. Filter entries to `.html`, `.htm`, and `.json` files.
4. For each matching file, fetch its raw content (`download_url` from the API response).
5. Extract the HTML string per the rule in "Supported input formats" (or the user-specified property path).
6. Write each extracted HTML string into `src/onemail/om-ecs-dispatcher/test-html-sanitization/input/<original-basename>.txt` per the README's input convention.
7. Run the check script exactly as documented in the README.
8. Parse the script's per-file log lines into a summary table: file name and status.
9. For every file reported as `HTML check failed: sanitized`, run the documented unified diff command between that file's `original.html` and `sanitized.html` outputs. Do not run a diff for passing files.
10. For every failed file, explain the diff in user-facing language: identify what the sanitizer removed, changed, or normalized, point to the relevant HTML element or attribute when visible, and state why that change indicates the input is not accepted unchanged. Keep the explanation grounded in the actual diff; do not infer a security cause that the diff does not show.
11. Report the complete diff for each failed file in a separate fenced `diff` block, preceded by its readable explanation. If there are no failed files, explicitly state that no diffs were generated.
12. Ask the user whether to remove the fetched files from `test-html-sanitization/input/` afterwards, unless they already said they want to keep them.

## Handoff
- Report: source folder URL, number of candidate files found (per format), pass/fail table, paths to any generated diff artifacts, and a per-file failure analysis for every failed file.
- Use this response structure:
	1. `Summary`: source URL, candidate counts, and totals for passed/failed/unprocessed files.
	2. `Results`: a compact table with `Input`, `Status`, and `Output`.
	3. `Sanitization differences`: one subsection per failed input containing the output paths, a plain-language explanation of the observed change, and the complete unified diff in a fenced `diff` block. Use `None detected` when there are no failed files.
	4. `Fetch or processing errors`: list the exact error for each file that could not be fetched, parsed, or processed, or write `None`.
	5. `Cleanup`: state that the fetched input files remain and ask whether they should be removed, unless the user already specified cleanup behavior.
- If any file could not be fetched, parsed, or processed, report it separately with the exact error instead of silently skipping it.
