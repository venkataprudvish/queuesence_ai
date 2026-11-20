import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 rounded-xl whitespace-nowrap shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#244C3A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5EC] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[#244C3A] text-[#F7F5EC] hover:bg-[#1C3D2E] border border-[#244C3A]',
    secondary:
      'bg-[#E1E6DA] text-[#244C3A] hover:bg-[#D3DBC9] border border-[#A8B9A0]/50',
    outline:
      'bg-[#FFFDF6] text-[#244C3A] border border-[#A8B9A0] hover:bg-[#F7F5EC]',
    ghost:
      'bg-transparent text-[#252B26] hover:bg-[#E1E6DA]/60 border border-transparent',
    danger:
      'bg-[#C66B5B] text-[#FFFDF6] hover:bg-[#B25A4B] border border-[#C66B5B]',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'min-h-[40px] px-3.5 py-2 text-xs',
    md: 'min-h-[44px] px-4 py-2.5 text-sm',
    lg: 'min-h-[48px] px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
