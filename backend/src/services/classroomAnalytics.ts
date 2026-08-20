import { query } from '../db';
import type { StudentAccessRequester } from './studentAccess';

// ---------------------------------------------------------------------------
// Classroom Analytics Engine
// Aggregates student data for class-level teacher views.
// ---------------------------------------------------------------------------

export interface ClassHeatmapEntry {
  studentId: string;
  studentName: string;
  gradeLevel: number | null;
  rev: number;
  sub: number;
  omi: number;
  ins: number;
  bld: number;
  pac: number;
  totalErrors: number;
  totalWords: number;
  avgWpm: number;
  sessionCount: number;
  healthScore: number | null;
}

export interface ClassWeaknessAnalysis {
  category: string;
  categoryName: string;
  totalOccurrences: number;
  affectedStudents: number;
  percentageOfClass: number;
}

export interface SkillDistribution {
  excellent: number;
  good: number;
  medium: number;
  high: number;
  critical: number;
}

const CATEGORY_NAMES: Record<string, string> = {
  REV: 'Letter Reversals',
  SUB: 'Word Substitutions',
  OMI: 'Word Omissions',
  INS: 'Word Insertions',
  BLD: 'Blend Breakdowns',
  PAC: 'Pacing Issues',
};

function getStudentScopeSql(
  requester: StudentAccessRequester | undefined,
  studentAlias: string,
  startParamIndex: number
): { sql: string; params: unknown[] } {
  if (requester?.role !== 'teacher') {
    return { sql: '', params: [] };
  }

  return {
    sql: `
      AND EXISTS (
        SELECT 1 FROM teacher_student_links tsl
        WHERE tsl.teacher_id = $${startParamIndex}
          AND tsl.student_id = ${studentAlias}.id
      )`,
    params: [requester.id],
  };
}

/**
 * Get a heatmap of error distributions across all students.
 */
export async function getClassHeatmap(requester?: StudentAccessRequester): Promise<ClassHeatmapEntry[]> {
  const scope = getStudentScopeSql(requester, 'u', 1);
  const res = await query(`
    SELECT
      u.id as student_id,
      u.display_name as student_name,
      u.grade_level,
      COALESCE(SUM(ep.rev_count), 0) as rev,
      COALESCE(SUM(ep.sub_count), 0) as sub,
      COALESCE(SUM(ep.omi_count), 0) as omi,
      COALESCE(SUM(ep.ins_count), 0) as ins,
      COALESCE(SUM(ep.bld_count), 0) as bld,
      COALESCE(SUM(ep.pac_count), 0) as pac,
      COALESCE(SUM(ep.total_errors), 0) as total_errors,
      COALESCE(SUM(ep.total_words_read), 0) as total_words,
      COALESCE(AVG(rs.words_per_minute), 0) as avg_wpm,
      COUNT(DISTINCT rs.id) as session_count,
      (SELECT hs.score FROM health_scores hs WHERE hs.student_id = u.id ORDER BY hs.computed_at DESC LIMIT 1) as health_score
    FROM users u
    LEFT JOIN reading_sessions rs ON u.id = rs.student_id AND rs.deleted_at IS NULL AND rs.status = 'completed'
    LEFT JOIN error_profiles ep ON ep.session_id = rs.id
    WHERE u.role = 'student' AND u.deleted_at IS NULL
    ${scope.sql}
    GROUP BY u.id, u.display_name, u.grade_level
    ORDER BY u.display_name ASC
  `, scope.params);

  return res.rows.map((r: any) => ({
    studentId: r.student_id,
    studentName: r.student_name,
    gradeLevel: r.grade_level,
    rev: parseInt(r.rev),
    sub: parseInt(r.sub),
    omi: parseInt(r.omi),
    ins: parseInt(r.ins),
    bld: parseInt(r.bld),
    pac: parseInt(r.pac),
    totalErrors: parseInt(r.total_errors),
    totalWords: parseInt(r.total_words),
    avgWpm: Math.round(parseFloat(r.avg_wpm)),
    sessionCount: parseInt(r.session_count),
    healthScore: r.health_score != null ? parseInt(r.health_score) : null,
  }));
}

/**
 * Analyze class-wide weaknesses (which error types are most prevalent).
 */
export async function getClassWeaknesses(requester?: StudentAccessRequester): Promise<ClassWeaknessAnalysis[]> {
  const scope = getStudentScopeSql(requester, 'u', 1);
  const res = await query(`
    SELECT
      SUM(ep.rev_count) as rev,
      SUM(ep.sub_count) as sub,
      SUM(ep.omi_count) as omi,
      SUM(ep.ins_count) as ins,
      SUM(ep.bld_count) as bld,
      SUM(ep.pac_count) as pac,
      COUNT(DISTINCT ep.student_id) as total_students
    FROM error_profiles ep
    JOIN users u ON u.id = ep.student_id
    WHERE u.role = 'student' AND u.deleted_at IS NULL
    ${scope.sql}
  `, scope.params);

  if (res.rows.length === 0) return [];
  const row = res.rows[0];
  const totalStudents = parseInt(row.total_students) || 1;

  // For each category, count how many distinct students have that error type
  const categories = ['REV', 'SUB', 'OMI', 'INS', 'BLD', 'PAC'];
  const result: ClassWeaknessAnalysis[] = [];

  for (const cat of categories) {
    const colName = cat.toLowerCase() === 'pac' ? 'pac' : cat.toLowerCase();
    const count = parseInt(row[colName] || '0');
    if (count === 0) continue;

    // Count affected students for this category
    const affectedScope = getStudentScopeSql(requester, 'u', 1);
    const affectedRes = await query(
      `SELECT COUNT(DISTINCT student_id) as cnt FROM error_profiles
       JOIN users u ON u.id = error_profiles.student_id
       WHERE ${colName}_count > 0
         AND u.role = 'student'
         AND u.deleted_at IS NULL
       ${affectedScope.sql}`,
      affectedScope.params
    );
    const affected = parseInt(affectedRes.rows[0]?.cnt || '0');

    result.push({
      category: cat,
      categoryName: CATEGORY_NAMES[cat] || cat,
      totalOccurrences: count,
      affectedStudents: affected,
      percentageOfClass: Math.round((affected / totalStudents) * 100),
    });
  }

  return result.sort((a, b) => b.totalOccurrences - a.totalOccurrences);
}

/**
 * Get skill distribution across the class (based on health scores).
 */
export async function getSkillDistribution(requester?: StudentAccessRequester): Promise<SkillDistribution> {
  const scope = getStudentScopeSql(requester, 'u', 1);
  const res = await query(`
    SELECT hs.score
    FROM health_scores hs
    JOIN users u ON u.id = hs.student_id
    INNER JOIN (
      SELECT student_id, MAX(computed_at) as max_date
      FROM health_scores GROUP BY student_id
    ) latest ON hs.student_id = latest.student_id AND hs.computed_at = latest.max_date
    WHERE u.role = 'student' AND u.deleted_at IS NULL
    ${scope.sql}
  `, scope.params);

  const dist: SkillDistribution = { excellent: 0, good: 0, medium: 0, high: 0, critical: 0 };
  for (const row of res.rows) {
    const score = row.score;
    if (score >= 90) dist.excellent++;
    else if (score >= 75) dist.good++;
    else if (score >= 60) dist.medium++;
    else if (score >= 40) dist.high++;
    else dist.critical++;
  }
  return dist;
}
