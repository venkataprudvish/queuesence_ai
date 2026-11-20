import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  onClick,
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  const interactiveStyles = onClick
    ? 'cursor-pointer hover:border-[#A8B9A0] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#244C3A]'
    : '';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`bg-[#FFFDF6] border border-[#E1E6DA] rounded-2xl ${paddingStyles[padding]} ${interactiveStyles} ${className}`}
    >
      {children}
    </div>
  );
};
