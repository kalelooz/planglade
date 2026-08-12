(() => {
  let saved
  try {
    saved = localStorage.getItem('planglade-site-theme')
  } catch {
    saved = null
  }
  const theme = saved === 'light' || saved === 'dark'
    ? saved
    : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
})()
