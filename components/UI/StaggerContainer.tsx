'use client';

import { Box, BoxProps } from '@mantine/core';
import React, { Children, isValidElement } from 'react';

interface StaggerContainerProps extends BoxProps {
  children: React.ReactNode;
  staggerDelay?: number; // ms
  initialDelay?: number; // ms
}

export function StaggerContainer({ 
  children, 
  staggerDelay = 50, 
  initialDelay = 0,
  style,
  ...props 
}: StaggerContainerProps) {
  
  return (
    <Box {...props} style={style}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;

        return (
          <div
            style={{
              animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              opacity: 0,
              animationDelay: `${initialDelay + index * staggerDelay}ms`,
            }}
          >
            {child}
          </div>
        );
      })}
    </Box>
  );
}
