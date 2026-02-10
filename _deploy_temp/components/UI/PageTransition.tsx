'use client';

import { Box, BoxProps } from '@mantine/core';

interface PageTransitionProps extends BoxProps {
  children: React.ReactNode;
}

export function PageTransition({ children, style, ...props }: PageTransitionProps) {
  return (
    <Box
      style={{
        animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        opacity: 0, // Start invisible, let animation handle it
        ...style,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
