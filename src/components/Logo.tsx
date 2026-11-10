import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'blue' | 'white' | 'color';
  alt?: string;
}

/**
 * Official EFA GARDE Logo component
 * 100% faithful to the official emblem: blue shield, dark blue EFA lettering, blue medical cross
 * Fully responsive across mobile, tablet, and desktop with zero distortion
 */
export const Logo: React.FC<LogoProps> = ({
  className = 'w-10 h-10',
  size,
  variant,
  alt = 'EFA GARDE - Pharmacies de Garde Lomé',
}) => {
  return (
    <img
      src="/logo-transparent.png"
      alt={alt}
      className={`inline-block ${className}`}
      style={{
        width: size ? `${size}px` : undefined,
        height: size ? `${size}px` : undefined,
        objectFit: 'contain',
        maxWidth: '100%',
        maxHeight: '100%',
        filter: variant === 'white' ? 'brightness(0) invert(1)' : undefined,
      }}
      loading="eager"
      decoding="async"
    />
  );
};

export default Logo;
