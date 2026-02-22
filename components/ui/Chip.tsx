import { type HTMLAttributes } from 'react';
import { chip, chipAccent, chipOutline } from '../../lib/ui';

type ChipVariant = 'default' | 'outline' | 'accent';

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: ChipVariant;
};

const variantClasses: Record<ChipVariant, string> = {
  default: chip,
  outline: chipOutline,
  accent: chipAccent,
};

export function Chip({ variant = 'default', className = '', ...props }: ChipProps) {
  return <span className={`${variantClasses[variant]} ${className}`.trim()} {...props} />;
}


