# Kitchen Sink Farm

A Progressive Web App for coordinating daily farm chores across multiple team members in real-time. Farm workers can efficiently track and complete daily animal care tasks while staying synchronized even in offline environments with spotty connectivity.

## Features

### For Farm Workers (URL key access)
- View today's chores grouped by time of day (morning, afternoon, evening) and animal category
- Quick toggle to mark chores complete with minimal taps
- Optional photo capture for chore verification
- Real-time sync across all connected devices
- Full offline support with automatic sync when reconnected
- 7-day history view with completion statistics and photos
- Ad-hoc chore creation for one-off tasks

### For Admins (email/password login)
- Master chore list management (create, edit, delete template chores)
- Configure chores by time slot and animal category
- Set photo requirement flags per chore
- Generate and manage shareable URL access keys for workers
- Revoke access keys with usage tracking
- Real-time dashboard showing completion status

## Tech Stack

- **Runtime:** Bun
- **Frontend:** SvelteKit 2 + Svelte 5 with TypeScript
- **Backend:** Convex (real-time serverless database)
- **Authentication:** @convex-dev/auth (email/password for admin, URL keys for workers)
- **PWA:** @vite-pwa/sveltekit with Workbox for offline support
- **Image Processing:** browser-image-compression

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- A Convex account (free at [convex.dev](https://convex.dev))

### Installation

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd kitchen_sink_farm
   ```

2. Install dependencies:
   ```sh
   bun install
   ```

3. Set up Convex:
   ```sh
   bunx convex dev
   ```
   This will prompt you to create a new Convex project or link to an existing one.

4. Start the development server:
   ```sh
   bun run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

### First-Time Setup

1. Navigate to `/admin` and create an account (the first account automatically becomes admin)
2. Create master chores in the admin panel
3. Generate an access key for workers
4. Share the access key URL with your team

## Development

```sh
# Start dev server
bun run dev

# Run type checking
bun run check

# Run linting
bun run lint

# Build for production
bun run build

# Preview production build
bun run preview
```

## How It Works

### Daily Chore Generation
Master chores are templates. Each day, when a user first accesses the app, daily chore instances are automatically created from the active master chores.

### Offline Support
The app uses IndexedDB to queue changes made while offline. When connectivity is restored, changes sync automatically using client-generated IDs for idempotent operations.

### Real-Time Sync
Convex subscriptions push updates to all connected clients instantly. Multiple people can work simultaneously without duplicating effort.

### Photo Verification
Chores can require photo proof of completion. Photos are compressed client-side before upload to Convex storage.

## Project Structure

```
src/
├── lib/
│   ├── auth/           # Authentication logic
│   ├── components/     # Reusable Svelte components
│   ├── stores/         # Svelte stores for state management
│   └── utils/          # Utility functions
├── routes/
│   ├── (app)/          # Main app routes (worker view)
│   └── admin/          # Admin routes
└── convex/             # Convex backend (schema, functions, auth)
```

## License

MIT
