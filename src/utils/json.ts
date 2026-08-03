export function formatJson(value: string): string {
  return JSON.stringify(JSON.parse(value), null, 2)
}

const JSON_TOKEN =
  /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

export function highlightJson(value: string): string {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped.replace(JSON_TOKEN, (match) => {
    let className = 'text-amber-600 dark:text-amber-400'
    if (match.startsWith('"')) {
      className = match.endsWith(':') ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400'
    } else if (match === 'true' || match === 'false') {
      className = 'text-purple-600 dark:text-purple-400'
    } else if (match === 'null') {
      className = 'text-gray-500 dark:text-gray-400'
    }
    return `<span class="${className}">${match}</span>`
  })
}
