# Obsidian MCP Server Logging Behavior

## Summary
The current implementation logs structured events with `pino` to **STDOUT** (`src/utils/logger.ts`). When the server runs under Claude Desktop (or any MCP host) the host expects JSON-RPC messages only on STDOUT. Pretty-printed log lines therefore break framing and trigger JSON parse errors. We applied a **short-term workaround** (set `LOG_LEVEL=silent`, redirect STDOUT) but a permanent fix is needed.

## Symptoms Observed
- Claude Desktop pops up errors such as `Unexpected token 'p'` or `Expected ',' or ']' after array element`.
- Logs show Claude receiving messages like `tool: "move_note"` or platform metadata instead of JSON-RPC frames.
- The MCP connection survives but user experience degrades due to repeated dialogs.

## Root Cause
- `logger.info(...)` writes human-readable objects because `pino-pretty` is enabled when `NODE_ENV !== 'production'` (`src/utils/logger.ts`).
- Even in production mode the default destination is STDOUT, the same channel used for JSON-RPC responses.
- MCP clients treat any non-JSON text on STDOUT as protocol data and attempt to parse it, leading to failures.

## Short-Term Workaround (Applied)
- Export `NODE_ENV=production` and `LOG_LEVEL=silent` when launching the server.
- Redirect STDOUT to `NUL` when running manually (`node start-server.mjs 1>$null`).
- Pass the same environment variables in Claude Desktop’s `mcpServers` entry so auto-launched processes remain quiet.

## Long-Term Fix Options
1. **Send logs to STDERR**
   - Update the logger configuration to set the transport destination to file descriptor 2.
   - Example inside `src/utils/logger.ts`:
     ```ts
     transport: {
       target: 'pino-pretty',
       options: { colorize: true, destination: 2 }
     }
     ```
   - Requires ensuring `NODE_ENV` logic doesn’t re-enable STDOUT output by default.

2. **Swap to JSON logging and filter at client**
   - Disable `pino-pretty` entirely and provide a CLI flag to opt-in.
   - Provide documentation instructing users to pipe logs if they need them.

3. **Separate transport per environment**
   - Keep pretty logs for local development but require `STDOUT`-clean mode when `process.env.MCP_STDIO === 'true'` (new flag).
   - Example: when STDIO mode is detected, automatically switch to `destination: 2` or a rolling file appender.

4. **Expose logging configuration**
   - Add config keys (e.g., `logging.destination`, `logging.level`) in `config.json` to give users explicit control without environment variables.

## Proposed Follow-Up Tasks
- Implement option (1) by default; adjust tests to account for STDERR output.
- Add regression test verifying no non-JSON output on STDOUT when `handleToolCall()` executes.
- Create a dedicated troubleshooting guide (`guides/logging-troubleshooting.md`, TBD) covering verification steps and client-specific fixes.
- Update `SETUP_GUIDE.md` once the troubleshooting guide exists.
- Validate across clients (Claude Desktop, Windsurf, Cursor, Zed) to ensure JSON parse pop-ups disappear.
