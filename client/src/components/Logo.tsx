import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  theme?: 'dark' | 'light';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false }) => {
  const iconSizes = {
    sm: 'w-7 h-7 rounded-lg p-1',
    md: 'w-9 h-9 rounded-xl p-1.5',
    lg: 'w-12 h-12 rounded-2xl p-2',
    xl: 'w-16 h-16 rounded-2xl p-2.5',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const taglineSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  return (
    <div className="flex items-center gap-2.5 select-none group">
      {/* Premium Clik2Go Black & Lime Badge */}
      <div className={`${iconSizes[size]} bg-[#171719] text-[#C6FF3D] border border-[#303034] shadow-subtle flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 group-hover:border-[#C6FF3D]/50`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-[#C6FF3D]">
          {/* Rickshaw canopy & modern streamlined cab */}
          <path d="M4 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" />
          <path d="M18 11l2 4h-2" />
          <path d="M4 11H2l1 4h1" />
          <path d="M3 15h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z" fill="currentColor" fillOpacity="0.2" />
          <circle cx="6.5" cy="18.5" r="2" fill="currentColor" />
          <circle cx="17.5" cy="18.5" r="2" fill="currentColor" />
          <path d="M19 13h2" strokeWidth="2.5" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className={`font-black tracking-tight leading-none ${textSizes[size]}`}>
          <span className="text-white">Clik</span>
          <span className="text-[#C6FF3D]">2Go</span>
        </div>
        {showTagline && (
          <span className={`font-semibold tracking-normal mt-1 leading-tight hidden sm:inline-block ${taglineSizes[size]} text-[#A1A1AA]`}>
            Your Ride, Just a Tap Away
          </span>
        )}
      </div>
    </div>
  );
};
