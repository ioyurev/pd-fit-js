export function encodeState(state: any): string {
  const json = JSON.stringify(state);
  // Use btoa with encodeURIComponent for better Unicode support
  return btoa(encodeURIComponent(json));
}

export function decodeState(base64: string): any {
  try {
    const json = decodeURIComponent(atob(base64));
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to decode state from URL', e);
    return null;
  }
}

export function syncToURL(state: any) {
  const encoded = encodeState(state);
  const url = new URL(window.location.href);
  url.searchParams.set('state', encoded);
  window.history.replaceState(null, '', url.toString());
}

export function loadFromURL(): any {
  const params = new URLSearchParams(window.location.search);
  const stateStr = params.get('state');
  if (stateStr) {
    return decodeState(stateStr);
  }
  return null;
}
