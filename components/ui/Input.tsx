import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { input } from '../../lib/ui';

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(
  ({ className = '', ...props }, ref) => {
    return <input ref={ref} className={`${input} ${className}`.trim()} {...props} />;
  }
);

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(
  ({ className = '', ...props }, ref) => {
    return <textarea ref={ref} className={`${input} ${className}`.trim()} {...props} />;
  }
);

Textarea.displayName = 'Textarea';


