// Secret exfiltration guard. Blocks tool calls touching `.env*` files or
// `.opencode/secrets/`. Covers read, grep, bash. Paths realpath'd when they
// exist -> symlink-proof. Case lowered -> .ENV/.Env no bypass on mac/win.
import { realpathSync } from "node:fs"

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

export const EnvProtection = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const args = output.args ?? {}
      const blocked =
        (input.tool === "read" && hit(resolve(args.filePath ?? ""))) ||
        (input.tool === "grep" &&
          (hit(resolve(args.path ?? "")) || hit(args.include ?? ""))) ||
        (input.tool === "bash" && hit(args.command ?? ""))
      if (blocked) {
        throw new Error("Blocked: .env / .opencode/secrets access not allowed")
      }
    },
  }
}