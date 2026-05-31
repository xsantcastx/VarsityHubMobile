function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label}_timeout`));
    }, timeoutMs);

    promise.then(
      value => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      error => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export async function runDatabaseHealthcheck(
  query: () => Promise<unknown>,
  timeoutMs = 2000
): Promise<boolean> {
  try {
    await withTimeout(query(), timeoutMs, 'database_health');
    return true;
  } catch {
    return false;
  }
}
