import type { ComponentProps } from 'react';

export function Surface({
  className = '',
  ...props
}: ComponentProps<'section'>) {
  return <section className={`surface ${className}`} {...props} />;
}
