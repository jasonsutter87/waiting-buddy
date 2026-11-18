# waiting-buddy

A little buddy that keeps you company above the prompt in Claude Code while Claude's background tasks run.

```
 o                 \|/
/|-   =            [_]
/ \ ............... |
explorer test · 3m 12s · aces 4
```

- **Disc golf** (the default): he aims, throws, and the disc arcs down the fairway into the chains. Two in three are aces, and the ace count runs along the bottom.
- **Woodcutter**: he chops a tree down a branch at a time, stacks the log, and the tree grows back.

Under the scene: what's running (a backgrounded command or agent) and for how long, with a count when there's more than one. When a task finishes he cheers with how long it took. When nothing is running, the band goes away.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install waiting-buddy --marketplace jasonsutter87/waiting-buddy
```

Answer `y` to add the marketplace, then pick a scope (user is the usual one). From a shell:

```
claude plugin install waiting-buddy --marketplace jasonsutter87/waiting-buddy
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `jasonsutter87/waiting-buddy`, then Add plugin.

## Use

It plays by itself whenever Claude starts a background task. Switch scenes with:

```
/scene disc
/scene wood
```

## How it works

A Claude Code mod (a hooks module): it notices a `Bash` or `Agent` call run in the background, keeps it on a small board with its start time, draws the scene in the band above the prompt on a 250 ms clock while anything is on the board, and takes it off when the task's notification comes in.

## License

MIT
