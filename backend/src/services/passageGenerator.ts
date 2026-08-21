import { query } from '../db';
import dotenv from 'dotenv';
import { getLLMProvider } from './llmProviders';

dotenv.config();

export interface GeneratedPassage {
  id: string;
  title: string;
  content: string;
  gradeLevel: number;
  wordCount: number;
  lexileScore: number;
}

const PASSAGE_TOPICS = [
  { title: 'The Mystery of the Flying Kite', theme: 'adventure' },
  { title: 'Oliver and the Solar Scooter', theme: 'science' },
  { title: 'The Hidden Blue Waterfall', theme: 'nature' },
  { title: 'Detective Maya and the Lost Compass', theme: 'mystery' },
  { title: 'The Rainbow Chameleon of the Rainforest', theme: 'animals' },
  { title: 'Sammy\'s Unexpected Journey to the Moon', theme: 'space' },
  { title: 'Secrets of the Whispering Oak Tree', theme: 'magic' },
  { title: 'The Friendly River Dolphin', theme: 'ocean' },
  { title: 'Nico\'s Wooden Robot Invention', theme: 'craft' },
  { title: 'The Lighthouse Keeper\'s Cat', theme: 'cozy' },
];

const PASSAGE_TEMPLATES = [
  'High above the emerald valley, the wind carried a bright red kite across the sunlit clouds. Timmy held the string tightly as it danced over tall pine trees. "Higher!" cheered his little sister, laughing as a gentle breeze pushed the kite towards the mountain peak. It was a perfect afternoon for a soaring adventure.',
  'An old wooden clock sat quietly on the shelf in Grandpa\'s workshop. Every hour, a small brass bird popped out and chirped a cheerful tune. Maya loved watching the gears turn and listening to the steady tick-tock. She carefully wiped the dust off the clock and listened to its sweet song.',
  'Deep inside the quiet forest, a clear stream bubbled over smooth river stones. A young deer stopped to drink the cool water while blue butterflies fluttered around wild ferns. The morning sun shone softly through broad oak leaves, making the whole forest look magical and bright.',
  'Leo found an ancient leather notebook hidden in the attic. Inside were hand-drawn maps of secret islands and drawings of unusual sea birds. With a magnifying glass in hand, Leo studied every line. He smiled, realizing his grandfather had once been a brave explorer.',
];

/**
 * Generate a fresh, unique reading passage using the configured LLM provider.
 */
export async function generatePassage(gradeLevel: number = 3): Promise<GeneratedPassage> {
  const countRes = await query(`SELECT COUNT(*) as cnt FROM passages`);
  const count = parseInt(countRes?.rows?.[0]?.cnt || '0', 10) + 1;

  let title = '';
  let content = '';

  const provider = getLLMProvider();

  try {
    const passage = await provider.generatePassage({ gradeLevel });
    title = passage.title;
    content = passage.content;
  } catch (err) {
    console.warn('LLM passage generation fallback to procedural:', (err as Error).message);
  }

  if (!title || !content) {
    const topicObj = PASSAGE_TOPICS[(count - 1) % PASSAGE_TOPICS.length];
    const template = PASSAGE_TEMPLATES[(count - 1) % PASSAGE_TEMPLATES.length];

    title = `${topicObj.title} #${count}`;
    content = template;
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const lexileScore = 400 + gradeLevel * 100;

  const res = await query(
    `INSERT INTO passages (title, content, grade_level, lexile_score, word_count)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [title, content, gradeLevel, lexileScore, wordCount]
  );

  return {
    id: res?.rows?.[0]?.id || 'generated-passage-id',
    title,
    content,
    gradeLevel,
    wordCount,
    lexileScore,
  };
}