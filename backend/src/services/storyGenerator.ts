import { query } from '../db';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Dynamic Infinite AI Story Generator (OpenAI & Groq Powered)
// ---------------------------------------------------------------------------

export interface GeneratedStory {
  id: string;
  title: string;
  content: string;
  difficultyLevel: number;
  targetPhonemes: string[];
  targetWeaknesses: string[];
  wordCount: number;
}

// Procedural elements for infinite unique 200-250 word stories
const CHARACTERS = [
  { name: 'Shelly', animal: 'squirrel', descriptor: 'curious and quick' },
  { name: 'Charlie', animal: 'chipmunk', descriptor: 'cheerful and adventurous' },
  { name: 'Theo', animal: 'thrush', descriptor: 'thoughtful and musical' },
  { name: 'Buddy', animal: 'bear cub', descriptor: 'brave and kind-hearted' },
  { name: 'Daisy', animal: 'duckling', descriptor: 'daring and playful' },
  { name: 'Pedro', animal: 'panda', descriptor: 'patient and clever' },
  { name: 'Brett', animal: 'badger', descriptor: 'bold and resourceful' },
  { name: 'Grace', animal: 'gazelle', descriptor: 'graceful and speedy' },
  { name: 'Joan', animal: 'jaguar', descriptor: 'jubilant and energetic' },
  { name: 'Pip', animal: 'penguin', descriptor: 'polite and eager' },
  { name: 'Zeke', animal: 'zebra', descriptor: 'zealous and helpful' },
  { name: 'Chloe', animal: 'cat', descriptor: 'clever and gentle' },
  { name: 'Barnaby', animal: 'beaver', descriptor: 'busy and bright' },
  { name: 'Finley', animal: 'fox', descriptor: 'friendly and swift' },
  { name: 'Sammy', animal: 'sea otter', descriptor: 'spirited and imaginative' },
];

const COMPANIONS = [
  { name: 'Oliver', animal: 'owl' },
  { name: 'Hattie', animal: 'hedgehog' },
  { name: 'Penny', animal: 'porcupine' },
  { name: 'Rusty', animal: 'rabbit' },
  { name: 'Milo', animal: 'mouse' },
  { name: 'Toby', animal: 'turtle' },
];

const SETTINGS = [
  'deep in the sunlit pine forest where ancient oak trees arched overhead',
  'along the sparkling blue riverbank surrounded by fragrant wild clover',
  'high atop the misty Emerald Hills where rainbow-colored butterflies fluttered',
  'inside a cozy hollow treehouse filled with carved wooden lanterns',
  'near a hidden stone waterfall that hummed a gentle melody',
  'across the Golden Meadow where tall silver grass swayed in the morning breeze',
  'within a quiet rainforest trail lined with glowing moss flowers',
  'beside an old stone fountain at the heart of the Woodland Village',
];

const PLOTS = [
  {
    theme: 'Mystery of the Lost Compass',
    goal: 'find an ancient shiny silver compass hidden behind the overgrown ivy wall',
    obstacle: 'a steep muddy hill and a thick patch of thorny brambles blocked the main path',
    clue: 'a trail of glowing blue feathers left by a friendly forest bird',
    resolution: 'discovered the polished compass tucked safely inside a hollow oak branch',
  },
  {
    theme: 'Quest for the Golden Acorn',
    goal: 'locate the mythical golden acorn that could light up the entire forest at night',
    obstacle: 'strong autumn winds blew rustling leaves in every direction, hiding the secret trail',
    clue: 'a soft rhythmic tapping sound coming from behind the old stone bridge',
    resolution: 'uncovered the glowing acorn shining warmly beneath a blanket of soft green moss',
  },
  {
    theme: 'The Secret River Celebration',
    goal: 'gather sweet wild berries and fresh river mint for the annual woodland feast',
    obstacle: 'the wooden footbridge across the rushing creek had lost three of its key planks',
    clue: 'a bundle of sturdy willow twigs floating gently near the water edge',
    resolution: 'rebuilt the bridge together with friends and filled three wicker baskets to the brim',
  },
  {
    theme: 'Rescue of the Starlight Map',
    goal: 'decode the handwritten starlight map left by the wise old forest elders',
    obstacle: 'the symbols on the parchment were faded and tricky to sound out clearly',
    clue: 'a shimmering crystal key hidden beneath a smooth river pebble',
    resolution: 'read every word with careful focus and unlocked a hidden chest of glowing gemstones',
  },
  {
    theme: 'The Great Canopy Flying Contest',
    goal: 'construct a lightweight glider out of pine needles and sturdy maple leaves',
    obstacle: 'finding the right balance so the craft could soar smoothly over high branches',
    clue: 'a gentle thermal breeze swirling around the sunny mountain overlook',
    resolution: 'launched the glider high into the sky, winning applause from every forest creature',
  },
];

const PHONEME_EXERCISES: Record<string, string[][]> = {
  b_d_p: [
    [
      'Buddy the bear picked up a big blue ball by the barn.',
      'Daisy the duck dived into deep dark water with a happy splash.',
      'Pip the panda pointed to a pretty pink peach hanging high on the branch.',
      'Together, they promised to protect the peaceful pathway.',
    ],
    [
      'A brave boy bounced a bright ball beside the big oak tree.',
      'The playful puppy dug deep under the dry garden dirt.',
      'Pedro painted a splendid picture of purple pansies in full bloom.',
      'They carefully sounded out each letter: /b/, /d/, and /p/.',
    ],
  ],
  blends: [
    [
      'The bright green frog leaped gracefully across the clear bubbling brook.',
      'Brave Brett stopped to clear the path of heavy fallen branches.',
      'Grace smiled as glowing stars sparkled across the dark night sky.',
      'Slick snails slid smoothly over the flat stones near the spring.',
    ],
    [
      'Strong breezes blew fresh pine scents through the quiet valley.',
      'Crisp autumn leaves crinkled beneath their small swift paws.',
      'They constructed a sturdy shelter using straight twigs and spruce needles.',
      'Splendid sunshine streamed down as the brave travelers pressed forward.',
    ],
  ],
  sh_ch_th: [
    [
      'Shelly saw a shiny shell glistening by the sandy shore.',
      'Charlie chose a fresh cherry treat to share with his best friend.',
      'Theo thought three thick branches had fallen across the path.',
      'Shirley brushed her shoes with care before stepping into the hall.',
    ],
    [
      'The cheerful chipmunk chattered excitedly from a high branch.',
      'Thirty thistles grew near the quiet forest trail.',
      'Shadows shifted softly as the thermal breeze blew through the trees.',
      'They chanted three short rhymes to practice their target sounds.',
    ],
  ],
  general: [
    [
      'The morning sun shone warm and bright over the peaceful meadow.',
      'Every single step brought new excitement and wondrous discoveries.',
      'A friendly bluebird perched on a high twig and sang a cheerful song.',
      'Fresh mountain air filled the valley with energy and delight.',
    ],
    [
      'Clear water bubbled over smooth river rocks in a steady rhythm.',
      'Happy laughter echoed through the trees as the friends journeyed together.',
      'They paused to admire the colorful wildflowers blooming along the path.',
      'Confidence grew with every sentence they read aloud with pride.',
    ],
  ],
};

const CATEGORY_TO_FOCUS: Record<string, string> = {
  REV: 'b_d_p',
  BLD: 'blends',
  SUB: 'sh_ch_th',
  OMI: 'general',
  INS: 'general',
  PAC: 'general',
};

const STORY_THEME_SEEDS = [
  'tropical rainforest exploration',
  'snowy mountain winter rescue',
  'enchanted garden mystery',
  'starlit nocturnal campfire',
  'underwater coral reef adventure',
  'ancient castle library discovery',
  'sunny island treasure hunt',
  'autumn harvest celebration',
];

/**
 * Generate a rich, 200-250+ word procedural story when LLM is unavailable or offline.
 */
function generateProceduralStory(
  studentGrade: number,
  focusKey: string,
  storyNum: number
): { title: string; content: string } {
  // Use a mix of storyNum and random seed for true variety
  const randChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const randComp = COMPANIONS[Math.floor(Math.random() * COMPANIONS.length)];
  const randSetting = SETTINGS[Math.floor(Math.random() * SETTINGS.length)];
  const randPlot = PLOTS[Math.floor(Math.random() * PLOTS.length)];

  const phonemeSets = PHONEME_EXERCISES[focusKey] || PHONEME_EXERCISES['general'];
  const phonemeLines = phonemeSets[Math.floor(Math.random() * phonemeSets.length)];

  const title = `${randChar.name} and the ${randPlot.theme}`;

  // Paragraph 1: Introduction (~60 words)
  const p1 = `${randChar.name} was a ${randChar.descriptor} ${randChar.animal} who lived ${randSetting}. ` +
    `Every morning, ${randChar.name} loved to explore new paths and discover the hidden wonders of the woodland. ` +
    `On this special day, ${randChar.name} was joined by a dear friend named ${randComp.name} the ${randComp.animal}. ` +
    `Together, they decided to set out on an exciting journey to ${randPlot.goal}. ` +
    `The air was crisp and full of promise as they laced up their walking boots and headed down the winding trail.`;

  // Paragraph 2: Challenge & Phoneme Practice (~70 words)
  const p2 = `As they traveled deeper into the woods, they encountered an unexpected challenge: ${randPlot.obstacle}. ` +
    `${randChar.name} stopped to observe the surroundings carefully, determined not to give up. ` +
    `To stay focused and build up courage, ${randChar.name} and ${randComp.name} practiced sounding out words out loud. ` +
    `${phonemeLines[0]} ${phonemeLines[1]} ` +
    `Saying each word clearly gave them the energy they needed to keep moving forward without hesitation.`;

  // Paragraph 3: Journey & Clue (~60 words)
  const p3 = `Sensing that they were getting closer, ${randComp.name} pointed toward ${randPlot.clue}. ` +
    `${phonemeLines[2]} ${phonemeLines[3]} ` +
    `Step by step, the two companions navigated around the tricky obstacles with impressive teamwork. ` +
    `${randChar.name} focused on reading the directional markers posted along the wooden signposts, checking every letter with patience and accuracy.`;

  // Paragraph 4: Happy Resolution & Conclusion (~60 words)
  const p4 = `Finally, after a thrilling search, ${randChar.name} and ${randComp.name} ${randPlot.resolution}. ` +
    `They cheered with delight and celebrated their successful teamwork under the warm sunshine. ` +
    `Looking back at the path they had conquered, ${randChar.name} felt proud of how far they had come and how fluently they had read every clue. ` +
    `It was an unforgettable woodland adventure filled with confidence, laughter, and lifelong friendship!`;

  const content = `${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;
  return { title, content };
}

/**
 * Generate a personalized reading story for a student using OpenAI, Groq, or Procedural Engine.
 */
export async function generateStoryForStudent(
  studentId: string,
  difficultyLevel: number = 3
): Promise<GeneratedStory> {
  const studentRes = await query(
    `SELECT grade_level FROM users WHERE id = $1`,
    [studentId]
  );
  const gradeLevel = studentRes.rows[0]?.grade_level || difficultyLevel;

  const errorRes = await query(
    `SELECT
       SUM(rev_count) as rev, SUM(sub_count) as sub,
       SUM(omi_count) as omi, SUM(ins_count) as ins,
       SUM(bld_count) as bld, SUM(pac_count) as pac
     FROM error_profiles
     WHERE student_id = $1`,
    [studentId]
  );
  const errors = errorRes.rows[0] || {};
  const errorMap: Array<[string, number]> = [
    ['REV', Number(errors.rev || 0)],
    ['BLD', Number(errors.bld || 0)],
    ['SUB', Number(errors.sub || 0)],
    ['OMI', Number(errors.omi || 0)],
    ['INS', Number(errors.ins || 0)],
    ['PAC', Number(errors.pac || 0)],
  ];
  errorMap.sort((a, b) => b[1] - a[1]);

  const topCategory = errorMap[0][1] > 0 ? errorMap[0][0] : 'general';
  const focusKey = CATEGORY_TO_FOCUS[topCategory] || 'general';

  const countRes = await query(
    `SELECT COUNT(*) as cnt FROM generated_stories WHERE student_id = $1`,
    [studentId]
  );
  const storyNum = parseInt(countRes.rows[0]?.cnt || '0') + 1;

  let title = '';
  let content = '';
  let targetPhonemes: string[] = [];

  // Determine LLM provider (OpenAI primary, Groq secondary)
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  let llmClient: OpenAI | null = null;
  let modelName = '';

  if (openaiKey && !openaiKey.includes('your-key-here')) {
    llmClient = new OpenAI({ apiKey: openaiKey });
    modelName = 'gpt-4o-mini';
  } else if (groqKey && !groqKey.includes('your_free_groq_key_here')) {
    llmClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
    modelName = 'llama-3.3-70b-versatile';
  }

  if (llmClient) {
    try {
      const themeSeed = STORY_THEME_SEEDS[Math.floor(Math.random() * STORY_THEME_SEEDS.length)];

      const completion = await llmClient.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: `You are an expert Orton-Gillingham reading specialist and children's story author.
Write a captivating, multi-paragraph reading story for a Grade ${gradeLevel} student.

STORY SPECIFICATIONS:
- Target Phoneme Focus: ${focusKey} (naturally weave words with these sound patterns throughout).
- MANDATORY LENGTH: The story MUST be AT LEAST 200 TO 250 WORDS long. Do NOT make it short.
- FORMAT:
Title: [Creative Story Title]

[Paragraph 1: Character & Setting introduction]

[Paragraph 2: Conflict or challenge introducing phoneme practice]

[Paragraph 3: Journey & problem solving]

[Paragraph 4: Rewarding resolution]

Make the story completely original, fun, and engaging!`,
          },
          {
            role: 'user',
            content: `Generate a brand new unique story #${storyNum} for Grade ${gradeLevel}. Theme seed: ${themeSeed}. Target phoneme: ${focusKey}. Ensure it is at least 200 to 250 words long.`,
          },
        ],
        max_tokens: 1000,
      });

      const text = completion.choices[0]?.message?.content || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const titleLine = lines.find(l => l.toLowerCase().startsWith('title:'));

      if (titleLine) {
        title = titleLine.replace(/^title:\s*/i, '').replace(/[*"]/g, '');
        content = lines.filter(l => !l.toLowerCase().startsWith('title:')).join('\n\n');
      } else if (lines.length > 0) {
        title = lines[0].replace(/[*"]/g, '');
        content = lines.slice(1).join('\n\n');
      }
    } catch (llmErr) {
      console.warn(`LLM story generation (${modelName}) fallback to procedural engine:`, (llmErr as Error).message);
    }
  }

  // Fallback to rich procedural engine if LLM was skipped or failed
  if (!content || !title) {
    const proc = generateProceduralStory(gradeLevel, focusKey, storyNum);
    title = proc.title;
    content = proc.content;
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  targetPhonemes = {
    sh_ch_th: ['sh', 'ch', 'th'],
    b_d_p: ['b', 'd', 'p'],
    blends: ['bl', 'cr', 'str', 'spl', 'br', 'gr'],
    general: ['general_phonics'],
  }[focusKey] || ['general_phonics'];

  const res = await query(
    `INSERT INTO generated_stories
      (student_id, title, content, difficulty_level, target_phonemes,
       target_weaknesses, age_group, word_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      studentId, title, content, difficultyLevel,
      JSON.stringify(targetPhonemes),
      JSON.stringify([topCategory]),
      `grade_${gradeLevel}`,
      wordCount,
    ]
  );

  return {
    id: res.rows[0].id,
    title,
    content,
    difficultyLevel,
    targetPhonemes,
    targetWeaknesses: [topCategory],
    wordCount,
  };
}

export const generateStory = generateStoryForStudent;

export async function getStudentStories(studentId: string, limit: number = 20) {
  const res = await query(
    `SELECT * FROM generated_stories
     WHERE student_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [studentId, limit]
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    studentId: r.student_id,
    title: r.title,
    content: r.content,
    difficultyLevel: r.difficulty_level,
    targetPhonemes: r.target_phonemes || [],
    targetWeaknesses: r.target_weaknesses || [],
    wordCount: r.word_count,
    timesRead: r.times_read,
    createdAt: r.created_at,
  }));
}

export async function getStoryById(storyId: string) {
  const res = await query(
    `SELECT * FROM generated_stories WHERE id = $1`,
    [storyId]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    studentId: r.student_id,
    title: r.title,
    content: r.content,
    difficultyLevel: r.difficulty_level,
    targetPhonemes: r.target_phonemes || [],
    targetWeaknesses: r.target_weaknesses || [],
    wordCount: r.word_count,
    timesRead: r.times_read,
    createdAt: r.created_at,
  };
}
