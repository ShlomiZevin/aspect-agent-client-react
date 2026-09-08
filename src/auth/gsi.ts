/**
 * The one place that touches Google Identity Services.
 *
 * GIS is a hosted global (`window.google.accounts.id`), not a typed package, so
 * the `unknown` cast and the button options live here rather than being spread
 * across every component that wants a Google button.
 */

interface GoogleIdApi {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

function api(): GoogleIdApi | null {
  const g = (window as unknown as {
    google?: { accounts?: { id?: GoogleIdApi } };
  }).google;
  return g?.accounts?.id ?? null;
}

/**
 * Renders Google's own "Continue with Google" button into `parent` and calls
 * `onCredential` with the ID token when the person picks an account.
 *
 * Google's button must be drawn by their script — a hand-rolled one calling
 * their API is against their brand terms and breaks whenever they change the
 * flow. Returns false when the GIS script has not loaded yet, so the caller
 * can keep showing its fallback.
 */
export function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  onCredential: (idToken: string) => void,
  width = 320,
): boolean {
  const id = api();
  if (!id) return false;

  id.initialize({
    client_id: clientId,
    callback: (r) => onCredential(r.credential),
  });
  id.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width,
  });
  return true;
}
