// Iconos SVG propios (sustituyen a los emojis en la interfaz).
// Todos usan viewBox 0 0 24 24 y el color actual (currentColor).

const P = {
  // ── Interfaz ──
  close: '<path d="M6.4 4.9 12 10.6l5.6-5.7 1.5 1.5-5.7 5.6 5.7 5.6-1.5 1.5-5.6-5.7-5.6 5.7-1.5-1.5 5.7-5.6-5.7-5.6z"/>',
  info: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1.3 8v8h2.6v-8Zm1.3-4.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z"/>',
  gear: '<path d="M10.3 2h3.4l.5 2.6c.7.2 1.3.5 1.9.9l2.3-1.4 2.4 2.4-1.4 2.3c.4.6.7 1.2.9 1.9l2.6.5v3.4l-2.6.5c-.2.7-.5 1.3-.9 1.9l1.4 2.3-2.4 2.4-2.3-1.4c-.6.4-1.2.7-1.9.9l-.5 2.6h-3.4l-.5-2.6c-.7-.2-1.3-.5-1.9-.9l-2.3 1.4-2.4-2.4 1.4-2.3c-.4-.6-.7-1.2-.9-1.9L2 13.7v-3.4l2.6-.5c.2-.7.5-1.3.9-1.9L4.1 5.6l2.4-2.4 2.3 1.4c.6-.4 1.2-.7 1.9-.9ZM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>',
  music: '<path d="M9 3h12v12.5a3.5 3.5 0 1 1-2-3.2V7h-8v10.5A3.5 3.5 0 1 1 9 14.3Z"/>',
  coin: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/>',
  up: '<path d="M12 3 4 12h5v9h6v-9h5z"/>',
  refresh: '<path d="M12 4a8 8 0 0 1 7.4 5H22l-3.5 5L15 9h2.2A5.5 5.5 0 0 0 6.6 10.4L4.2 9.6A8 8 0 0 1 12 4Zm-7.5 6L8 15H5.8a5.5 5.5 0 0 0 10.6 1.4l2.4.8A8 8 0 0 1 4.6 15H2z"/>',
  lock: '<path d="M7 10V8a5 5 0 0 1 10 0v2h1.5A1.5 1.5 0 0 1 20 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10Zm2.6 0h4.8V8a2.4 2.4 0 0 0-4.8 0Z"/>',
  unlock: '<path d="M9.6 10H18.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10H7V8a5 5 0 0 1 9.6-2l-2.4 1a2.4 2.4 0 0 0-4.6 1Z"/>',
  check: '<path d="M9.5 16.2 5 11.7l-2.1 2.1 6.6 6.6L21.1 8.8 19 6.7z"/>',
  wand: '<path d="m3 19 11-11 2 2-11 11zM17 2l1 2.5L20.5 5 18 6l-1 2.5L16 6l-2.5-1L16 4zM21 9l.6 1.4L23 11l-1.4.6L21 13l-.6-1.4L19 11l1.4-.6z"/>',
  book: '<path d="M5 3h11a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1Zm2 14a1 1 0 0 0 0 2h10v-2Z"/><circle cx="11.5" cy="9.5" r="3" fill="rgba(255,255,255,.35)"/>',
  smile: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-3.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM7 14a5 5 0 0 0 10 0Z"/>',
  soundOn: '<path d="M3 9h4l5-4v14l-5-4H3zM15 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zm2.8-2.8a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z"/>',
  soundOff: '<path d="M3 9h4l5-4v14l-5-4H3zm12.3.3 1.4-1.4 2.3 2.3 2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"/>',
  chat: '<path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>',
  eye: '<path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  heart: '<path d="M12 21 3.5 12.6A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 8.5 6.6z"/>',
  star: '<path d="m12 2 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8l-6.3 3.6 1.5-7.1L1.8 9.4 9 8.6z"/>',
  sparkle: '<path d="M12 1.5 14.2 9.8 22.5 12l-8.3 2.2L12 22.5l-2.2-8.3L1.5 12l8.3-2.2z"/>',
  flag: '<path d="M5 2h2v20H5zm3 1h12l-3 4.5 3 4.5H8z"/>',
  trophy: '<path d="M6 3h12v2h3v3a4 4 0 0 1-4 4 6 6 0 0 1-4 3v3h4v3H7v-3h4v-3a6 6 0 0 1-4-3 4 4 0 0 1-4-4V5h3zm-1 4v1a2 2 0 0 0 1.3 1.9A7 7 0 0 1 6 8V7zm13 0v1a7 7 0 0 1-.3 1.9A2 2 0 0 0 19 8V7z"/>',
  skull: '<path d="M12 2a9 9 0 0 1 9 9c0 3-1.6 5.3-4 6.6V21h-2v-2h-2v2h-2v-2H9v2H7v-3.4A7.6 7.6 0 0 1 3 11a9 9 0 0 1 9-9Zm-3.5 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
  bot: '<path d="M11 2h2v3h4a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h4Zm-2.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM9 16v1.5h6V16z"/>',
  plug: '<path d="M8 2h2v5h4V2h2v5h2v4a6 6 0 0 1-5 5.9V22h-2v-5.1A6 6 0 0 1 6 11V7h2z"/>',
  ball: '<path d="M12 2a10 10 0 0 1 10 9h-6.2a4 4 0 0 0-7.6 0H2a10 10 0 0 1 10-9Z"/><path d="M2 13h6.2a4 4 0 0 0 7.6 0H22a10 10 0 0 1-20 0Z" opacity=".55"/><circle cx="12" cy="12" r="2.2"/>',
  bag: '<path d="M8 7V6a4 4 0 0 1 8 0v1h3l1 15H4L5 7Zm2 0h4V6a2 2 0 0 0-4 0Z"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11Zm4 2.5A1.5 1.5 0 1 0 7 8.5a1.5 1.5 0 0 0 0-3Z"/>',
  gift: '<path d="M3 8h18v4H3zm1 5h7v8H4zm9 0h7v8h-7zM12 8C10 4 6 3 6 6s6 2 6 2Zm0 0c2-4 6-5 6-2s-6 2-6 2Z"/>',
  news: '<path d="M3 4h15v15a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2Zm3 3v4h9V7Zm0 6v1.5h9V13Zm0 3v1.5h9V16Zm14-9h2v12a2 2 0 0 1-2 2 2 2 0 0 1-2-2V7Z"/>',
  candy: '<path d="M8.5 8.5a5 5 0 0 1 7 7 5 5 0 0 1-7-7ZM7 7 3 5l1 4zm10 10 4 2-1-4zM7.2 17.2 5 21l4-1zm9.6-10.4L19 3l-4 1z"/>',
  target: '<path d="M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1Zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/>',
  walk: '<path d="M13.5 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM10 7h4l3 4h3v2h-4l-1.4-1.9L13 14l3 3v5h-2v-4l-3.3-2.7L9 22H7l2.3-9.2L8 13v3H6v-4z"/>',
  // ── Tipos de ronda ──
  swords: '<path d="M3 2h3.5l8 8-2.5 2.5-8-8zm18 0h-3.5l-5.5 5.5 2.5 2.5L20 4.5ZM5.5 14l2 2-2.8 2.8 1.4 1.4L4.7 21.6 2.4 19.3l1.4-1.4 1.4 1.4L8 16.4zm13 0L16 16.4l2.8 2.8 1.4-1.4 1.4 1.4-2.3 2.3-1.4-1.4 1.4-1.4-2.8-2.8L18.5 14ZM14.5 11 17 13.5 9 21.5 6.5 19Z"/>',
  paw: '<path d="M12 11c3 0 6 4 6 7 0 2-2 3-3.5 2.5S13 20 12 20s-1.5.5-2.5.5S6 20 6 18c0-3 3-7 6-7ZM6 6.5a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5Zm12 0a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5ZM9.3 2a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5Zm5.4 0a2 2.5 0 1 1 0 5 2 2.5 0 0 1 0-5Z"/>',
  stadium: '<path d="M2 20V9l10-6 10 6v11h-7v-6H9v6ZM12 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/>',
  crown: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5Zm2 13h14v2H5z"/>',
  raid: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 4.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>',
  // ── Tipos ──
  normal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5" fill="rgba(0,0,0,.3)"/>',
  fuego: '<path d="M12 22a7 7 0 0 1-7-7c0-4 3-6 4-10 1.5 1.5 2 3 2 4.5C13 7 14 4 14 2c3 3 5 7 5 12a7 7 0 0 1-7 8Zm0-2a3 3 0 0 0 3-3c0-2-1.5-3-2-5-.5 1.5-1.5 2-2.3 3.2A3 3 0 0 0 12 20Z"/>',
  agua: '<path d="M12 2s7 7.5 7 12.5a7 7 0 0 1-14 0C5 9.5 12 2 12 2Zm-3 12.5c0 1.8 1.3 3.5 3 3.5v-2c-.6 0-1-.7-1-1.5Z"/>',
  planta: '<path d="M20 3S9 2 5.5 9.5C3.7 13.3 5 17 5 17l-2 4 1.8.9 2-4C8.5 18.8 13 19.5 16.5 16 21 11.5 20 3 20 3ZM8 16.5c1.5-4 5-7.5 9-9.5-3 3-6 6-8 10.3Z"/>',
  electrico: '<path d="M14 2 4 14h6l-2 8 10-12h-6z"/>',
  hielo: '<path d="M11 2h2v4l2.3-1.6 1.1 1.7L13 8.4v2.3l2-1.2 1-3.7 2 .5-.6 2.2 3.4-2 1 1.8-3.4 2 2.2.6-.5 2-3.8-1-2 1.1 2 1.2 3.8-1 .5 2-2.2.6 3.4 2-1 1.7-3.4-2 .6 2.3-2 .5-1-3.8-2-1.2v2.3l3.4 2.3-1.1 1.7L13 18v4h-2v-4l-2.3 1.6-1.1-1.7L11 15.6v-2.3l-2 1.2-1 3.8-2-.5.6-2.3-3.4 2-1-1.8 3.4-2-2.2-.6.5-2 3.8 1 2-1.2-2-1.1-3.8 1-.5-2 2.2-.6-3.4-2 1-1.8 3.4 2L6 6.5l2-.5 1 3.7 2 1.2V8.4L7.6 6.1l1.1-1.7L11 6z"/>',
  lucha: '<path d="M7 9V6.5a1.5 1.5 0 0 1 3 0V5a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v6a8 8 0 0 1-3 6v3H8v-3a6 6 0 0 1-3-5v-2.5A2.5 2.5 0 0 1 7 9Z"/>',
  tierra: '<path d="M2 20 9 7l4 6 2-3 7 10Zm7-9-2 4h3Z"/>',
  volador: '<path d="M21 3c-6 0-11 2-14 6-2 2.7-3 6-3 9l-2 3 1.5 1L6 18.5c3 0 6.5-1 9-3.5L10 15l6-3-4 0 6-4-4 .5C17 6 19.5 4 21 3Z"/>',
  psiquico: '<path d="M12 4a9 9 0 0 1 9 8 9 9 0 0 1-18 0 9 9 0 0 1 9-8Zm0 3a5 5 0 0 0-5 5c0 2 1.5 3.5 3.3 3.5 1.5 0 2.7-1.2 2.7-2.7 0-1.2-1-2.1-2-2.1-.8 0-1.4.6-1.4 1.3h1.6a3.3 3.3 0 0 1-2.2-1.6A3.5 3.5 0 0 1 12 9a3.5 3.5 0 0 1 3.5 3.5 5 5 0 0 1-1 3 5 5 0 0 0 2.5-4.5A5 5 0 0 0 12 7Z"/>',
  roca: '<path d="m8 3 8 1 5 7-2 9H6l-4-7Zm1 3-3 6 2.5 4 3-6Z"/>',
  fantasma: '<path d="M12 2a8 8 0 0 1 8 8v12l-2.7-2-2.6 2-2.7-2-2.7 2-2.6-2L4 22V10a8 8 0 0 1 8-8Zm-3 7a1.5 2 0 1 0 0 4 1.5 2 0 0 0 0-4Zm6 0a1.5 2 0 1 0 0 4 1.5 2 0 0 0 0-4Z"/>',
  dragon: '<path d="M4 3c3 1 5 3 6 6l3-5 1.5 5.5L20 7l-2 6 4 1-5 2 1 5-5-3-4 4v-6l-6-1 5-3C6 10 4.5 7 4 3Z"/>',
  siniestro: '<path d="M14.5 2A9.5 9.5 0 1 0 22 16.5 8 8 0 0 1 14.5 2Z"/>',
  acero: '<path d="M10.3 2h3.4l.6 2.6 2.3 1 2.3-1.4 2.4 2.4-1.4 2.3 1 2.3 2.6.6v3.4l-2.6.6-1 2.3 1.4 2.3-2.4 2.4-2.3-1.4-2.3 1-.6 2.6h-3.4l-.6-2.6-2.3-1-2.3 1.4-2.4-2.4 1.4-2.3-1-2.3L2 13.7v-3.4l2.6-.6 1-2.3-1.4-2.3 2.4-2.4 2.3 1.4 2.3-1ZM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>',
  hada: '<path d="M12 1.5 14 9l7.5 1-6 4.5 2 7.5L12 17.5 6.5 22l2-7.5-6-4.5L10 9Z" opacity=".35"/><path d="M12 4.5 13.3 10l5.2.8-4.1 3 1.3 5L12 16l-3.7 2.8 1.3-5-4.1-3 5.2-.8Z"/>',
  // ── Roles ──
  defensor: '<path d="M12 2 20 5v6c0 5.5-3.5 9.5-8 11-4.5-1.5-8-5.5-8-11V5Z"/>',
  atacante: '<path d="M20 2 21 3.5 10 16l1.5 1.5-1.4 1.4-1.5-1.5-3 3L3 19.8l3-3-1.5-1.5 1.4-1.4L7.4 15.4 18.5 3Z"/>',
  veloz: '<path d="M4 5h7l6 7-6 7H4l6-7Zm8 0h3l6 7-6 7h-3l6-7Z"/>',
  tirador: '<path d="M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1Zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/>',
  mistico: '<path d="M12 2c1 3 3 4 6 4-2 2-2 4-1 7-3-1-4 0-5 3-1-3-2-4-5-3 1-3 1-5-1-7 3 0 5-1 6-4Zm-7 15 2 1-2 4-2-1Zm14 0 2 4-2 1-2-4Z"/>',
  soporte: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
  // ── Clima ──
  despejado: '<circle cx="9" cy="9" r="4.5"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4" stroke="currentColor" stroke-width="1.6"/><path d="M10 21a4 4 0 0 1 .5-8 5 5 0 0 1 9.4 1.5A3.3 3.3 0 0 1 19.5 21Z" fill="#fff"/>',
  sol: '<circle cx="12" cy="12" r="5.5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="2"/>',
  lluvia: '<path d="M6 15a4.5 4.5 0 0 1 .6-9A6 6 0 0 1 18 7.5 4 4 0 0 1 18 15Z"/><path d="m8 17-1.5 4M12.5 17 11 21M17 17l-1.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  arena: '<path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h16a3 3 0 1 1-3 3M3 16h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  nieve: '<path d="M11 2h2v4l2.3-1.6 1.1 1.7L13 8.4v2.3l2-1.2 1-3.7 2 .5-.6 2.2 3.4-2 1 1.8-3.4 2 2.2.6-.5 2-3.8-1-2 1.1 2 1.2 3.8-1 .5 2-2.2.6 3.4 2-1 1.7-3.4-2 .6 2.3-2 .5-1-3.8-2-1.2v2.3l3.4 2.3-1.1 1.7L13 18v4h-2v-4l-2.3 1.6-1.1-1.7L11 15.6v-2.3l-2 1.2-1 3.8-2-.5.6-2.3-3.4 2-1-1.8 3.4-2-2.2-.6.5-2 3.8 1 2-1.2-2-1.1-3.8 1-.5-2 2.2-.6-3.4-2 1-1.8 3.4 2L6 6.5l2-.5 1 3.7 2 1.2V8.4L7.6 6.1l1.1-1.7L11 6z"/>',
  niebla: '<path d="M3 7h13M6 11h15M3 15h13M7 19h11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  tormenta: '<path d="M6 14a4.5 4.5 0 0 1 .6-9A6 6 0 0 1 18 6.5 4 4 0 0 1 18 14h-3l-3 4h3l-4 5 1-4H9l2-5Z"/>',
  // ── Componentes ──
  i_proteina: '<path d="M2 10h2V7h3v10H4v-3H2Zm20 0h-2V7h-3v10h3v-3h2ZM8 11h8v2H8Z"/>',
  i_calcio: '<path d="M9 2h6v2h-1v5l6 10a2 2 0 0 1-1.7 3H5.7A2 2 0 0 1 4 19L10 9V4H9Zm-1.2 13h8.4l-2.3-4h-3.8Z"/>',
  i_carburante: '<path d="M13 2 5 13h5l-1 9 9-12h-5Z"/>',
  i_hierro: '<path d="M12 2 20 5v6c0 5.5-3.5 9.5-8 11-4.5-1.5-8-5.5-8-11V5Zm0 3.2-5 1.9V11c0 3.8 2.2 6.6 5 7.8Z"/>',
  i_zinc: '<path d="M6 3h12l4 6-10 13L2 9Zm1.2 6h9.6L12 16.5Z"/>',
  i_masps: '<path d="M12 21 3.5 12.6A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 8.5 6.6z"/>',
  i_maspp: '<path d="M12 2s7 7.5 7 12.5a7 7 0 0 1-14 0C5 9.5 12 2 12 2Z"/>',
  i_caramelo: '<path d="M8.5 8.5a5 5 0 0 1 7 7 5 5 0 0 1-7-7ZM7 7 3 5l1 4zm10 10 4 2-1-4zM7.2 17.2 5 21l4-1zm9.6-10.4L19 3l-4 1z"/>',
  i_iman: '<path d="M4 3h6v4H8v5a4 4 0 0 0 8 0V7h-2V3h6v9a8 8 0 0 1-16 0Z"/>',
  // ── Estados ──
  s_sleep: '<path d="M4 4h8v2l-5 6h5v2H4v-2l5-6H4zm10 6h6v1.6L17 15h3v2h-6v-1.6l3-3.4h-3z"/>',
  s_slow: '<path d="M11 3h2v12l4-4 1.4 1.4L12 18.8l-6.4-6.4L7 11l4 4Z"/>',
  s_confuse: '<path d="M12 2a6 6 0 0 1 6 6c0 3-3 4-4 5.5V15h-4v-2c0-2.5 4-3.5 4-5a2 2 0 0 0-4 0H6a6 6 0 0 1 6-6Zm-2 15h4v4h-4z"/>',
};

export function icon(name, cls = '', title = '') {
  const p = P[name];
  if (!p) return '';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${title ? `<title>${title}</title>` : ''}${p}</svg>`;
}

// Icono de un tipo/rol/clima con su color.
export function typeIcon(id, color, cls = '') {
  return `<span class="ti ${cls}" style="--tc:${color}">${icon(id === 'electrico' && cls.includes('w') ? 'tormenta' : id)}</span>`;
}

// Icono de objeto: los componentes tienen su glifo; los completos combinan los dos.
export function itemIcon(item, small = false) {
  if (!item) return '';
  const sz = small ? ' small' : '';
  if (item.component || item.consumable) {
    return `<span class="it${sz}" style="--a:${item.color}">${icon('i_' + item.id)}</span>`;
  }
  const [a, b] = item.from;
  return `<span class="it full${sz}" style="--a:${item.color};--b:${item.color2}"><span class="g1">${icon('i_' + a)}</span><span class="g2">${icon('i_' + b)}</span></span>`;
}

export const WEATHER_ICON = { despejado: 'despejado', sol: 'sol', lluvia: 'lluvia', arena: 'arena', nieve: 'nieve', niebla: 'niebla', electrico: 'tormenta' };
export const WEATHER_COLOR = { despejado: '#ffc93c', sol: '#ffb020', lluvia: '#8fb8ff', arena: '#e0b36a', nieve: '#bfeaff', niebla: '#f3b6e6', electrico: '#ffe14a' };

// Medallas: color + glifo.
export const BADGE_LOOK = {
  amuleto: ['#f5c542', 'coin'], bolsa: ['#e0a030', 'bag'], caramelos: ['#6fb7ff', 'candy'], maletin: ['#b07a4a', 'bag'],
  mochila: ['#58b86b', 'bag'], estudio: ['#5a8ad8', 'book'], descuento: ['#e8574a', 'tag'], ultraball: ['#f0c030', 'ball'],
  iris: ['#c68af0', 'sparkle'], roca: ['#b6a136', 'roca'], cascada: ['#3d9bff', 'agua'], trueno: ['#f7d02c', 'electrico'],
  arcoiris: ['#6cd88a', 'planta'], alma: ['#f95587', 'psiquico'], pantano: ['#e08a3a', 'lucha'], volcan: ['#ff6a2e', 'fuego'],
  tierra: ['#d9a44e', 'tierra'], emblema: ['#ffcb05', 'star'], amistad: ['#ff7aa8', 'heart'], dinamax: ['#e0203a', 'raid'],
};
export const EVENT_ICON = { calma: 'planta', enjambre: 'paw', rebajas: 'tag', caramelos: 'candy', regalo: 'gift', shiny: 'sparkle', entreno: 'up' };
