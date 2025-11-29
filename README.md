# git-rescribe

If you want to fix metadata in your commit history, the current best tool is `git rebase -i`. You mark commits in a TODO file, save it, then Git pauses at each one so you can run commands to [amend the author](https://stackoverflow.com/questions/3042437), [edit the message](https://stackoverflow.com/questions/179123), [set environment variables for dates](https://stackoverflow.com/questions/454734), etc.

What if... you could just edit all that metadata directly in the TODO file?

git-rescribe lets you edit commit metadata (authors, dates, committers, messages) directly in a YAML file, then applies all changes at once.

**Common scenarios:**

- Want to clean up "WIP", "fix", "asdf" messages before you push?
- Committed 50 times with the wrong email address?
- Want to fix commit dates that rebase changed?
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

**Before (`git log --reverse`):**

```
commit f1a2b3c
Author: Correct Author <correct@example.com>
Date:   Mon Nov 25 12:00:00 2025 -0500

    Add login feature

commit 9e3f1a2
Author: user <user@machine.local>
Date:   Wed Nov 20 16:45:00 2025 -0500

    WIP

commit 2a6c9f1
Author: user <user@machine.local>
Date:   Fri Nov 22 15:30:00 2025 -0500

    final final version

commit e8d4a73
Author: user <user@machine.local>
Date:   Sat Nov 23 10:00:00 2025 -0500

    actually final

commit 3c7d9e4
Author: Correct Author <correct@example.com>
Date:   Tue Nov 26 14:00:00 2025 -0500

    Add dashboard routing
```

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
      Add settings page
    # more fields available, omitted for brevity ...

  # more commits ...
```

**After (`git log --reverse`):**

```
commit f1a2b3c
Author: Correct Author <correct@example.com>
Date:   Mon Nov 25 12:00:00 2025 -0500

    Add login feature

commit b5f2e94
Author: Correct Author <correct@example.com>
Date:   Thu Nov 28 10:00:00 2025 -0500

    Add user authentication

    Implemented login and signup flows

commit 4e9b2f6
Author: Correct Author <correct@example.com>
Date:   Thu Nov 28 11:00:00 2025 -0500

    Add settings page

commit 1d8c5a9
Author: Correct Author <correct@example.com>
Date:   Thu Nov 28 12:00:00 2025 -0500

    Update dashboard styles

    Co-authored-by: Designer <designer@example.com>

commit 8f5a1c2
Author: Correct Author <correct@example.com>
Date:   Tue Nov 26 14:00:00 2025 -0500

    Add dashboard routing
```

## Future Work

- Currently, this tool focuses on commit metadata editing. We currently support different strategies for modifying content, like applying diffs or using specific trees, but it's not well documented and the UX story isn't fully explored.
- Currently, you can only edit or remove existing commits. We could consider adding support for splitting and squashing commits.

## License

I am happy to attach a license for this project. Please file an issue so I can understand what license would be most useful for the community.
