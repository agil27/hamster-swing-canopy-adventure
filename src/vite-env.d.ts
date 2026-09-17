/// <reference types="vite/client" />

// Injected by vite.config.ts's `define` from the single GOOGLE_CLIENT_ID
// env var (see the comment there for why it isn't the usual VITE_-prefixed
// import.meta.env approach) — empty string if unset.
declare const __GOOGLE_CLIENT_ID__: string
