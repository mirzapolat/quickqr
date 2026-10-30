// Registers the service worker that makes the app work offline. Production
// only: in dev, a worker would serve stale modules over Vite's HMR.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
