/**
 * YAML formatting with Prettier
 * Could be published as: @std/yaml-format or deno.land/x/yaml-pretty
 */

import { stringify as stringifyYaml } from "https://deno.land/std@0.208.0/yaml/mod.ts";
import * as prettier from "npm:prettier@3.1.0";

/**
 * Convert a JavaScript object to formatted YAML string
 */
export async function formatYaml(data: unknown): Promise<string> {
  const yaml = stringifyYaml(data as Record<string, unknown>);

  const formatted = await prettier.format(yaml, {
    parser: "yaml",
    printWidth: 80,
  });

  return formatted;
}
