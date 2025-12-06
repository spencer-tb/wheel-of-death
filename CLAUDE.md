# CLAUDE.md

This file provides context for Claude Code when working on this project.

## Project Overview

Wheel of Death is a randomizer wheel web app built with SvelteKit, Svelte 5, Tailwind CSS v4, and TypeScript. It's deployed on Cloudflare Pages with KV storage for persistence.

## Key Architecture

### Frontend (`src/routes/+page.svelte`)
- Main page component with all UI state management
- Uses Svelte 5 runes (`$state`, `$props`, `$derived`, `$effect`)
- Manual save flow (Save button triggers API call)
- Two visual modes: Fun (light) and Death (dark)

### Components (`src/lib/components/`)
- `Wheel.svelte` - Canvas-based wheel with spin animation, touch/swipe support, sound effects
- `Timer.svelte` - Countdown timer shown after selection
- `ParticipantList.svelte` - Manage participants with add/edit/remove/toggle

### API Routes (`src/routes/api/`)
- `POST /api/wheel` - Create or update a wheel configuration
- `GET /api/wheel/[id]` - Get wheel by ID
- `GET/POST /api/spins` - Global spin counter

### Storage
- Cloudflare KV namespace `WHEELS` stores wheel configs as JSON
- 60-day TTL, refreshed on each access
- Wheel IDs are 8-character alphanumeric strings

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=wheelofdeath  # Deploy
```

## Code Patterns

- State initialization from server data uses `$state()` with fallback defaults
- Touch events check if touch started in center 70% of wheel to prevent accidental triggers
- Audio context initialized on first user interaction (required for iOS)
- Effects (confetti/blood splats) use DOM manipulation with cleanup timers

## Important Notes

- The project uses Svelte 5 syntax (not Svelte 4)
- Tailwind v4 uses `@import "tailwindcss"` not `@tailwind` directives
- Cloudflare adapter requires `platform.env.WHEELS` for KV access
- New Wheel link uses `data-sveltekit-reload` for full page refresh

## Git Commits

- Do NOT add Claude as a co-author on commits
- Keep commit messages concise and descriptive
