const registry = new Map();

/**
 * 表示方式を登録する。
 * @param {{ name: string, create: (stage: HTMLElement, options: object) => { render: Function, setPaused: Function } }} renderer
 */
export function registerRenderer(renderer) {
  registry.set(renderer.name, renderer);
}

export function getRenderer(name) {
  const r = registry.get(name);
  if (!r) throw new Error(`未登録の弾幕レンダラ: ${name}`);
  return r;
}
