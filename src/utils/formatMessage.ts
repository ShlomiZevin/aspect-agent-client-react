/**
 * Format message text with markdown-like syntax
 * Converts **bold**, headers, bullet points, and numbered lists
 */
export function formatMessage(text: string): string {
  // Convert **bold** to <strong>
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert ### headers to <h3>
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');

  // Convert ## headers to <h2>
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');

  // Convert - bullet points to <li>
  const lines = text.split('\n');
  let inList = false;
  const formattedLines: string[] = [];

  lines.forEach(line => {
    const bulletMatch = line.match(/^[\s]*[-•]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) {
        formattedLines.push('<ul>');
        inList = true;
      }
      formattedLines.push(`<li>${bulletMatch[1]}</li>`);
    } else {
      if (inList) {
        formattedLines.push('</ul>');
        inList = false;
      }
      formattedLines.push(line);
    }
  });

  if (inList) {
    formattedLines.push('</ul>');
  }

  text = formattedLines.join('\n');

  // Convert numbered lists
  text = text.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="numbered-item"><span class="number">$1.</span><span>$2</span></div>');

  return text;
}
