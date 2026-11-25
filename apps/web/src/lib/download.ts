import { API_URL, getToken } from './api';

/** Downloads a CSV from the API with the session token (a plain link would not carry it). */
export async function downloadCsv(path: string, filename: string) {
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!response.ok) throw new Error('Export failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
