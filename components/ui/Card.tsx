import { type HTMLAttributes } from 'react';
import { card } from '../../lib/ui';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'muted';
};

export function Card({ variant = 'default', className = '', ...props }: CardProps) {
  const classes = variant === 'muted' ? `${card} bg-slate-50` : card;
  return <div className={`${classes} ${className}`.trim()} {...props} />;
}


