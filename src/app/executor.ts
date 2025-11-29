/**
 * Execute a rescribe rebase plan
 */

import type { RebasePlan } from "./planner.ts";
import { createCommit, updateCurrentBranch } from "../lib/git.ts";

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

