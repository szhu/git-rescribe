/**
 * Execute a rescribe rebase plan
 */

import { parse as parseYaml } from "https://deno.land/std@0.208.0/yaml/mod.ts";
import { RebaseSchema } from "./schema.ts";

/**
 * Execute a rebase plan from a YAML file
 */
export async function executeRescribe(
  yamlPath: string,
  options: { updateHead?: boolean } = {},
): Promise<string | null> {
  const { updateHead = true } = options;

  console.log("Validating YAML...");

  const yamlContent = await Deno.readTextFile(yamlPath);
  const parsed = parseYaml(yamlContent);
  const validated = RebaseSchema.parse(parsed);

  console.log(`Found ${validated.commits.length} commits to process`);

  // Track mapping of original hash → new hash for rewritten: references
  const rewrittenMap = new Map<string, string>();
  let previousCommit: string | null = null;

  for (let i = 0; i < validated.commits.length; i++) {
    const commit = validated.commits[i];
    console.log(`\n[${i + 1}/${validated.commits.length}] Processing commit...`);

    // 1. Resolve tree hash from content strategy
    const tree = await resolveContentStrategy(commit.content);
    console.log(`  Tree: ${tree}`);

    // 2. Resolve parents
    const parents = resolveParents(commit.parents, previousCommit, rewrittenMap);
    console.log(`  Parents: ${parents.length === 0 ? "(root commit)" : parents.join(", ")}`);

    // 3. Create commit with custom metadata
    const newHash = await createCommit({
      tree,
      parents,
      author: commit.author,
      committer: commit.committer,
      message: commit.message,
    });
    console.log(`  Created: ${newHash}`);

    // 4. Track the new commit
    const originalHash = extractOriginalHash(commit.content);
    if (originalHash) {
      rewrittenMap.set(originalHash, newHash);
    }
    previousCommit = newHash;
  }

  // 5. Optionally update current branch to point to final commit
  if (previousCommit && updateHead) {
    console.log(`\nUpdating HEAD to ${previousCommit}...`);
    await updateCurrentBranch(previousCommit);
    console.log("✓ Rebase complete!");
  }

  return previousCommit;
}

/**
 * Resolve content strategy to a tree hash
 * Supports: tree:hash, diff:hash, commit:hash
 */
async function resolveContentStrategy(content: string): Promise<string> {
  const [strategy, hash] = content.split(":");

  if (strategy === "tree") {
    return hash;
  }

  if (strategy === "commit") {
    // Get tree from existing commit
    const command = new Deno.Command("git", {
      args: ["rev-parse", `${hash}^{tree}`],
      stdout: "piped",
    });
    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout).trim();
  }

  if (strategy === "diff") {
    // Apply diff to get new tree
    // This is complex - for now, just use the commit's tree
    // TODO: Implement actual diff application
    const command = new Deno.Command("git", {
      args: ["rev-parse", `${hash}^{tree}`],
      stdout: "piped",
    });
    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout).trim();
  }

  throw new Error(`Unknown content strategy: ${strategy}`);
}

/**
 * Resolve parent references to actual commit hashes
 */
function resolveParents(
  parents: string[],
  previousCommit: string | null,
  rewrittenMap: Map<string, string>,
): string[] {
  return parents.map((parent) => {
    if (parent === "previous") {
      if (!previousCommit) {
        throw new Error("Cannot use 'previous' for first commit");
      }
      return previousCommit;
    }

    if (parent.startsWith("rewritten:")) {
      const originalHash = parent.substring("rewritten:".length);
      const rewritten = rewrittenMap.get(originalHash);
      if (!rewritten) {
        throw new Error(`No rewritten commit found for ${originalHash}`);
      }
      return rewritten;
    }

    // Direct hash reference
    return parent;
  });
}

/**
 * Create a commit using git commit-tree
 */
async function createCommit(options: {
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
 * Parse identity string "Name <email@example.com>"
 */
function parseIdentity(identity: string): { name: string; email: string } {
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
 * Extract original commit hash from content strategy (if commit: or diff:)
 */
function extractOriginalHash(content: string): string | null {
  const [strategy, hash] = content.split(":");
  if (strategy === "commit" || strategy === "diff") {
    return hash;
  }
  return null;
}

/**
 * Update current branch to point to the new commit
 */
async function updateCurrentBranch(commitHash: string): Promise<void> {
  // Get current branch name
  const getBranch = new Deno.Command("git", {
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    stdout: "piped",
  });
  const { stdout } = await getBranch.output();
  const branch = new TextDecoder().decode(stdout).trim();

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
