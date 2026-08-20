import { query } from '../db';

export const generateDrill = async (sessionId: string, studentId: string, errorCounts: Record<string, number>) => {
  // Fetch exact mispronounced / misread words from this session
  const errorWordsRes = await query(
    `SELECT source_word, spoken_word, category, rationale 
     FROM error_classifications 
     WHERE session_id = $1 AND category IN ('REV', 'SUB', 'OMI', 'BLD')`,
    [sessionId]
  );

  const mispronouncedList = errorWordsRes.rows.map(r => {
    const rawWord = r.source_word || r.spoken_word || '';
    const cleanWord = rawWord.replace(/[.,!?;:'"]/g, '').trim();
    return {
      word: cleanWord,
      target: cleanWord,
      spoken: r.spoken_word ? r.spoken_word.replace(/[.,!?;:'"]/g, '').trim() : null,
      category: r.category,
      rationale: r.rationale,
      spelling: cleanWord.toUpperCase().split('').join(' • '),
      phonics: cleanWord.toLowerCase()
    };
  }).filter(item => item.word && item.word.length > 0);

  // Deduplicate words
  const uniqueWordsMap = new Map<string, typeof mispronouncedList[0]>();
  for (const item of mispronouncedList) {
    if (!uniqueWordsMap.has(item.word.toLowerCase())) {
      uniqueWordsMap.set(item.word.toLowerCase(), item);
    }
  }
  const uniqueMispronounced = Array.from(uniqueWordsMap.values());

  const drillable = ['REV', 'SUB', 'BLD'];
  let maxCategory = 'SUB';
  let maxCount = -1;

  for (const cat of drillable) {
    if ((errorCounts[cat] || 0) > maxCount) {
      maxCount = errorCounts[cat];
      maxCategory = cat;
    }
  }

  let drillType = 'Targeted Pronunciation & Sight Words';
  if (maxCategory === 'REV') {
    drillType = 'Visual Reversal & Phoneme Discrimination';
  } else if (maxCategory === 'BLD') {
    drillType = 'Consonant & Vowel Blending Practice';
  }

  const content = {
    instructions: 'Practice pronouncing these specific words from your reading session:',
    words: uniqueMispronounced.length > 0 
      ? uniqueMispronounced.slice(0, 6)
      : [
          { word: 'scared', target: 'scared', spoken: 'scard', spelling: 'S • C • A • R • E • D', phonics: 'sk-air-d' },
          { word: 'bottom', target: 'bottom', spoken: null, spelling: 'B • O • T • T • O • M', phonics: 'bot-tom' },
          { word: 'breathe', target: 'breathe', spoken: 'breath', spelling: 'B • R • E • A • T • H • E', phonics: 'br-ee-th' }
        ]
  };

  const res = await query(`
    INSERT INTO drills (session_id, student_id, target_category, drill_type, content)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [sessionId, studentId, maxCategory, drillType, JSON.stringify(content)]);

  return res.rows[0];
};
