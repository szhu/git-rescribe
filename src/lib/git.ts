/**
 * Git utilities
 * Could be published as: @std/git or deno.land/x/git-utils
 */

/**
 * Get full commit information from git
 */
export async function getCommitInfo(hash: string) {
  const command = new Deno.Command("git", {
    args: [
      "show",
      "--format=%an%n%ae%n%aI%n%cn%n%ce%n%cI%n%T%n%P%n%B",
      "--no-patch",
      hash,
    ],
    stdout: "piped",
  });

  const { stdout } = await command.output();
  const output = new TextDecoder().decode(stdout);
  const lines = output.trim().split("\n");

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
    parents: parentsLine ? parentsLine.split(" ") : [],
    message: messageLines.join("\n").trim(),
  };
}

/**
 * Parse identity string "Name <email@example.com>"
 */
export function parseIdentity(
  identity: string,
): { name: string; email: string } {
  const match = identity.match(/^(.+?)\s*<(.+?)>$/);
  if (!match) {
    throw new Error(`Invalid identity format: ${identity}`);
  }
  return {
    name: match[1].trim(),
    email: match[2].trim(),
  };
}

/**
 * Format identity from name and email to "Name <email@example.com>"
 */
export function formatIdentity(name: string, email: string): string {
  return `${name} <${email}>`;
}

/**
 * Create a commit using git commit-tree
 */
export async function createCommit(options: {
  tree: string;
  parents: string[];
  author: { identity: string; date: string };
  committer: { identity: string; date: string };
  message: string;
}): Promise<string> {
  const { tree, parents, author, committer, message } = options;

  // Build args for git commit-tree
  const args = [tree];
  for (const parent of parents) {
    args.push("-p", parent);
  }
  args.push("-m", message);

  const command = new Deno.Command("git", {
    args: ["commit-tree", ...args],
    env: {
      ...Deno.env.toObject(),
      GIT_AUTHOR_NAME: parseIdentity(author.identity).name,
      GIT_AUTHOR_EMAIL: parseIdentity(author.identity).email,
      GIT_AUTHOR_DATE: author.date,
      GIT_COMMITTER_NAME: parseIdentity(committer.identity).name,
      GIT_COMMITTER_EMAIL: parseIdentity(committer.identity).email,
      GIT_COMMITTER_DATE: committer.date,
    },
    stdout: "piped",
  });

  const { stdout } = await command.output();
  return new TextDecoder().decode(stdout).trim();
}

/**
 * Update current branch to point to a new commit
 */
export async function updateCurrentBranch(commitHash: string): Promise<void> {
  // Get current branch name
  const branch = await getCurrentBranch();

  // Update branch ref
  const updateRef = new Deno.Command("git", {
    args: ["update-ref", `refs/heads/${branch}`, commitHash],
    stdout: "inherit",
    stderr: "inherit",
  });
  await updateRef.output();

  // Reset working tree to match
  const reset = new Deno.Command("git", {
    args: ["reset", "--hard", commitHash],
    stdout: "inherit",
    stderr: "inherit",
  });
  await reset.output();
}

/**
 * Get the name of the current branch
 */
export async function getCurrentBranch(): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    stdout: "piped",
  });
  const { stdout } = await command.output();
  return new TextDecoder().decode(stdout).trim();
}

/**
 * Count commits in a ref or range
 */
export async function countCommits(ref: string = "HEAD"): Promise<number> {
  const command = new Deno.Command("git", {
    args: ["rev-list", "--count", ref],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await command.output();
  return parseInt(new TextDecoder().decode(stdout).trim(), 10);
}

/**
 * Resolve and verify a git ref
 * Returns true if the ref exists and is valid
 */
export async function resolveRef(ref: string): Promise<boolean> {
  const command = new Deno.Command("git", {
    args: ["rev-parse", "--verify", ref],
    stdout: "piped",
    stderr: "piped",
  });
  const { code } = await command.output();
  return code === 0;
}

/**
 * Get the tree hash for a commit
 */
export async function getTreeHash(commitHash: string): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["rev-parse", `${commitHash}^{tree}`],
    stdout: "piped",
  });
  const { stdout } = await command.output();
  return new TextDecoder().decode(stdout).trim();
}
