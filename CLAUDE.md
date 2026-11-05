# CLAUDE.md

## Project Overview

**magpie** is a personal inspiration board, a Milanote clone. Images, links and markdown notes on infinite canvases, grouped in columns and nested boards. Static SvelteKit app, local-first (IndexedDB), synced to the user's Google Drive. A small Cloudflare Worker fetches link previews.

- Spec: `docs/spec.md`. Read it before starting a task.
- Design: `design/`. Mockups are `*.dc.html`, shared styles are `magpie.css`. Tokens and decisions are in `Tokens.dc.html`, card states in `Cards.dc.html`, interactions and shortcuts in `Interactions.dc.html`. Match them closely.

Ensure simple clean concise implementation. Do not overcomplicate things. Do not perform unnecessary searches/commands. Do not waste tokens.

## Stack

- Bun for packages and scripts
- SvelteKit + adapter-static, Svelte 5 runes, TypeScript
- Plain CSS. All colors, spacing, radii, shadows and motion come from `app/src/lib/styles/tokens.css`. No Tailwind, no UI or canvas libraries
- Cloudflare Pages (app), Cloudflare Workers (worker)
- Ask before adding any dependency

## Commands

- `bun install` from root
- `bun run dev`, `bun run check`, `bun run build`
- `bun run worker` for the worker in local dev

Run `bun run check` before finishing a task.

## Layout

- `app/` sveltekit app. Logic in `src/lib/`: `canvas/`, `cards/`, `chrome/`, `input/`, `store/`, `styles/`
- `worker/` link preview worker
- `docs/` spec, `design/` mockups

## Rules

- Every board change goes through the commands in `app/src/lib/board.svelte.ts`, so undo/redo covers it
- Local first: write to IndexedDB, then sync. Never block the UI on Drive
- Drive access uses the `drive.file` scope only
- Desktop browser only for now

## Code Style

- Simple, clean, minimal, no overengineering
- No redundant comments, only docstrings above functions (if needed)
- Concise docstrings: lowercase, no full stops
- All lowercase naming, no camelCase, hyphens, or underscores
  - `dropcard` not `drop_card`, `getboard` not `getBoard`
  - applies to filenames too, components included (`imagecard.svelte`)
  - only exception: component imports are capitalized, since Svelte needs it (`import Imagecard from './imagecard.svelte'`)
- Short, human-sounding names, no AI-like variable names
- No redundancies, consistent style throughout
- Minimal diffs, only change what's needed
