export function extractLeadFromHtml(html, maxLen = 260) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const firstP = tmp.querySelector('p');
  const raw = (firstP?.textContent || tmp.textContent || '').trim();
  if (!raw) return '';
  if (raw.length <= maxLen) return raw;
  // Recortar sin cortar palabra
  const slice = raw.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`;
}
