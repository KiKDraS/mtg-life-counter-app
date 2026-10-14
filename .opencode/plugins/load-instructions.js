// Instruction docs loader. Injects `.opencode/docs/` docs into every request's
// system context, restoring V1 `instructions` parity — V2 accepts the config
// array but does not resolve its entries yet.
// shortcut: manual injection while V2 ignores config `instructions`; drop this
// plugin when upstream resolves them, or the docs load twice.
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Plugin } from "@opencode/plugin"

const FILES = ["skills-settings-rules.md", "agent-knowledge-awareness.md"]
const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs")

export default Plugin.define({
  id: "load-instructions",
  async setup(ctx) {
    const docs = FILES.flatMap((file) => {
      const path = join(docsDir, file)
      try {
        return [{ type: "text", text: `Instructions from: ${path}\n\n${readFileSync(path, "utf8")}` }]
      } catch (error) {
        console.warn(`load-instructions: cannot read ${path}: ${error.message}`)
        return []
      }
    })

    await ctx.session.hook("context", (event) => {
      event.system.push(...docs)
    })
  },
})
