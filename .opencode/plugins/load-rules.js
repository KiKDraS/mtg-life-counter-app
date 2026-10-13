// Session rules loader. Appends rule-activation block to every agent's
// system prompt. Catches all agents incl future — zero config maintenance.
import { Plugin } from "@opencode/plugin"

const RULES = [
  "",
  "## Session rules (auto-loaded)",
  "- AGENTS.md + .opencode/docs/*.md + your agent file = law. Already in your system prompt. Follow. No deviation.",
  "- Caveman: per skills-settings-rules.md (ON, full). Git Flow: per AGENTS.md. Orchestrator: plan -> approval -> execute.",
]
const MARKER = "## Session rules (auto-loaded)"

export default Plugin.define({
  id: "load-rules",
  async setup(ctx) {
    await ctx.session.hook("context", (event) => {
      if (event.system.some((part) => String(part?.text ?? "").includes(MARKER))) return
      event.system.push(...RULES.map((text) => ({ type: "text", text })))
    })
  },
})
