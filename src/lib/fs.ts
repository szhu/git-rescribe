/**
 * Filesystem utilities
 * Could be published as: @std/fs-utils or deno.land/x/fs-helpers
 */

/**
 * Check if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
