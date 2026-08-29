import { Fragment, createElement, useMemo, type ReactNode } from 'react'
import { marked, type Token, type Tokens } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

const safeProtocols = new Set(['http:', 'https:', 'mailto:'])
const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

function safeHref(href: string): string | undefined {
  if (!href || href !== href.trim()) return
  for (const character of href) {
    if (character <= '\u0020' || character === '\u007f' || character.trim() === '') return
  }

  try {
    return safeProtocols.has(new URL(href).protocol.toLowerCase()) ? href : undefined
  } catch {
    return
  }
}

function renderTokens(tokens: Token[]): ReactNode[] {
  return tokens.map((token, index) => <Fragment key={index}>{renderToken(token)}</Fragment>)
}

function renderToken(token: Token): ReactNode {
  switch (token.type) {
    case 'space':
    case 'def':
      return null
    case 'heading': {
      const heading = token as Tokens.Heading
      return createElement(headings[heading.depth - 1] ?? 'h6', null, renderTokens(heading.tokens))
    }
    case 'paragraph':
      return <p>{renderTokens((token as Tokens.Paragraph).tokens)}</p>
    case 'text': {
      const text = token as Tokens.Text
      return text.tokens ? renderTokens(text.tokens) : text.text
    }
    case 'escape':
      return (token as Tokens.Escape).text
    case 'strong':
      return <strong>{renderTokens((token as Tokens.Strong).tokens)}</strong>
    case 'em':
      return <em>{renderTokens((token as Tokens.Em).tokens)}</em>
    case 'del':
      return <del>{renderTokens((token as Tokens.Del).tokens)}</del>
    case 'br':
      return <br />
    case 'hr':
      return <hr />
    case 'blockquote':
      return <blockquote>{renderTokens((token as Tokens.Blockquote).tokens)}</blockquote>
    case 'code':
      return <pre><code>{(token as Tokens.Code).text}</code></pre>
    case 'codespan':
      return <code>{(token as Tokens.Codespan).text}</code>
    case 'link': {
      const link = token as Tokens.Link
      const children = renderTokens(link.tokens)
      const href = safeHref(link.href)
      return href ? <a href={href} title={link.title ?? undefined}>{children}</a> : children
    }
    case 'image':
      return (token as Tokens.Image).text
    case 'html':
      return (token as Tokens.HTML).text
    case 'checkbox': {
      const checkbox = token as Tokens.Checkbox
      return <input type="checkbox" checked={checkbox.checked} disabled readOnly aria-label={checkbox.checked ? 'Completed task item' : 'Incomplete task item'} />
    }
    case 'list': {
      const list = token as Tokens.List
      const items = list.items.map((item, index) => <li key={index} className={item.task ? 'md-task-list-item' : undefined}>{renderTokens(item.tokens)}</li>)
      return list.ordered
        ? <ol start={typeof list.start === 'number' ? list.start : undefined}>{items}</ol>
        : <ul>{items}</ul>
    }
    case 'list_item':
      return <li>{renderTokens((token as Tokens.ListItem).tokens)}</li>
    case 'table': {
      const table = token as Tokens.Table
      return (
        <table>
          <thead>
            <tr>{table.header.map((cell, index) => <th key={index} style={{ textAlign: cell.align ?? undefined }}>{renderTokens(cell.tokens)}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ textAlign: cell.align ?? undefined }}>{renderTokens(cell.tokens)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )
    }
    default: {
      const generic = token as Tokens.Generic
      return generic.tokens ? renderTokens(generic.tokens) : generic.raw
    }
  }
}

export function Markdown({ content }: { content: string }) {
  const rendered = useMemo(() => renderTokens(marked.lexer(content || '*Nothing here yet.*')), [content])
  return <div className="md-preview">{rendered}</div>
}
