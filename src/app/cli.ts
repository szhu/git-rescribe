/**
 * CLI workflows for git-rescribe
 * These functions can be imported and used programmatically
 */

import { openEditor } from "../lib/editor.ts";
import { exists } from "../lib/fs.ts";
import { truncate } from "../lib/string.ts";
import { countCommits, getCurrentBranch, resolveRef } from "../lib/git.ts";
import { convertGitGraphToYaml } from "./converter.ts";
import { executeRescribe } from "./executor.ts";
import { createPlan, type RebasePlan } from "./planner.ts";

const RESCRIBE_TODO = ".git/RESCRIBE_TODO.yml";
const RESCRIBE_STATE = ".git/RESCRIBE_STATE";

// Global flag for --yes
let skipConfirmation = false;

/**
 * Start a new interactive rebase
 */
export async function startRebase(base: string): Promise<void> {
  // Check if rebase already in progress
  if (await exists(RESCRIBE_TODO)) {
    throw new Error("Rescribe already in progress. Use --continue or --abort");
  }

  // Validate base and count commits
  const validation = await validateBase(base);
  if (!validation.valid) {
    console.error(`Error: Invalid base '${base}'`);
    console.error(
      `\nThis branch has ${validation.totalCommits} commit${
        validation.totalCommits === 1 ? "" : "s"
      }.`,
    );
    console.error(`\nTo rescribe all commits, run:`);
    console.error(`  git-rescribe --root`);
    if (validation.totalCommits > 1) {
      console.error(`\nOr to rescribe the last N commits, run:`);
      console.error(`  git-rescribe HEAD~N`);
      console.error(
        `  (e.g., git-rescribe HEAD~${
          Math.min(5, validation.totalCommits - 1)
        })`,
      );
    }
    Deno.exit(1);
  }

  console.log(`Starting rescribe from ${base}...`);
  console.log(
    `This will process ${validation.commitCount} commit${
      validation.commitCount === 1 ? "" : "s"
    }.`,
  );

  // Query git commit graph directly and generate YAML
  console.log("Generating YAML from commit history...");
  const yaml = await convertGitGraphToYaml(base);
  await Deno.writeTextFile(RESCRIBE_TODO, yaml);

  // Save original HEAD
  const originalRef = await getCurrentBranch();
  await Deno.writeTextFile(RESCRIBE_STATE, originalRef);

  // Open editor for user to edit YAML
  console.log("Opening editor...");
  await openEditor(RESCRIBE_TODO);

  console.log("\nEditor closed. Applying changes...");

  // Automatically continue after editor exits
  await continueRebase();
}

/**
 * Validate base ref and count commits
 */
async function validateBase(base: string): Promise<{
  valid: boolean;
  commitCount: number;
  totalCommits: number;
}> {
  // Get total commit count in current branch
  const totalCommits = await countCommits("HEAD");

  // Special case: --root means all commits
  if (base === "--root") {
    return { valid: true, commitCount: totalCommits, totalCommits };
  }

  // Try to resolve the base ref
  const valid = await resolveRef(base);
  if (!valid) {
    return { valid: false, commitCount: 0, totalCommits };
  }

  // Count commits between base and HEAD
  const commitCount = await countCommits(`${base}..HEAD`);

  return { valid: true, commitCount, totalCommits };
}

/**
 * Preview changes and get user confirmation
 */
async function previewChanges(plan: RebasePlan): Promise<void> {
  console.log(
    `\nPlan for ${plan.commits.length} commit${
      plan.commits.length === 1 ? "" : "s"
    }:`,
  );

  for (const commitPlan of plan.commits) {
    const firstLine = commitPlan.commit.message.split("\n")[0];
    const truncated = truncate(firstLine, 60);

    const status = commitPlan.action === "reuse" ? "  Reuse" : " Modify";
    console.log(`${status}  ${truncated}`);

    // Show what changed for modified commits
    if (commitPlan.action === "create" && commitPlan.changes.length > 0) {
      for (const change of commitPlan.changes) {
        console.log(`         - ${change}`);
      }
    }
  }

  // Wait for confirmation unless --yes flag
  if (!skipConfirmation) {
    console.log("\nPress Enter to continue or Ctrl+C to cancel...");
    const buf = new Uint8Array(1);
    await Deno.stdin.read(buf);
  }
}

/**
 * Continue an in-progress rebase
 */
export async function continueRebase(): Promise<void> {
  if (!await exists(RESCRIBE_TODO)) {
    throw new Error(
      "No rescribe in progress. Did you run 'git-rescribe <base>' first?",
    );
  }

  // Create plan
  const plan = await createPlan(RESCRIBE_TODO);

  // Preview changes and get confirmation
  await previewChanges(plan);

  console.log("\nApplying changes...");
  await executeRescribe(plan);

  // Clean up
  console.log("\nCleaning up...");
  try {
    await Deno.remove(RESCRIBE_TODO);
    await Deno.remove(RESCRIBE_STATE);
  } catch {
    // Ignore errors
  }
}

/**
 * Abort the current rebase
 */
export async function abortRebase(): Promise<void> {
  console.log("Aborting rescribe...");

  // Clean up state files
  try {
    await Deno.remove(RESCRIBE_TODO);
    await Deno.remove(RESCRIBE_STATE);
    console.log("Cleaned up rescribe state");
  } catch {
    console.log("No rescribe state to clean up");
  }
}

/**
 * Main CLI entry point
 * Parses arguments and dispatches to appropriate workflow
 */
export async function main(): Promise<void> {
  const args = Deno.args;

  // Check for --yes flag
  if (args.includes("--yes") || args.includes("-y")) {
    skipConfirmation = true;
  }

  // Filter out flags to get positional args
  const positionalArgs = args.filter((arg) => !arg.startsWith("-"));

  // Check for flags
  if (args.includes("--abort")) {
    await abortRebase();
    return;
  }

  if (args.includes("--continue")) {
    await continueRebase();
    return;
  }

  // Start new rebase
  if (args.includes("--root")) {
    await startRebase("--root");
    return;
  }

  // Base argument is required
  if (positionalArgs.length === 0) {
    console.error("Error: Missing base argument");
    console.error("\nUsage:");
    console.error(
      "  git-rescribe <base>        Start interactive rebase from base",
    );
    console.error("  git-rescribe --root        Rescribe all commits");
    console.error("  git-rescribe --continue    Continue in-progress rescribe");
    console.error("  git-rescribe --abort       Abort in-progress rescribe");
    console.error("\nOptions:");
    console.error("  --yes, -y                  Skip confirmation prompt");
    console.error("\nExamples:");
    console.error("  git-rescribe HEAD~5        Rescribe last 5 commits");
    console.error(
      "  git-rescribe main --yes    Rescribe commits since main without prompt",
    );
    Deno.exit(1);
  }

  const base = positionalArgs[0];
  await startRebase(base);
}
