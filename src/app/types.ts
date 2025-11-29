/**
 * Domain types for git-rescribe
 */

export interface Identity {
  date: string;
  identity: string; // "Name <email@example.com>"
}

export interface RescribeCommit {
  author: Identity;
  committer: Identity;
  content: string; // "tree:abc123" | "diff:abc123" | "commit:abc123"
  message: string;
  parents: string[]; // ["previous"] | ["abc1234"] | ["rewritten:abc1234"]
}

export interface RebasePlan {
  commits: RescribeCommit[];
}
