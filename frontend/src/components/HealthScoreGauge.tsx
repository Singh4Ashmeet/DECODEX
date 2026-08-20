import React from 'react';

interface HealthScoreGaugeProps {
  score: number;
  riskLevel: string;
}

export function HealthScoreGauge({ score, riskLevel }: HealthScoreGaugeProps) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  const riskColors: Record<string, string> = {
    excellent: 'var(--risk-excellent-border)',
    good: 'var(--risk-good-border)',
    medium: 'var(--risk-medium-border)',
    high: 'var(--risk-high-border)',
    critical: 'var(--risk-critical-border)',
  };
  const color = riskColors[riskLevel] || 'var(--color-primary)';

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-surface-container-high opacity-30" />
        <circle
          cx="72" cy="72" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-extrabold" style={{ color }}>{score}</span>
        <span className="badge-risk mt-1" style={{ backgroundColor: `var(--risk-${riskLevel}-bg)`, color: `var(--risk-${riskLevel}-text)`, borderColor: `var(--risk-${riskLevel}-border)` }}>{riskLevel}</span>
      </div>
    </div>
  );
}