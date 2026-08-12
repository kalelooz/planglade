const root = document.documentElement
const toggle = document.querySelector('[data-theme-toggle]')

function updateToggle() {
  if (!(toggle instanceof HTMLButtonElement)) return
  const dark = root.dataset.theme === 'dark'
  toggle.setAttribute('aria-pressed', String(dark))
  toggle.setAttribute('aria-label', dark ? 'Use light appearance' : 'Use dark appearance')
}

toggle?.addEventListener('click', () => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
  root.dataset.theme = theme
  root.style.colorScheme = theme
  try {
    localStorage.setItem('planglade-site-theme', theme)
  } catch {
    // The selected appearance still applies for this page view.
  }
  updateToggle()
})

document.querySelectorAll('.mobile-menu a').forEach((link) => {
  link.addEventListener('click', () => {
    const menu = link.closest('details')
    if (menu instanceof HTMLDetailsElement) menu.open = false
  })
})

updateToggle()
