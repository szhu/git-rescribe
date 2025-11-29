/**
 * Convert between git commits and rescribe YAML format
 */

import { parseGitRebaseTodo, getCommitInfo } from "../lib/git-rebase.ts";
import { formatYaml } from "../lib/yaml-prettier.ts";
import type { RescribeCommit } from "./types.ts";

/**
 * Convert git-rebase-todo file to rescribe YAML
 */
export async function convertGitTodoToYaml(gitTodoPath: string): Promise<string> {
  const gitTodo = await Deno.readTextFile(gitTodoPath);
  const commits = parseGitRebaseTodo(gitTodo);

  const yamlCommits = await Promise.all(commits.map(async (commit, index) => {
    const info = await getCommitInfo(commit.hash);

    // Truncate hashes to 7 chars
    const parents = info.parents.map(p => p.substring(0, 7));

    // Determine parent references
    const parentRefs = parents.length === 0
      ? []
      : index === 0
        ? parents
        : ["previous"];

    const rescribeCommit: RescribeCommit = {
      author: {
        date: info.authorDate,
        identity: `${info.authorName} <${info.authorEmail}>`,
      },
      committer: {
        date: info.committerDate,
        identity: `${info.committerName} <${info.committerEmail}>`,
      },
      content: `tree:${info.tree}`,
      message: info.message,
      parents: parentRefs,
    };

    return rescribeCommit;
  }));

  return await formatYaml({ commits: yamlCommits });
}
