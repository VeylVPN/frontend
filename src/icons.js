const s = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const icons = {
  main: s('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>'),
  devices: s('<rect x="3" y="5" width="13" height="10" rx="2"/><path d="M7 19h5"/><rect x="18" y="8" width="3" height="9" rx="1"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  chevron: s('<path d="m9 6 6 6-6 6"/>', 'width="18" height="18"'),
  down: s('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>', 'width="12" height="12" stroke-width="2.6"'),
  bolt: s('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', 'width="12" height="12" stroke-width="2.4"'),
  min: s('<path d="M5 12h14"/>', 'width="16" height="16"'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>', 'width="16" height="16"'),
};
