# Obsidian MCP Client Setup (Windows & WSL)

This guide explains how to connect the Obsidian MCP server to popular MCP clients and IDEs across Windows and WSL. Reuse the same `start-server.mjs` entry point and environment variables described in `guides/terminal-commands.md`.

## Claude Desktop
- **Config file**: `%APPDATA%\AnthropicClaude\mcp_config.json`
- **Entry**:
  ```json
  {
    "command": "node",
    "args": [
      "D:\\dev\\obsidian-mcp-2\\code_artifacts\\obsidian-mcp-server\\start-server.mjs"
    ],
    "env": {
      "NODE_ENV": "production",
      "LOG_LEVEL": "silent",
      "CONFIG_PATH": "D:\\dev\\obsidian-mcp-2\\code_artifacts\\obsidian-mcp-server\\config.json",
      "OBSIDIAN_API_KEY": "<your key>"
    },
    "workingDirectory": "D:\\dev\\obsidian-mcp-2\\code_artifacts\\obsidian-mcp-server"
  }
  ```
- **Notes**: Restart Claude after editing. Keep keys secure.

## Claude Code (VS Code extension)
- **Config file**: `.claude/code/mcp.config.json` inside your workspace.
- **Sample**:
  ```json
  {
    "servers": {
      "obsidian": {
        "command": "node",
        "args": [
          "${workspaceFolder}/code_artifacts/obsidian-mcp-server/start-server.mjs"
        ],
        "env": {
          "NODE_ENV": "production",
          "LOG_LEVEL": "silent",
          "CONFIG_PATH": "${workspaceFolder}/code_artifacts/obsidian-mcp-server/config.json",
          "OBSIDIAN_API_KEY": "${env:OBSIDIAN_API_KEY}"
        },
        "cwd": "${workspaceFolder}/code_artifacts/obsidian-mcp-server"
      }
    }
  }
  ```

## Cursor IDE
- **Config file**: `%APPDATA%\Cursor\mcp\servers.json`
- **Entry** mirrors Claude Desktop; Cursor will restart servers automatically when the file changes.

## Windsurf
- **Config file**: `%APPDATA%\Windsurf\mcp_config.json`
- **Entry**: identical structure to Claude Desktop’s `mcpServers`. Ensure `LOG_LEVEL=silent` is set to avoid noisy panels.

## Zed Editor
- **Config file**: `%APPDATA%\Zed\mcp\servers.json` (Windows) or `~/.config/zed/mcp/servers.json` (Linux/WSL).
- **Example**:
  ```json
  {
    "obsidian": {
      "command": "node",
      "args": [
        "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/start-server.mjs"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "silent",
        "CONFIG_PATH": "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json",
        "OBSIDIAN_API_KEY": "${env:OBSIDIAN_API_KEY}"
      },
      "workingDirectory": "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server"
    }
  }
  ```

## WSL-specific Considerations
- Use WSL path forms (`/mnt/d/...`).
- Ensure the Obsidian vault is accessible from WSL (if stored on Windows drive, watch for case sensitivity).
- When running Obsidian’s Local REST API, it listens on Windows; you may need to map port access via `localhost` works under WSL by default.

## Command-Line MCP Clients
- **Codex CLI / Gemini CLI / Augment Code**
  - Launch your MCP client with environment variables pointing to the server:
    ```bash
    CONFIG_PATH=/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json \
    OBSIDIAN_API_KEY="<key>" \
    NODE_ENV=production LOG_LEVEL=silent \
    node /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/start-server.mjs >/dev/null &
    ```
  - Configure the CLI’s MCP server list (usually `~/.config/<client>/mcp.toml` or `.json`) to connect via STDIO.

## Windows vs WSL Summary
- **Windows**: Use backslash paths, set env vars via `$env:...`.
- **WSL/Linux**: Use forward slashes, export vars via `export`.
- All clients should inject `NODE_ENV`, `LOG_LEVEL`, `CONFIG_PATH`, and `OBSIDIAN_API_KEY` to ensure quiet logging and proper vault selection.

## Next Steps
- Extend documentation once automated tests validate Windows native, WSL (Windows FS), and WSL (Linux FS) scenarios.
- Capture platform-specific edge cases (permissions, path normalization) in future revisions.
