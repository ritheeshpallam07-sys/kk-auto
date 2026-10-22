import React from 'react';
import { Logo } from './Logo';
import { Phone, Mail, Globe, ShieldCheck } from 'lucide-react';

interface FooterProps {
  navigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="bg-[#0B0B0D] text-[#A1A1AA] border-t border-[#303034] safe-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="space-y-3.5">
            <Logo size="md" showTagline={false} />

            <p className="text-xs text-[#A1A1AA] leading-relaxed max-w-xs">
              Fast, dependable, and transparent auto-rickshaw rides with point-to-point fixed fares. Your ride is always just a tap away.
            </p>

            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-[#C6FF3D]" />
              <span>Verified Drivers & Safe Rides</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold text-white mb-3.5 uppercase tracking-wider">
              Quick Links
            </h4>

            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-[#C6FF3D] transition-colors"
                >
                  Home
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigate('/book')}
                  className="hover:text-[#C6FF3D] transition-colors"
                >
                  Book an Auto
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigate('/my-rides')}
                  className="hover:text-[#C6FF3D] transition-colors"
                >
                  My Rides
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigate('/profile')}
                  className="hover:text-[#C6FF3D] transition-colors"
                >
                  Profile & Settings
                </button>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs font-bold text-white mb-3.5 uppercase tracking-wider">
              Services
            </h4>

            <ul className="space-y-2 text-xs text-[#A1A1AA]">
              <li>Instant Doorstep Auto Booking</li>
              <li>Scheduled Daily Commutes</li>
              <li>Fixed Transparent Routes</li>
              <li>Intercity Car & Trip Booking</li>
              <li>Instant Cashless & Online Checkout</li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs font-bold text-white mb-3.5 uppercase tracking-wider">
              Support
            </h4>

            <ul className="space-y-2.5 text-xs text-[#A1A1AA]">
              <li className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#171719] border border-[#303034] flex items-center justify-center text-[#C6FF3D]">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Helpline</div>
                  <span className="font-semibold text-white">24/7 Booking Support</span>
                </div>
              </li>

              <li className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#171719] border border-[#303034] flex items-center justify-center text-[#C6FF3D]">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Email</div>
                  <a href="mailto:support@clik2go.in" className="font-semibold text-white hover:text-[#C6FF3D] transition-colors">
                    support@clik2go.in
                  </a>
                </div>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-[#303034] mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#A1A1AA]">
          <div>
            © {new Date().getFullYear()} <strong className="text-white">Clik2Go</strong>. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Safe Transit Platform</span>
            <span>•</span>
            <a href="https://clik2go.in" target="_blank" rel="noopener noreferrer" className="hover:text-[#C6FF3D] transition-colors">
              https://clik2go.in
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
