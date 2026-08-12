// Session rules loader. Appends rule-activation block to every agent's
// system prompt. Catches all agents incl future — zero config maintenance.
export const LoadRules = async () => {
  const RULES = [
    "",
    "## Session rules (auto-loaded)",
    "- AGENTS.md + .opencode/docs/skills-settings-rules.md + your agent file = law. Already in your system prompt. Follow. No deviation.",
    "- Caveman: per skills-settings-rules.md (ON, full). Git Flow: per AGENTS.md. Orchestrator: plan -> approval -> execute.",
  ]
  const MARKER = "## Session rules (auto-loaded)"
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      if (output.system.join("\n").includes(MARKER)) return
      output.system.push(...RULES)
    },
  }
}
