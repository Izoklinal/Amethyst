---
name: implement-feature
description: Implement an approved feature or implementation plan in Amethyst. Use when writing new functionality, modifying existing behavior, or carrying out an approved multi-step development task.
---

# Implement Feature

## Goal

Implement the requested functionality according to the approved plan, existing architecture and project rules.

Prioritize correctness, maintainability, performance and data integrity.

## 1. Verify the Implementation Plan

Before modifying code:

- Read the approved implementation plan.
- Review relevant project documentation.
- Inspect the current state of affected files.
- Verify that the plan still matches the actual codebase.
- Identify any changes that have occurred since planning.

Do not blindly follow an outdated plan.

If implementation reveals a significant architectural problem or an incorrect assumption, stop and explain it before proceeding.

## 2. Respect Project Architecture

Follow:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `AGENTS.md`
- Relevant `.cursor/rules/`

Maintain the established dependency direction:

React → Tauri API → Rust Core.

Keep business logic in Rust Core.

Keep Tauri commands thin.

Keep React focused on presentation and interaction.

Do not introduce unnecessary dependencies between modules.

Do not move existing responsibilities between layers without justification.

## 3. Implement Incrementally

Divide the implementation into small, logically complete steps.

For each step:

1. Make a focused change.
2. Inspect the result.
3. Run relevant checks or tests.
4. Fix issues before continuing.

Avoid modifying many unrelated files at once.

Do not rewrite working code unnecessarily.

Do not combine unrelated refactoring with feature implementation.

Prefer extending existing abstractions over introducing competing implementations.

## 4. Maintain Code Quality

Follow the project's Rust and React development rules.

### Rust

- Use idiomatic Rust.
- Prefer explicit types and error handling.
- Avoid unnecessary cloning.
- Avoid `unwrap()` and `expect()` in application paths.
- Keep Core independent of Tauri.
- Use asynchronous execution appropriately.

### React and TypeScript

- Use strongly typed interfaces.
- Keep components focused.
- Avoid duplicating backend business logic.
- Keep backend communication centralized.
- Manage state deliberately.
- Avoid unnecessary global state and abstractions.

## 5. Protect User Data

For any operation involving Vault content or user files:

- Follow `04-data-integrity.mdc`.
- Preserve unknown and unsupported content.
- Account for external modifications.
- Use safe file operations.
- Handle partial failures.
- Preserve recoverability.
- Never silently overwrite or delete user data.

Do not test destructive operations against a real user Vault.

## 6. Preserve Obsidian Compatibility

Follow `05-obsidian-compatibility.mdc`.

Do not introduce changes that unnecessarily alter:

- Markdown formatting.
- Wikilinks.
- Frontmatter.
- Properties.
- Tags.
- Callouts.
- Embeds.
- Attachments.
- Existing Vault structure.

Preserve unsupported syntax.

## 7. Testing During Implementation

Add or update tests as functionality is implemented.

Do not postpone all testing until the end.

Test:

- Expected behavior.
- Important edge cases.
- Error handling.
- Relevant regressions.
- Data integrity where applicable.

Use the appropriate testing level:

- Rust unit tests.
- Rust integration tests.
- React component tests.
- Tauri integration tests.
- End-to-end tests.

## 8. Dependencies

Do not add dependencies without a clear reason.

Before adding one:

- Check existing project dependencies.
- Evaluate whether existing functionality is sufficient.
- Consider maintenance, security and performance.
- Explain significant new dependencies.

Do not upgrade unrelated dependencies as part of an ordinary feature implementation.

## 9. Scope Control

Implement only what the approved plan requires.

Do not:

- Add unrelated features.
- Implement future roadmap functionality prematurely.
- Perform broad refactoring without approval.
- Change established architecture silently.
- Introduce speculative abstractions.

If additional work becomes necessary, explain why and update the plan.

## 10. Completion Verification

Before reporting completion:

- Run relevant tests.
- Run Rust formatting checks where applicable.
- Run Clippy where applicable.
- Run frontend type checking and linting where configured.
- Build affected application targets when practical.
- Inspect the final changes for accidental modifications.

Do not claim that a check passed unless it was actually executed successfully.

If a check cannot be performed, explicitly state why.

## 11. Final Report

Summarize:

### Implemented
What functionality was added or changed.

### Files Changed
Which files were created or modified.

### Tests
Which tests and checks were executed and their results.

### Remaining Issues
Known limitations, unresolved problems or follow-up work.

### Documentation
Mention any documentation or architectural decisions that need updating.

Do not report unfinished functionality as complete.

## 12. Final Rule

Implement deliberately, not aggressively.

A smaller, verified implementation is preferable to a large, partially working change.

The approved plan defines the scope. The project architecture defines the boundaries. Data integrity defines the safety requirements.