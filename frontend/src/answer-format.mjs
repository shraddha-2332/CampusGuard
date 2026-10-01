export function formatAnswer(text, next = '') {
  let body = String(text || '').trim();
  const followUp = String(next || '').trim();
  // Remove only an exact duplicated suffix, never an arbitrary occurrence in evidence.
  if (followUp && body.endsWith(`Next: ${followUp}`)) {
    body = body.slice(0, -(`Next: ${followUp}`.length)).trim();
  }
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  return paragraphs.map((paragraph) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => /^(?:[-*\u2022]|\d+[.)])\s+/.test(line))) {
      return { type: 'list', items: lines.map((line) => line.replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '')) };
    }
    const sentences = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(paragraph)].map((item) => item.segment.trim())
      : [paragraph];
    return sentences.length >= 3 && paragraph.length > 280
      ? { type: 'list', items: sentences }
      : { type: 'paragraph', text: paragraph };
  });
}
