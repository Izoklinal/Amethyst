# Amethyst — Development Roadmap

## 1. Purpose

This document defines the planned development stages of Amethyst, from the initial technical foundation to a mature knowledge management application.

The roadmap establishes priorities, development order, and expected outcomes.

The roadmap is intentionally flexible. Features may be reprioritized as development progresses, but changes to the MVP scope should be deliberate.

**Core principle:** Build a reliable and useful application first. Expand its capabilities only after the foundation is stable.

---

# Phase 0 — Foundation

**Goal:** Establish the technical foundation and development environment.

### Project infrastructure
- [ ] Initialize the project structure.
- [ ] Configure Rust, Tauri 2 and React.
- [ ] Configure TypeScript and frontend tooling.
- [ ] Establish development and production build workflows.
- [ ] Configure Git repository and branching conventions.
- [ ] Set up formatting, linting and static analysis.
- [ ] Configure Rust Analyzer and essential development tools.
- [ ] Prepare Cursor Rules, Skills and development workflows.

### Application foundation
- [ ] Establish communication between React and Rust through Tauri.
- [ ] Define core application architecture and module boundaries.
- [ ] Implement application startup and lifecycle management.
- [ ] Establish error handling and logging.
- [ ] Implement basic settings infrastructure.
- [ ] Establish automated testing infrastructure.

### Initial UI
- [ ] Create the main application window.
- [ ] Implement the initial Workspace layout.
- [ ] Establish the visual design system.
- [ ] Implement basic navigation.
- [ ] Add light and dark themes.

**Completion criteria:**

The application launches successfully on Windows and Linux, the frontend communicates with the Rust core, and the project has a working development and testing environment.

---

# Phase 1 — MVP

**Goal:** Deliver a usable desktop application capable of replacing the basic everyday note-taking workflow in Obsidian.

Supported platforms:
- Windows
- Linux

Android is explicitly outside the MVP scope.

## 1. Vault Management

- [ ] Open existing Obsidian Vaults.
- [ ] Create a new Vault.
- [ ] Switch between Vaults.
- [ ] Preserve the original folder and file structure.
- [ ] Work directly with original user files.
- [ ] Detect external filesystem changes.
- [ ] Handle simultaneous access from Amethyst and external editors.

## 2. File Explorer

- [ ] Display the Vault folder structure.
- [ ] Navigate between folders.
- [ ] Create, rename and delete files and folders.
- [ ] Move files and folders.
- [ ] Support drag-and-drop operations where appropriate.
- [ ] Display common file types and attachments.

## 3. Markdown Editor

- [ ] Implement Obsidian-style Live Preview.
- [ ] Implement Reading Mode.
- [ ] Edit and save original Markdown files.
- [ ] Support headings, lists, quotes and formatting.
- [ ] Support internal links and embeds.
- [ ] Support callouts.
- [ ] Support Markdown checkboxes.
- [ ] Implement automatic saving.
- [ ] Provide access to raw Markdown editing when necessary.

The editor must preserve the original Markdown structure and avoid unnecessary formatting changes.

## 4. Links and Navigation

- [ ] Support `[[wikilinks]]`.
- [ ] Support links to headings and blocks where applicable.
- [ ] Resolve links between notes.
- [ ] Display backlinks.
- [ ] Navigate between linked notes.
- [ ] Handle unresolved links.

## 5. Properties

- [ ] Read and edit YAML frontmatter.
- [ ] Support text, number, boolean, date, list and tags.
- [ ] Implement appropriate visual editors.
- [ ] Support geographic coordinates and a visual coordinate editor.
- [ ] Preserve unknown and non-standard properties.
- [ ] Maintain compatibility with Obsidian conventions.

The internal representation should support future extensions without requiring a redesign of the storage layer.

## 6. Search

- [ ] Search by note title and filename.
- [ ] Implement full-text search.
- [ ] Search by tags.
- [ ] Search and filter by Properties.
- [ ] Provide fast navigation to search results.
- [ ] Maintain an incremental search index.

Complex query languages and advanced logical operators are outside the MVP scope.

## 7. Workspace

- [ ] Implement tabbed navigation.
- [ ] Support multiple open notes.
- [ ] Provide basic editor organization.
- [ ] Show and hide side panels.
- [ ] Allow resizing of primary panels.
- [ ] Restore the previous Workspace state.
- [ ] Support basic keyboard navigation.

Advanced workspace layouts, arbitrary panel positioning and multiple saved layouts are postponed.

## 8. Attachments

- [ ] Support images.
- [ ] Support PDF files.
- [ ] Support audio and video files.
- [ ] Preview supported attachment types.
- [ ] Insert attachments into notes.
- [ ] Configure the attachment folder.
- [ ] Support drag-and-drop attachment insertion.

Original attachment files must remain accessible outside Amethyst.

## 9. Daily Notes

- [ ] Create Daily Notes.
- [ ] Navigate to a note by date.
- [ ] Configure the Daily Notes folder.
- [ ] Configure filename date formats.
- [ ] Avoid creating duplicate notes for the same date.

A full Calendar interface is postponed.

## 10. Templates

- [ ] Configure the Templates folder.
- [ ] Create and manage templates.
- [ ] Insert templates into notes.
- [ ] Support basic Obsidian-compatible template syntax.
- [ ] Support date and time variables.

Conditional logic and scripting are postponed.

## 11. Git Sync

Git synchronization is a built-in application subsystem, not a third-party plugin.

- [ ] Connect an existing Git repository.
- [ ] Configure remote repository and branch.
- [ ] Configure commit author name and email.
- [ ] Support SSH keys and token-based authentication.
- [ ] Implement manual synchronization.
- [ ] Pull remote changes.
- [ ] Push local changes.
- [ ] Display synchronization status.
- [ ] Preserve local changes while offline.
- [ ] Detect synchronization conflicts.
- [ ] Preserve conflicting versions.
- [ ] Notify the user about unresolved conflicts.
- [ ] Provide a basic conflict resolution interface.
- [ ] Prevent recursive synchronization of conflict copies.
- [ ] Protect credentials using secure storage.

Automatic synchronization schedules and advanced merge tools are postponed.

## 12. Settings and Customization

- [ ] Implement a dedicated settings window.
- [ ] Configure editor behavior and appearance.
- [ ] Configure attachment and file handling.
- [ ] Configure Daily Notes.
- [ ] Configure Templates.
- [ ] Configure Git Sync.
- [ ] Configure keyboard shortcuts.
- [ ] Support light and dark themes.
- [ ] Persist application settings separately from Vault content.

## 13. Data Safety

Data integrity is a mandatory MVP requirement.

- [ ] Implement safe file-writing operations.
- [ ] Protect against incomplete writes.
- [ ] Handle unexpected application termination.
- [ ] Detect external modifications before overwriting files.
- [ ] Warn about potentially destructive operations.
- [ ] Implement a local recoverable version history.
- [ ] Ensure Git conflicts never silently discard data.
- [ ] Test recovery and data integrity scenarios.

## 14. Testing and Compatibility

- [ ] Rust unit tests.
- [ ] Rust integration tests.
- [ ] Frontend tests.
- [ ] End-to-end application tests.
- [ ] Obsidian Markdown compatibility tests.
- [ ] YAML frontmatter compatibility tests.
- [ ] External filesystem modification tests.
- [ ] Git synchronization and conflict tests.
- [ ] Data recovery tests.
- [ ] Windows and Linux testing.

### MVP Completion Criteria

The MVP is considered complete when:

1. A user can open an existing Obsidian Vault without migration.
2. Notes can be created, viewed and edited reliably.
3. Core Markdown and Obsidian-compatible features work correctly.
4. Properties can be edited visually without losing unsupported data.
5. Search, navigation, Daily Notes and Templates are functional.
6. Git Sync works reliably, including conflict handling.
7. The application protects user data against common failure scenarios.
8. The application is usable on Windows and Linux.
9. Compatibility tests confirm that edited Vaults remain usable in Obsidian.

---

# Phase 2 — Core Experience Expansion

**Goal:** Bring the main Obsidian experience into Amethyst and improve Workspace flexibility.

### Graph
- [ ] Global Graph.
- [ ] Local Graph.
- [ ] Graph filters.
- [ ] Customizable nodes and edges.
- [ ] Navigation through graph relationships.

### Canvas
- [ ] Open and edit `.canvas` files.
- [ ] Text cards.
- [ ] Note and file cards.
- [ ] External links.
- [ ] Connections between cards.
- [ ] Groups.
- [ ] Free positioning and resizing.
- [ ] Zoom and navigation.
- [ ] Preserve original Obsidian Canvas format.

### Calendar
- [ ] Monthly and weekly views.
- [ ] Daily Notes integration.
- [ ] Date navigation.
- [ ] Display relevant dates and events.
- [ ] Future support for tasks and date-based Properties.

### Workspace Expansion
- [ ] Multiple editor groups.
- [ ] Split views.
- [ ] Drag-and-drop tabs.
- [ ] Move and resize panels.
- [ ] Multiple saved Workspace layouts.
- [ ] Improved session restoration.
- [ ] More extensive keyboard customization.

### Templates Expansion
- [ ] Conditional templates.
- [ ] Weekday and date-based conditions.
- [ ] More advanced variable processing.
- [ ] Additional automation capabilities.

### Search Expansion
- [ ] Advanced filters.
- [ ] AND, OR and NOT operators.
- [ ] Regular expressions.
- [ ] Search by note relationships.

---

# Phase 3 — Advanced Knowledge Management

**Goal:** Transform Amethyst from a note-taking application into a more powerful knowledge management environment.

### Bases
- [ ] Create and manage Bases.
- [ ] Read Properties as structured data.
- [ ] Table views.
- [ ] Card views.
- [ ] Kanban views.
- [ ] Filtering.
- [ ] Sorting.
- [ ] Grouping.
- [ ] Edit Properties directly from Bases.
- [ ] Preserve compatibility with Obsidian Bases.

### Analytics
- [ ] Analyze structured note data.
- [ ] Generate charts and visualizations.
- [ ] Calculate aggregates.
- [ ] Support calculated values.
- [ ] Create time-series visualizations.
- [ ] Build customizable dashboards.
- [ ] Allow multiple data sources within a Vault.

Analytics must remain a derived view of user data. Markdown and original Vault files remain the source of truth.

### Advanced Properties
- [ ] Additional built-in property types.
- [ ] Improved geographic data support.
- [ ] Custom property types.
- [ ] Extensible property editors.
- [ ] Improved handling of structured data.

---

# Phase 4 — Extensibility and Ecosystem

**Goal:** Establish an extensible platform and enable third-party development.

### Plugin System
- [ ] Define a public plugin API.
- [ ] Support JavaScript/TypeScript plugins.
- [ ] Plugin lifecycle management.
- [ ] Plugin commands.
- [ ] Custom Workspace panels.
- [ ] Custom Property editors.
- [ ] Access to selected application capabilities.
- [ ] Permission management.
- [ ] API versioning.
- [ ] Plugin isolation and security model.

### Plugin Ecosystem
- [ ] Plugin installation.
- [ ] Plugin updates.
- [ ] Plugin removal.
- [ ] Plugin discovery.
- [ ] Plugin documentation.
- [ ] Public contribution guidelines.

Core application functionality must never depend on third-party plugins.

---

# Phase 5 — Mobile and Long-term Expansion

**Goal:** Extend Amethyst beyond desktop environments.

### Android Companion Application

Android is a long-term objective and is not part of the MVP.

Planned capabilities:

- [ ] Open and access existing Vaults.
- [ ] Create and edit notes.
- [ ] Quick note capture.
- [ ] Daily Notes.
- [ ] Basic task creation and editing.
- [ ] Search.
- [ ] View attachments.
- [ ] Git synchronization.
- [ ] Mobile-specific interface and navigation.

The mobile application should reuse shared Rust business logic wherever practical while providing a dedicated mobile experience.

### Future Possibilities

Potential directions for further exploration:

- More advanced task management.
- Calendar and task integration.
- Advanced template scripting.
- Additional visualization tools.
- Further Workspace customization.
- Additional platform support.
- Open-source ecosystem development.

These possibilities are not commitments or requirements for earlier phases.

---

# Development Principles

The following principles apply throughout all development phases:

1. **Data safety first.** User data must never be silently lost or corrupted.
2. **Performance first.** Avoid unnecessary work, expensive operations and excessive resource consumption.
3. **Local-first.** Core functionality must remain available without a cloud dependency.
4. **Compatibility.** Preserve interoperability with existing Obsidian Vaults.
5. **Modularity.** Maintain clear boundaries between application subsystems.
6. **Testability.** Critical functionality must have appropriate automated tests.
7. **Incremental development.** Build and validate functionality in manageable steps.
8. **Avoid premature complexity.** Do not implement distant future features before their foundations are needed.
9. **User control.** Users retain ownership and control of their data.
10. **Architecture consistency.** Significant changes must be evaluated against PRODUCT.md, ARCHITECTURE.md and DECISIONS.md.

---

# Roadmap Maintenance

This roadmap is a living document.

- Completed tasks should be marked accordingly.
- Priorities may change based on development findings.
- New requirements should be evaluated before being added.
- Significant architectural changes should be recorded in DECISIONS.md.
- Changes to product scope should be reflected in PRODUCT.md.
- Implementation details should be documented separately from this roadmap.

The roadmap describes the intended direction of Amethyst, not a rigid release schedule.