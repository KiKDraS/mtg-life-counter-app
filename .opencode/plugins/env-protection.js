// Secret exfiltration guard. Blocks tool calls touching `.env*` files or
// `.opencode/secrets/`. Covers read, grep, shell. Paths realpath'd when they
// exist -> symlink-proof. Case lowered -> .ENV/.Env no bypass on mac/win.
import { realpathSync } from "node:fs"
import { Plugin } from "@opencode/plugin"

const TARGETS = [".env", ".opencode/secrets"]
const norm = (s) => String(s).toLowerCase().replaceAll("\\", "/")
const hit = (s) => TARGETS.some((t) => norm(s).includes(t))
const resolve = (p) => {
  try {
    return realpathSync(p)
  } catch {
    return p // path may not exist; string check still applies
  }
}

export default Plugin.define({
  id: "env-protection",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", (event) => {
      const args = event.input ?? {}
      const blocked =
        // v2 read input is `path`; `filePath` kept as fallback
        (event.tool === "read" && hit(resolve(args.path ?? args.filePath ?? ""))) ||
        (event.tool === "grep" &&
          (hit(resolve(args.path ?? "")) || hit(args.include ?? ""))) ||
        (event.tool === "shell" && hit(args.command ?? ""))
      if (blocked) {
        throw new Error("Blocked: .env / .opencode/secrets access not allowed")
      }
    })
  },
})
