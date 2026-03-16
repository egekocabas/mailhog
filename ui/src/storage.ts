const KEYS = {
  smtpPort: 'mailhog.ports.smtp',
  uiPort:   'mailhog.ports.ui',
  zoom:     'mailhog.webui.zoom',
} as const;

function readInt(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function readFloat(key: string, fallback: number, min: number, max: number): number {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? fallback : Math.min(max, Math.max(min, parsed));
}

export const storage = {
  getSmtpPort: ()           => readInt(KEYS.smtpPort, 1025),
  setSmtpPort: (v: number)  => localStorage.setItem(KEYS.smtpPort, String(v)),

  getUiPort:   ()           => readInt(KEYS.uiPort, 8025),
  setUiPort:   (v: number)  => localStorage.setItem(KEYS.uiPort, String(v)),

  getZoom:     ()           => readFloat(KEYS.zoom, 1.0, 0.5, 2.0),
  setZoom:     (v: number)  => localStorage.setItem(KEYS.zoom, String(v)),
};
