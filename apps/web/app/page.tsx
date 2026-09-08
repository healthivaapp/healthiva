'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const rotatingWords = ['Smarter.', 'Faster.', 'Easier.', 'Better.'];

export default function HealthivaLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Smooth dynamic text animation
  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % rotatingWords.length);
        setFade(true);
      }, 350);
    }, 2800);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fbfe] text-slate-800 flex flex-col selection:bg-[#009fe3] selection:text-white">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (BIG CRISP LOGO & CLEAN NAV)                       */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs transition-colors duration-200">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-22 flex items-center justify-between">
          
          {/* Big High-Definition Brand Logo */}
          <Link href="/" className="flex items-center group py-1">
            <div className="relative w-56 sm:w-76 md:w-84 h-14 sm:h-18 flex items-center transition-transform duration-300 group-hover:scale-[1.01]">
              <Image 
                src="/healthiva-logo.png" 
                alt="Healthiva — Run Your Clinic Smarter." 
                fill 
                className="object-contain object-left scale-115 sm:scale-120 origin-left"
                priority
                unoptimized
              />
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-medium text-slate-700">
            <div className="relative group cursor-pointer flex items-center gap-1 hover:text-[#009fe3] transition-colors duration-200 py-2">
              <span>Features</span>
              <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#009fe3] transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <div className="relative group cursor-pointer flex items-center gap-1 hover:text-[#009fe3] transition-colors duration-200 py-2">
              <span>Solutions</span>
              <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#009fe3] transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <Link href="#pricing" className="hover:text-[#009fe3] transition-colors duration-200 py-2">
              Pricing
            </Link>

            <div className="relative group cursor-pointer flex items-center gap-1 hover:text-[#009fe3] transition-colors duration-200 py-2">
              <span>Resources</span>
              <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#009fe3] transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <Link href="#about" className="hover:text-[#009fe3] transition-colors duration-200 py-2">
              About Us
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden lg:flex items-center gap-5">
            <Link 
              href="/login" 
              className="text-[15px] font-semibold text-slate-700 hover:text-[#009fe3] transition-colors duration-200 px-3 py-2"
            >
              Login
            </Link>
            <Link 
              href="/start-trial" 
              className="relative overflow-hidden group bg-[#009fe3] hover:bg-[#008bc7] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md hover:shadow-sky-500/20 transition-all duration-300 hover:-translate-y-0.5 active:scale-98"
            >
              <span className="relative z-10">Start Free Trial</span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out" />
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button 
            type="button" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-5 flex flex-col gap-4 text-[15px] font-medium text-slate-700 shadow-xl transition-all duration-200">
            <Link href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#009fe3] transition-colors">Features</Link>
            <Link href="#solutions" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#009fe3] transition-colors">Solutions</Link>
            <Link href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#009fe3] transition-colors">Pricing</Link>
            <Link href="#resources" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#009fe3] transition-colors">Resources</Link>
            <Link href="#about" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#009fe3] transition-colors">About Us</Link>
            <hr className="border-slate-100 my-1" />
            <div className="flex flex-col gap-3">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-center py-2.5 font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Login
              </Link>
              <Link href="/start-trial" onClick={() => setMobileMenuOpen(false)} className="text-center py-2.5 font-bold bg-[#009fe3] text-white rounded-lg shadow-sm hover:bg-[#008bc7] transition-colors">
                Start 30-Day Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION (WITH DYNAMIC ANIMATED TEXT & FLOATING SHOWCASE)          */}
      {/* ========================================================================= */}
      <section className="relative pt-6 sm:pt-12 pb-12 sm:pb-14 overflow-hidden">
        {/* Soft Ambient Glow with Gentle Breathing Pulse */}
        <div className="absolute top-0 left-1/4 w-[650px] h-[450px] bg-sky-200/35 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow" />

        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-5 flex flex-col items-start z-10">
              
              {/* Category Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#e8f6fd] border border-[#bae4fb] text-[#009fe3] text-xs sm:text-[13px] font-bold mb-4 sm:mb-6 shadow-2xs hover:scale-105 transition-transform duration-200 cursor-default">
                <span>All-in-One Clinic Management Software</span>
              </div>

              {/* Main Headline with Animated Rotating Text */}
              <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-extrabold text-[#0f172a] tracking-tight leading-[1.15] mb-4 sm:mb-5 min-h-[110px] sm:min-h-[140px]">
                Run Your Clinic <br />
                <span 
                  className={`inline-block text-[#009fe3] bg-gradient-to-r from-[#009fe3] via-[#0ea5e9] to-[#0284c7] bg-clip-text text-transparent transition-all duration-350 transform ${
                    fade 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'opacity-0 -translate-y-2.5 scale-95'
                  }`}
                >
                  {rotatingWords[wordIndex]}
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-slate-600 text-sm sm:text-lg leading-relaxed max-w-lg mb-6 sm:mb-8 font-normal">
                Healthiva helps you simplify appointments, manage patients, billing, inventory and reports — all in one place.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 w-full sm:w-auto mb-6 sm:mb-8">
                <Link
                  href="/start-trial"
                  className="group relative overflow-hidden w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white text-[15px] font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-sky-400/25 transition-all duration-300 hover:-translate-y-0.5 active:scale-98"
                >
                  <span className="relative z-10">Start 30-Day Free Trial</span>
                  <svg className="w-4 h-4 relative z-10 group-hover:translate-x-1.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out" />
                </Link>

                <Link
                  href="#features"
                  className="w-full sm:w-auto inline-flex items-center justify-center bg-white hover:bg-sky-50 text-[#009fe3] border-2 border-[#bae4fb] hover:border-[#009fe3] text-[15px] font-bold px-7 py-3.5 rounded-xl transition-all duration-200 shadow-xs hover:-translate-y-0.5"
                >
                  Explore Features
                </Link>
              </div>

              {/* Trust Badge with SVG Shield */}
              <div className="flex items-center gap-2.5 text-slate-600 text-xs sm:text-[13px] font-medium pt-1 sm:pt-2">
                <div className="w-5 h-5 relative shrink-0">
                  <svg className="w-5 h-5 text-[#009fe3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <span>Trusted by Clinics & Healthcare Professionals</span>
              </div>
            </div>

            {/* Right Column: Silky Floating Showcase Image */}
            <div className="lg:col-span-7 relative w-full flex justify-center items-center p-0 m-0">
              <div className="relative w-full flex justify-center items-center animate-float">
                <Image
                  src="/healthiva-dashboard-showcase.png"
                  alt="Healthiva Clinic Dashboard & Doctor Mobile App Interface"
                  width={1200}
                  height={700}
                  className="w-full h-auto object-contain block drop-shadow-2xl select-none pointer-events-none transition-transform duration-300 hover:scale-[1.01]"
                  priority
                  unoptimized
                />
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SIX CORE FEATURE HIGHLIGHT CARDS (SMOOTH HOVER LIFT & ICON ZOOM)      */}
      {/* ========================================================================= */}
      <section id="features" className="py-4 sm:py-6 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-300">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-7 gap-x-4 sm:gap-6 items-stretch">
            
            {/* Feature 1: Smart Appointments */}
            <div className="flex flex-col items-center text-center group w-full h-full justify-between p-3 rounded-xl transition-all duration-300 hover:bg-sky-50/50 hover:-translate-y-1 cursor-pointer">
              <div className="w-12 h-12 sm:w-14 sm:h-14 relative mb-3 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Image 
                  src="/vectors/01_smart_appointments.svg" 
                  alt="Smart Appointments" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <div className="flex flex-col items-center flex-1 justify-between w-full">
                <h4 className="font-bold text-[13px] sm:text-[14px] text-slate-800 mb-1 leading-snug min-h-[34px] flex items-center justify-center group-hover:text-[#009fe3] transition-colors duration-200">
                  Smart Appointments
                </h4>
                <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                  Manage appointments effortlessly
                </p>
              </div>
            </div>

            {/* Feature 2: Patient Management */}
            <div className="flex flex-col items-center text-center group w-full h-full justify-between p-3 rounded-xl transition-all duration-300 hover:bg-sky-50/50 hover:-translate-y-1 cursor-pointer">
              <div className="w-12 h-12 sm:w-14 sm:h-14 relative mb-3 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Image 
                  src="/vectors/02_patient_management.svg" 
                  alt="Patient Management" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <div className="flex flex-col items-center flex-1 justify-between w-full">
                <h4 className="font-bold text-[13px] sm:text-[14px] text-slate-800 mb-1 leading-snug min-h-[34px] flex items-center justify-center group-hover:text-[#009fe3] transition-colors duration-200">
                  Patient Management
                </h4>
                <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                  Keep patient records organized and secure
                </p>
              </div>
            </div>

            {/* Feature 3: Billing & Invoices */}
            <div className="flex flex-col items-center text-center group w-full h-full justify-between p-3 rounded-xl transition-all duration-300 hover:bg-sky-50/50 hover:-translate-y-1 cursor-pointer">
              <div className="w-12 h-12 sm:w-14 sm:h-14 relative mb-3 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Image 
                  src="/vectors/03_billing_invoices.svg" 
                  alt="Billing & Invoices" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <div className="flex flex-col items-center flex-1 justify-between w-full">
                <h4 className="font-bold text-[13px] sm:text-[14px] text-slate-800 mb-1 leading-snug min-h-[34px] flex items-center justify-center group-hover:text-[#009fe3] transition-colors duration-200">
                  Billing & Invoices
                </h4>
                <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                  Create invoices, manage payments and dues
                </p>
              </div>
            </div>

            {/* Feature 4: Inventory Management */}
            <div className="flex flex-col items-center text-center group w-full h-full justify-between p-3 rounded-xl transition-all duration-300 hover:bg-sky-50/50 hover:-translate-y-1 cursor-pointer">
              <div className="w-12 h-12 sm:w-14 sm:h-14 relative mb-3 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Image 
                  src="/vectors/04_inventory_management.svg" 
                  alt="Inventory Management" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <div className="flex flex-col items-center flex-1 justify-between w-full">
                <h4 className="font-bold text-[13px] sm:text-[14px] text-slate-800 mb-1 leading-snug min-h-[34px] flex items-center justify-center group-hover:text-[#009fe3] transition-colors duration-200">
                  Inventory Management
                </h4>
                <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                  Track medicine & supplies in real-time
                </p>
              </div>
            </div>

            {/* Feature 5: Reports & Analytics */}
            <div className="flex flex-col items-center text-center group w-full h-full justify-between p-3 rounded-xl transition-all duration-300 hover:bg-sky-50/50 hover:-translate-y-1 cursor-pointer">
              <div className="w-12 h-12 sm:w-14 sm:h-14 relative mb-3 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Image 
                  src="/vectors/05_reports_analytics.svg" 
                  alt="Reports & Analytics" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <div className="flex flex-col items-center flex-1 justify-between w-full">
                <h4 className="font-bold text-[13px] sm:text-[14px] text-slate-800 mb-1 leading-snug min-h-[34px] flex items-center justify-center group-hover:text-[#009fe3] transition-colors duration-200">
                  Reports & Analytics
                </h4>
                <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                  Get insights and grow your clinic
                </p>
              </div>
            </div>

            {/* Feature 6: Multi-User Access */}
            <div className="flex flex-col items-center text-center group w-full h-full justify-between p-3 rounded-xl transition-all duration-300 hover:bg-sky-50/50 hover:-translate-y-1 cursor-pointer">
              <div className="w-12 h-12 sm:w-14 sm:h-14 relative mb-3 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Image 
                  src="/vectors/06_multi_user_access.svg" 
                  alt="Multi-User Access" 
                  width={56} 
                  height={56} 
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <div className="flex flex-col items-center flex-1 justify-between w-full">
                <h4 className="font-bold text-[13px] sm:text-[14px] text-slate-800 mb-1 leading-snug min-h-[34px] flex items-center justify-center group-hover:text-[#009fe3] transition-colors duration-200">
                  Multi-User Access
                </h4>
                <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                  Add staff and manage roles easily
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. STATS & DATA SECURITY BANNER (#042451 EXACT 5-COLUMN BALANCED GRID)    */}
      {/* ========================================================================= */}
      <section className="py-4 sm:py-6 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 w-full mb-12">
        <div className="bg-[#042451] text-white rounded-2xl px-6 sm:px-8 py-7 sm:py-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-0 items-center">
            
            {/* 1. Happy Clinics */}
            <div className="flex flex-col items-center justify-center text-center lg:border-r border-white/20 px-2 sm:px-4 group cursor-default">
              <div className="text-3xl sm:text-[34px] font-bold text-white tracking-tight leading-none mb-1.5 transition-transform duration-200 group-hover:scale-105">
                500+
              </div>
              <div className="text-xs sm:text-[13px] text-slate-300 font-normal">
                Happy Clinics
              </div>
            </div>

            {/* 2. Patients Managed */}
            <div className="flex flex-col items-center justify-center text-center lg:border-r border-white/20 px-2 sm:px-4 group cursor-default">
              <div className="text-3xl sm:text-[34px] font-bold text-white tracking-tight leading-none mb-1.5 transition-transform duration-200 group-hover:scale-105">
                50,000+
              </div>
              <div className="text-xs sm:text-[13px] text-slate-300 font-normal">
                Patients Managed
              </div>
            </div>

            {/* 3. Appointments */}
            <div className="flex flex-col items-center justify-center text-center lg:border-r border-white/20 px-2 sm:px-4 group cursor-default">
              <div className="text-3xl sm:text-[34px] font-bold text-white tracking-tight leading-none mb-1.5 transition-transform duration-200 group-hover:scale-105">
                1M+
              </div>
              <div className="text-xs sm:text-[13px] text-slate-300 font-normal">
                Appointments
              </div>
            </div>

            {/* 4. Data Security */}
            <div className="flex flex-col items-center justify-center text-center lg:border-r border-white/20 px-2 sm:px-4 group cursor-default">
              <div className="text-3xl sm:text-[34px] font-bold text-white tracking-tight leading-none mb-1.5 transition-transform duration-200 group-hover:scale-105">
                99.9%
              </div>
              <div className="text-xs sm:text-[13px] text-slate-300 font-normal">
                Data Security
              </div>
            </div>

            {/* 5. Security Guarantee Block */}
            <div className="sm:col-span-2 lg:col-span-1 flex items-center justify-center lg:justify-start gap-3.5 lg:pl-8 pt-4 sm:pt-0 border-t sm:border-t-0 border-white/15 group cursor-default">
              <div className="w-8 h-8 relative shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Image 
                  src="/vectors/07_data_security.svg" 
                  alt="Data Security Shield" 
                  width={32} 
                  height={32} 
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div className="text-left">
                <div className="font-bold text-xs sm:text-[13.5px] text-white leading-tight mb-0.5 group-hover:text-sky-300 transition-colors duration-200">
                  Your Data is Safe with Us
                </div>
                <div className="text-[11px] sm:text-[12px] text-slate-300 leading-tight">
                  We follow highest security<br className="hidden sm:inline" /> standards to keep your data protected.
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="border-t border-slate-200/60 bg-white py-8 text-center text-xs text-slate-500">
        <div className="max-w-[1380px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Healthiva</span>
            <span>·</span>
            <span>Run Your Clinic Smarter.</span>
          </div>
          <div>
            © {new Date().getFullYear()} Healthiva Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
