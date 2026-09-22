import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  theme?: 'dark' | 'light';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false, theme = 'dark' }) => {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14'
  };

  const textSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  const taglineSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm'
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Auto-Rickshaw SVG Icon Badge */}
      <div className={`${iconSizes[size]} bg-amber-500 rounded-xl p-1.5 shadow-md flex items-center justify-center text-slate-950 flex-shrink-0 transition-transform hover:scale-105`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          {/* Rickshaw canopy */}
          <path d="M4 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" />
          {/* Windshield & front frame */}
          <path d="M18 11l2 4h-2" />
          <path d="M4 11H2l1 4h1" />
          {/* Body */}
          <path d="M3 15h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z" fill="currentColor" fillOpacity="0.2" />
          {/* Wheels */}
          <circle cx="6.5" cy="18.5" r="2.5" fill="currentColor" />
          <circle cx="17.5" cy="18.5" r="2.5" fill="currentColor" />
          {/* Front headlight */}
          <path d="M20 13h1" strokeWidth="3" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className={`font-extrabold tracking-tight ${textSizes[size]} ${theme === 'light' ? 'text-white' : 'text-slate-900'}`}>
          <span>Kk_</span>
          <span className="text-amber-500">Auto</span>
        </div>
        {showTagline && (
          <span className={`font-medium tracking-wide text-slate-500 -mt-1 ${taglineSizes[size]} ${theme === 'light' ? 'text-slate-300' : 'text-slate-500'}`}>
            Your ride, your way.
          </span>
        )}
      </div>
    </div>
  );
};
