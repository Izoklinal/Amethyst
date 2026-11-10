# Amethyst — Product Vision

## 1. Overview

Amethyst is a cross-platform knowledge management and note-taking application inspired by Obsidian and Visual Studio Code.

The primary goal is to provide the functionality and flexibility of Obsidian while improving application performance, keyboard-driven interaction, customization and synchronization.

Amethyst should be compatible with existing Obsidian vaults, allowing users to migrate their notes without data loss or mandatory conversion.

The application should combine the knowledge management capabilities of Obsidian with the workspace organization, navigation and keyboard interaction model of Visual Studio Code.

Amethyst is intended to become an independent, extensible and performant knowledge management platform.

## 2. Problem

Existing note-taking applications have several limitations that Amethyst aims to address:

- Obsidian uses Electron, which introduces overhead for a relatively lightweight note-taking application.
- Keyboard navigation and shortcuts could be more intuitive and consistent.
- Some useful functionality, such as Calendar, depends on third-party plugins.
- Synchronization should not require dependence on a particular hosting provider.
- Interface customization should be more flexible and accessible.
- Database-like functionality could provide more advanced data analysis and visualization.
- The template system could support more complex and context-aware automation.

## 3. Product Goals

### 3.1. Performance

Build a lightweight and responsive desktop and mobile application using Rust and Tauri.

Performance should be a core design requirement rather than an afterthought.

### 3.2. Obsidian Compatibility

Support existing Obsidian vaults without requiring migration or modification of their contents.

Core compatibility requirements:

- Markdown files.
- Internal links and backlinks.
- Note properties (frontmatter).
- Templates.
- Graph view.
- Canvas files.
- Attachments.
- Callouts and other common Obsidian Markdown extensions.
- Obsidian Bases files and their underlying data formats.

Amethyst should work directly with existing Obsidian vaults.

Users should be able to open the same vault in both applications without losing data or requiring conversion.

Amethyst-specific settings should be stored separately from the vault's original content.

Compatibility with every third-party Obsidian plugin is not a requirement, but future interoperability should be considered.

### 3.3. Built-in Functionality

Provide commonly used functionality directly in the application instead of relying on third-party plugins.

The Calendar functionality is an initial priority.

Calendar should integrate naturally with daily notes and support convenient navigation between dates.

### 3.4. Keyboard-driven Interface

Combine the workspace organization and navigation concepts of VS Code with the knowledge management capabilities of Obsidian.

Keyboard navigation and shortcuts should be first-class features.

Requirements:

- Configurable keyboard shortcuts.
- Consistent keyboard navigation.
- Command palette.
- Efficient navigation between notes and interface panels.
- Convenient workspace management.
- Minimal dependence on mouse interaction.

### 3.5. Customization

Provide extensive interface customization.

Users should be able to configure:

- Colors and themes.
- Application appearance.
- Interface elements.
- Keyboard shortcuts.
- Layout and workspace organization.
- Other visual and behavioral preferences.

User preferences should be stored separately from note contents in an application configuration directory, potentially using a `.amethyst` format.

### 3.6. Git Synchronization

Implement synchronization using Git as the underlying version control and synchronization mechanism.

The synchronization system should not depend on a particular hosting provider.

Requirements:

- No mandatory dependency on GitHub, GitLab or another specific hosting service.
- Users should be able to configure their own remote repositories.
- Support different connection methods supported by Git.
- Support synchronization between multiple devices.
- Handle merge conflicts and concurrent modifications safely.
- Preserve the original note files.
- Provide clear information about synchronization status and errors.

Git should be treated as the underlying synchronization mechanism, not as a mandatory user-facing development tool.

### 3.7. Plugin System

Provide an extensible plugin architecture.

Initial direction:

- JavaScript / TypeScript plugin support.
- A documented public API.
- Access to application events and selected application functionality.
- Plugin lifecycle management.
- Plugin permissions and access restrictions.
- Ability to extend application functionality and interface.

Native Rust plugins may be considered in the future.

The architecture should allow plugins to be introduced without compromising application stability and security.

### 3.8. Cross-platform Support

Target platforms:

- Windows.
- Linux.
- Android.

Maintain a shared application core wherever practical.

The user experience should be adapted to the capabilities and interaction patterns of each platform.

### 3.9. Advanced Template System

Amethyst should preserve compatibility with the standard Obsidian template format while introducing more advanced template capabilities.

Planned functionality:

- Standard Obsidian-compatible templates.
- Dynamic date and time variables.
- Conditional template selection.
- Templates based on weekdays, months and calendar events.
- Special templates for specific dates or recurring periods.
- User-defined rules for automatic template selection.

Examples:

- Automatically use a Monday template when creating a Monday daily note.
- Use a different template for the last day of the week.
- Apply a special template on the first day of each month.
- Select a template based on the current date or note properties.

Advanced scripting and user-defined template logic may be introduced in the future.

### 3.10. Bases and Data Analytics

Amethyst should support database-like views built directly from Markdown notes, following the core concepts of Obsidian Bases.

Requirements:

- Create databases based on note collections.
- Use note properties as database fields.
- Support filtering, sorting and grouping.
- Provide multiple views, including tables and cards.
- Allow editing note properties directly from database views.
- Preserve compatibility with existing Obsidian Bases files where practical.

#### Extended Analytics

Amethyst should extend the database functionality with built-in analytical tools:

- Charts and graphs.
- Statistical summaries.
- Aggregations and calculated values.
- Grouped data analysis.
- Time-series visualization.
- Custom dashboards.

All database views and analytics should use Markdown notes as their underlying source of truth.

The analytics system should be modular and extensible.

## 4. Target Audience

Amethyst is intended for users who need a flexible knowledge management system with:

- Markdown-based storage.
- Internal links and backlinks.
- Graph visualization.
- Advanced customization.
- Structured databases.
- Efficient keyboard-driven workflows.

Existing Obsidian users should be able to adopt Amethyst without abandoning their existing vaults.

The application should also be suitable for users who want a customizable personal knowledge management environment without unnecessary complexity.

## 5. Design Principles

### 5.1. Performance First

Application performance should be considered throughout development.

Avoid unnecessary resource consumption and expensive operations that negatively affect responsiveness.

### 5.2. Local-first

Local files should remain the primary source of truth.

Users should retain control over their data and should not require a proprietary cloud service to use the application.

### 5.3. Compatibility

Prefer existing open formats and compatibility with established ecosystems over proprietary formats.

### 5.4. Keyboard-first Interaction

Keyboard interaction should be a fundamental part of the application design, not an optional addition.

### 5.5. Customization

Users should be able to adapt the interface and application behavior to their individual workflows without modifying application source code.

### 5.6. Modularity

Application functionality should be organized into independent and maintainable components.

The architecture should allow future extensions without requiring unnecessary modifications to the application core.

### 5.7. Extensibility Without Premature Complexity

Consider future functionality when making architectural decisions, but avoid implementing abstractions before they are needed.

### 5.8. Data Safety

User data must not be silently modified, discarded or converted.

Operations involving synchronization, file modification and migration should handle errors and conflicts explicitly.

## 6. Non-goals

The project should not attempt to:

- Reimplement every existing Obsidian plugin.
- Introduce a proprietary note storage format.
- Depend on a proprietary cloud synchronization service.
- Implement a full plugin marketplace immediately.
- Implement every planned feature in the initial release.
- Optimize for every possible use case before the core application is functional.

These limitations do not exclude the corresponding functionality from the long-term product vision.

## 7. Long-term Vision

Amethyst should become an independent, extensible and performant knowledge management platform that combines:

- The flexibility and knowledge management capabilities of Obsidian.
- The workspace organization and keyboard interaction model of Visual Studio Code.
- Advanced database and data visualization capabilities.
- Flexible Git-based synchronization.
- Extensive interface customization.
- A powerful template system.
- A cross-platform experience.

The ultimate goal is to provide users with complete control over their knowledge, data, workspace and application behavior without sacrificing performance or usability.