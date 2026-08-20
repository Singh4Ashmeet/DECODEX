import { query } from '../db';
import { ClassificationResult } from '../services/classifier';
import { AlignmentResult } from '../services/alignment';

/**
 * Saves classification results using a fully parameterized batch INSERT.
 * Each column value is passed as a query parameter ($N) — never interpolated
 * into the SQL string — eliminating SQL injection risk.
 */
export const saveClassifications = async (sessionId: string, classifications: ClassificationResult[]) => {
  if (classifications.length === 0) return;

  // Build parameterized placeholders: ($1,$2,$3,$4,$5,$6), ($7,$8,...), ...
  const values: any[] = [];
  const placeholders = classifications.map((c, i) => {
    const base = i * 6;
    values.push(
      sessionId,
      c.index,
      c.sourceWord ?? '',
      c.spokenWord ?? '',
      c.category,
      c.rationale,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  await query(
    `INSERT INTO error_classifications (session_id, word_index, source_word, spoken_word, category, rationale)
     VALUES ${placeholders.join(', ')}`,
    values,
  );
};

export const updateErrorProfile = async (sessionId: string, studentId: string, alignment: AlignmentResult[], classifications: ClassificationResult[]) => {
  const totalWords = alignment.length;
  const errors = classifications.length;
  const errorRate = totalWords > 0 ? errors / totalWords : 0;

  const counts = { REV: 0, SUB: 0, OMI: 0, INS: 0, BLD: 0, PAC: 0, UNC: 0 };
  classifications.forEach(c => {
    if (counts[c.category] !== undefined) counts[c.category]++;
  });

  await query(`
    INSERT INTO error_profiles (
      student_id, session_id, total_words_read, total_errors, error_rate,
      rev_count, sub_count, omi_count, ins_count, bld_count, pac_count, uncertain_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    studentId, sessionId, totalWords, errors, errorRate,
    counts.REV, counts.SUB, counts.OMI, counts.INS, counts.BLD, counts.PAC, counts.UNC
  ]);
  
  return counts;
};
