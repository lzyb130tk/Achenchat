const EVENT = 'achat:data-changed';

export function notifyDataChanged() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onDataChanged(handler) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
