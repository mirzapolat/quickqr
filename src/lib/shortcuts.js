const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.userAgent)

export const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl'

// ⌘ on Mac, Ctrl elsewhere — and not both, so system shortcuts stay theirs.
export const hasMod = (e) => (IS_MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey

// Shown in the Customize panel; App handles the keys.
export const SHORTCUTS = [
  { keys: [MOD_LABEL, 'C'], label: 'Copy the code' },
  { keys: [MOD_LABEL, 'S'], label: 'Download' },
  { keys: [MOD_LABEL, 'P'], label: 'Print stickers' },
  { keys: [MOD_LABEL, 'O'], label: 'Scan or open an image' },
  { keys: [MOD_LABEL, ','], label: 'Customize' },
  { keys: ['/'], label: 'Focus the input' },
  { keys: ['Esc'], label: 'Close' },
]
