import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, useApiQuery } from '../lib/api';
import DexAvatar from '../components/DexAvatar';

interface Passage {
  id: string;
  title: string;
  content: string;
  grade_level: number;
  word_count: number;
}

export default function PassageSelection() {
  const [generating, setGenerating] = useState(false);
  const { data, loading, error, refetch } = useApiQuery<{ passages: Passage[] }>('/passages');

  const handleGeneratePassage = async () => {
    setGenerating(true);
    try {
      await apiFetch('/passages/generate', {
        method: 'POST',
        body: JSON.stringify({ grade_level: 3 }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to generate passage:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="stat-card p-8 text-center text-on-surface-variant font-body student-text">Loading passages...</div>;
  if (error) return <div className="stat-card p-8 text-center text-error font-body student-text">Error loading passages: {error.message}</div>;

  return (
    <main className="w-full max-w-max-content-width mx-auto px-container-padding py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link to="/" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary font-display text-sm font-bold tracking-[0.08em] uppercase transition-colors w-fit">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Dashboard
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-on-surface">Select a Reading Passage</h1>
          <p className="font-body text-lg text-on-surface-variant student-text">Choose a passage or generate a fresh AI text to begin your reading assessment.</p>
        </div>

        {/* Dynamic AI Passage Generator Button */}
        <button
          onClick={handleGeneratePassage}
          disabled={generating}
          className="h-14 px-8 rounded-full btn-clay flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-60 shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined">{generating ? 'hourglass_top' : 'auto_awesome'}</span>
          {generating ? 'Crafting Passage…' : 'Generate Fresh AI Passage'}
        </button>
      </div>
      
      {/* Dex Companion */}
      <DexAvatar state="idle" size="sm" showCaptionBubble={true} caption="Pick a passage or create a new one — every story is a chance to grow! 🌱" className="mx-auto sm:mx-0" />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {data?.passages.map((passage) => (
          <div 
            key={passage.id} 
            className="stat-card stat-card-hover flex flex-col justify-between"
            style={{ borderLeftColor: 'var(--color-primary)' }}
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="stat-icon bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-3xl">auto_stories</span>
                </div>
                <h3 className="font-display text-xl font-bold text-on-surface group-hover:text-primary transition-colors">{passage.title}</h3>
              </div>
              <div className="flex gap-2.5 text-xs font-display font-bold uppercase tracking-[0.08em] text-outline mb-4">
                <span className="badge-cat cat-sub">Grade {passage.grade_level}</span>
                <span className="badge-cat cat-sub">{passage.word_count} words</span>
              </div>
              <p className="font-body text-on-surface-variant text-base line-clamp-3 mb-6 leading-relaxed student-text">
                {passage.content}
              </p>
            </div>
            <Link 
              to={`/session/${passage.id}`}
              className="w-full text-center px-8 py-4 btn-clay flex items-center justify-center gap-2 text-sm uppercase tracking-[0.08em]"
            >
              Start Reading
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}