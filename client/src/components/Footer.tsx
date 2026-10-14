import React from 'react';
import { Logo } from './Logo';
import { Phone, Mail, Globe, ShieldCheck } from 'lucide-react';

interface FooterProps {
  navigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="bg-[#071426] text-[#A9B7C9] border-t border-[#10243D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="space-y-4">
            <Logo size="md" showTagline={true} theme="light" />

            <p className="text-xs text-[#A9B7C9] leading-relaxed max-w-xs">
              Fast, dependable, and transparent auto-rickshaw rides with point-to-point fixed fares. Your ride is always just a tap away.
            </p>

            <div className="flex items-center gap-2 text-xs font-semibold text-[#FF8A00]">
              <ShieldCheck className="w-4 h-4 text-[#FF8A00]" />
              <span>Verified Drivers & Safe Rides</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Quick Links
            </h4>

            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-[#FF8A00] transition-colors"
                >
                  Home
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigate('/book')}
                  className="hover:text-[#FF8A00] transition-colors"
                >
                  Book an Auto
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigate('/my-rides')}
                  className="hover:text-[#FF8A00] transition-colors"
                >
                  My Rides
                </button>
              </li>

              <li>
                <a
                  href="https://clik2go.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#FF8A00] transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-[#FF8A00]" />
                  <span>clik2go.in</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Services
            </h4>

            <ul className="space-y-2.5 text-xs text-[#A9B7C9]">
              <li>Instant Doorstep Auto Booking</li>
              <li>Scheduled Daily Commutes</li>
              <li>Fixed Transparent Routes</li>
              <li>Intercity Car & Trip Booking</li>
              <li>Instant Cashless & Online Checkout</li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Support
            </h4>

            <ul className="space-y-3 text-xs text-[#A9B7C9]">
              <li className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#10243D] flex items-center justify-center text-[#FF8A00]">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Helpline</div>
                  <span className="font-semibold text-white">24/7 Booking Support</span>
                </div>
              </li>

              <li className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#10243D] flex items-center justify-center text-[#FF8A00]">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Email</div>
                  <a href="mailto:support@clik2go.in" className="font-semibold text-white hover:text-[#FF8A00] transition-colors">
                    support@clik2go.in
                  </a>
                </div>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-[#10243D] mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A9B7C9]">
          <div>
            © {new Date().getFullYear()} <strong className="text-white">Clik2Go</strong>. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Safe Transit Platform</span>
            <span>•</span>
            <a href="https://clik2go.in" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF8A00] transition-colors">
              https://clik2go.in
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};