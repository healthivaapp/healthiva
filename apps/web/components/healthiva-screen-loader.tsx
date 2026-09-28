'use client';

import React from 'react';
import Image from 'next/image';

interface HealthivaScreenLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export function HealthivaScreenLoader({
  message = 'Loading your clinic workspace...',
  subMessage = 'Setting up permissions, branches, and clinic records',
  fullScreen = true,
}: HealthivaScreenLoaderProps) {
  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
      {/* Brand Icon Container with Radial Glow */}
      <div className="relative mb-6">
        {/* Soft Ambient Radial Halo */}
        <div className="absolute -inset-4 bg-gradient-to-tr from-[#009fe3]/20 via-[#042451]/10 to-teal-400/20 rounded-full blur-2xl animate-pulse pointer-events-none" />

        {/* Outer Animated Ring */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-[#009fe3]/10 flex items-center justify-center p-4">
          {/* Subtle spinning accent border */}
          <div className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-[#009fe3]/60 border-r-[#009fe3]/20 animate-spin [animation-duration:3s]" />
          
          {/* Logo Mark / Wordmark */}
          <div className="relative w-full h-full flex items-center justify-center animate-pulse [animation-duration:2s]">
            <Image
              src="/healthiva-icon.png"
              alt="Healthiva"
              fill
              className="object-contain p-1"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Small floating pulse dot */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-[#009fe3] animate-ping" />
          <span className="absolute w-2.5 h-2.5 rounded-full bg-[#009fe3]" />
        </div>
      </div>

      {/* Primary Message */}
      <h3 className="text-base sm:text-lg font-extrabold text-[#0f172a] tracking-tight mb-1.5">
        {message}
      </h3>

      {/* Subtext */}
      {subMessage && (
        <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-xs sm:max-w-sm leading-relaxed mb-4">
          {subMessage}
        </p>
      )}

      {/* Micro Progress Indicator */}
      <div className="w-48 sm:w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 bg-gradient-to-r from-[#009fe3] via-[#042451] to-[#009fe3] w-1/2 rounded-full animate-[progress_1.6s_ease-in-out_infinite]" />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#f8fbfe] flex items-center justify-center font-sans">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center font-sans">
      {content}
    </div>
  );
}
