const KEY = 'achat.pending-prompt';

export function setPendingPrompt(value) {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // Prompt prefilling is optional when session storage is unavailable.
  }
}

export function takePendingPrompt() {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value || '';
  } catch {
    return '';
  }
}
