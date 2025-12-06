# Wheel of Death

A fun randomizer wheel app to pick participants! Spin the wheel to decide who goes next.

**Live at: [wheelofdeath.rip](https://wheelofdeath.rip)**

## Features

- **Spin the Wheel** - Click, tap, or swipe to spin and randomly select a participant
- **Two Modes** - Fun mode with confetti or Death mode with blood splats and spooky sounds
- **Timer** - Optional countdown timer after each selection
- **Fast Spin** - Quick spin option for faster selections
- **Sound Effects** - 20+ unique celebration/scary sounds
- **Persistent Wheels** - Save and share wheels via unique URLs
- **Mobile Support** - Touch/swipe to spin, responsive design
- **Custom Colors** - Set individual colors for each participant

## Tech Stack

- **Framework**: [SvelteKit](https://svelte.dev) with Svelte 5 (runes)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4
- **Language**: TypeScript
- **Hosting**: [Cloudflare Pages](https://pages.cloudflare.com)
- **Storage**: [Cloudflare KV](https://developers.cloudflare.com/kv) for wheel persistence

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

Deploy to Cloudflare Pages:

```bash
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=wheelofdeath
```

## Environment

Requires Cloudflare KV namespace `WHEELS` for storing wheel configurations. Wheels auto-expire after 60 days of inactivity.

## License

MIT
