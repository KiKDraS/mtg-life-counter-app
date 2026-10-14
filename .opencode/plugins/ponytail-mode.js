import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "ponytail-mode",
  async setup(ctx) {
    await ctx.shell.hook("create.before", (event) => {
      event.env.PONYTAIL_DEFAULT_MODE = "full"
    })
  },
})
