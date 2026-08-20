import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Target, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

interface Drill {
  id: string;
  session_id?: string;
  target_category: string;
  drill_type: string;
  content: any;
  completed: boolean;
}

interface Props {
  drill: Drill;
}

export default function DrillCard({ drill }: Props) {
  const navigate = useNavigate();
  const { id: routeSessionId } = useParams();

  if (!drill) return null;

  const content = typeof drill.content === 'string' 
    ? (function() { try { return JSON.parse(drill.content); } catch { return {}; } })() 
    : (drill.content || {});

  const getCategoryMeta = (cat: string) => {
    const meta: Record<string, { label: string; icon: string; style: string }> = {
      'REV': { label: 'Letter / Word Reversals', icon: 'swap_horiz', style: 'cat-rev' },
      'SUB': { label: 'Word Substitutions', icon: 'find_replace', style: 'cat-sub' },
      'BLD': { label: 'Phoneme Blending', icon: 'blend', style: 'cat-bld' },
      'OMI': { label: 'Omitted Words', icon: 'playlist_remove', style: 'cat-omi' },
      'INS': { label: 'Inserted Words', icon: 'playlist_add', style: 'cat-ins' },
      'PAC': { label: 'Pacing / Self-Correction', icon: 'pace', style: 'cat-pac' },
      'UNC': { label: 'Uncertain', icon: 'help', style: 'cat-unc' },
    };
    return meta[cat] || { label: cat, icon: 'neurology', style: 'cat-unc' };
  };

  const rawWordsList: any[] = Array.isArray(content.words) ? content.words : [];
  const wordsList: string[] = rawWordsList.map(item => {
    if (typeof item === 'string') return item.replace(/[.,!?;:'"]/g, '').trim();
    return (item.word || item.target || '').replace(/[.,!?;:'"]/g, '').trim();
  }).filter(w => w && w.length > 0);

  const displayWords = wordsList.length > 0 ? wordsList.slice(0, 5) : ['scared', 'bottom', 'breathe'];
  const targetSessionId = drill.session_id || routeSessionId;

  return (
    <div className="stat-card stat-card-hover p-6 flex flex-col gap-5 bg-surface-container-lowest" style={{ borderRadius: '1.75rem', borderLeftColor: 'var(--color-primary)' }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center shrink-0 shadow-inner">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-primary">Personalized AI Practice</span>
          <h3 className="font-display text-lg font-bold text-on-surface">{drill.drill_type || 'Pronunciation Clinic'}</h3>
        </div>
      </div>
       
      {(() => { const catMeta = getCategoryMeta(drill.target_category); return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border badge-cat ${catMeta.style}`}>
          <span className="material-symbols-outlined text-sm">{catMeta.icon}</span>
          {catMeta.label}
        </div>
      ); })()}

      <div className="stat-card p-5 border border-surface-container-highest flex flex-col items-center gap-4 text-center" style={{ background: 'var(--color-muted)' }}>
        <p className="font-body text-xs font-bold uppercase tracking-wider text-on-surface-variant">Words to practice from your audio:</p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {displayWords.map((word, idx) => (
            <span key={idx} className="px-3.5 py-1.5 bg-white text-primary font-display font-bold text-base rounded-xl shadow-xs border border-surface-variant student-text">
              {word}
            </span>
          ))}
        </div>

        {drill.completed ? (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-xs font-bold border badge-risk risk-excellent">
            <CheckCircle2 className="w-4 h-4" />
            Practice Completed! Great Job!
          </div>
        ) : (
          <button
            onClick={() => navigate(`/sessions/${targetSessionId}/practice`)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 btn-clay font-display text-sm font-bold cursor-pointer mt-1"
          >
            <Sparkles className="w-4 h-4" />
            Start Practice Clinic <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}