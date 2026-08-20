/**
 * Alignment & Reversal Classification Tests
 * Verifies that string reversals, letter transpositions, and directional letter swaps
 * are properly aligned as substitutions and classified as REV (Reversals).
 */
import { describe, it, expect } from 'vitest';
import { alignText } from '../services/alignment';
import { classifyErrors } from '../services/classifier';

describe('Alignment & Orton-Gillingham Reversal Classification', () => {
  it('should align "saw" -> "was" as a substitution and classify as REV', async () => {
    const original = "The boy saw the cat.";
    const spoken = "The boy was the cat.";

    const alignment = alignText(original, spoken);
    const subError = alignment.find(a => a.sourceWord?.toLowerCase() === 'saw');

    expect(subError).toBeTruthy();
    expect(subError?.type).toBe('substitution');
    expect(subError?.spokenWord?.toLowerCase()).toBe('was');

    const classifications = await classifyErrors(alignment);
    const revClass = classifications.find(c => c.sourceWord?.toLowerCase() === 'saw');

    expect(revClass).toBeTruthy();
    expect(revClass?.category).toBe('REV');
  });

  it('should align transposed letter words "from" -> "form" as substitution and classify as REV', async () => {
    const original = "He came from the shop.";
    const spoken = "He came form the shop.";

    const alignment = alignText(original, spoken);
    const subError = alignment.find(a => a.sourceWord?.toLowerCase() === 'from');

    expect(subError).toBeTruthy();
    expect(subError?.type).toBe('substitution');
    expect(subError?.spokenWord?.toLowerCase()).toBe('form');

    const classifications = await classifyErrors(alignment);
    const revClass = classifications.find(c => c.sourceWord?.toLowerCase() === 'from');

    expect(revClass).toBeTruthy();
    expect(revClass?.category).toBe('REV');
  });

  it('should align directional letter swap "big" -> "dig" as substitution and classify as REV', async () => {
    const original = "The big dog ran.";
    const spoken = "The dig dog ran.";

    const alignment = alignText(original, spoken);
    const subError = alignment.find(a => a.sourceWord?.toLowerCase() === 'big');

    expect(subError).toBeTruthy();
    expect(subError?.type).toBe('substitution');
    expect(subError?.spokenWord?.toLowerCase()).toBe('dig');

    const classifications = await classifyErrors(alignment);
    const revClass = classifications.find(c => c.sourceWord?.toLowerCase() === 'big');

    expect(revClass).toBeTruthy();
    expect(revClass?.category).toBe('REV');
  });

  it('should handle completely omitted words without misclassifying them', async () => {
    const original = "The big green frog jumped.";
    const spoken = "The big frog jumped.";

    const alignment = alignText(original, spoken);
    const omiError = alignment.find(a => a.sourceWord?.toLowerCase() === 'green');

    expect(omiError).toBeTruthy();
    expect(omiError?.type).toBe('omission');

    const classifications = await classifyErrors(alignment);
    const omiClass = classifications.find(c => c.sourceWord?.toLowerCase() === 'green');

    expect(omiClass).toBeTruthy();
    expect(omiClass?.category).toBe('OMI');
  });
});
