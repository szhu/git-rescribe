/**
 * String utilities
 * Could be published as: @std/string-utils or deno.land/x/string-helpers
 */

/**
 * Truncate a string to a maximum length, adding ellipsis if needed
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + "...";
}
