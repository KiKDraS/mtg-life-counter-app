## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-typescript-sdk
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and
[many more agents](https://cli.github.com/manual/gh_skill_install). Add
`--scope user` to install across every project for your current agent, or
`--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.)
see the [root README](../../README.md#installing).

## Package split

The SDK is split into two packages:

- **[`@openrouter/agent`](https://www.npmjs.com/package/@openrouter/agent)** —
  Agent features: `callModel`, `tool()`, stop conditions, streaming, format
  converters
- **[`@openrouter/sdk`](https://www.npmjs.com/package/@openrouter/sdk)** —
  Platform features: model listing, chat completions, credits, OAuth, API key
  management

Migrating from an older `@openrouter/sdk` that still exposed agent features? See
the [openrouter-agent-migration](../openrouter-agent-migration/README.md) skill.
