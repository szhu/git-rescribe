/**
 * Zod schemas for validating git-rescribe YAML files
 */

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const IdentitySchema = z.object({
  date: z.string(),
  identity: z.string().regex(/^.+ <.+@.+>$/),
});

const ContentSchema = z.string().refine(
  (val) => /^(tree|diff|commit):[a-f0-9]{7,40}$/.test(val),
  "Content must be tree:hash, diff:hash, or commit:hash",
);

const ParentSchema = z.union([
  z.literal("previous"),
  z.string().regex(/^rewritten:[a-f0-9]{7,40}$/),
  z.string().regex(/^[a-f0-9]{7,40}$/),
]);

const CommitSchema = z.object({
  author: IdentitySchema,
  committer: IdentitySchema,
  content: ContentSchema,
  message: z.string(),
  parents: z.array(ParentSchema),
});

export const RebaseSchema = z.object({
  commits: z.array(CommitSchema),
});
