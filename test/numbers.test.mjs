// Unit tests for the numeral spell-out module (pure, US-English convention).
import test from 'node:test';
import assert from 'node:assert/strict';
import { numberToWords, fractionToCommaDecimal, NUMBER_RE } from '../public/src/numbers.js';

test('cardinals', () => {
  assert.equal(numberToWords('0'), 'zero');
  assert.equal(numberToWords('7'), 'seven');
  assert.equal(numberToWords('300'), 'three hundred');
  assert.equal(numberToWords('1,000'), 'one thousand');
  assert.equal(numberToWords('1000000'), 'one million');
  assert.equal(numberToWords('305'), 'three hundred five'); // US: no "and"
});

test('decimals and leading zeros', () => {
  assert.equal(numberToWords('3.14'), 'three point one four');
  assert.equal(numberToWords('0.5'), 'zero point five');
  assert.equal(numberToWords('007'), 'zero zero seven');
});

test('negatives', () => {
  assert.equal(numberToWords('-5'), 'minus five');
});

test('years (1100–2099 heuristic)', () => {
  assert.equal(numberToWords('1999'), 'nineteen ninety nine');
  assert.equal(numberToWords('1905'), 'nineteen oh five');
  assert.equal(numberToWords('1900'), 'nineteen hundred');
  assert.equal(numberToWords('2000'), 'two thousand');
  assert.equal(numberToWords('2005'), 'two thousand five');
  assert.equal(numberToWords('2019'), 'twenty nineteen');
  assert.equal(numberToWords('1000'), 'one thousand'); // below 1100 = not a year
  assert.equal(numberToWords('2100'), 'two thousand one hundred'); // above 2099 = not a year
});

test('ordinals', () => {
  assert.equal(numberToWords('1st'), 'first');
  assert.equal(numberToWords('2nd'), 'second');
  assert.equal(numberToWords('3rd'), 'third');
  assert.equal(numberToWords('21st'), 'twenty first');
  assert.equal(numberToWords('100th'), 'one hundredth');
});

test('currency', () => {
  assert.equal(numberToWords('$300'), 'three hundred dollars');
  assert.equal(numberToWords('$1'), 'one dollar');
  assert.equal(numberToWords('$3.50'), 'three dollars and fifty cents');
  assert.equal(numberToWords('$0.99'), 'ninety nine cents');
  assert.equal(numberToWords('£5'), 'five pounds');
});

test('percent', () => {
  assert.equal(numberToWords('50%'), 'fifty percent');
  assert.equal(numberToWords('3.5%'), 'three point five percent');
});

test('fractions (idiomatic)', () => {
  assert.equal(numberToWords('1/2'), 'one half');
  assert.equal(numberToWords('3/4'), 'three quarters');
  assert.equal(numberToWords('2/3'), 'two thirds');
  assert.equal(numberToWords('22/7'), 'twenty two sevenths');
  assert.equal(numberToWords('1/100'), 'one hundredth');
  assert.equal(numberToWords('4/1'), 'four');
  assert.equal(numberToWords('1/0'), '1/0'); // degenerate: original text
  assert.equal(numberToWords('1/21'), 'one twenty first'); // compound denominator
  assert.equal(numberToWords('3/100'), 'three hundredths'); // round denominator, plural
});

test('fractionToCommaDecimal', () => {
  assert.equal(fractionToCommaDecimal('1/2'), '0,5');
  assert.equal(fractionToCommaDecimal('22/7'), '3,142857');
  assert.equal(fractionToCommaDecimal('300'), null);
  assert.equal(fractionToCommaDecimal('1/0'), null);
});

test('NUMBER_RE matches cores, not signs or hyphens', () => {
  for (const s of ['300', '1,000', '3.14', '1/2', '1st', '50%', '$300', '1.000,50']) {
    assert.ok(NUMBER_RE.test(s), `should match ${s}`);
  }
  for (const s of ['abc', '3-5', '-5', '']) {
    assert.ok(!NUMBER_RE.test(s), `should not match ${s}`);
  }
});
