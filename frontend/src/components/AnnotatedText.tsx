import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface Classification {
  word_index: number;
  source_word: string | null;
  spoken_word: string | null;
  category: string;
  rationale: string;
}

interface Props {
  sessionId: string;
  originalText?: string;
  classifications?: Classification[];
}

function buildSourceIndexMap(
  classifications: Classification[] = [],
): Map<number, Classification[]> {
  const map = new Map<number, Classification[]>();
  if (!Array.isArray(classifications)) return map;

  for (const c of classifications) {
    if (c.word_index !== undefined && c.word_index !== null) {
      if (!map.has(c.word_index)) map.set(c.word_index, []);
      map.get(c.word_index)!.push(c);
    }
  }

  return map;
}

const CATEGORY_STYLES: Record<string, string> = {
  REV: 'cat-rev',
  SUB: 'cat-sub',
  OMI: 'cat-omi',
  INS: 'cat-ins',
  BLD: 'cat-bld',
  PAC: 'cat-pac',
  UNC: 'cat-unc',
};

const _CATEGORY_LABELS: Record<string, string> = {
  REV: 'Reversal (b/d)',
  SUB: 'Substitution',
  OMI: 'Omission',
  INS: 'Insertion',
  BLD: 'Blend Breakdown',
  PAC: 'Pacing / Self-Correction',
  UNC: 'Uncertain',
};

export default function AnnotatedText({ sessionId, originalText = '', classifications = [] }: Props) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const words = (originalText || '').split(/\s+/).filter(w => w.length > 0);
  
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);

  const errorMap = buildSourceIndexMap(classifications || []);

  const handleCorrection = async (wordIndex: number, newCategory: string) => {
    setSubmitting(wordIndex);
    try {
      await apiFetch(`/sessions/${sessionId}/classifications/${wordIndex}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ corrected_category: newCategory })
      });
      setOverrides(prev => ({ ...prev, [wordIndex]: newCategory }));
    } catch {
      alert('Failed to submit correction.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="font-body text-xl leading-loose flex flex-wrap gap-y-3 items-baseline student-text">
      {words.map((word, index) => {
        const errorsAtPos = errorMap.get(index) || [];
        const activeError = errorsAtPos[0];
        const effectiveCategory = activeError ? (overrides[activeError.word_index] || activeError.category) : null;

        const isTopLine = index < 6;
        const isLeftColumn = index % 8 < 2;
        const isRightColumn = index % 8 >= 6;

        const vPos = isTopLine ? 'top-full mt-2' : 'bottom-full mb-2';
        const hPos = isLeftColumn
          ? 'left-0 translate-x-0'
          : isRightColumn
          ? 'right-0 left-auto translate-x-0'
          : 'left-1/2 -translate-x-1/2';

        const categoryStyle = CATEGORY_STYLES[effectiveCategory || ''] || 'cat-unc';

        return (
          <span key={index} className="relative group inline-block mr-2">
            <span className={`cursor-pointer ${effectiveCategory ? `badge-cat ${categoryStyle} px-2 py-1 rounded-xl font-bold border` : 'text-on-surface hover:text-primary transition-colors'}`}>
              {word}
            </span>
            
            {activeError && (
              <div className={`absolute ${vPos} ${hPos} hidden group-hover:flex flex-col items-center z-40 w-56 pointer-events-auto transition-all animate-in fade-in duration-150`}>
                {/* Top arrow when tooltip pops down */}
                {isTopLine && (
                  <div className="w-2.5 h-2.5 bg-surface-container-highest rotate-45 -mb-1 shadow-sm border-t border-l border-surface-variant z-50"></div>
                )}
                
                <div className="stat-card p-3.5 shadow-2xl border border-surface-variant w-full relative z-40 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold font-display text-[11px] uppercase tracking-wider text-primary">
                      {effectiveCategory} {activeError.category !== effectiveCategory && `(${activeError.category})`}
                    </span>
                    {activeError.spoken_word && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-display text-[10px] font-bold">
                        Spoken: "{activeError.spoken_word}"
                      </span>
                    )}
                  </div>
                  <p className="text-on-surface-variant font-body mb-2 text-[12px] leading-relaxed student-text">{activeError.rationale}</p>
                  
                  {isTeacher && (
                    <div className="border-t border-surface-variant/80 pt-2.5 mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-1.5">Teacher Override:</p>
                      <div className="grid grid-cols-4 gap-1">
                        {['REV', 'SUB', 'OMI', 'INS'].map(cat => (
                          <button
                            key={cat}
                            disabled={submitting === activeError.word_index}
                            onClick={() => handleCorrection(activeError.word_index, cat)}
                            className={`px-1.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer badge-cat ${submitting === activeError.word_index ? 'opacity-50' : CATEGORY_STYLES[cat]} ${effectiveCategory === cat ? 'shadow-xs' : ''}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom arrow when tooltip pops up */}
                {!isTopLine && (
                  <div className="w-2.5 h-2.5 bg-surface-container-highest rotate-45 -mt-1 shadow-sm border-b border-r border-surface-variant z-50"></div>
                )}
              </div>
            )}
          </span>
        );
      })}
    </div>
  );
}