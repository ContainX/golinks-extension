// Small DOM helpers shared by the popup and the options page.
//
// Everything the extension renders is built as nodes rather than markup: it
// keeps deployment-supplied strings out of any HTML parser, and it is less
// code than the alternative.

type Attributes = Record<string, string | boolean | number | undefined>

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue
    if (name === 'class') node.className = String(value)
    else if (value === true) node.setAttribute(name, '')
    else node.setAttribute(name, String(value))
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

export function text(value: string): Text {
  return document.createTextNode(value)
}

export function clear(node: Element): void {
  node.replaceChildren()
}

const ICON_PATHS = {
  copy: 'M9 3.5h6.5A1.5 1.5 0 0 1 17 5v8M5 7.5h7a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 12 17.5H5A1.5 1.5 0 0 1 3.5 16V9A1.5 1.5 0 0 1 5 7.5Z',
  check: 'M4.5 10.5 8.5 14.5 15.5 6',
  open: 'M11 4h5v5M16 4l-7.5 7.5M14 12v3.5A1.5 1.5 0 0 1 12.5 17h-8A1.5 1.5 0 0 1 3 15.5v-8A1.5 1.5 0 0 1 4.5 6H8',
  gear: 'M10 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM10 2.5l.8 2a6.6 6.6 0 0 1 1.6.66l1.9-.9 1.44 1.44-.9 1.9c.28.5.5 1.04.66 1.6l2 .8v2l-2 .8a6.6 6.6 0 0 1-.66 1.6l.9 1.9-1.44 1.44-1.9-.9c-.5.28-1.04.5-1.6.66l-.8 2h-2l-.8-2a6.6 6.6 0 0 1-1.6-.66l-1.9.9L2.26 15.8l.9-1.9a6.6 6.6 0 0 1-.66-1.6l-2-.8v-2l2-.8c.16-.56.38-1.1.66-1.6l-.9-1.9L3.7 4.26l1.9.9c.5-.28 1.04-.5 1.6-.66l.8-2h2Z',
  arrow: 'M3.5 10h13M12 5.5 16.5 10 12 14.5',
} as const

export type IconName = keyof typeof ICON_PATHS

/** An inline SVG icon. The extension bundles no icon font and loads nothing. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 20 20')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', 'icon')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', ICON_PATHS[name])
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.6')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

/** A button whose label sits next to an icon. */
export function iconButton(
  label: string,
  name: IconName,
  attributes: Attributes = {},
): HTMLButtonElement {
  return el('button', { type: 'button', ...attributes }, [icon(name), el('span', {}, [label])])
}

/** Copy text, then confirm it on the button for a moment. */
export async function copyWithFeedback(button: HTMLButtonElement, value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
  const label = button.querySelector('span')
  const previous = label?.textContent ?? ''
  button.replaceChildren(icon('check'), el('span', {}, ['Copied']))
  window.setTimeout(() => {
    button.replaceChildren(icon('copy'), el('span', {}, [previous]))
  }, 1400)
}
