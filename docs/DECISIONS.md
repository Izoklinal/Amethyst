# Amethyst — Architecture Decision Records

This document contains important architectural and technical decisions made during the development of Amethyst.

Its purpose is to preserve the reasoning behind significant decisions and prevent future changes from contradicting established architectural principles without explicit consideration.

Only decisions with meaningful long-term architectural impact should be recorded here.

---

## ADR-001: Rust as the Core Language

**Status:** Accepted

**Decision:**

Rust is the primary language for Amethyst's application core and business logic.

**Rationale:**

- Performance and resource efficiency.
- Memory safety.
- Strong type system.
- Suitable for filesystem and data processing operations.
- Cross-platform support.

Business logic should remain independent of Tauri wherever practical.

---

## ADR-002: React as the Frontend Framework

**Status:** Accepted

**Decision:**

React is selected as the frontend framework.

**Rationale:**

- Mature ecosystem.
- Extensive library availability.
- Suitable for complex and dynamic interfaces.
- Integration with Tauri.
- Familiarity with the development ecosystem.

Specific frontend libraries and supporting technologies will be selected separately.

---

## ADR-003: Tauri 2 as the Application Framework

**Status:** Accepted

**Decision:**

Tauri 2 is selected as the application framework connecting the Rust core with the frontend and providing platform integration.

**Rationale:**

- Native application integration.
- Rust backend.
- Cross-platform support.
- Separation between business logic and presentation.

Tauri commands should remain thin and delegate business operations to the Rust core.

---

## ADR-004: Obsidian Vault as the Source of Truth

**Status:** Accepted

**Decision:**

Existing Obsidian Vault files remain the authoritative source of user content.

Amethyst must work directly with original files without requiring migration to a proprietary storage format.

**Rationale:**

- Compatibility with Obsidian.
- User ownership of data.
- Interoperability with external Markdown editors.
- Reduced vendor lock-in.
- Data accessibility without Amethyst.

Internal databases may store indexes, caches and derived information, but must not replace original files as the source of truth.

---

## ADR-005: Local-first Architecture

**Status:** Accepted

**Decision:**

Amethyst follows a local-first architecture.

User data must remain available locally without requiring a proprietary cloud service.

**Rationale:**

- User control over data.
- Offline functionality.
- Reduced external dependencies.
- Compatibility with user-managed synchronization.

---

## ADR-006: Git Sync as a Built-in Subsystem

**Status:** Accepted

**Decision:**

Git synchronization is a native Amethyst feature and must not require a third-party plugin.

The synchronization system should work with user-configured Git repositories and must not depend on a specific hosting provider.

**Rationale:**

- User control over repositories.
- No mandatory dependence on GitHub or GitLab.
- Synchronization between multiple devices.
- Offline-first workflow.
- Integrated user experience.

Conflict resolution must preserve conflicting versions and avoid silent data loss.

---

## ADR-007: Desktop-first Product Strategy

**Status:** Accepted

**Decision:**

Desktop is the primary Amethyst platform.

Android is a companion application focused on quick note creation, editing, Daily Notes and access to existing information.

**Rationale:**

- The primary use case involves a comprehensive knowledge management workspace.
- Advanced workspace management is better suited to desktop environments.
- Mobile usage should prioritize convenience and quick interactions.
- Shared core functionality should be reused wherever practical.

---

## ADR-008: Modular Rust Core

**Status:** Accepted

**Decision:**

The Rust core should follow a modular architecture with clearly defined responsibilities and interfaces.

**Rationale:**

- Maintainability.
- Separation of concerns.
- Independent testing.
- Reduced coupling.
- Easier future extension.

Modules should be introduced when needed rather than created prematurely.

---

## ADR-009: Workspace as an Extensible System

**Status:** Accepted

**Decision:**

The application interface should use a flexible Workspace model inspired by Visual Studio Code.

Built-in tools should be represented as independent workspace components.

**Rationale:**

- Flexible user workflows.
- Customizable layouts.
- Multiple simultaneous tools.
- Future plugin integration.
- Consistent interface organization.

---

## Future Decisions

Additional decisions should be recorded here when they have meaningful long-term architectural consequences.

Each decision should include:

- Unique identifier.
- Title.
- Status.
- Decision.
- Rationale.
- Consequences where relevant.

Do not record temporary implementation details or minor technical choices unless they significantly affect the architecture.