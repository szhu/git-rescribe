/**
 * Generic editor utilities
 * Could be published as: @std/editor or deno.land/x/terminal-editor
 */

/**
 * Open a file in the user's preferred editor and wait for it to close
 */
export async function openEditor(filePath: string): Promise<void> {
  const editorString = Deno.env.get("EDITOR") || Deno.env.get("VISUAL") || "vi";

  // Split editor string to handle cases like "code --wait"
  const editorParts = editorString.split(/\s+/);
  const editorCmd = editorParts[0];
  const editorArgs = editorParts.slice(1);

  const command = new Deno.Command(editorCmd, {
    args: [...editorArgs, filePath],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const { code } = await command.output();

  if (code !== 0) {
    throw new Error(`Editor exited with code ${code}`);
  }
}
