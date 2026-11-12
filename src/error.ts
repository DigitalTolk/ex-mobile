import './styles.css';

// The shell's start page reopens the stored server; with this flag it shows
// the server field instead (see App).
export const RETRY_URL = '/';
export const CHANGE_SERVER_URL = '/?change-server';

interface ErrorPageWindow {
  location: Pick<Location, 'replace'>;
  addEventListener(type: 'online', listener: () => void, options: AddEventListenerOptions): void;
}

// initErrorPage wires the error screen Android shows when a server page fails
// to load: "Try again" and coming back online reopen the server through the
// shell, "Change server" opens the server field so a wrong address is never a
// dead end.
export function initErrorPage(doc: Document, win: ErrorPageWindow): void {
  const retry = () => win.location.replace(RETRY_URL);
  doc.getElementById('retry')?.addEventListener('click', retry);
  doc.getElementById('change-server')?.addEventListener('click', () => win.location.replace(CHANGE_SERVER_URL));
  win.addEventListener('online', retry, { once: true });
}
