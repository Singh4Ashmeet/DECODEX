import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={`stat-card bg-surface-container-high/50 rounded-xl ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number, className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={`stat-card stat-card-hover bg-surface-container-high/50 rounded-2xl p-6 ${className}`}
    >
      <div className="h-8 w-1/3 bg-surface-container-high rounded-lg mb-4" />
      <div className="h-4 w-full bg-surface-container-high rounded-lg mb-2" />
      <div className="h-4 w-3/4 bg-surface-container-high rounded-lg" />
    </motion.div>
  );
}