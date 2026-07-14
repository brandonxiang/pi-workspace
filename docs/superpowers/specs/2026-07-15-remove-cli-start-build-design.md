# Remove CLI `start` and `build` Subcommands

## Goal

Simplify the public `pi-workspace` command surface by removing the redundant
`start` and `build` subcommands.

## Behavior

- `pi-workspace` remains the only command for starting the bundled production
  service.
- `pi-workspace start` and `pi-workspace build` are rejected as unknown
  arguments and exit with a non-zero status.
- `pi-workspace --port <number>` continues to override the service port.
- `update`, `check`, `--help`, and `--version` keep their existing behavior.
- Project development scripts such as `pnpm start` and `pnpm build` remain
  unchanged. This change only affects the published CLI interface.
- The CLI help and README examples stop advertising the removed subcommands.

## Implementation

Remove `start` and `build` from the argument parser and help output. Remove the
dedicated CLI build dispatch branch; the existing automatic build guard remains
part of the bare `pi-workspace` startup path.

Update the English and Chinese README command examples so users build the
project through package scripts rather than a removed CLI subcommand.

## Error Handling

The existing unknown-argument path handles removed subcommands. For example,
`pi-workspace start` reports `Unknown argument: start` and exits with status 1.

## Testing

Add CLI process tests that verify:

- help omits `start` and `build`;
- both removed subcommands fail through the public executable;
- retained non-mutating commands such as `--version` still work.

Run the repository checks, tests, and production build before merging the
implementation into the main worktree.
