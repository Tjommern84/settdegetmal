import Link from 'next/link';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { buttonPrimary, buttonSecondary, buttonDestructive } from '../../lib/ui';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
};

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: buttonPrimary,
  secondary: buttonSecondary,
  destructive: buttonDestructive,
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}

export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  return (
    <Link
      className={`${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}


