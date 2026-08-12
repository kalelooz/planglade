import path from 'node:path'

export function decodeRequestPath(requestUrl) {
  try {
    return decodeURIComponent(requestUrl.split('?')[0])
  } catch {
    return null
  }
}

export function resolveRequest(files, requestUrl) {
  const decoded = decodeRequestPath(requestUrl)
  if (decoded === null) return { asset: null, malformed: true, status: 400 }

  const requestKey = `/${decoded.replace(/^\/+/, '')}`
  const candidates = []

  if (path.posix.extname(requestKey) === '') {
    candidates.push(requestKey.endsWith('/') ? `${requestKey}index.html` : `${requestKey}/index.html`)
  }
  candidates.push(requestKey)
  if (requestKey === '/demo' || requestKey.startsWith('/demo/')) {
    candidates.push('/demo/index.html')
  }
  candidates.push('/404.html')

  for (const candidate of new Set(candidates)) {
    const asset = files.get(candidate)
    if (asset) {
      return { asset, malformed: false, status: candidate === '/404.html' ? 404 : 200 }
    }
  }

  return { asset: null, malformed: false, status: 404 }
}
