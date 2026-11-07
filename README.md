# WildCrane

See the draft. Let agents do the rest.

WildCrane turns what you want done into tasks with previews you review before anything is built, then has your coding agent deliver them. See [wildcrane.ai](https://wildcrane.ai) for the product and [documentation](https://wildcrane.ai/docs) for setup and usage.

## What's in this repository

This repository holds the parts of WildCrane that run on your computer:

| Folder | What it is |
| --- | --- |
| `cli/` | `akb`, the command-line tool (npm package `wildcrane`) |
| `runner/` | The Runner that runs tasks on your computer (npm package `wildcrane-runner`) |
| `plugins/` | The WildCrane plugin for Claude Code |
| `artifact-sdk/` | The SDK for previews (npm package `wildcrane-artifact-sdk`) |
| `official/` | Built-in workflows and preview agents |

WildCrane Cloud and the web app at [app.wildcrane.ai](https://app.wildcrane.ai) are closed source and not in this repository. Everything here talks to it only over its public API.

Your code stays on your computer: the Runner works in your own repository, and Cloud never stores your code, branches or model keys.

## Install

Claude Code:

```sh
claude plugin marketplace add wildcrane-ai/wildcrane
claude plugin install wildcrane@wildcrane
```

The standalone CLI:

```sh
npm install -g wildcrane@latest
```

## Contributing

Issues and pull requests are welcome. This repository is synced from our main repository, so a maintainer applies an accepted pull request there, and it appears here with the next sync, credited to you.

## License

[Functional Source License 1.1, ALv2 Future License](LICENSE). Each version becomes available under the Apache License 2.0 two years after its release; see [NOTICE](NOTICE).
