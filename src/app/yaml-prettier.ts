/**
 * YAML formatting with Prettier
 * Could be published as: @std/yaml-format or deno.land/x/yaml-pretty
 */

import * as prettier from "npm:prettier@3.1.0";
import type { RebasePlan } from "./types.ts";

/**
 * Convert a RebasePlan to formatted YAML string
 */
export async function formatYaml(data: RebasePlan): Promise<string> {
  // Manually construct YAML with our preferred format
  const lines: string[] = [];

  lines.push("commits:");

  for (let i = 0; i < data.commits.length; i++) {
    const commit = data.commits[i];

    // Add blank line before each commit (except the first)
    if (i > 0) {
      lines.push("");
    }

    lines.push("  - author:");
    lines.push(`      date: ${JSON.stringify(commit.author.date)}`);
    lines.push(`      identity: ${JSON.stringify(commit.author.identity)}`);
    lines.push("    committer:");
    lines.push(`      date: ${JSON.stringify(commit.committer.date)}`);
    lines.push(`      identity: ${JSON.stringify(commit.committer.identity)}`);
    lines.push(`    content: ${JSON.stringify(commit.content)}`);

    // Use |- format for all messages
    lines.push("    message: |-");
    const messageLines = commit.message.split('\n');
    for (const msgLine of messageLines) {
      lines.push(`      ${msgLine}`);
    }

    lines.push(`    parents: ${JSON.stringify(commit.parents)}`);
  }

  const yaml = lines.join('\n') + '\n';

  // Run through Prettier for final formatting
  const formatted = await prettier.format(yaml, {
    parser: "yaml",
    printWidth: 80,
  });

  return formatted;
}
