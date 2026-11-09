export interface ElementOptions {
  readonly className?: string;
  readonly text?: string;
}

/**
 * Creates an element and fills it through DOM methods only: `textContent` for
 * text and `append` for children, so no HTML string is ever parsed.
 */
export const createElement = <Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  options: ElementOptions = {},
  ...children: readonly Node[]
): HTMLElementTagNameMap[Tag] => {
  const element = document.createElement(tag);

  if (options.className !== undefined) {
    element.className = options.className;
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  element.append(...children);

  return element;
};
