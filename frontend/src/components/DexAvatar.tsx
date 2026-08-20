import React, { useRef, useState, useEffect } from 'react';
import type { DexState } from '../hooks/useDex';
import { TUTOR_NAME } from '../lib/constants';
import dexCharacterImg from '../assets/dex-character.png';
import { ConfettiBurst } from './ConfettiBurst';

// ---------------------------------------------------------------------------
// DexAvatar — Official Cartoon Companion Character for Dex
// Warm, charming, high-quality mascot animation system.
// Clean, elegant dynamics without gaudy or flashy effects.
// ---------------------------------------------------------------------------

export interface DexAvatarProps {
  state: DexState;
  caption?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showCaptionBubble?: boolean;
  className?: string;
}

const STATE_CONFIG: Record<DexState, {
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  badgeIcon: string;
  badgeLabel: string;
  animationClass: string;
}> = {
  idle: {
    borderColor: 'border-secondary/30',
    badgeBg: 'bg-secondary',
    badgeText: 'text-on-secondary',
    badgeIcon: 'auto_awesome',
    badgeLabel: 'Ready to Read',
    animationClass: 'animate-[dex-breathe_4s_ease-in-out_infinite]',
  },
  speaking: {
    borderColor: 'border-primary/40',
    badgeBg: 'bg-primary',
    badgeText: 'text-on-primary',
    badgeIcon: 'volume_up',
    badgeLabel: `${TUTOR_NAME} Reading…`,
    animationClass: 'animate-[dex-speak_1.2s_ease-in-out_infinite]',
  },
  listening: {
    borderColor: 'border-amber-300',
    badgeBg: 'bg-amber-600',
    badgeText: 'text-white',
    badgeIcon: 'mic',
    badgeLabel: 'Listening…',
    animationClass: 'animate-[dex-listen_1.5s_ease-in-out_infinite]',
  },
  thinking: {
    borderColor: 'border-purple-300',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    badgeIcon: 'psychology',
    badgeLabel: 'Checking…',
    animationClass: 'animate-[dex-think_2s_ease-in-out_infinite]',
  },
  celebrating: {
    borderColor: 'border-emerald-400',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    badgeIcon: 'verified',
    badgeLabel: 'Great Reading!',
    animationClass: 'animate-[dex-bounce_0.6s_ease-in-out_infinite]',
  },
  concerned: {
    borderColor: 'border-rose-300',
    badgeBg: 'bg-rose-600',
    badgeText: 'text-white',
    badgeIcon: 'favorite',
    badgeLabel: 'Let\'s Try Again',
    animationClass: 'animate-[dex-encourage_1.5s_ease-in-out_infinite]',
  },
};

export default function DexAvatar({
  state,
  caption,
  size = 'md',
  showCaptionBubble = true,
  className,
}: DexAvatarProps) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle;

  // Fire confetti exactly once each time we enter the 'celebrating' state
  const prevStateRef = useRef<DexState | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (state === 'celebrating' && prevStateRef.current !== 'celebrating') {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1900);
      return () => clearTimeout(t);
    }
    prevStateRef.current = state;
  }, [state]);

  // Size scaling map
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-28 h-28 sm:w-32 sm:h-32',
    lg: 'w-40 h-40 sm:w-44 sm:h-44',
    hero: 'w-52 h-52 sm:w-60 sm:h-60',
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center relative select-none ${className || ''}`}>
      <ConfettiBurst active={showConfetti} />
      {/* Cartoon Character Frame Container */}
      <div className={`relative flex items-center justify-center ${config.animationClass}`}>

        {/* Dex Mascot Character Image Card */}
        <div
          className={`relative ${sizeClasses} rounded-3xl overflow-hidden p-2 bg-gradient-to-b from-white via-amber-50/50 to-indigo-50/50 border-2 ${config.borderColor} shadow-lg backdrop-blur-md flex items-center justify-center`}
        >
          <img
            src={dexCharacterImg}
            alt={TUTOR_NAME}
            width={480}
            height={311}
            loading="eager"
            fetchPriority="high"
            className={`w-full h-full object-contain filter drop-shadow-md transition-transform duration-300 ${
              state === 'celebrating' ? 'scale-105' : ''
            }`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.insertAdjacentHTML('beforeend', '<span class="text-6xl" aria-hidden="true">🤖</span>');
            }}
          />
        </div>

        {/* State Status Badge */}
        <div
          className={`absolute -bottom-3 px-3 py-1 rounded-full ${config.badgeBg} ${config.badgeText} font-display text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 z-20 border border-white/80`}
        >
          <span className="material-symbols-outlined text-sm sm:text-base">{config.badgeIcon}</span>
          <span>{config.badgeLabel}</span>
        </div>
      </div>

      {/* Speech Bubble Caption */}
      {showCaptionBubble && caption && (
        <div className="mt-5 relative max-w-sm sm:max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-secondary/30 shadow-md text-center animate-in fade-in slide-in-from-bottom-2">
          {/* Speech bubble pointer */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-6 border-l-transparent border-r-6 border-r-transparent border-b-6 border-b-white/95" />
          <p className="font-body text-sm sm:text-base text-on-surface font-semibold leading-relaxed">
            "{caption}"
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-1 font-display text-[10px] font-extrabold uppercase tracking-widest text-secondary">
            <span className="material-symbols-outlined text-xs">auto_awesome</span>
            {TUTOR_NAME} — Reading Companion
          </div>
        </div>
      )}

      {/* Clean Character Animations */}
      <style>{`
        @keyframes dex-breathe {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes dex-speak {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.03); }
        }
        @keyframes dex-listen {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(-1.5deg); }
        }
        @keyframes dex-think {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(2deg) translateY(-2px); }
        }
        @keyframes dex-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }
        @keyframes dex-encourage {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
