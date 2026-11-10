---
name: debug-issue
description: Investigate and fix bugs in Amethyst by identifying root causes, reproducing failures, and verifying targeted fixes. Use when debugging errors, unexpected behavior, crashes, performance problems, or regressions.
---

# Debug Issue

## Goal

Identify the root cause of a problem and implement the smallest reliable fix.

Do not make speculative changes or hide symptoms without understanding the underlying issue.

## 1. Understand the Problem

Determine:

- What exactly is not working.
- What the expected behavior should be.
- What actually happens.
- Whether the issue is reproducible.
- When the problem first appeared.
- Which parts of the application may be involved.

Use the user's description, error messages, logs and available reproduction steps.

If essential information is missing, ask a focused question.

Do not invent reproduction steps or claim to have reproduced an issue when you have not.

## 2. Inspect the Relevant Context

Before modifying code:

- Read relevant project documentation.
- Inspect affected modules and components.
- Review recent changes when available.
- Examine related tests.
- Inspect relevant logs and error messages.
- Check dependencies and interfaces between affected layers.

Consider whether the issue originates in:

- Rust Core.
- Tauri integration.
- React frontend.
- Filesystem operations.
- Local database.
- Workspace state.
- Git synchronization.
- External modifications to the Vault.
- Platform-specific behavior.

Do not assume that the visible location of a bug is its actual source.

## 3. Reproduce and Isolate

When practical:

1. Reproduce the issue.
2. Identify the smallest set of conditions required.
3. Determine whether the problem is deterministic.
4. Isolate the affected functionality.
5. Compare actual behavior with expected behavior.

Use existing tests, logs, debugging tools and minimal test cases.

Do not modify unrelated code while investigating.

If the issue cannot be reproduced, clearly distinguish verified facts from hypotheses.

## 4. Find the Root Cause

Trace the problem through the relevant execution path.

Look for:

- Incorrect assumptions.
- Invalid state transitions.
- Ownership or lifetime mistakes.
- Race conditions.
- Incorrect asynchronous behavior.
- Serialization or deserialization problems.
- Filesystem edge cases.
- Stale frontend state.
- Incorrect IPC contracts.
- Cross-platform differences.
- Missing error handling.
- Performance bottlenecks.

Do not stop at the first suspicious line.

Verify that the identified cause actually explains the observed behavior.

## 5. Explain the Diagnosis

Before making significant changes, summarize:

### Observed Problem
What is happening.

### Root Cause
What is causing it, if established.

### Evidence
Which code paths, logs or tests support the diagnosis.

### Proposed Fix
What should change and why.

### Regression Risks
What existing functionality might be affected.

For a small, clearly isolated bug, proceed directly with a focused fix.

For a significant or architectural change, wait for user approval.

## 6. Implement a Minimal Fix

Prefer the smallest change that correctly addresses the root cause.

- Preserve existing architecture.
- Reuse established patterns.
- Avoid unrelated refactoring.
- Do not introduce unnecessary dependencies.
- Do not suppress errors to make the problem disappear.
- Do not weaken validation or safety checks without justification.

If the actual root cause requires broader changes, explain why.

## 7. Add Regression Tests

When practical, create a test that reproduces the original failure.

Verify that:

- The test fails before the fix, when practical.
- The test passes after the fix.
- Related behavior remains correct.
- Important edge cases are covered.

Do not delete or weaken tests merely to make the suite pass.

## 8. Protect User Data

For bugs involving Vault files, indexing, serialization or Git synchronization:

- Follow `04-data-integrity.mdc`.
- Preserve original data.
- Test using isolated fixtures.
- Account for external changes.
- Verify recovery behavior where applicable.

Never use a real user Vault for destructive debugging experiments.

## 9. Verify the Fix

Run relevant checks:

- Focused regression tests.
- Related unit and integration tests.
- Frontend tests where applicable.
- Formatting and linting.
- Type checking.
- Build checks when practical.

Check for new warnings and unintended changes.

Do not claim success without executing the relevant verification.

If the issue persists, return to investigation rather than stacking speculative fixes.

## 10. Final Report

Summarize:

### Root Cause
What actually caused the issue.

### Fix
What was changed.

### Files Changed
Which files were modified.

### Verification
Which tests and checks were executed.

### Remaining Risks
Anything that remains uncertain or unresolved.

## 11. Final Rule

Debug systematically.

Reproduce, isolate, diagnose, fix and verify.

Never confuse making an error disappear with actually fixing the problem.