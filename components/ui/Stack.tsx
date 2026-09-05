import React from 'react';

export interface StackProps {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
  direction?: 'horizontal' | 'vertical';
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}

const spacingMap = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

export function Stack({ 
  children, 
  className = '', 
  'aria-label': ariaLabel,
  direction = 'vertical',
  spacing = 'md',
  align = 'stretch',
  justify = 'start'
}: StackProps) {
  const directionClass = direction === 'horizontal' ? 'flex-row' : 'flex-col';
  const spacingClass = spacingMap[spacing];
  const alignClass = alignMap[align];
  const justifyClass = justifyMap[justify];

  return (
    <div aria-label={ariaLabel} className={`flex ${directionClass} ${spacingClass} ${alignClass} ${justifyClass} ${className}`}>
      {children}
    </div>
  );
}
