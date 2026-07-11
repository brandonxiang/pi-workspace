# Dependency Upgrade and npm Release Design

## Goal

Upgrade every direct dependency to its latest npm registry release, replace every
`latest` specifier with an explicit version, and add a minimal `release-it`
workflow for publishing `pi-workspace` to npm.

## Dependency policy

- Resolve latest versions from the npm registry at implementation time.
- Replace existing `latest` specifiers with exact versions such as `8.1.4`.
- Preserve the style of other specifiers: caret ranges remain caret ranges and
  exact pins remain exact pins.
- Keep `release-it` in `devDependencies` because it is release tooling rather
  than runtime code.
- Regenerate `pnpm-lock.yaml` with the repository's declared pnpm version.
- Keep native dependency build permissions in `pnpm-workspace.yaml`, the
  location supported by the declared pnpm version.
- Preserve the user's existing uncommitted dependency changes and build on top
  of them.

## Release workflow

Add a `release` npm script backed by `release-it`. The workflow will:

1. Require a clean, valid Git state before release.
2. Run the test suite and production build before changing the version.
3. Update the package version selected interactively by the maintainer.
4. Create the release commit and Git tag, then push them.
5. Publish the package to npm.

GitHub Release creation is out of scope. Existing `prepack` behavior remains the
source of truth for building npm package contents.

## Failure handling

- Dependency incompatibilities are fixed in source or configuration without
  weakening existing tests.
- A failed test, typecheck, build, package dry run, or release dry run blocks
  handoff until fixed or explicitly reported.
- No real version bump, Git push, tag creation, or npm publish is performed while
  configuring and verifying the workflow.

## Verification

- Confirm no dependency specifier is still `latest`.
- Run `pnpm test`.
- Run `pnpm typecheck`.
- Run `pnpm build` (the project handoff requirement).
- Run `pnpm pack --dry-run` to inspect publish contents.
- Run the non-mutating `release-it` dry-run path to validate configuration.
