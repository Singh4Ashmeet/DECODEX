import { query } from '../db';
import { getLatestHealthScore } from './healthScore';
import { getLatestScreening } from './riskScreening';

// ---------------------------------------------------------------------------
// Decodex Copilot — Flagship Feature
// Generates a comprehensive intervention strategy for a student.
// Includes: summary, key concerns, weekly roadmap, exercises, parent comm draft.
// ---------------------------------------------------------------------------

export interface CopilotStrategy {
  summary: string;
  keyConcerns: string[];
  weeklyRoadmap: WeeklyPlan[];
  recommendedExercises: Exercise[];
  parentCommunicationDraft: string;
  healthScoreAtGeneration: number | null;
  riskLevelAtGeneration: string | null;
}

export interface WeeklyPlan {
  week: number;
  focus: string;
  objectives: string[];
  activities: string[];
}

export interface Exercise {
  name: string;
  category: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
}

// Supported languages for parent communication
export type ParentLanguage = 'en' | 'hi' | string;

// O-G category full names for readable output
const CATEGORY_NAMES: Record<string, string> = {
  REV: 'Letter Reversals',
  SUB: 'Word Substitutions',
  OMI: 'Word Omissions',
  INS: 'Word Insertions',
  BLD: 'Blend Breakdowns',
  PAC: 'Pacing & Self-Correction',
  UNC: 'Uncertain Classifications',
};

// Exercise library organized by error category
const EXERCISE_LIBRARY: Record<string, Exercise[]> = {
  REV: [
    { name: 'Mirror Letter Discrimination', category: 'REV', description: 'Practice distinguishing b/d, p/q using tactile letter cards and directional arrows.', difficulty: 'beginner', estimatedMinutes: 10 },
    { name: 'Reversal Word Sort', category: 'REV', description: 'Sort words containing commonly reversed letters into correct categories.', difficulty: 'intermediate', estimatedMinutes: 15 },
    { name: 'Directional Writing Practice', category: 'REV', description: 'Trace and write letters with directional cues, emphasizing starting points.', difficulty: 'beginner', estimatedMinutes: 10 },
  ],
  SUB: [
    { name: 'Sight Word Flash Cards', category: 'SUB', description: 'Rapid recognition practice with high-frequency words commonly substituted.', difficulty: 'beginner', estimatedMinutes: 10 },
    { name: 'Context Clue Reading', category: 'SUB', description: 'Read sentences with blanks and choose the correct word from visually similar options.', difficulty: 'intermediate', estimatedMinutes: 15 },
    { name: 'Word Family Sorting', category: 'SUB', description: 'Group words by phonetic families to build pattern recognition.', difficulty: 'beginner', estimatedMinutes: 10 },
  ],
  OMI: [
    { name: 'Finger Tracking Reading', category: 'OMI', description: 'Use finger or pointer to track each word while reading aloud, preventing skipping.', difficulty: 'beginner', estimatedMinutes: 15 },
    { name: 'Word Count Verification', category: 'OMI', description: 'Read a sentence then count the words. Compare with the actual count.', difficulty: 'intermediate', estimatedMinutes: 10 },
    { name: 'Chunked Reading', category: 'OMI', description: 'Break passages into 3-word chunks with visual separators for tracking practice.', difficulty: 'beginner', estimatedMinutes: 10 },
  ],
  INS: [
    { name: 'Precise Reading Practice', category: 'INS', description: 'Read passages slowly with emphasis on matching exact text — no additions.', difficulty: 'beginner', estimatedMinutes: 15 },
    { name: 'Record and Compare', category: 'INS', description: 'Record reading, then compare transcript with original to identify insertions.', difficulty: 'intermediate', estimatedMinutes: 15 },
  ],
  BLD: [
    { name: 'Phoneme Blending Ladder', category: 'BLD', description: 'Build words sound by sound: /s/ → /st/ → /sto/ → /stop/.', difficulty: 'beginner', estimatedMinutes: 10 },
    { name: 'Consonant Cluster Cards', category: 'BLD', description: 'Practice reading consonant clusters (bl, cr, str, spl) in isolation then in words.', difficulty: 'intermediate', estimatedMinutes: 15 },
    { name: 'Syllable Segmentation', category: 'BLD', description: 'Clap or tap out syllables in multi-syllable words before reading them whole.', difficulty: 'beginner', estimatedMinutes: 10 },
  ],
  PAC: [
    { name: 'Repeated Reading', category: 'PAC', description: 'Re-read the same short passage 3 times, aiming for smoother delivery each time.', difficulty: 'beginner', estimatedMinutes: 15 },
    { name: 'Echo Reading', category: 'PAC', description: 'Listen to a sentence read aloud, then immediately read it back matching pace and expression.', difficulty: 'intermediate', estimatedMinutes: 15 },
  ],
};

/**
 * Generate a comprehensive intervention strategy for a student.
 */
export async function generateStrategy(
  studentId: string,
  teacherId?: string
): Promise<CopilotStrategy> {
  // 1. Gather student data
  const studentRes = await query(
    `SELECT display_name, grade_level FROM users WHERE id = $1`,
    [studentId]
  );
  const student = studentRes.rows[0];
  const studentName = student?.display_name || 'Student';
  const gradeLevel = student?.grade_level || 3;

  // 2. Get health score and risk screening
  const healthScore = await getLatestHealthScore(studentId);
  const screening = await getLatestScreening(studentId);

  // 3. Aggregate error patterns across all sessions
  const errorRes = await query(
    `SELECT
       SUM(rev_count) as rev, SUM(sub_count) as sub,
       SUM(omi_count) as omi, SUM(ins_count) as ins,
       SUM(bld_count) as bld, SUM(pac_count) as pac,
       SUM(uncertain_count) as unc,
       SUM(total_errors) as total_errors,
       SUM(total_words_read) as total_words,
       COUNT(*) as session_count
     FROM error_profiles WHERE student_id = $1`,
    [studentId]
  );
  const errors = errorRes.rows[0] || {};

  // 4. Get session performance trends
  const trendsRes = await query(
    `SELECT rs.words_per_minute, ep.error_rate, rs.started_at
     FROM reading_sessions rs
     JOIN error_profiles ep ON ep.session_id = rs.id
     WHERE rs.student_id = $1 AND rs.deleted_at IS NULL
     ORDER BY rs.started_at DESC LIMIT 10`,
    [studentId]
  );

  // 5. Identify top weaknesses (sorted by frequency)
  const errorCounts: Array<[string, number]> = [
    ['REV', Number(errors.rev || 0)],
    ['SUB', Number(errors.sub || 0)],
    ['OMI', Number(errors.omi || 0)],
    ['INS', Number(errors.ins || 0)],
    ['BLD', Number(errors.bld || 0)],
    ['PAC', Number(errors.pac || 0)],
  ];
  errorCounts.sort((a, b) => b[1] - a[1]);

  const topWeaknesses = errorCounts.filter(([, count]) => count > 0).slice(0, 3);
  const topCategories = topWeaknesses.map(([cat]) => cat);

  // 6. Build key concerns
  const keyConcerns: string[] = [];
  for (const [cat, count] of topWeaknesses) {
    const name = CATEGORY_NAMES[cat] || cat;
    keyConcerns.push(`${name}: ${count} occurrences across ${errors.session_count || 0} sessions`);
  }
  if (healthScore && healthScore.score < 60) {
    keyConcerns.push(`Reading Health Score is ${healthScore.score}/100 (${healthScore.riskLevel})`);
  }
  if (screening && screening.risk !== 'low') {
    keyConcerns.push(`Risk screening: ${screening.risk} risk (${screening.confidence}% confidence)`);
  }

  // 7. Build weekly roadmap
  const weeklyRoadmap: WeeklyPlan[] = generateWeeklyRoadmap(topCategories, gradeLevel);

  // 8. Select recommended exercises
  const recommendedExercises: Exercise[] = [];
  for (const cat of topCategories) {
    const exercises = EXERCISE_LIBRARY[cat] || [];
    recommendedExercises.push(...exercises.slice(0, 2));
  }

  // 9. Generate summary
  const avgWpm = trendsRes.rows.length > 0
    ? Math.round(trendsRes.rows.reduce((a: number, r: any) => a + (r.words_per_minute || 0), 0) / trendsRes.rows.length)
    : 0;

  const summary = generateSummary(
    studentName, gradeLevel, healthScore?.score || 0,
    topWeaknesses, avgWpm, errors.session_count || 0
  );

  // 10. Fetch parent's preferred_language for the communication draft
  const parentLangRes = await query(
    `SELECT u.preferred_language
     FROM parent_student_links psl
     JOIN users u ON u.id = psl.parent_id
     WHERE psl.student_id = $1 AND psl.withdrawn_at IS NULL AND u.deleted_at IS NULL
     ORDER BY psl.consent_date ASC LIMIT 1`,
    [studentId]
  );
  const parentPreferredLanguage: ParentLanguage = parentLangRes.rows[0]?.preferred_language || 'en';

  // 11. Generate parent communication draft in parent's preferred language
  const parentDraft = generateParentCommunication(
    studentName, gradeLevel, healthScore?.score || 0,
    topWeaknesses, weeklyRoadmap, parentPreferredLanguage
  );

  const strategy: CopilotStrategy = {
    summary,
    keyConcerns,
    weeklyRoadmap,
    recommendedExercises,
    parentCommunicationDraft: parentDraft,
    healthScoreAtGeneration: healthScore?.score || null,
    riskLevelAtGeneration: healthScore?.riskLevel || screening?.risk || null,
  };

  // Persist to DB
  await query(
    `INSERT INTO copilot_sessions
      (student_id, teacher_id, summary, key_concerns, weekly_roadmap,
       recommended_exercises, parent_communication_draft,
       health_score_at_generation, risk_level_at_generation)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      studentId, teacherId || null, summary,
      JSON.stringify(keyConcerns), JSON.stringify(weeklyRoadmap),
      JSON.stringify(recommendedExercises), parentDraft,
      healthScore?.score || null, healthScore?.riskLevel || null,
    ]
  );

  return strategy;
}

function generateWeeklyRoadmap(topCategories: string[], gradeLevel: number): WeeklyPlan[] {
  const plans: WeeklyPlan[] = [];

  // Week 1: Foundation — address the most frequent error
  const primary = topCategories[0] || 'SUB';
  plans.push({
    week: 1,
    focus: `Foundation: ${CATEGORY_NAMES[primary] || primary}`,
    objectives: [
      `Reduce ${CATEGORY_NAMES[primary]?.toLowerCase() || primary} errors by 30%`,
      'Build awareness of specific error patterns',
      'Introduce targeted practice exercises',
    ],
    activities: [
      ...(EXERCISE_LIBRARY[primary] || []).slice(0, 2).map(e => e.name),
      'Daily 10-minute reading practice with finger tracking',
    ],
  });

  // Week 2: Phonological skills
  const secondary = topCategories[1] || 'BLD';
  plans.push({
    week: 2,
    focus: `Phonological Skills: ${CATEGORY_NAMES[secondary] || secondary}`,
    objectives: [
      `Address ${CATEGORY_NAMES[secondary]?.toLowerCase() || secondary} patterns`,
      'Strengthen phoneme awareness and blending',
      'Continue Week 1 exercises for reinforcement',
    ],
    activities: [
      ...(EXERCISE_LIBRARY[secondary] || []).slice(0, 2).map(e => e.name),
      'Phoneme segmentation and blending warm-ups',
    ],
  });

  // Week 3: Fluency building
  plans.push({
    week: 3,
    focus: 'Fluency & Confidence Building',
    objectives: [
      `Increase reading speed toward grade ${gradeLevel} norms`,
      'Build reading confidence through repeated exposure',
      'Practice smooth, expressive reading',
    ],
    activities: [
      'Repeated Reading with familiar passages',
      'Echo Reading with audio models',
      'Timed reading challenge (self-competition)',
    ],
  });

  // Week 4: Integration & assessment
  plans.push({
    week: 4,
    focus: 'Integration & Progress Assessment',
    objectives: [
      'Apply all learned skills to new passages',
      'Complete progress assessment reading session',
      'Celebrate improvements and set next goals',
    ],
    activities: [
      'Read a new passage applying all strategies',
      'Complete a Decodex assessment session',
      'Review progress dashboard with teacher',
    ],
  });

  return plans;
}

function generateSummary(
  name: string, grade: number, score: number,
  weaknesses: [string, number][], avgWpm: number, sessionCount: number
): string {
  const weaknessNames = weaknesses.map(([cat]) => CATEGORY_NAMES[cat]?.toLowerCase() || cat).join(', ');
  const scoreDesc = score >= 75 ? 'good progress' : score >= 60 ? 'developing skills' : score >= 40 ? 'needs targeted support' : 'requires urgent intervention';

  return `${name} is a Grade ${grade} student showing ${scoreDesc} with a Reading Health Score of ${score}/100. ` +
    `Across ${sessionCount} reading session${sessionCount !== 1 ? 's' : ''}, the primary areas for improvement are: ${weaknessNames}. ` +
    `Average reading speed is ${avgWpm} WPM. ` +
    `The recommended intervention plan focuses on structured Orton-Gillingham exercises targeting these specific patterns, ` +
    `with weekly milestones to track progress. Daily Practice Commitment: Students must practice reading daily — if not a whole story, reading even a small part of a story daily will continuously improve reading skills.`;
}

function generateParentCommunication(
  name: string, grade: number, score: number,
  weaknesses: [string, number][], roadmap: WeeklyPlan[],
  language: ParentLanguage = 'en'
): string {
  const weaknessText = weaknesses
    .map(([cat, count]) => `${CATEGORY_NAMES[cat]?.toLowerCase() || cat} (${count} occurrences)`)
    .join(', ');

  const weekSummary = roadmap
    .map(w => `  • Week ${w.week}: ${w.focus}`)
    .join('\n');

  // Language-specific templates
  const templates: Record<string, {
    greeting: string;
    intro: (name: string, score: number) => string;
    focus: string;
    plan: string;
    help: string;
    closing: string;
    signature: string;
  }> = {
    en: {
      greeting: 'Dear Parent/Guardian,',
      intro: (name: string, score: number) =>
        `I wanted to share an update on ${name}'s reading progress in our Decodex program.\n\n` +
        `${name} is currently reading at a Health Score of ${score} out of 100. ` +
        (score >= 75
          ? `This represents strong progress, and we're working to build on these achievements.`
          : score >= 60
            ? `This shows developing skills with specific areas where targeted practice can make a real difference.`
            : `We've identified some patterns that will benefit from structured, targeted practice.`),
      focus: 'The areas we\'re focusing on include:',
      plan: 'Here\'s our 4-week improvement plan:',
      help: `How you can help at home:\n` +
        `  • Encourage daily reading practice (if not a whole story, reading even a small part of a story daily is essential!)\n` +
        `  • Listen to ${name} read aloud and praise effort (not just accuracy)\n` +
        `  • Use the Decodex parent dashboard to track weekly progress\n` +
        `  • Celebrate milestones — every improvement matters!`,
      closing: `Please don't hesitate to reach out if you have questions about ${name}'s progress or the intervention plan.`,
      signature: 'Warm regards,\nThe Decodex Teaching Team',
    },
    hi: {
      greeting: 'प्रिय अभिभावक/पालक,',
      intro: (name: string, score: number) =>
        `मैं ${name} की रीडिंग प्रगति पर हमारे डिकोडेक्स प्रोग्राम में एक अपडेट साझा करना चाहता/चाहती हूँ।\n\n` +
        `${name} वर्तमान में 100 में से ${score} के हेल्थ स्कोर पर पढ़ रहे हैं। ` +
        (score >= 75
          ? `यह मजबूत प्रगति दर्शाता है, और हम इन उपलब्धियों को आगे बढ़ाने के लिए काम कर रहे हैं।`
          : score >= 60
            ? `यह विकासशील कौशल दिखाता है जहां लक्षित अभ्यास वास्तविक अंतर ला सकता है।`
            : `हमने कुछ पैटर्न पहचाने हैं जो संरचित, लक्षित अभ्यास से लाभान्वित होंगे।`),
      focus: 'हम जिन क्षेत्रों पर ध्यान केंद्रित कर रहे हैं उनमें शामिल हैं:',
      plan: 'यह हमारी 4-सप्ताह की सुधार योजना है:',
      help: `घर पर आप कैसे मदद कर सकते हैं:\n` +
        `  • दैनिक रीडिंग अभ्यास को प्रोत्साहित करें (यदि पूरी कहानी नहीं, तो कहानी का एक छोटा सा हिस्सा भी रोज पढ़ना आवश्यक है!)\n` +
        `  • ${name} को जोर से पढ़ते हुए सुनें और प्रयास की सराहना करें (सिर्फ सटीकता की नहीं)\n` +
        `  • साप्ताहिक प्रगति ट्रैक करने के लिए डिकोडेक्स पेरेंट डैशबोर्ड का उपयोग करें\n` +
        `  • उपलब्धियों का जश्न मनाएं — हर सुधार मायने रखता है!`,
      closing: `यदि आपके ${name} की प्रगति या हस्तक्षेप योजना के बारे में कोई प्रश्न हैं, तो कृपया संपर्क करने में संकोच न करें।`,
      signature: 'सादर,\nडिकोडेक्स टीचिंग टीम',
    },
  };

  const t = templates[language] ?? templates.en;

  return `${t.greeting}\n\n${t.intro(name, score)}\n\n${t.focus} ${weaknessText}.\n\n${t.plan}\n${weekSummary}\n\n${t.help}\n\n${t.closing}\n\n${t.signature}`;
}

/**
 * Get copilot strategy history for a student.
 */
export async function getStrategyHistory(studentId: string, limit: number = 10) {
  const res = await query(
    `SELECT * FROM copilot_sessions
     WHERE student_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [studentId, limit]
  );
  return res.rows;
}
