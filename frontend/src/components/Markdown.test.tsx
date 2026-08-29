import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '@/components/Markdown'

const render = (content: string) => renderToStaticMarkup(<Markdown content={content} />)

describe('Markdown', () => {
  it('retains the supported inert Markdown elements', () => {
    const html = render(`# Heading

Paragraph with **bold**, *emphasis*, ~~deleted~~, \`inline code\`, and [a link](https://example.test/path).

- [x] Checked
- Item

1. First
2. Second

> Quote

\`\`\`ts
const safe = true
\`\`\`

| Name | Value |
| --- | ---: |
| safe | yes |

---`)

    for (const element of ['h1', 'p', 'strong', 'em', 'del', 'code', 'a', 'ul', 'ol', 'blockquote', 'pre', 'table', 'hr']) {
      expect(html).toContain(`<${element}`)
    }
    expect(html).toContain('href="https://example.test/path"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-label="Completed task item"')
    expect(html).toContain('class="md-task-list-item"')
    expect(html).not.toContain('aria-hidden="true"')
  })

  it('renders raw active HTML as text instead of browser elements', () => {
    const payloads = {
      script: '<script>globalThis.pwned = true</script>',
      svg: '<svg><script>globalThis.pwned = true</script><a href="javascript:alert(1)">x</a></svg>',
      mathml: '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
      eventHandler: '<img src=x onerror="alert(1)">',
      iframe: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      object: '<object data="data:text/html,<script>alert(1)</script>"></object>',
      embeddedContent: '<embed src="data:text/html,<script>alert(1)</script>">',
      cssUrl: '<style>body{background:url(javascript:alert(1))}</style><div style="background:url(data:text/html,x)">x</div>',
      malformedNesting: '<table><svg><style><img src=x onerror=alert(1)></table>',
    }

    for (const [name, payload] of Object.entries(payloads)) {
      const html = render(payload)
      expect(html, name).not.toMatch(/<(?:script|svg|math|img|iframe|object|embed|style|table)(?:\s|>)/i)
      expect(html.match(/<div(?:\s|>)/gi), name).toHaveLength(1)
      expect(html, name).toContain('&lt;')
    }
  })

  it('keeps only deliberately supported link protocols clickable', () => {
    const safe = render('[HTTPS](HTTPS://example.test/path) [mail](mailto:person@example.test)')
    expect(safe).toContain('href="HTTPS://example.test/path"')
    expect(safe).toContain('href="mailto:person@example.test"')

    const unsafeDestinations = [
      'JaVaScRiPt:alert(1)',
      'javascript&#58;alert(1)',
      'javascript%3Aalert(1)',
      'java%73cript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,alert(1)',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'https://[invalid',
    ]

    for (const destination of unsafeDestinations) {
      const html = render(`[unsafe](${destination})`)
      expect(html, destination).not.toContain('href=')
      expect(html, destination).toContain('unsafe')
    }
  })

  it('renders empty content with the existing placeholder', () => {
    expect(render('')).toContain('Nothing here yet.</em>')
  })
})
