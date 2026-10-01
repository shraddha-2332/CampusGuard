import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAnswer } from '../src/answer-format.mjs';

test('removes only the repeated next-step suffix', () => {
  assert.deepEqual(formatAnswer('A fee is annual.\n\nNext: Check your category.', 'Check your category.'), [{ type: 'paragraph', text: 'A fee is annual.' }]);
  assert.equal(formatAnswer('Next: A different instruction.', 'Check your category.')[0].text, 'Next: A different instruction.');
});
test('preserves decimal values, abbreviations and qualification text', () => {
  const text = 'B.Tech fees are 17,217 rupees. The historical score was 61.2790648. Eligibility does not guarantee admission. ' + 'The academic year, category, candidature, admission route and applicable official notice must be considered before making a decision. '.repeat(2);
  const blocks = formatAnswer(text);
  assert.equal(blocks[0].type, 'list');
  assert.equal(blocks[0].items.join(' '), text.trim());
});
test('renders explicit lists and preserves short multilingual answers', () => {
  assert.deepEqual(formatAnswer('1. Scorecard\n2. Marksheet'), [{ type: 'list', items: ['Scorecard', 'Marksheet'] }]);
  assert.deepEqual(formatAnswer('प्रवेशाची माहिती येथे उपलब्ध आहे.'), [{ type: 'paragraph', text: 'प्रवेशाची माहिती येथे उपलब्ध आहे.' }]);
});
