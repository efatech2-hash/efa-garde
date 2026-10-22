import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'blue' | 'white' | 'color';
}

/**
 * Official EFA GARDE Logo component
 * Exact reproduction of the official shield logo with EFA lettering & medical cross
 */
export const Logo: React.FC<LogoProps> = ({
  className = 'w-10 h-10',
  size,
  variant = 'blue',
}) => {
  const primaryColor = variant === 'white' ? '#ffffff' : '#0b5cb5';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
    >
      {/* Upper Hexagonal Crown Shield */}
      <path
        d="M 256,86 
           L 398,144 
           L 398,258 
           L 114,258 
           L 114,144 
           Z"
        fill="none"
        stroke={primaryColor}
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* "EFA" Bold Geometric Letters */}
      {/* Letter E */}
      <path
        d="M 138,166 H 198 V 189 H 164 V 201 H 194 V 222 H 164 V 234 H 198 V 257 H 138 Z"
        fill={primaryColor}
      />

      {/* Letter F */}
      <path
        d="M 214,166 H 272 V 189 H 240 V 201 H 268 V 222 H 240 V 257 H 214 Z"
        fill={primaryColor}
      />

      {/* Letter A */}
      <path
        d="M 326,166 L 368,257 H 343 L 336,241 H 304 L 297,257 H 273 L 315,166 Z 
           M 320,201 L 310,223 H 330 Z"
        fill={primaryColor}
      />
      {/* A vertical right framing guide stroke */}
      <path
        d="M 374,174 V 257 H 397 V 174 Z"
        fill={primaryColor}
      />

      {/* Lower Shield Divider Bar with Shoulders */}
      <path
        d="M 114,275 
           H 398 
           V 297 
           C 388,301 384,307 384,318 
           C 384,380 330,424 256,442 
           C 182,424 128,380 128,318 
           C 128,307 124,301 114,297 
           Z"
        fill="none"
        stroke={primaryColor}
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Medical Cross (+) inside Lower Shield */}
      {/* Vertical beam */}
      <rect
        x="238"
        y="275"
        width="36"
        height="110"
        rx="5"
        ry="5"
        fill={primaryColor}
      />
      {/* Horizontal beam */}
      <rect
        x="200"
        y="312"
        width="112"
        height="36"
        rx="5"
        ry="5"
        fill={primaryColor}
      />
    </svg>
  );
};

export default Logo;
