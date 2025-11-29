/**
 * Execute a rescribe rebase plan
 */

import type { RebasePlan } from "./planner.ts";

/**
 * Execute a rebase plan
 */
export async function executeRescribe(
  plan: RebasePlan,
  options: { updateHead?: boolean } = {},
): Promise<string | null> {
  const { updateHead = true } = options;

  console.log(`Processing ${plan.commits.length} commit${plan.commits.length === 1 ? "" : "s"}...`);

  // Track mapping of original hash → new hash for resolving "pending" references
  const rewrittenMap = new Map<string, string>();
  let finalCommit: string | null = null;

  for (let i = 0; i < plan.commits.length; i++) {
    const commitPlan = plan.commits[i];
    console.log(`\n[${i + 1}/${plan.commits.length}] Processing commit...`);

    // Resolve parent placeholders for display and execution
    const resolvedParents = commitPlan.parents.map(parent => {
      if (parent === "pending") {
        return finalCommit!;
      }
      return parent;
    });

    console.log(`  Tree: ${commitPlan.tree}`);
    console.log(`  Parents: ${resolvedParents.length === 0 ? "(root commit)" : resolvedParents.join(", ")}`);

    let newHash: string;

    if (commitPlan.action === "reuse") {
      // Reuse the original commit
      newHash = commitPlan.originalHash!;
      console.log(`  Reused: ${newHash} (unchanged)`);
    } else {

      // Create commit with custom metadata
      newHash = await createCommit({
        tree: commitPlan.tree,
        parents: resolvedParents,
        author: commitPlan.commit.author,
        committer: commitPlan.commit.committer,
        message: commitPlan.commit.message,
      });
      console.log(`  Created: ${newHash}`);
    }

    // Track the new commit
    if (commitPlan.originalHash) {
      rewrittenMap.set(commitPlan.originalHash, newHash);
    }
    finalCommit = newHash;
  }

  // Optionally update current branch to point to final commit
  if (finalCommit && updateHead) {
    console.log(`\nUpdating HEAD to ${finalCommit}...`);
    await updateCurrentBranch(finalCommit);
    console.log("✓ Rebase complete!");
  }

  return finalCommit;
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
