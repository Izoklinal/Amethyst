---
name: feature-planning
description: Analyze and plan new features or significant changes in Amethyst before implementation. Use when introducing functionality, changing existing behavior, modifying architecture, or planning multi-file tasks.
---

# Feature Planning

## Goal

Produce a clear, technically grounded implementation plan before modifying the codebase.

Do not start implementation during this workflow.

## 1. Understand the Request

- Identify the actual problem or user need.
- Determine the expected behavior.
- Identify explicit requirements and constraints.
- Identify ambiguous or missing requirements.
- Do not invent product requirements.

If a critical ambiguity prevents a reliable plan, ask the user a focused clarification question.

Do not ask questions whose answers can reasonably be derived from existing project documentation or code.

## 2. Inspect Project Documentation

Read the relevant documentation before proposing a solution.

Primary sources:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `AGENTS.md`
- Relevant `.cursor/rules/`

Determine:

- Whether the feature belongs to the current development phase.
- Whether it is included in the MVP.
- Which existing architectural decisions apply.
- Whether the request conflicts with established requirements.

Do not silently expand the MVP scope.

## 3. Inspect Existing Code

Before proposing implementation:

- Inspect the current project structure.
- Find relevant modules and components.
- Understand existing patterns and conventions.
- Identify existing implementations that can be reused.
- Check relevant dependencies and interfaces.
- Inspect related tests.

Do not assume that a module or functionality does not exist merely because it was not immediately visible.

Do not propose creating duplicate abstractions or services.

## 4. Analyze Architectural Impact

Determine which application layers are affected.

Consider:

- Rust Core.
- Tauri integration.
- React frontend.
- Filesystem and Vault operations.
- Local database and indexing.
- Workspace state.
- Git synchronization.
- Cross-platform behavior.

Identify module ownership and dependency direction.

Keep business logic in Rust Core whenever it belongs to the backend domain.

Keep React focused on presentation and interaction.

Do not introduce unnecessary cross-layer dependencies.

## 5. Consider Data Integrity

For any feature involving user data, explicitly analyze:

- Which files or records may change.
- Whether external modifications are possible.
- How existing data is preserved.
- How failures are handled.
- Whether the operation is recoverable.
- Whether unknown Obsidian content remains intact.

Never propose an implementation that silently risks user data.

## 6. Evaluate Alternatives

When multiple reasonable implementations exist:

- Identify the relevant alternatives.
- Compare complexity, maintainability and performance.
- Consider consistency with the existing architecture.
- Consider future extensibility only where it has practical value.

Recommend one approach.

Do not overwhelm the user with unnecessary alternatives.

Do not introduce new dependencies without justification.

## 7. Produce the Implementation Plan

Present a structured plan containing:

### Objective
What will be implemented and why.

### Existing Architecture
Which existing modules, services and components are relevant.

### Proposed Changes
Which files or modules need to be created or modified.

### Implementation Steps
A logical sequence of small, verifiable changes.

### Data Integrity
Potential risks and preservation mechanisms, when applicable.

### Testing
Required unit, integration, frontend or E2E tests.

### Risks
Potential regressions, architectural concerns and unresolved questions.

### Acceptance Criteria
Clear conditions that determine when the feature is complete.

Be specific. Avoid vague steps such as "implement backend" or "update frontend".

## 8. Scope Control

Do not implement unrelated improvements while planning a feature.

Separate:

- Required changes.
- Optional improvements.
- Future enhancements.

Do not implement future roadmap functionality unless explicitly requested.

Prefer the smallest complete solution that satisfies the requirements.

## 9. Approval

After presenting the plan:

- Wait for explicit user approval before implementation.
- Incorporate requested changes.
- Revise the plan when necessary.
- Do not treat silence as approval.

Significant architectural changes must be explicitly discussed with the user.

## 10. Final Rule

A good implementation plan must be based on the actual codebase and project documentation, not assumptions.

If important information is missing, investigate before proposing changes.

The purpose of this Skill is to reduce unnecessary implementation, prevent architectural mistakes and make development predictable.