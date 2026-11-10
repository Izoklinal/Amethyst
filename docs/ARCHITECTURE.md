# Amethyst — Architecture

## 1. Overview

Amethyst is a cross-platform knowledge management application built around a modular Rust core, a React frontend and Tauri 2 as the application framework.

The architecture is designed around the following principles:

- Separation of business logic and presentation.
- Modular and maintainable application structure.
- Local-first data management.
- Compatibility with existing Obsidian vaults.
- Performance and responsiveness.
- Extensibility.
- Cross-platform support.
- User data safety.

The architecture should support the long-term product vision described in `PRODUCT.md` without introducing unnecessary complexity during initial development.

Not every planned subsystem needs to be implemented immediately. However, architectural decisions should avoid unnecessarily limiting future development.

---

## 2. High-level Architecture

Amethyst consists of three primary layers.

### 2.1. Rust Core

Rust is responsible for the application's primary business logic and data processing.

Responsibilities include:

- Vault and filesystem management.
- Note management.
- Markdown processing.
- Internal links and backlinks.
- Indexing and search.
- Templates.
- Properties processing.
- Bases.
- Analytics.
- Git synchronization.
- Application-level operations.
- Data validation and integrity.

The Rust core should remain independent of Tauri wherever practical.

Business logic must not depend directly on frontend components or Tauri-specific APIs.

This separation should make the core easier to test, maintain and potentially reuse in other application environments.

### 2.2. Frontend

React is the selected frontend framework.

The frontend is responsible for:

- User interface.
- Workspace management.
- Note editor presentation.
- Navigation.
- User interaction.
- Visualizations.
- Graph View.
- Canvas interface.
- Bases and Analytics presentation.
- Application settings.

The frontend should not independently implement business logic that belongs to the Rust core.

### 2.3. Tauri

Tauri 2 acts as the communication and integration layer between Rust and React.

Responsibilities include:

- Exposing Rust functionality to the frontend.
- Handling application lifecycle events.
- Providing platform integration.
- Managing permissions and capabilities.
- Handling native application functionality.

Tauri commands should remain relatively thin.

Business logic should be implemented in dedicated Rust modules rather than directly inside Tauri command handlers.

---

## 3. Rust Core Architecture

### 3.1. Modular Structure

The Rust core should be organized into independent functional modules.

Proposed logical modules:

| Module | Responsibility |
|---|---|
| `vault` | Vault management and filesystem operations |
| `notes` | Note creation, reading and modification |
| `markdown` | Markdown parsing and processing |
| `links` | Internal links and backlinks |
| `properties` | Note properties and data types |
| `indexer` | File indexing and index maintenance |
| `search` | Search functionality |
| `templates` | Template processing and selection |
| `bases` | Database-like views based on notes |
| `analytics` | Statistical analysis and data aggregation |
| `graph` | Graph data preparation |
| `canvas` | Canvas data processing |
| `calendar` | Calendar and Daily Notes logic |
| `sync` | Git synchronization |
| `settings` | Application configuration |

These are logical boundaries rather than a requirement to create every module immediately.

Modules should have clearly defined responsibilities and communicate through explicit interfaces.

Avoid unnecessary coupling, circular dependencies and premature abstractions.

### 3.2. Module Independence

Modules should not access each other's internal implementation directly.

Communication should happen through defined interfaces and data structures.

Core business logic should be testable independently of the frontend and Tauri.

---

## 4. Data Storage

### 4.1. Vault as the Source of Truth

The original Obsidian Vault is the primary source of truth for user content.

Amethyst must work directly with existing vault files.

The application should not require migration to a proprietary storage format.

User content includes:

- Markdown notes.
- YAML frontmatter.
- Canvas files.
- Attachments.
- Other supported Obsidian-compatible files.

Changes made by Amethyst must preserve compatibility with the original file formats.

Users should be able to open the same Vault in Obsidian and Amethyst without mandatory conversion.

### 4.2. Application Data

Application-specific data should be stored separately from the Vault's original content.

A dedicated application configuration directory, potentially `.amethyst`, will contain application settings and preferences.

Examples:

- `settings.json`
- `appearance.json`
- `keybindings.json`
- `plugins.json`
- Other application-specific configuration files.

The exact configuration format and directory structure remain to be determined.

### 4.3. Internal Database

Amethyst may use its own local database for derived and application-specific data.

Potential uses:

- Note indexes.
- Full-text search indexes.
- Link indexes.
- Cached metadata.
- Analytics-related data.
- Other performance-related information.

The internal database must never become the primary source of truth for note contents.

If the database is deleted or corrupted, Amethyst must be able to rebuild derived data from the original Vault.

The specific database technology is TBD.

### 4.4. Data Integrity

The application must avoid silent data loss.

Important requirements:

- Do not overwrite user data without a valid reason.
- Handle filesystem errors explicitly.
- Preserve unknown or unsupported file contents whenever possible.
- Avoid unnecessary modifications to files.
- Make destructive operations explicit.
- Ensure that internal indexes can be reconstructed.

---

## 5. Filesystem Monitoring and Indexing

### 5.1. External Changes

Amethyst must account for changes made outside the application.

Examples:

- Obsidian modifies a note.
- An external Markdown editor modifies a file.
- Git synchronization changes files.
- The user manually modifies the Vault.

### 5.2. Change Detection

Use a combined approach:

1. Filesystem watching for real-time change detection.
2. Periodic verification to detect changes missed by filesystem watchers.
3. Full indexing when a Vault is first opened or when explicitly requested.

Filesystem monitoring must work across supported platforms.

### 5.3. Index Maintenance

Indexes must remain consistent with the actual filesystem.

When files change:

- Update affected note metadata.
- Update link relationships.
- Update search indexes.
- Invalidate relevant cached data.
- Notify dependent application components when necessary.

Avoid rebuilding the entire Vault index after every individual file modification.

### 5.4. External Modification Handling

The application must distinguish between its own file operations and external modifications where practical.

Indexing should account for temporary files, incomplete writes and other filesystem events that do not represent a completed content modification.

---

## 6. Search

The search system should be implemented as part of the Rust core.

Initial functionality:

- Search by note title.
- Full-text search.
- Search by Properties.
- Search by tags.
- Basic combined filters.

Search should remain responsive on large Vaults.

The architecture should allow future extensions, including:

- Complex logical queries.
- AND / OR / NOT operators.
- Regular expressions.
- Search based on note relationships.
- More advanced query expressions.

These advanced capabilities are long-term possibilities and should not complicate the initial implementation.

---

## 7. Markdown and Note Editor

### 7.1. Editor Philosophy

The editor should follow the Obsidian Live Preview approach.

The primary goal is to make writing and reading notes feel natural rather than expose the user to Markdown syntax unnecessarily.

The editor should minimize distractions and avoid forcing users to think about formatting syntax during ordinary writing.

### 7.2. Editor Requirements

- Markdown editing.
- Live Preview.
- Reading mode.
- Internal links.
- Embeds.
- Callouts.
- Formatting.
- Properties and frontmatter integration.
- Autocomplete where appropriate.
- Automatic saving.

The editor must preserve the original Markdown format.

### 7.3. Editor Independence

The editor should be integrated into the Workspace system rather than tightly coupled to a single application window or layout.

The exact editor engine and supporting libraries are TBD.

---

## 8. Workspace System

The Workspace system is one of the central architectural components of Amethyst.

The interface should follow the flexible workspace model of Visual Studio Code.

### 8.1. Workspace Structure

The Workspace system should support:

- Multiple tabs.
- Multiple editor groups.
- Split View.
- Drag and Drop between editor groups.
- Resizable panels.
- Movable sidebars.
- Hidden and visible interface elements.
- Multiple instances of supported tools where appropriate.
- Saved workspace configurations.

### 8.2. Workspace Components

Both built-in tools and future plugins should be able to provide independent workspace components.

Examples:

- Note editor.
- File explorer.
- Search.
- Calendar.
- Graph View.
- Canvas.
- Bases.
- Analytics.
- Future plugin-provided tools.

### 8.3. Workspace Persistence

The application should be able to:

- Save workspace layouts.
- Restore previously saved layouts.
- Restore the previous session.
- Remember open tabs and editor groups.

Workspace configuration must be stored separately from original Vault content.

### 8.4. Extensibility

The Workspace system should be designed to support future third-party components.

However, a full plugin integration system is not required during initial development.

---

## 9. Properties System

### 9.1. Storage Compatibility

Properties should remain compatible with Obsidian YAML frontmatter.

The original Markdown file remains the source of truth.

### 9.2. Data Types

Support standard property types and additional specialized types.

Potential types include:

- Text.
- Number.
- Boolean.
- Date.
- Date and time.
- List.
- Tags.
- Links.
- Coordinates and geographic locations.

### 9.3. Property Editors

Properties should have suitable visual editors.

Examples:

- Date picker for dates.
- Toggle for Boolean values.
- Numeric input for numbers.
- Map-based editor for geographic coordinates.

The user should not have to manually edit YAML for properties that can be edited through a visual interface.

### 9.4. Separation of Representation and Storage

The internal representation of a property and its serialized Markdown representation do not need to be identical.

Amethyst may use a richer internal data model while preserving the original storage format.

Serialization must preserve compatibility with existing Obsidian files and relevant third-party conventions.

Unknown or unsupported properties must not be silently discarded or converted.

### 9.5. Custom Property Types

Long-term support may include:

- User-defined property types.
- Custom property editors.
- Plugin-provided types.
- Custom serialization and display rules.

This is a future extension and not an initial implementation requirement.

---

## 10. Templates

The template system should preserve compatibility with standard Obsidian templates.

Additional capabilities may include:

- Conditional template selection.
- Date-based rules.
- Weekday-based templates.
- Monthly and yearly rules.
- Special templates for the first or last day of a period.
- More advanced user-defined conditions.

Future extensions may include scripting and custom automation.

The exact template syntax and execution model remain TBD.

---

## 11. Bases and Analytics

### 11.1. Bases

Bases should provide database-like views based on Markdown notes.

Requirements:

- Properties as database fields.
- Filtering.
- Sorting.
- Grouping.
- Table views.
- Card views.
- Potential Kanban views.
- Editing note properties directly from database views.
- Compatibility with Obsidian Bases files where practical.

### 11.2. Analytics

Analytics should extend Bases with data analysis capabilities.

Potential functionality:

- Charts.
- Statistical summaries.
- Aggregations.
- Calculated values.
- Grouped analysis.
- Time-series visualizations.
- Dashboards.

### 11.3. Data Source

Markdown notes remain the source of truth.

Bases and Analytics operate on indexed and derived data.

They must not introduce a separate authoritative data store for information already represented in note files.

---

## 12. Graph View

Graph View should provide functionality comparable to Obsidian.

Initial requirements:

- Global Graph.
- Local Graph.
- Note relationship visualization.
- Navigation between connected notes.
- Filtering.
- Visual customization.

More advanced graph analysis and visualization can be considered later.

Graph data should be derived from the Vault's note relationships.

---

## 13. Canvas

Canvas must support the original Obsidian Canvas format.

Requirements:

- Create and edit Canvas files.
- Text cards.
- Note cards.
- File cards.
- External links.
- Connections between elements.
- Groups.
- Free positioning.
- Resizing.
- Zooming and navigation.

Canvas files must remain compatible with Obsidian.

Changes made in either application should preserve the supported original format.

---

## 14. Calendar and Daily Notes

Calendar should be a built-in application component.

Initial functionality should be comparable to the Obsidian Calendar plugin.

Requirements:

- Monthly view.
- Weekly view.
- Daily Note navigation.
- Daily Note creation.
- Configurable file naming.
- Configurable storage location.
- Navigation between dates.
- Workspace integration.

Long-term possibilities include:

- Events.
- Tasks.
- Deadlines.
- Dates extracted from note Properties.
- More advanced calendar-based data visualization.

These extensions are not required initially.

---

## 15. Tasks

The initial implementation should support standard Markdown checkboxes.

Requirements:

- Correct Markdown task rendering.
- Task editing inside notes.
- Preservation of original Markdown syntax.
- Compatibility with existing Obsidian notes.

A more comprehensive task management system may be considered in the future.

Potential extensions include deadlines, priorities, recurring tasks and calendar integration.

---

## 16. Attachments

Attachment handling should follow the standard Obsidian model.

Requirements:

- Images.
- PDF files.
- Audio.
- Video.
- Other supported file types.
- Embedding attachments in notes.
- Preview of supported formats.
- Configurable attachment directory.
- Drag and Drop.
- Preservation of original files.

Advanced attachment management is not an initial priority.

---

## 17. Git Synchronization

Git Sync is a built-in subsystem of Amethyst.

It must not require a third-party plugin.

### 17.1. General Principles

- Git is the underlying synchronization mechanism.
- Users control their repositories and remotes.
- No dependency on a specific hosting provider.
- Local-first operation.
- Offline changes must be preserved.
- Synchronization must be available manually and automatically.
- Conflicts must never result in silent data loss.

### 17.2. Configuration

Users should be able to configure:

- Remote repository.
- Branch.
- Commit author name.
- Commit author email.
- Authentication method.
- Automatic synchronization settings.

Potential authentication methods include SSH and access tokens.

The exact authentication implementation is TBD.

### 17.3. Synchronization Modes

Support configurable synchronization modes:

| Mode | Description |
|---|---|
| Manual Sync | Synchronization initiated by the user |
| Sync on Open | Synchronization when opening a Vault |
| Sync on Leave | Synchronization when leaving or closing a Vault/application |
| Sync Every N | Synchronization at a configurable interval |
| Sync on Change | Synchronization after local changes, with an appropriate delay |

Modes should be independently configurable and combinable.

### 17.4. Command Palette Integration

Git Sync must be accessible through Command Palette.

Potential commands:

- Sync Now.
- Pull Changes.
- Push Changes.
- Show Sync Status.
- Resolve Conflicts.

### 17.5. Conflict Management

The default conflict behavior should follow the general approach of the Obsidian Fit plugin.

When a synchronization conflict occurs:

- Preserve the current local version as the active file.
- Save the conflicting version separately.
- Notify the user.
- Do not silently overwrite either version.

A dedicated conflict directory is required.

The proposed directory name is `_fit`, but the final name remains TBD.

Conflict files must be excluded from normal synchronization processing where appropriate to prevent recursive conflict creation.

### 17.6. Conflict Resolution Interface

Provide a dedicated conflict resolution window.

Initial functionality:

- Display Local Version.
- Display Remote Version.
- Show differences between versions.
- Allow the user to select one complete version.
- Preserve the unselected version until resolution is safely completed.

Future functionality may include an advanced merge editor inspired by Visual Studio Code.

The initial user experience should prioritize quick resolution of common conflicts.

### 17.7. Synchronization Status

Provide an interface showing:

- Last successful synchronization.
- Pending local changes.
- Incoming remote changes.
- Connection errors.
- Synchronization errors.
- Unresolved conflicts.

### 17.8. Data Safety

Synchronization must be designed to prevent data loss.

Important requirements:

- Never silently discard conflicting changes.
- Preserve recoverable versions.
- Handle interrupted synchronization.
- Avoid duplicate conflict creation.
- Avoid infinite synchronization loops.
- Provide clear error information.

---

## 18. Plugin Architecture

Plugin support is a long-term architectural goal.

Initial direction:

- JavaScript / TypeScript plugins.
- Public plugin API.
- Access to selected application functionality.
- Custom commands.
- Workspace components.
- Custom Properties editors.
- Additional tools and integrations.

The plugin architecture should include:

- Permissions.
- Lifecycle management.
- Isolation where practical.
- API versioning.
- Security restrictions.

A plugin marketplace or integrated plugin catalog may be introduced in the future.

The project should remain open to community contributions and an open-source ecosystem.

Core application functionality must not depend on third-party plugins.

Detailed plugin architecture is TBD.

---

## 19. Cross-platform Architecture

### 19.1. Target Platforms

- Windows.
- Linux.
- Android.

### 19.2. Shared Core

Reuse Rust business logic across platforms wherever practical.

Platform-specific functionality should be isolated from the core domain logic.

### 19.3. Desktop

Desktop is the primary Amethyst experience.

It should provide the complete application functionality:

- Advanced Workspace.
- Full editor.
- Graph View.
- Canvas.
- Bases.
- Analytics.
- Calendar.
- Git Sync.
- Customization.
- Future plugin support.

### 19.4. Android

Android is a companion version focused on everyday note-taking and quick access to information.

Primary functionality:

- Creating and editing notes.
- Daily Notes.
- Recording ideas.
- Basic Markdown tasks.
- Searching and viewing notes.
- Attachments.
- Git synchronization.

The mobile interface should be adapted to mobile interaction patterns.

It is not necessary to reproduce the complete desktop Workspace system on Android.

### 19.5. Platform Differences

Platform-specific capabilities should be handled explicitly.

Differences in filesystem access, lifecycle, permissions and background execution must not compromise the shared application logic.

---

## 20. Security

Security and user data protection are fundamental architectural requirements.

### 20.1. File Safety

- Avoid destructive operations without explicit justification.
- Handle errors safely.
- Preserve user content.
- Protect against accidental overwrites.
- Preserve recoverable versions during conflict resolution.

### 20.2. Plugin Security

Future plugins must not automatically receive unrestricted access to the user's system.

A permission model should define which application resources and operations plugins can access.

### 20.3. Authentication

Git credentials and authentication data must be handled securely.

Sensitive credentials must not be stored as ordinary plaintext application settings.

The exact secure storage mechanism is TBD.

### 20.4. Tauri Security

Follow Tauri security recommendations.

Use explicit capabilities and permissions.

Avoid unnecessary exposure of native functionality to the frontend.

---

## 21. Testing Strategy

Amethyst should use a multi-level testing strategy.

### 21.1. Unit Tests

Test individual Rust modules and business logic.

### 21.2. Integration Tests

Test interactions between modules and external resources.

Examples:

- Filesystem operations.
- Vault processing.
- Indexing.
- Git operations.
- Serialization.

### 21.3. Frontend Tests

Test React components and user interaction.

### 21.4. End-to-End Tests

Test complete user workflows.

Examples:

- Opening a Vault.
- Creating and editing notes.
- Updating Properties.
- Working with Canvas.
- Searching.
- Synchronizing between devices.
- Resolving conflicts.

### 21.5. Compatibility Tests

Special attention should be given to:

- Obsidian Markdown compatibility.
- YAML frontmatter preservation.
- Canvas format compatibility.
- Bases compatibility.
- External filesystem modifications.
- Git synchronization integrity.

Data integrity and compatibility tests should be treated as particularly important.

---

## 22. Performance Requirements

Performance should be considered throughout development.

Important areas:

- Fast application startup.
- Responsive editor.
- Efficient indexing.
- Fast full-text search.
- Efficient graph data processing.
- Responsive Workspace operations.
- Minimal unnecessary filesystem access.
- Efficient memory usage.
- Background processing for expensive operations.

Large Vaults should not cause unnecessary UI blocking.

Long-running operations should provide appropriate progress and error feedback.

---

## 23. Architectural Decision Boundaries

The following technologies and implementation details have not yet been finalized.

They should be selected during the detailed architecture and implementation planning stages.

| Area | Status |
|---|---|
| Frontend framework | React selected |
| Application framework | Tauri 2 selected |
| Core language | Rust selected |
| Internal database | TBD |
| Search engine | TBD |
| Markdown editor engine | TBD |
| Markdown parser | TBD |
| Frontend state management | TBD |
| Workspace layout implementation | TBD |
| Graph visualization library | TBD |
| Canvas rendering implementation | TBD |
| Git implementation and integration | TBD |
| Git credential storage | TBD |
| Plugin runtime | TBD |
| Mobile-specific implementation details | TBD |

Do not treat unspecified technologies as approved architectural decisions.

When selecting technologies, prioritize:

- Maintainability.
- Performance.
- Reliability.
- Cross-platform support.
- Compatibility.
- Security.
- Long-term ecosystem health.

---

## 24. Architecture Evolution

The architecture should evolve incrementally.

Important principles:

- Do not implement future functionality prematurely.
- Do not introduce abstractions without a clear purpose.
- Preserve the ability to extend existing modules.
- Keep business logic independent from presentation.
- Avoid unnecessary dependencies.
- Document significant architectural decisions.
- Update architecture documentation when actual implementation decisions change.

The implementation should follow the roadmap rather than attempting to realize the entire product vision at once.

---

## 25. Final Architectural Goal

Amethyst should be built around a modular, independent Rust core with a flexible React frontend and Tauri-based platform integration.

The architecture must provide:

- Reliable local-first storage.
- Obsidian compatibility.
- A flexible Workspace system.
- Extensible note and data processing.
- Built-in Git synchronization.
- Cross-platform support.
- Strong data integrity.
- Future extensibility through plugins.

The primary architectural objective is to create a foundation that remains maintainable as Amethyst grows from a note-taking application into a comprehensive knowledge management platform.