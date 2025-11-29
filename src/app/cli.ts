/**
 * CLI workflows for git-rescribe
 * These functions can be imported and used programmatically
 */

import { runGit } from "../lib/git-rebase.ts";
import { openEditor } from "../lib/editor.ts";
import { convertGitTodoToYaml } from "./converter.ts";
import { executeRescribe } from "./executor.ts";

const REBASE_DIR = ".git/rebase-merge";
const RESCRIBE_TODO = ".git/RESCRIBE_TODO.yml";
const RESCRIBE_STATE = ".git/RESCRIBE_STATE";

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Start a new interactive rebase
 */
export async function startRebase(base: string): Promise<void> {
  // Check if rebase already in progress
  if (await exists(REBASE_DIR)) {
    throw new Error("Rebase already in progress. Use --continue or --abort");
  }

  // Validate base and count commits
  const validation = await validateBase(base);
  if (!validation.valid) {
    console.error(`Error: Invalid base '${base}'`);
    console.error(`\nThis branch has ${validation.totalCommits} commit${validation.totalCommits === 1 ? "" : "s"}.`);
    console.error(`\nTo rescribe all commits, run:`);
    console.error(`  git-rescribe --root`);
    if (validation.totalCommits > 1) {
      console.error(`\nOr to rescribe the last N commits, run:`);
      console.error(`  git-rescribe HEAD~N`);
      console.error(`  (e.g., git-rescribe HEAD~${Math.min(5, validation.totalCommits - 1)})`);
    }
    Deno.exit(1);
  }

  console.log(`Starting rebase from ${base}...`);
  console.log(`This will process approximately ${validation.commitCount} commit${validation.commitCount === 1 ? "" : "s"}.`);

  // Find the bin/git-rescribe script to use as the editor
  const currentFile = import.meta.url.replace("file://", "");
  const binScript = currentFile.replace("/src/app/cli.ts", "/bin/git-rescribe");

  // Start git rebase with git-rescribe itself as the editor
  // When git calls it with the todo file path, it will auto-detect and enter editor mode
  // We suppress stderr to hide git's "there was a problem with the editor" message
  // (our editor exits with error code 1 to abort the rebase after saving the YAML)
  console.log("Starting git rebase...");
  await runGit(["rebase", "-i", "--rebase-merges", base], {
    env: { GIT_SEQUENCE_EDITOR: binScript },
    suppressStderr: true,
  });

  console.log("Done!");
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
  const countCmd = new Deno.Command("git", {
    args: ["rev-list", "--count", "HEAD"],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout: countStdout } = await countCmd.output();
  const totalCommits = parseInt(new TextDecoder().decode(countStdout).trim(), 10);

  // Special case: --root means all commits
  if (base === "--root") {
    return { valid: true, commitCount: totalCommits, totalCommits };
  }

  // Try to resolve the base ref
  const resolveCmd = new Deno.Command("git", {
    args: ["rev-parse", "--verify", base],
    stdout: "piped",
    stderr: "piped",
  });
  const { code } = await resolveCmd.output();

  if (code !== 0) {
    return { valid: false, commitCount: 0, totalCommits };
  }

  // Count commits between base and HEAD
  const rangeCmd = new Deno.Command("git", {
    args: ["rev-list", "--count", `${base}..HEAD`],
    stdout: "piped",
  });
  const { stdout: rangeStdout } = await rangeCmd.output();
  const commitCount = parseInt(new TextDecoder().decode(rangeStdout).trim(), 10);

  return { valid: true, commitCount, totalCommits };
}

/**
 * Continue an in-progress rebase
 */
export async function continueRebase(): Promise<void> {
  console.log("Continuing rescribe...");

  if (!await exists(RESCRIBE_TODO)) {
    throw new Error("No rescribe in progress. Did you run 'git-rescribe <base>' first?");
  }

  await executeRescribe(RESCRIBE_TODO);

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

  // Also abort any git rebase in progress
  if (await exists(REBASE_DIR)) {
    await runGit(["rebase", "--abort"]);
  }
}

/**
 * Editor mode: called from git's sequence editor
 * This converts the git-rebase-todo to YAML, opens editor, and saves for later execution
 */
export async function editorMode(todoFile: string): Promise<void> {
  const rebaseDir = todoFile.replace("/git-rebase-todo", "");
  const backupFile = `${rebaseDir}/git-rebase-todo.backup`;

  console.log("\n=== git-rescribe ===");
  console.log("Converting to YAML format...");
  const yaml = await convertGitTodoToYaml(backupFile);

  // Save to persistent location (not in rebase-merge which gets deleted)
  await Deno.writeTextFile(RESCRIBE_TODO, yaml);

  console.log("Opening editor...");
  await openEditor(RESCRIBE_TODO);

  console.log("Saving state...");

  // Save original branch/HEAD before rebase
  const getHead = new Deno.Command("git", {
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    stdout: "piped",
  });
  const { stdout } = await getHead.output();
  const originalRef = new TextDecoder().decode(stdout).trim();
  await Deno.writeTextFile(RESCRIBE_STATE, originalRef);

  console.log("\nYAML saved to:", RESCRIBE_TODO);
  console.log("\nNext steps:");
  console.log("  1. Review/edit the YAML file if needed");
  console.log("  2. Run: git-rescribe --continue");
  console.log("  3. Or run: git-rescribe --abort to cancel");

  // Exit with error code to abort git's rebase
  // (git's error message will be suppressed by startRebase)
  Deno.exit(1);
}

/**
 * Main CLI entry point
 * Parses arguments and dispatches to appropriate workflow
 */
export async function main(): Promise<void> {
  const args = Deno.args;

  // Special mode: called from git's sequence editor
  if (args.includes("--editor-mode")) {
    const todoFile = args[args.indexOf("--editor-mode") + 1];
    await editorMode(todoFile);
    return;
  }

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
  if (args.length === 0) {
    console.error("Error: Missing base argument");
    console.error("\nUsage:");
    console.error("  git-rescribe <base>     Start interactive rebase from base");
    console.error("  git-rescribe --root     Rescribe all commits");
    console.error("  git-rescribe --continue Continue in-progress rescribe");
    console.error("  git-rescribe --abort    Abort in-progress rescribe");
    console.error("\nExamples:");
    console.error("  git-rescribe HEAD~5     Rescribe last 5 commits");
    console.error("  git-rescribe main       Rescribe commits since main branch");
    Deno.exit(1);
  }

  const base = args[0];
  await startRebase(base);
}
