import React from 'react';
import { Card as CardType } from '@shared/types';

interface CardProps {
  card: CardType;
  hidden?: boolean;
  className?: string;
}

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export function Card({ card, hidden = false, className = '' }: CardProps) {
  if (hidden || card.suit === 'hidden' as any) {
    return (
      <div className={`playing-card hidden ${className}`}>
        <div className="text-white text-2xl">🂠</div>
      </div>
    );
  }
  
  return (
    <div className={`playing-card ${card.suit} ${className}`}>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-bold">{card.rank}</span>
        <span className="text-4xl">{suitSymbols[card.suit]}</span>
      </div>
    </div>
  );
}
