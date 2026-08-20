import { query } from '../db';
import OpenAI from 'openai';
import dotenv from 'dotenv';

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
 * Generate a fresh, unique reading passage using Groq API or Procedural Engine.
 */
export async function generatePassage(gradeLevel: number = 3): Promise<GeneratedPassage> {
  const countRes = await query(`SELECT COUNT(*) as cnt FROM passages`);
  const count = parseInt(countRes.rows[0]?.cnt || '0', 10) + 1;

  let title = '';
  let content = '';

  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (hasGroq) {
    try {
      const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
      const model = 'llama-3.3-70b-versatile';

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an educational reading assessment author. Write a fresh, engaging 60-90 word reading passage for Grade ${gradeLevel} students. Output format:\nTitle: [Title]\nContent: [Passage Text]`,
          },
          {
            role: 'user',
            content: `Generate unique reading passage #${count} for Grade ${gradeLevel}.`,
          },
        ],
        max_tokens: 250,
      });

      const text = completion.choices[0]?.message?.content || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const titleLine = lines.find(l => l.toLowerCase().startsWith('title:'));

      if (titleLine) {
        title = titleLine.replace(/^title:\s*/i, '').replace(/[*"]/g, '');
        content = lines.filter(l => !l.toLowerCase().startsWith('title:') && !l.toLowerCase().startsWith('content:')).join(' ');
      } else if (lines.length > 0) {
        title = lines[0].replace(/[*"]/g, '');
        content = lines.slice(1).join(' ');
      }
    } catch (err) {
      console.warn('Groq passage generation fallback to procedural:', (err as Error).message);
    }
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
    id: res.rows[0].id,
    title,
    content,
    gradeLevel,
    wordCount,
    lexileScore,
  };
}
