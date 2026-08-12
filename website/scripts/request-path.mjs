export function decodeRequestPath(requestUrl) {
  try {
    return decodeURIComponent(requestUrl.split('?')[0])
  } catch {
    return null
  }
}
