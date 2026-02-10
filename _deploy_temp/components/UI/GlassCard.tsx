'use client';

import { Paper, PaperProps, createPolymorphicComponent } from '@mantine/core';
import classes from './GlassCard.module.css';

interface _GlassCardProps extends PaperProps {
  variant?: 'static' | 'interactive' | 'active';
  children: React.ReactNode;
}

const GlassCard = createPolymorphicComponent<'div', _GlassCardProps>(
  ({ variant = 'static', children, className, style, ...props }: _GlassCardProps & { className?: string, style?: any }, ref: any) => {
    
    // Determine class based on variant
    const getVariantClass = () => {
        switch(variant) {
            case 'interactive': return classes.interactive;
            case 'active': return classes.active;
            default: return classes.static;
        }
    };

    return (
      <Paper
        ref={ref}
        p="md"
        radius="lg"
        className={`${classes.base} ${getVariantClass()} ${className || ''}`}
        style={style}
        {...props}
      >
        {children}
      </Paper>
    );
  }
);

export { GlassCard };
