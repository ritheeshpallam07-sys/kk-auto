import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  durationMs = 1200,
}) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, Math.max(300, durationMs - 300));

    const endTimer = setTimeout(() => {
      onComplete();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [durationMs, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0B0D] transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background radial lime glow */}
      <div className="absolute w-72 h-72 rounded-full bg-[#C6FF3D]/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 animate-fade-in">
        {/* Centered Brand Logo */}
        <div className="mb-6 transform scale-110 sm:scale-125 transition-transform">
          <Logo size="xl" showTagline={false} />
        </div>

        {/* Subtitle pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#171719] border border-[#303034] text-xs font-semibold text-[#A1A1AA] mb-8">
          <span className="w-2 h-2 rounded-full bg-[#C6FF3D] animate-pulse" />
          <span>Point to Point Auto Rides</span>
        </div>

        {/* Loading bar */}
        <div className="w-36 h-1 bg-[#202023] rounded-full overflow-hidden">
          <div className="h-full bg-[#C6FF3D] rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    </div>
  );
};
