---
name: add-tests
description: Design and implement tests for Amethyst functionality, bug fixes, and existing code. Use when adding test coverage, improving reliability, or verifying behavior and regression scenarios.
---

# Add Tests

## Goal

Create meaningful tests that verify application behavior, protect against regressions and validate important edge cases.

Tests must verify correctness, not merely increase coverage statistics.

## 1. Understand the Functionality

Before writing tests:

- Read the relevant implementation.
- Understand its intended behavior.
- Inspect existing tests.
- Read relevant project documentation.
- Identify important inputs, outputs and state transitions.
- Identify failure conditions and edge cases.

Do not write tests based solely on function names or assumptions.

If expected behavior is unclear, clarify it before proceeding.

## 2. Identify the Appropriate Testing Level

Choose the simplest testing level that adequately verifies the behavior.

### Rust Unit Tests

Use for:

- Business logic.
- Data transformations.
- Markdown processing.
- Link resolution.
- Properties handling.
- Search logic.
- Validation.
- Error handling.

### Rust Integration Tests

Use for:

- Interactions between Core modules.
- Filesystem operations.
- Vault workflows.
- Database operations.
- Git synchronization behavior.

### React Tests

Use for:

- Component behavior.
- User interactions.
- UI state transitions.
- Forms and validation.
- Keyboard navigation.
- Loading and error states.

### Tauri Integration Tests

Use when verifying communication between the frontend, Tauri and Rust Core.

### End-to-End Tests

Use for complete user workflows where integration between multiple application layers matters.

Do not introduce E2E tests for every small function.

## 3. Define Test Scenarios

For each functionality, consider:

- Normal successful behavior.
- Empty or missing input.
- Invalid input.
- Boundary values.
- Unexpected but valid input.
- Failure conditions.
- Concurrent operations where relevant.
- Recovery behavior where applicable.

Use representative test cases.

Avoid excessive combinations that do not provide meaningful additional coverage.

## 4. Rust Testing Standards

Follow idiomatic Rust testing practices.

- Use `#[test]` for synchronous tests.
- Use appropriate async test support when necessary.
- Prefer clear assertions.
- Use isolated test fixtures.
- Avoid unnecessary mocking.
- Test public behavior rather than private implementation details when practical.

Keep tests deterministic.

Do not introduce arbitrary sleeps to handle asynchronous behavior.

## 5. Filesystem and Vault Testing

Use temporary directories for filesystem tests.

Never modify a real user Vault during testing.

Test:

- Creating files.
- Reading files.
- Updating files.
- Moving and renaming files.
- Deleting and recovering files.
- Nested directories.
- Unicode filenames.
- Missing files.
- Invalid paths.
- Permission errors.
- External modifications.
- Concurrent modifications.
- Interrupted operations.

Verify that failed operations preserve existing data.

## 6. Obsidian Compatibility Testing

Include fixtures representing realistic Obsidian Vault content.

Test:

- Markdown syntax.
- Wikilinks.
- Aliases.
- Heading references.
- Block references.
- Embeds.
- YAML frontmatter.
- Unknown Properties.
- Nested tags.
- Callouts.
- Attachments.
- Daily Notes.
- Templates.

Verify that unrelated content is preserved after modifications.

Do not assume that successful parsing guarantees compatibility.

## 7. Frontend Testing Standards

Test observable behavior.

Verify:

- Correct rendering.
- User interactions.
- Keyboard behavior.
- State changes.
- Loading states.
- Error states.
- Backend communication.
- Workspace interactions.

Prefer accessible queries and realistic user interactions.

Avoid excessive mocking of the component being tested.

Do not make tests depend on fragile DOM implementation details.

## 8. Regression Tests

When adding tests for a bug fix:

1. Identify the original failure.
2. Create a test that reproduces it when practical.
3. Verify that the test detects the problem before the fix when feasible.
4. Verify that the test passes after the fix.
5. Check related behavior for regressions.

A regression test should fail for the specific reason the original bug occurred.

## 9. Test Quality

Every test should have:

- A clear purpose.
- Understandable setup.
- Explicit assertions.
- Isolated state.
- Deterministic behavior.

Avoid:

- Tests without meaningful assertions.
- Duplicated test scenarios.
- Excessive mocking.
- Arbitrary timing assumptions.
- Tests that depend on execution order.
- Tests that access external services unexpectedly.

Keep test fixtures small and understandable.

## 10. Run and Verify

After writing tests:

- Run the newly added tests.
- Run relevant existing tests.
- Run formatting and linting checks where applicable.
- Investigate failures.
- Fix flaky or invalid tests.

Do not weaken assertions merely to make tests pass.

Do not report unexecuted tests as successful.

## 11. Final Report

Summarize:

### Tests Added
What behavior is now covered.

### Test Locations
Which files contain the tests and fixtures.

### Verification
Which commands were executed and their results.

### Remaining Gaps
Important behavior that is still not covered.

## 12. Final Rule

Write tests that give confidence in the actual behavior of Amethyst.

Correctness, data integrity and compatibility matter more than test count or coverage percentage.