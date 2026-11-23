export async function catalogRequest(path, options) {
  const response = await fetch(`/api/${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.error || 'Запрос не выполнен. Попробуйте ещё раз.');
    error.status = response.status;
    throw error;
  }
  if (response.status === 200) return response.json();
}
