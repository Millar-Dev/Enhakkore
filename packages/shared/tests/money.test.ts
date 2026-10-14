import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { departureStatus, formatMoney, money, progressPercent, seatsRemaining, toMajor, toMinor } from '../src';

/**
 * Money and the small calculations the interface shows. Every amount is an
 * integer in the currency's smallest unit, so these conversions and formats
 * are the only place rounding can go wrong.
 */
describe('money', () => {
  test('Tanzanian shillings have no decimal part', () => {
    assert.equal(formatMoney(money(450_000, 'TZS')), 'TZS 450,000');
    assert.equal(formatMoney(money(1_950_000, 'TZS')), 'TZS 1,950,000');
    assert.equal(formatMoney(money(0, 'TZS')), 'TZS 0');
  });

  test('currencies with cents keep both digits', () => {
    assert.equal(formatMoney(money(1_250, 'USD')), '$12.50');
    assert.equal(formatMoney(money(1_200, 'USD')), '$12.00');
    assert.equal(formatMoney(money(99, 'EUR')), '€0.99');
  });

  test('compact figures are for stat tiles', () => {
    assert.equal(formatMoney(money(10_800_000, 'TZS'), { compact: true }), 'TZS 10.8M');
    assert.equal(formatMoney(money(15_000_000, 'TZS'), { compact: true }), 'TZS 15M');
    assert.equal(formatMoney(money(450_000, 'TZS'), { compact: true }), 'TZS 450K');
    // Small amounts stay exact rather than rounding to a meaningless 0K.
    assert.equal(formatMoney(money(5_000, 'TZS'), { compact: true }), 'TZS 5,000');
  });

  test('converting between what people type and what is stored', () => {
    assert.equal(toMinor(450_000, 'TZS'), 450_000, 'shillings are stored as-is');
    assert.equal(toMinor(12.5, 'USD'), 1_250, 'dollars are stored as cents');
    assert.equal(toMajor(1_250, 'USD'), 12.5);
    assert.equal(toMinor(12.345, 'USD'), 1_235, 'rounded, never left as a fraction of a cent');
  });

  test('an unknown currency falls back instead of crashing a page', () => {
    assert.equal(formatMoney(money(1_000, 'XYZ')), 'TZS 1,000');
  });

  test('progress is a whole percentage, clamped to 0–100', () => {
    assert.equal(progressPercent(10_800_000, 15_000_000), 72);
    assert.equal(progressPercent(0, 15_000_000), 0);
    assert.equal(progressPercent(20_000_000, 15_000_000), 100, 'over-funded still reads as 100%');
    assert.equal(progressPercent(-5, 15_000_000), 0);
    assert.equal(progressPercent(5_000, 0), 0, 'a zero goal must not divide by zero');
  });
});

describe('departures', () => {
  test('seats left is never negative', () => {
    assert.equal(seatsRemaining(14, 20), 6);
    assert.equal(seatsRemaining(20, 20), 0);
    assert.equal(seatsRemaining(25, 20), 0, 'an oversold row still shows 0, not -5');
  });

  test('a departure is "almost full" from 80% and "full" at capacity', () => {
    assert.equal(departureStatus(10, 20), 'OPEN');
    assert.equal(departureStatus(15, 20), 'OPEN');
    assert.equal(departureStatus(16, 20), 'ALMOST_FULL');
    assert.equal(departureStatus(19, 20), 'ALMOST_FULL');
    assert.equal(departureStatus(20, 20), 'FULL');
    assert.equal(departureStatus(21, 20), 'FULL');
    assert.equal(departureStatus(0, 0), 'CLOSED', 'a departure with no seats is not bookable');
  });
});
