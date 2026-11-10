---
name: code-review
description: Review code changes in Amethyst for bugs, architectural violations, data integrity risks, security issues, performance problems, and missing tests. Use after implementing features, fixing bugs, or modifying existing code.
---

# Code Review

## Goal

Perform an independent, critical review of code changes.

Identify actual problems and meaningful risks.

Do not approve code merely because it compiles or appears reasonable.

## 1. Understand the Changes

Before reviewing:

- Inspect the complete diff.
- Identify all modified and newly created files.
- Understand the purpose of the changes.
- Read the relevant implementation plan or bug report.
- Inspect surrounding code where necessary.
- Review related tests.

Do not review isolated snippets without understanding their context.

Do not modify code during the review unless explicitly requested.

## 2. Check Functional Correctness

Look for:

- Incorrect business logic.
- Missing edge cases.
- Incorrect assumptions.
- Invalid state transitions.
- Unexpected behavior.
- Incorrect error handling.
- Inconsistent frontend/backend behavior.
- Incorrect serialization or deserialization.
- Potential regressions.

Verify that the implementation satisfies the actual requirements.

## 3. Check Architectural Compliance

Review against:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `AGENTS.md`
- Relevant `.cursor/rules/`

Pay particular attention to:

- Business logic incorrectly placed in React.
- Tauri commands containing substantial business logic.
- Core depending on Tauri or frontend-specific code.
- Unnecessary coupling between modules.
- Duplicate implementations.
- Unnecessary abstractions.
- Premature implementation of future roadmap features.

Identify architectural changes that were introduced without justification or approval.

## 4. Check Data Integrity

This is a critical review area.

Look for:

- Unsafe file writes.
- Partial overwrites.
- Unhandled concurrent modifications.
- Silent deletion.
- Loss of unknown frontmatter properties.
- Destructive document normalization.
- Unsafe filesystem paths.
- Incorrect recovery behavior.
- Git synchronization data loss.
- Database inconsistencies.

Verify compliance with `04-data-integrity.mdc`.

Any credible risk of silent user-data loss must be reported as a critical finding.

## 5. Check Obsidian Compatibility

For changes involving Vault content, review:

- Markdown preservation.
- Wikilinks and aliases.
- Embeds.
- YAML frontmatter.
- Unknown Properties.
- Tags.
- Callouts.
- Attachments.
- Existing folder structure.

Verify compliance with `05-obsidian-compatibility.mdc`.

Look for unintended modifications to content the application does not understand.

## 6. Check Security

Look for:

- Unsafe path handling.
- Path traversal.
- Unnecessary filesystem permissions.
- Exposed credentials or tokens.
- Sensitive information in logs.
- Unnecessary Tauri capabilities.
- Unsafe deserialization.
- Untrusted input handling.
- Insecure plugin-related assumptions.

Do not recommend weakening security controls for convenience.

## 7. Check Performance

Look for meaningful performance issues:

- Unnecessary cloning of large data structures.
- Repeated expensive computations.
- Blocking operations on asynchronous runtimes.
- Excessive database queries.
- Unnecessary React re-renders.
- Inefficient handling of large Vaults.
- Unnecessary full re-indexing.
- Memory growth or resource leaks.

Distinguish real issues from speculative micro-optimizations.

## 8. Check Error Handling

Verify that:

- Errors are propagated correctly.
- Failed operations are not silently ignored.
- Error messages are useful.
- Resources are cleaned up appropriately.
- Partial failures do not leave inconsistent state.
- The application remains usable after recoverable failures.

Pay special attention to filesystem and synchronization operations.

## 9. Check Tests

Review whether tests:

- Cover the intended behavior.
- Cover important edge cases.
- Verify failure paths.
- Protect against regressions.
- Use isolated test data.
- Avoid testing only implementation details.

Identify important missing tests.

Do not treat a passing test suite as proof that every behavior is correct.

## 10. Run Verification

When practical, run relevant:

- Rust tests.
- Frontend tests.
- Type checks.
- Formatting checks.
- Clippy.
- Build checks.

Do not claim that checks passed unless they were executed.

If a check cannot be run, report that limitation.

## 11. Findings Format

Report findings in descending order of severity.

Use these severity levels:

- **Critical** — data loss, security compromise, application corruption or similarly severe issues.
- **High** — significant functional bugs, serious regressions or architectural violations.
- **Medium** — meaningful correctness, reliability or maintainability problems.
- **Low** — minor issues with limited impact.

For every finding include:

- Severity.
- File and relevant location.
- Description of the problem.
- Why it matters.
- A concrete recommended fix.

Report only actionable findings.

Do not invent issues or inflate severity.

If no issues are found, state that explicitly and mention any limitations of the review.

## 12. Final Rule

Review changes as if they were written by someone else.

Be skeptical, evidence-based and precise.

The goal is to identify problems before they reach the user, not to praise the implementation.