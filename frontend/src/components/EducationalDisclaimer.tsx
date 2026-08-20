import React from 'react';

interface Props {
  className?: string;
  variant?: 'subtle' | 'card' | 'inline';
}

export function EducationalDisclaimer({ className = '', variant = 'subtle' }: Props) {
  const baseText = "Decodex is an educational screening and practice tool. It does not provide clinical diagnosis. For formal assessment, consult a qualified speech-language pathologist or educational psychologist.";

  if (variant === 'card') {
    return (
      <div className={`p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant leading-relaxed ${className}`}>
        <strong className="font-semibold text-on-surface block mb-1">Educational Disclaimer:</strong>
        {baseText}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <p className={`text-xs text-on-surface-variant ${className}`}>
        <span className="font-semibold">Educational Disclaimer:</span> {baseText}
      </p>
    );
  }

  return (
    <div className={`py-3 px-4 text-center text-xs text-on-surface-variant/80 border-t border-outline-variant/20 ${className}`}>
      <span className="font-semibold">Educational Disclaimer:</span> {baseText}
    </div>
  );
}

export default EducationalDisclaimer;
