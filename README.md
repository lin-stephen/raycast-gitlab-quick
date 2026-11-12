# GitLab Quick

A [Raycast](https://raycast.com) extension for jumping straight into a project on a
self-hosted GitLab instance — type a fragment of the project name, pick from the
matches, land on the page you wanted.

Built for on-prem GitLab. The instance URL is a preference, so nothing about any
particular server is baked into the source.

## Commands

| Command | Suggested alias | Opens |
| --- | --- | --- |
| Open GitLab Repo | `git` | the project homepage |
| Open GitLab Pipelines | `pl` | the project's CI/CD pipelines |

Both take an optional text argument. Typing an alias followed by a **space** moves
focus into that argument, so `git casa` then <kbd>Enter</kbd> goes straight to a
list of every project matching `casa` — `casa.frontend`, `casa.backend`, and so on.
Pick one and it opens in your browser.

Leave the argument empty to browse your most recently active projects instead.

Matching runs server-side against GitLab's project search with `search_namespaces`
enabled, so a group name matches too.

## Setup

### 1. Install

No published package yet — install from source:

```sh
git clone git@github.com:lin-stephen/raycast-gitlab-quick.git
cd raycast-gitlab-quick
npm install
npx ray build
```

Then in Raycast run **Import Extension** and select the cloned folder.

> **npm 11+**: the install may warn that `esbuild` has an install script that was
> not run. The build needs it. Run `npm install-scripts approve esbuild` followed by
> `npm install` again.

Keep the folder around — Raycast runs the extension from where you cloned it.

### 2. Create a GitLab token

In GitLab, go to **Settings → Access tokens** and create a personal access token
with the **`read_api`** scope. That is the only scope required; the extension never
writes anything.

`read_repository` is not needed — the extension opens web pages and does not clone.

Note the expiry date. When the token lapses the extension reports
*Could not reach GitLab* with a 401.

### 3. Configure

Open either command in Raycast and fill in its preferences:

| Preference | Value |
| --- | --- |
| GitLab URL | Base URL of your instance, e.g. `https://gitlab.example.com` |
| Personal Access Token | The `read_api` token from step 2 |
| Only projects I'm a member of | Restricts search to your own projects. Off by default, so internal and public projects on the instance are searchable too. |

The token is stored in Raycast's encrypted preference store, never on disk in this
repository.

### 4. Set aliases

Go to **Raycast Settings → Extensions → GitLab Quick** and set an alias on each
command — `git` and `pl` are the ones this README assumes. Aliases are what make
`git casa` work.

## Actions

With a project selected:

| Shortcut | Action |
| --- | --- |
| <kbd>Enter</kbd> | Open the command's primary target (repo, or pipelines) |
| <kbd>Cmd</kbd> <kbd>Enter</kbd> | Open the other one |
| <kbd>Cmd</kbd> <kbd>Shift</kbd> <kbd>M</kbd> | Merge requests |
| <kbd>Cmd</kbd> <kbd>Shift</kbd> <kbd>I</kbd> | Issues |
| <kbd>Cmd</kbd> <kbd>Shift</kbd> <kbd>J</kbd> | Jobs |
| <kbd>Cmd</kbd> <kbd>Shift</kbd> <kbd>B</kbd> | Branches |
| <kbd>Cmd</kbd> <kbd>Shift</kbd> <kbd>C</kbd> | Copy project URL |
| <kbd>Cmd</kbd> <kbd>Shift</kbd> <kbd>.</kbd> | Copy SSH clone URL |

Each row shows the full namespace path and the last activity date, so near-identical
project names stay distinguishable.

## Development

```sh
npx ray develop   # watch mode, rebuilds and reloads on save
npx ray build     # one-off production build
npx ray lint      # validate the manifest and lint sources
```

`ray build` alone compiles the extension but does not register it with Raycast —
use `ray develop` or **Import Extension** for that the first time.

Requires Raycast 2.x. `@raycast/api` tracks the app version, so keep the dependency
in step with the Raycast you are running.

## Troubleshooting

**"Could not reach GitLab"** — check, in order: the GitLab URL preference has no
typo and includes the scheme; the token has not expired; the token carries
`read_api`. On a corporate network, TLS interception can also break the API call.

**The extension does not appear in Raycast** — `npx ray build` writes files but does
not add it to Raycast's index. Run `npx ray develop`, or use **Import Extension**.

**No results for a project you know exists** — turn off *Only projects I'm a member
of*, or check that your account can see the project at all. Search returns only what
your token's owner is permitted to see.

## License

MIT
