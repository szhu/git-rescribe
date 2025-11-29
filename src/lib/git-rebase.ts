/**
 * Git rebase utilities
 * Could be published as: @std/git or deno.land/x/git-rebase
 */

export interface GitTodoCommit {
  hash: string;
  message: string;
}

/**
 * Parse git-rebase-todo file format
 * Example:
 *   pick abc123 # Commit message # empty
 */
export function parseGitRebaseTodo(content: string): GitTodoCommit[] {
  const commits: GitTodoCommit[] = [];

  for (const line of content.split('\n')) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) continue;

    // Parse: pick <hash> <message>
    const match = line.match(/^(?:pick|p)\s+([a-f0-9]+)\s+(.*)$/);
    if (match) {
      commits.push({
        hash: match[1],
        message: match[2].replace(/^# /, '').replace(/ # empty$/, ''),
      });
    }
  }

  return commits;
}

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

/**
 * Run a git command
 */
export async function runGit(
  args: string[],
  options?: { env?: Record<string, string>; suppressStderr?: boolean },
): Promise<number> {
  const command = new Deno.Command("git", {
    args,
    env: { ...Deno.env.toObject(), ...options?.env },
    stdout: "inherit",
    stderr: options?.suppressStderr ? "piped" : "inherit",
  });

  const { code } = await command.output();
  return code;
}
