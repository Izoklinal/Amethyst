# Amethyst — Agent Instructions

## Project Overview

Amethyst is a cross-platform, local-first knowledge management and note-taking application inspired by Obsidian and Visual Studio Code.

The project uses:
- Rust for the application core and business logic.
- Tauri 2 for native application integration.
- React and TypeScript for the frontend.

## Documentation

Before making changes, consult the relevant project documentation:

- `docs/PRODUCT.md` — product vision, goals and features.
- `docs/ARCHITECTURE.md` — architecture, components and technical boundaries.
- `docs/DECISIONS.md` — accepted architectural decisions.
- `docs/ROADMAP.md` — development phases and priorities.

These documents define the intended direction of the project.

## General Rules

1. Follow the established architecture and module boundaries.
2. Do not introduce architectural changes without explaining and justifying them.
3. Keep business logic independent of Tauri and frontend wherever practical.
4. Preserve compatibility with existing Obsidian Vaults.
5. Treat user data integrity as a critical requirement.
6. Avoid unnecessary abstractions, dependencies and premature optimization.
7. Prefer small, focused and testable changes.
8. Add or update tests when changing application behavior.
9. Do not implement features outside the current development scope without explicit approval.
10. Do not silently overwrite, delete or transform user data.

## Development Workflow

For non-trivial tasks:

1. Inspect the existing implementation.
2. Read relevant documentation.
3. Identify affected components and dependencies.
4. Explain the proposed approach.
5. Create an implementation plan.
6. Implement incrementally.
7. Run relevant tests and checks.
8. Summarize changes and any remaining limitations.

If requirements are ambiguous or conflict with existing decisions, ask for clarification rather than making potentially consequential assumptions.

## Scope

The current initial target is the desktop MVP for Windows and Linux.

Android, third-party plugin support, advanced Canvas, Graph, Bases and Analytics functionality are outside the MVP scope.