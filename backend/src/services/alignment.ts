import * as diff from 'diff';

export interface AlignmentResult {
  sourceWord: string | null;
  spokenWord: string | null;
  type: 'match' | 'omission' | 'insertion' | 'substitution';
  index: number;
}

/**
 * Normalizes text for comparison by removing punctuation and converting to lowercase.
 */
function normalizeWord(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:'"]/g, '').trim();
}

function editDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Detects whether two words represent a reversal, letter transposition, or directional swap.
 * Returns true if w1 and w2 are string reversals (was/saw), anagrams/transpositions (from/form),
 * or directional letter swaps (b/d, p/q, m/w, n/u).
 */
function isReversalOrTransposition(w1: string, w2: string): boolean {
  if (!w1 || !w2 || w1.length < 2 || w2.length < 2) return false;

  // 1. Direct string reversal: "was" <-> "saw", "on" <-> "no", "top" <-> "pot", "star" <-> "rats"
  if (w1.split('').reverse().join('') === w2) return true;

  // 2. Letter transposition / anagram: "from" <-> "form", "felt" <-> "flet", "barn" <-> "bran"
  if (Math.abs(w1.length - w2.length) <= 1) {
    const s1 = w1.split('').sort().join('');
    const s2 = w2.split('').sort().join('');
    if (s1 === s2) return true;
  }

  // 3. Directional letter swap: b/d, p/q, m/w, n/u (e.g. "big" <-> "dig", "bad" <-> "dad", "pat" <-> "qat")
  const hasDirectionalChar = /[bdpqmwnu]/.test(w1) || /[bdpqmwnu]/.test(w2);
  if (hasDirectionalChar) {
    const norm1 = w1.replace(/[bdpqmwnu]/g, '_');
    const norm2 = w2.replace(/[bdpqmwnu]/g, '_');
    if (norm1 === norm2) return true;
  }

  return false;
}

/**
 * Needleman-Wunsch Global Word Alignment for Speech Diagnostics
 */
export const alignText = (original: string, spoken: string): AlignmentResult[] => {
  const origWordsRaw = (original || '').split(/\s+/).filter(w => w.length > 0);
  const origNorm = origWordsRaw.map(w => normalizeWord(w));
  
  const spokenWordsRaw = (spoken || '').split(/\s+/).filter(w => w.length > 0);
  const spokenNorm = spokenWordsRaw.map(w => normalizeWord(w));

  const M = origNorm.length;
  const N = spokenNorm.length;

  if (M === 0) {
    return spokenWordsRaw.map((w, idx) => ({
      sourceWord: null,
      spokenWord: w,
      type: 'insertion',
      index: idx,
    }));
  }

  // Cost matrix
  const dp = Array.from({ length: M + 1 }, () => new Array(N + 1).fill(0));
  const MATCH_SCORE = 0;
  const SUB_COST = 0.8;
  const GAP_COST = 1.0;

  for (let i = 0; i <= M; i++) dp[i][0] = i * GAP_COST;
  for (let j = 0; j <= N; j++) dp[0][j] = j * GAP_COST;

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      const w1 = origNorm[i - 1];
      const w2 = spokenNorm[j - 1];

      let matchCost = GAP_COST * 2;
      if (w1 === w2) {
        matchCost = MATCH_SCORE;
      } else {
        const dist = editDistance(w1, w2);
        const maxLen = Math.max(w1.length, w2.length);
        const sim = 1 - dist / Math.max(1, maxLen);
        if (isReversalOrTransposition(w1, w2) || sim >= 0.5 || dist <= 2) {
          matchCost = SUB_COST;
        } else {
          matchCost = GAP_COST * 1.5;
        }
      }

      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + matchCost, // Match or Substitution
        dp[i - 1][j] + GAP_COST,     // Omission
        dp[i][j - 1] + GAP_COST      // Insertion
      );
    }
  }

  // Backtrack optimal alignment path
  let i = M;
  let j = N;
  const alignmentStack: { origIdx: number | null; spokenIdx: number | null; type: 'match' | 'omission' | 'insertion' | 'substitution' }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const w1 = origNorm[i - 1];
      const w2 = spokenNorm[j - 1];

      let matchCost = GAP_COST * 2;
      if (w1 === w2) {
        matchCost = MATCH_SCORE;
      } else {
        const dist = editDistance(w1, w2);
        const maxLen = Math.max(w1.length, w2.length);
        const sim = 1 - dist / Math.max(1, maxLen);
        if (isReversalOrTransposition(w1, w2) || sim >= 0.5 || dist <= 2) matchCost = SUB_COST;
        else matchCost = GAP_COST * 1.5;
      }

      const currentScore = dp[i][j];
      const diagScore = dp[i - 1][j - 1] + matchCost;
      const upScore = dp[i - 1][j] + GAP_COST;

      if (Math.abs(currentScore - diagScore) < 0.001) {
        const isExactMatch = w1 === w2;
        alignmentStack.push({
          origIdx: i - 1,
          spokenIdx: j - 1,
          type: isExactMatch ? 'match' : 'substitution',
        });
        i--;
        j--;
        continue;
      }

      if (Math.abs(currentScore - upScore) < 0.001) {
        alignmentStack.push({
          origIdx: i - 1,
          spokenIdx: null,
          type: 'omission',
        });
        i--;
        continue;
      }

      alignmentStack.push({
        origIdx: null,
        spokenIdx: j - 1,
        type: 'insertion',
      });
      j--;
    } else if (i > 0) {
      alignmentStack.push({
        origIdx: i - 1,
        spokenIdx: null,
        type: 'omission',
      });
      i--;
    } else {
      alignmentStack.push({
        origIdx: null,
        spokenIdx: j - 1,
        type: 'insertion',
      });
      j--;
    }
  }

  alignmentStack.reverse();

  // Map to final AlignmentResult array
  return alignmentStack.map((item) => {
    const origWord = item.origIdx !== null ? origWordsRaw[item.origIdx] : null;
    const spokenWord = item.spokenIdx !== null ? spokenWordsRaw[item.spokenIdx] : null;
    const index = item.origIdx !== null ? item.origIdx : 0;

    return {
      sourceWord: origWord,
      spokenWord,
      type: item.type,
      index,
    };
  });
};
