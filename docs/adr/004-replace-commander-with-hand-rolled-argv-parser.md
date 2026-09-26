# ADR-004: Replace commander with a Hand-Rolled Argv Parser

## Status

Accepted

## Date

2026-09-27

## Context

The `pi-workspace` CLI entrypoint (`bin/pi-workspace.mjs`) used commander to
expose a deliberately tiny surface:

- `-v, --version`
- `-h, --help`
- `--port <number>`
- one optional positional `[command]`, where the accepted values are
  `check`, `update`, and `help`

That is one option, one positional, and two built-in flags. commander is an
excellent fit for CLIs with subcommands, option groups, and complex validation,
but none of those were present here, so the dependency was 232 KB earning very
little.

The CLI's output is a user-facing contract that other tooling and the existing
tests depend on, so the formatting could not drift:

```
Usage: pi-workspace [options] [command]

Start the built service

Options:
  -v, --version    Show the installed version
  --port <number>  Override PORT for the service
  -h, --help       Show this help message

Commands:
  check               Check whether a newer version is available
  update              Check for updates and upgrade to the latest version
  help                Show this help message
```

Exit codes and error text were also load-bearing, in particular the
`[pi-workspace] Unknown argument: <command>` message written by the CLI itself
rather than by commander.

## Decision

Parse `process.argv` in-repo with a `parseArgv()` function, and keep the help
text as an explicit constant rather than deriving it from option metadata.

`parseArgv()` returns `{ help, version, options, positionals }` and throws a
`UsageError` for malformed input. `main()` prints `UsageError` messages verbatim
(so they match commander's `error: ...` shape and exit non-zero), while all
other errors keep the `[pi-workspace]` prefix from the existing top-level catch.

The parser covers every case the CLI exposes, including bodies the previous
implementation handled that were not obvious:

| Input                         | Result                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| `--help` / `-h` / `help`      | help text on stdout, exit 0                                |
| `--version` / `-v`            | `v<version>`, exit 0                                       |
| `--port 8787` / `--port=8787` | port set                                                   |
| `--port` (no value)           | `error: option '--port <number>' argument missing`, exit 1 |
| `--port --help`               | same error — the next token being a flag counts as missing |
| `--nope`                      | `error: unknown option '--nope'`, exit 1                   |
| two positionals               | `error: too many arguments...`, exit 1                     |
| `start` / `build`             | `[pi-workspace] Unknown argument: start`, exit 1           |

The existing CLI test file was extended from 3 to 13 cases to lock the contract
down, and the pre-change output was captured as a byte-for-byte baseline before
the rewrite.

## Alternatives Considered

### Keep commander

- Pros:
  - handles help formatting, option parsing, and error messages already
  - the CLI would need no changes at all
- Cons:
  - 232 KB and a runtime dependency for one option and one positional
  - every published install of `pi-workspace` pays for it
  - `--help`/usage text was assembled through three separate API calls
    (`.usage()`, `.version()`, `.addHelpText()`) for a static string
- Rejected:
  - the surface is small and stable, and removing it is consistent with the
    dependency policy recorded in ADR-003

### Use `node:util.parseArgs`

- Pros:
  - built into Node, so no dependency at all
  - `allowPositionals` covers the single positional argument
- Cons:
  - does not produce commander-compatible error text, so each failure still
    needs translation to match the existing contract
  - help text still has to be written by hand
  - positional arity is not validated, so the "too many arguments" case needs a
    manual check regardless
- Rejected:
  - once error translation, help text, and the arity check are accounted for,
    the explicit loop is not meaningfully more code, and it keeps full control
    of the exact output

### Trim the CLI surface first, then drop commander

- Pros:
  - a smaller documented surface is easier to hand-roll
- Cons:
  - `check` and `update` are user-facing features, not commander artifacts
  - removing them is a product decision, not a dependency decision
- Rejected:
  - the surface was already small; the dependency was the problem, not the
    features

## Consequences

### Positive

- One fewer runtime dependency; `commander` is gone from `package.json` and the
  lockfile
- Help, version, and error output are plain strings in one place, so changing
  them is a single-file edit
- Exit codes and error text are pinned by tests rather than inherited from a
  library's defaults
- `--port` with a flag as its value now fails loudly instead of starting the
  server with a bogus port

### Negative

- The repository now owns argv edge cases: `--opt=value` splitting, "next token
  is a flag", arity checking, and `--` handling
- The help text is a hand-maintained constant, so adding an option means editing
  both the parser and the help string; nothing enforces that they agree
- Features commander provides for free — option grouping, negation, variadic
  arguments, completion — would have to be written if ever needed

### Follow-up Notes

- Keep the CLI surface small. If it grows to real subcommands with per-command
  options, reevaluate whether a parser library is the better trade.
- `--port` deliberately rejects a value starting with `-`. Revisit only if a
  legitimate negative or dashed port value ever exists.
- The CLI test spawns the real entrypoint from a temp fixture, so it exercises
  actual process exit codes rather than an in-process function call. Keep new
  cases on that path.
