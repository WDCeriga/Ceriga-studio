export function requestMessage(error: unknown, fallback: string): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message || '') : typeof error === 'string' ? error : '';
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(message)) {
    return 'Unable to reach the server. Check your internet connection and try again.';
  }
  return message || fallback;
}

export function isConnectionError(error: unknown): boolean {
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error),
  );
}
