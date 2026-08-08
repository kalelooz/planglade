export function projectSlugFromName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}

export function isValidProjectSlug(slug: string) {
  return /^[a-z0-9-]{2,50}$/.test(slug)
}
