# git-rescribe

If you want to fix metadata in your commit history, the current best tool is `git rebase -i`. You mark commits in a todo file (pick, edit, reword, etc.), then interactively run commands to fix up each one. What if... you could do all that in the TODO file?

git-rescribe lets you edit commit metadata (authors, dates, committers, messages) directly in a YAML file. Like `git rebase -i`, this rewrites history.

**Common scenarios:**

- Want to clean up "WIP", "fix", "asdf" messages before you push?
- Committed 50 times with the wrong email address?
- Need to update committer dates for compliance/audit?
- Want to change author names or add co-contributors?

## Usage

<details>
<summary>How to install this tool</summary>

```bash
# Install Deno (if needed)
curl -fsSL https://deno.land/install.sh | sh

# Clone and add to PATH
git clone https://github.com/szhu/git-rescribe.git
export PATH="$PATH:$(pwd)/git-rescribe/bin"
```

</details>

<br/>

```bash
# Rescribe last 5 commits
git-rescribe HEAD~5

# Rescribe all commits
git-rescribe --root

# Rescribe since main branch
git-rescribe main

# Skip confirmation prompt
git-rescribe HEAD~3 --yes

# Abort in-progress rescribe
git-rescribe --abort
```

## Example

**Before:**

| Hash    | Author         | Date       | Message               |
| ------- | -------------- | ---------- | --------------------- |
| f1a2b3c | Correct Author | 2025-11-25 | Add login feature     |
| 9e3f1a2 | machine.local  | 2025-11-20 | WIP                   |
| d74b8c5 | machine.local  | 2025-11-21 | fix                   |
| 2a6c9f1 | machine.local  | 2025-11-22 | final final version   |
| e8d4a73 | machine.local  | 2025-11-23 | actually final        |
| 3c7d9e4 | Correct Author | 2025-11-26 | Add dashboard routing |

**Run `git-rescribe f1a2b3c` and edit the YAML:**

```yaml
commits:
  - author:
      date: "2025-11-28T10:00:00-05:00"
      identity: "Correct Author <you@example.com>"
    message: |-
      Add user authentication

      Implemented login and signup flows
    # more fields available, omitted for brevity ...

  - author:
      date: "2025-11-28T11:00:00-05:00"
      identity: "Correct Author <you@example.com>"
    message: |-
      Add profile UI
    # more fields available, omitted for brevity ...

  # more commits ...
```

**After:**

| Hash    | Author         | Date       | Message                       |
| ------- | -------------- | ---------- | ----------------------------- |
| f1a2b3c | Correct Author | 2025-11-25 | Add login feature             |
| b5f2e94 | Correct Author | 2025-11-28 | Add user authentication [...] |
| c7a1d38 | Correct Author | 2025-11-28 | Add profile UI                |
| 4e9b2f6 | Correct Author | 2025-11-28 | Add settings page             |
| 1d8c5a9 | Correct Author | 2025-11-28 | Update dashboard styles       |
| 8f5a1c2 | Correct Author | 2025-11-26 | Add dashboard routing         |

## Future Work

- Currently, this tool focuses on commit metadata editing. We currently support different strategies for modifying content, like applying diffs or using specific trees, but it's not well documented and the UX story isn't fully explored.
- Currently, you can only edit or remove existing commits. We could consider adding support for splitting and squashing commits.

## License

I am happy to attach a license for this project. Please file an issue so I can understand what license would be most useful for the community.
