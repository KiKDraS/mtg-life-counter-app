export const PonytailMode = async () => {
  return {
    "shell.env": async (input, output) => {
      output.env.PONYTAIL_DEFAULT_MODE = "full"
    },
  }
}
