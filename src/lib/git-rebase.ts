/**
 * Git utilities
 * Could be published as: @std/git or deno.land/x/git-utils
 */

/**
 * Get full commit information from git
 */
export async function getCommitInfo(hash: string) {
  const command = new Deno.Command("git", {
    args: ["show", "--format=%an%n%ae%n%aI%n%cn%n%ce%n%cI%n%T%n%P%n%B", "--no-patch", hash],
    stdout: "piped",
  });

  const { stdout } = await command.output();
  const output = new TextDecoder().decode(stdout);
  const lines = output.trim().split('\n');

  const [
    authorName,
    authorEmail,
    authorDate,
    committerName,
    committerEmail,
    committerDate,
    tree,
    parentsLine,
    ...messageLines
  ] = lines;

  return {
    authorName,
    authorEmail,
    authorDate,
    committerName,
    committerEmail,
    committerDate,
    tree,
    parents: parentsLine ? parentsLine.split(' ') : [],
    message: messageLines.join('\n').trim(),
  };
}

