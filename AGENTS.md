# Repository Guidelines

## Project Structure & Module Organization

This repository is a collection of self-contained StableOps integration examples. Each first-level example directory owns its source code, tests, assets, dependency manifest, and setup documentation. Add new examples as sibling directories with clear, framework-oriented names, such as `nextjs-hosted-checkout/` or `python-api/`.

Keep repository-wide information in the root `README.md`. Put setup, configuration, architecture, and deployment instructions in each example's own `README.md`. Examples must not depend on files, services, or build output from other examples.

## Build, Test, and Development Commands

Run commands from the example you are changing, using the package manager and scripts documented there. Every example README must list prerequisites and its exact local workflow, including install, development, tests, linting, type checks, builds, and any migrations. For example:

```bash
cd <example-directory>
<package-manager> install
<package-manager> test
```

When adding a new example, provide a reproducible command set and lock dependency versions where its ecosystem supports lockfiles.

## Coding Style & Naming Conventions

Follow the formatter, linter, and language conventions established inside the example being changed. Use descriptive, framework-idiomatic names and keep source files focused on a single responsibility. New examples should include an appropriate formatter or linter and document how to run it.

## Testing Guidelines

Place tests in the location expected by the selected framework and document that location in the example README. Name tests after behavior, not implementation. Cover successful flows, invalid input, and retry or idempotency behavior for payment and webhook logic. Mock external services; tests must not require live StableOps credentials or shared infrastructure.

## Security & Configuration

Provide an `.env.example` whenever configuration is required. Never commit credentials, API keys, webhook secrets, or production database URLs. Keep server-side credentials out of browser-exposed configuration, and document all required variables and their purpose.

## Commit & Pull Request Guidelines

Existing commits use concise, imperative subjects. Keep each commit focused on one example or a repository-wide documentation change. Pull requests should identify affected examples, describe behavior changes, list verification commands run, and include screenshots for user-facing UI changes. Call out new environment variables, migrations, and webhook or security implications explicitly.
