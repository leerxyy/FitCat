try {
  const raw = JSON.parse(localStorage.getItem('ritua.workspace.v1'));
  const preference = raw?.preferences?.theme;
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (raw?.preferences?.reducedMotion) document.documentElement.dataset.motion = 'reduced';
} catch { /* Initial rendering works even without storage. */ }
