/**
 * Plan a rebase operation
 * Determines what will happen without actually executing
 */

import { parse as parseYaml } from "https://deno.land/std@0.208.0/yaml/mod.ts";
import { RebaseSchema } from "./schema.ts";
import { getCommitInfo, getTreeHash, formatIdentity } from "../lib/git.ts";
import type { RescribeCommit } from "./types.ts";

/**
 * Plan for a single commit
 */
export interface CommitPlan {
  commit: RescribeCommit;
  originalHash: string | null;
  action: "reuse" | "create";
  changes: string[]; // What changed (for display)
  tree: string; // Resolved tree hash
  parents: string[]; // Resolved parent hashes
}

/**
 * Overall rebase plan
 */
export interface RebasePlan {
  commits: CommitPlan[];
}

/**
 * Create a rebase plan from a YAML file
 */
export async function createPlan(yamlPath: string): Promise<RebasePlan> {
  const yamlContent = await Deno.readTextFile(yamlPath);
  const parsed = parseYaml(yamlContent);
  const validated = RebaseSchema.parse(parsed);

  const commitPlans: CommitPlan[] = [];
  const rewrittenMap = new Map<string, string>();
  let previousCommit: string | null = null;

  for (let i = 0; i < validated.commits.length; i++) {
    const commit = validated.commits[i];
    const originalHash = extractOriginalHash(commit.content);

    // Resolve tree and parents
    const tree = await resolveContentStrategy(commit.content);
    const parents = resolveParents(commit.parents, previousCommit, rewrittenMap);

    // Determine what changed and if we can reuse
    const changes: string[] = [];
    let canReuse = false;

    if (originalHash) {
      const originalInfo = await getCommitInfo(originalHash);

      // Check tree
      if (originalInfo.tree !== tree) {
        changes.push("content");
      }

      // Check parents
      if (originalInfo.parents.length !== parents.length) {
        changes.push("parents");
      } else {
        for (let j = 0; j < parents.length; j++) {
          if (!originalInfo.parents[j].startsWith(parents[j])) {
            changes.push("parents");
            break;
          }
        }
      }

      // Check author
      const authorIdentity = formatIdentity(originalInfo.authorName, originalInfo.authorEmail);
      if (authorIdentity !== commit.author.identity) {
        changes.push("author identity");
      }
      if (originalInfo.authorDate !== commit.author.date) {
        changes.push("author date");
      }

      // Check committer
      const committerIdentity = formatIdentity(originalInfo.committerName, originalInfo.committerEmail);
      if (committerIdentity !== commit.committer.identity) {
        changes.push("committer identity");
      }
      if (originalInfo.committerDate !== commit.committer.date) {
        changes.push("committer date");
      }

      // Check message
      if (originalInfo.message !== commit.message) {
        changes.push("message");
      }

      // Can reuse if nothing changed
      canReuse = changes.length === 0;
    } else {
      changes.push("new commit");
    }

    const action = canReuse ? "reuse" : "create";

    // Track rewritten commits for parent resolution
    if (originalHash) {
      if (canReuse) {
        rewrittenMap.set(originalHash, originalHash);
        previousCommit = originalHash;
      } else {
        // Use a placeholder for now - executor will fill in actual hash
        rewrittenMap.set(originalHash, "pending");
        previousCommit = "pending";
      }
    } else {
      previousCommit = "pending";
    }

    commitPlans.push({
      commit,
      originalHash,
      action,
      changes,
      tree,
      parents,
    });
  }

  return { commits: commitPlans };
}

/**
 * Extract original commit hash from content strategy
 */
function extractOriginalHash(content: string): string | null {
  const [strategy, hash] = content.split(":");
  if (strategy === "commit" || strategy === "diff") {
    return hash;
  }
  return null;
}

/**
 * Resolve content strategy to tree hash
 */
async function resolveContentStrategy(content: string): Promise<string> {
  const [strategy, hash] = content.split(":");

  if (strategy === "tree") {
    return hash;
  }

  if (strategy === "commit" || strategy === "diff") {
    return await getTreeHash(hash);
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
