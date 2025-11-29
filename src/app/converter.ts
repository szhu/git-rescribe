/**
 * Convert between git commits and rescribe YAML format
 */

import { getCommitInfo } from "../lib/git-rebase.ts";
import { formatYaml } from "../lib/yaml-prettier.ts";
import type { RescribeCommit } from "./types.ts";

/**
 * Query git commit graph and convert to rescribe YAML
 */
export async function convertGitGraphToYaml(base: string): Promise<string> {
  // Get list of commits to process in topological order
  const revListArgs = base === "--root"
    ? ["rev-list", "--topo-order", "--reverse", "HEAD"]
    : ["rev-list", "--topo-order", "--reverse", `${base}..HEAD`];

  const revList = new Deno.Command("git", {
    args: revListArgs,
    stdout: "piped",
  });
  const { stdout } = await revList.output();
  const commitHashes = new TextDecoder().decode(stdout).trim().split("\n").filter(Boolean);

  // Build a map of commit hash -> index for parent resolution
  const commitIndexMap = new Map<string, number>();
  commitHashes.forEach((hash, index) => {
    commitIndexMap.set(hash, index);
  });

  // Process each commit
  const yamlCommits = await Promise.all(commitHashes.map(async (hash, index) => {
    const info = await getCommitInfo(hash);

    // Determine parent references
    let parentRefs: string[];

    if (info.parents.length === 0) {
      // Root commit
      parentRefs = [];
    } else if (info.parents.length === 1) {
      // Single parent - check if it's the previous commit in our list
      const parentHash = info.parents[0];
      const parentIndex = commitIndexMap.get(parentHash);

      if (parentIndex !== undefined && parentIndex === index - 1) {
        // Previous commit in sequence
        parentRefs = ["previous"];
      } else if (commitIndexMap.has(parentHash)) {
        // Parent is in our rebase range but not sequential - use rewritten reference
        parentRefs = [`rewritten:${parentHash.substring(0, 7)}`];
      } else {
        // Parent is outside our rebase range
        parentRefs = [parentHash.substring(0, 7)];
      }
    } else {
      // Merge commit - multiple parents
      parentRefs = info.parents.map((parentHash, parentIdx) => {
        const parentIndex = commitIndexMap.get(parentHash);

        if (parentIdx === 0 && parentIndex !== undefined && parentIndex === index - 1) {
          // First parent is previous commit
          return "previous";
        } else if (commitIndexMap.has(parentHash)) {
          // Parent is in our rebase range - use rewritten reference
          return `rewritten:${parentHash.substring(0, 7)}`;
        } else {
          // Parent is outside rebase range
          return parentHash.substring(0, 7);
        }
      });
    }

    const rescribeCommit: RescribeCommit = {
      author: {
        date: info.authorDate,
        identity: `${info.authorName} <${info.authorEmail}>`,
      },
      committer: {
        date: info.committerDate,
        identity: `${info.committerName} <${info.committerEmail}>`,
      },
      content: `commit:${hash.substring(0, 7)}`,
      message: info.message,
      parents: parentRefs,
    };

    return rescribeCommit;
  }));

  return await formatYaml({ commits: yamlCommits });
}
