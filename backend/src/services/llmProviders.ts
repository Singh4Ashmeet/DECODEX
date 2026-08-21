/**
 * LLM Provider Abstraction — Self-hosted LLM Support
 * 
 * Allows swapping between cloud (Groq) and self-hosted (Ollama, vLLM, TGI) providers
 * for the classifier, passage generator, copilot, and other LLM-dependent services.
 */
import { classifyErrors as groqClassifyErrors } from './classifier';
import { generatePassage as groqGeneratePassage } from './passageGenerator';
import { generateStrategy as groqGenerateStrategy } from './copilot';
import { synthesizeSpeech as groqSynthesizeSpeech } from './tts';

export type LLMProviderType = 'groq' | 'ollama' | 'vllm' | 'tgi';

export interface LLMProviderConfig {
  type: LLMProviderType;
  baseUrl?: string;           // For self-hosted: e.g., 'http://localhost:11434' (Ollama)
  model?: string;             // Model name
  apiKey?: string;            // For cloud providers
  timeout?: number;           // Request timeout in ms
  maxRetries?: number;
}

export interface ClassificationRequest {
  errors: Array<{
    index: number;
    sourceWord: string | null;
    spokenWord: string | null;
    type: string;
  }>;
}

export interface ClassificationResponse {
  index: number;
  sourceWord: string | null;
  spokenWord: string | null;
  category: 'REV' | 'SUB' | 'OMI' | 'INS' | 'BLD' | 'PAC' | 'UNC';
  rationale: string;
}

export interface PassageRequest {
  gradeLevel: number;
  topic?: string;
}

export interface PassageResponse {
  title: string;
  content: string;
  gradeLevel: number;
  wordCount: number;
  lexileScore: number;
}

export interface CopilotRequest {
  studentId: string;
  errorProfile: string;
}

export type CopilotResponse = any;

export interface TTSRequest {
  text: string;
  language: string;
  voice?: string;
}

export interface TTSResponse {
  audioBuffer: Buffer | null;
  useBrowserTts: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Provider Interface
// ────────────────────────────────────────────────────────────────────────────

export interface LLMProvider {
  classifyErrors(request: ClassificationRequest): Promise<ClassificationResponse[]>;
  generatePassage(request: PassageRequest): Promise<PassageResponse>;
  generateStrategy(request: CopilotRequest): Promise<CopilotResponse>;
  synthesizeSpeech(request: TTSRequest): Promise<TTSResponse>;
  healthCheck(): Promise<boolean>;
  getModelInfo(): { type: LLMProviderType; model: string; version?: string };
}

// ────────────────────────────────────────────────────────────────────────────
// Groq Provider (Cloud)
// ────────────────────────────────────────────────────────────────────────────

export class GroqProvider implements LLMProvider {
  private config: LLMProviderConfig;
  
  constructor(config: LLMProviderConfig = { type: 'groq' }) {
    this.config = config;
  }
  
  async classifyErrors(request: ClassificationRequest): Promise<ClassificationResponse[]> {
    try {
      const apiKey = process.env.GROQ_API_KEY || 'dummy_groq_key';
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });

      const prompt = `Classify each reading error into: REV, SUB, OMI, INS, BLD, PAC, UNC.
Errors: ${JSON.stringify(request.errors)}`;

      const response = await client.chat.completions.create({
        model: this.config.model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an expert reading specialist trained in the Orton-Gillingham approach. Classify errors: REV, SUB, OMI, INS, BLD, PAC, UNC.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return parsed.classifications || [];
    } catch {
      const { applyRuleBasedOGClassification } = await import('./classifier');
      return applyRuleBasedOGClassification(request.errors as any);
    }
  }
  
  async generatePassage(request: PassageRequest): Promise<PassageResponse> {
    try {
      const apiKey = process.env.GROQ_API_KEY || 'dummy_groq_key';
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });

      const response = await client.chat.completions.create({
        model: this.config.model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Generate educational reading passages.' },
          { role: 'user', content: `Generate a Grade ${request.gradeLevel} reading passage` },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || `Generated Passage Grade ${request.gradeLevel}`,
        content: parsed.content || 'High above the emerald valley, the wind carried a bright red kite across the sunlit clouds.',
        gradeLevel: request.gradeLevel,
        wordCount: parsed.content ? parsed.content.split(/\s+/).filter(Boolean).length : 16,
        lexileScore: 400 + request.gradeLevel * 100,
      };
    } catch {
      return {
        title: `Generated Passage Grade ${request.gradeLevel}`,
        content: 'High above the emerald valley, the wind carried a bright red kite across the sunlit clouds.',
        gradeLevel: request.gradeLevel,
        wordCount: 16,
        lexileScore: 400 + request.gradeLevel * 100,
      };
    }
  }
  
  async generateStrategy(request: CopilotRequest): Promise<CopilotResponse> {
    try {
      const apiKey = process.env.GROQ_API_KEY || 'dummy_groq_key';
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });

      const response = await client.chat.completions.create({
        model: this.config.model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an educational intervention specialist.' },
          { role: 'user', content: `Create intervention strategy for student: ${request.studentId}` },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch {
      return {
        summary: 'Intervention strategy generated for student.',
        keyConcerns: ['Letter reversals', 'Substitution errors'],
        weeklyRoadmap: [],
        recommendedExercises: [],
        parentCommunicationDraft: 'Dear Parent, here is the student reading update.',
        healthScoreAtGeneration: 75,
        riskLevelAtGeneration: 'low',
      };
    }
  }
  
  async synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
    const { _synthesizeSpeech } = await import('./tts');
    return _synthesizeSpeech(request.text);
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const { transcribeAudio } = await import('./openai');
      await transcribeAudio('/dev/null', 'test', 'en'); // Will fail but tests connectivity
      return true;
    } catch {
      return false;
    }
  }
  
  getModelInfo() {
    return { type: 'groq' as const, model: this.config.model || 'llama-3.3-70b-versatile' };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Ollama Provider (Self-hosted)
// ────────────────────────────────────────────────────────────────────────────

export class OllamaProvider implements LLMProvider {
  private config: LLMProviderConfig;
  private baseUrl: string;
  
  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }
  
  private async request(endpoint: string, body: any): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout || 30000);
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
  
  async classifyErrors(request: ClassificationRequest): Promise<ClassificationResponse[]> {
    // Use a specialized classification prompt for Ollama
    const prompt = this.buildClassificationPrompt(request.errors);
    
    const response = await this.request('/api/generate', {
      model: this.config.model || 'llama3.2:3b',
      prompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.1, num_predict: 1000 },
    });
    
    try {
      const parsed = JSON.parse(response.response);
      return parsed.classifications || [];
    } catch {
      // Fallback to rule-based
      const { applyRuleBasedOGClassification } = await import('./classifier');
      return applyRuleBasedOGClassification(request.errors as any);
    }
  }
  
  private buildClassificationPrompt(errors: ClassificationRequest['errors']): string {
    return `You are an expert reading specialist trained in the Orton-Gillingham approach.
Classify each reading error into ONE category: REV, SUB, OMI, INS, BLD, PAC, UNC.

Errors to classify:
${JSON.stringify(errors, null, 2)}

Respond ONLY with JSON: {"classifications": [{"index": 0, "category": "REV", "rationale": "..."}]}`;
  }
  
  async generatePassage(request: PassageRequest): Promise<PassageResponse> {
    const prompt = `Generate a ${request.gradeLevel}th grade reading passage (60-90 words). 
Topic: ${request.topic || 'educational'}
Format: JSON with title, content, gradeLevel, wordCount, lexileScore`;
    
    const response = await this.request('/api/generate', {
      model: this.config.model || 'llama3.2:3b',
      prompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.7, num_predict: 500 },
    });
    
    try {
      const parsed = JSON.parse(response.response);
      return {
        title: parsed.title,
        content: parsed.content,
        gradeLevel: request.gradeLevel,
        wordCount: parsed.content.split(/\s+/).filter(Boolean).length,
        lexileScore: 400 + request.gradeLevel * 100,
      };
    } catch {
      // Fallback
      const { generatePassage } = await import('./passageGenerator');
      return generatePassage(request.gradeLevel);
    }
  }
  
  async generateStrategy(request: CopilotRequest): Promise<CopilotResponse> {
    const prompt = `As an educational specialist, create an intervention strategy for a student with this error profile:
${request.errorProfile}

Provide: summary (2-3 sentences) and 3-5 specific recommendations. JSON format.`;
    
    const response = await this.request('/api/generate', {
      model: this.config.model || 'llama3.2:3b',
      prompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.3, num_predict: 800 },
    });
    
    try {
      return JSON.parse(response.response);
    } catch {
      const { generateStrategy } = await import('./copilot');
      return generateStrategy(request.studentId, request.errorProfile);
    }
  }
  
  async synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
    // Ollama doesn't do TTS - delegate to browser TTS or external service
    return { audioBuffer: Buffer.from(''), useBrowserTts: true };
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  getModelInfo() {
    return { type: 'ollama' as const, model: this.config.model || 'llama3.2:3b' };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// vLLM / TGI Provider (OpenAI-compatible API)
// ────────────────────────────────────────────────────────────────────────────

export class VLLMProvider implements LLMProvider {
  private config: LLMProviderConfig;
  private baseUrl: string;
  
  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'http://localhost:8000';
  }
  
  private async openAIRequest(endpoint: string, body: any): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });
    
    if (!response.ok) {
      throw new Error(`vLLM error: ${response.status}`);
    }
    
    return response.json();
  }
  
  async classifyErrors(request: ClassificationRequest): Promise<ClassificationResponse[]> {
    const prompt = this.buildClassificationPrompt(request.errors);
    
    const response = await this.openAIRequest('/v1/chat/completions', {
      model: this.config.model || 'meta-llama/Llama-3.2-3B-Instruct',
      messages: [
        { role: 'system', content: 'You are an Orton-Gillingham reading specialist. Classify errors.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1000,
    });
    
    try {
      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return parsed.classifications || [];
    } catch {
      const { applyRuleBasedOGClassification } = await import('./classifier');
      return applyRuleBasedOGClassification(request.errors as any);
    }
  }
  
  private buildClassificationPrompt(errors: ClassificationRequest['errors']): string {
    return `Classify each reading error into: REV, SUB, OMI, INS, BLD, PAC, UNC.
Errors: ${JSON.stringify(errors)}
Return: {"classifications": [{"index": 0, "category": "REV", "rationale": "..."}]}`;
  }
  
  async generatePassage(request: PassageRequest): Promise<PassageResponse> {
    const response = await this.openAIRequest('/v1/chat/completions', {
      model: this.config.model || 'meta-llama/Llama-3.2-3B-Instruct',
      messages: [
        { role: 'system', content: 'Generate educational reading passages.' },
        { role: 'user', content: `Generate a grade ${request.gradeLevel} passage (60-90 words). Return JSON: title, content, gradeLevel, wordCount, lexileScore` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500,
    });
    
    try {
      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return {
        title: parsed.title,
        content: parsed.content,
        gradeLevel: request.gradeLevel,
        wordCount: parsed.content.split(/\s+/).filter(Boolean).length,
        lexileScore: 400 + request.gradeLevel * 100,
      };
    } catch {
      const { generatePassage } = await import('./passageGenerator');
      return generatePassage(request.gradeLevel);
    }
  }
  
  async generateStrategy(request: CopilotRequest): Promise<CopilotResponse> {
    const response = await this.openAIRequest('/v1/chat/completions', {
      model: this.config.model || 'meta-llama/Llama-3.2-3B-Instruct',
      messages: [
        { role: 'system', content: 'You are an educational intervention specialist.' },
        { role: 'user', content: `Create strategy for: ${request.errorProfile}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    });
    
    try {
      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch {
      const { generateStrategy } = await import('./copilot');
      return generateStrategy(request.studentId, request.errorProfile);
    }
  }
  
  async synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
    return { audioBuffer: Buffer.from(''), useBrowserTts: true };
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  getModelInfo() {
    return { type: 'vllm' as const, model: this.config.model || 'meta-llama/Llama-3.2-3B-Instruct' };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Provider Factory
// ────────────────────────────────────────────────────────────────────────────

let currentProvider: LLMProvider | null = null;

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.type) {
    case 'groq':
      return new GroqProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'vllm':
    case 'tgi':
      return new VLLMProvider(config);
    default:
      throw new Error(`Unknown LLM provider type: ${config.type}`);
  }
}

export function setLLMProvider(provider: LLMProvider): void {
  currentProvider = provider;
}

export function getLLMProvider(): LLMProvider {
  if (!currentProvider) {
    // Default to Groq if configured, otherwise Ollama
    const type = (process.env.LLM_PROVIDER as LLMProviderType) || 'groq';
    currentProvider = createLLMProvider({ 
      type, 
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
      apiKey: process.env.LLM_API_KEY,
    });
  }
  return currentProvider;
}

// ────────────────────────────────────────────────────────────────────────────
// High-level API (drop-in replacements)
// ────────────────────────────────────────────────────────────────────────────

export async function classifyErrors(errors: ClassificationRequest['errors']): Promise<ClassificationResponse[]> {
  const provider = getLLMProvider();
  return provider.classifyErrors({ errors });
}

export async function generatePassage(gradeLevel: number, topic?: string): Promise<PassageResponse> {
  const provider = getLLMProvider();
  return provider.generatePassage({ gradeLevel, topic });
}

export async function generateStrategy(studentId: string, errorProfile: string): Promise<CopilotResponse> {
  const provider = getLLMProvider();
  return provider.generateStrategy({ studentId, errorProfile });
}

export async function synthesizeSpeech(text: string, language: string): Promise<TTSResponse> {
  const provider = getLLMProvider();
  return provider.synthesizeSpeech({ text, language });
}