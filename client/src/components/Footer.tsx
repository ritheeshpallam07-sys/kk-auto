import React from 'react';
import { Logo } from './Logo';
import { ShieldCheck, Heart, MapPin, Phone, Mail } from 'lucide-react';

interface FooterProps {
  navigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Col 1: Brand & Tagline */}
          <div className="space-y-4 md:col-span-1">
            <Logo size="md" showTagline={true} theme="light" />
            <p className="text-xs text-slate-400 leading-relaxed">
              India's premier modern auto-rickshaw hailing experience. Transparent meter rates, verified drivers, and scheduled bookings at your fingertips.
            </p>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Government Approved Fare Structure</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => navigate('/')} className="hover:text-amber-400 transition-colors">
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/book')} className="hover:text-amber-400 transition-colors">
                  Book an Auto
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/my-rides')} className="hover:text-amber-400 transition-colors">
                  Track Ride / My Bookings
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/driver')} className="hover:text-amber-400 transition-colors">
                  Driver Portal
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/admin')} className="hover:text-amber-400 transition-colors">
                  Admin Dashboard
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Ride Services */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Features</h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>Instant "Ride Now" Hailing</li>
              <li>Scheduled Advance Bookings</li>
              <li>1 to 4 Passenger Seating</li>
              <li>Zero Surge Transparency</li>
              <li>Verified Fixed-Route Fare System</li>
            </ul>
          </div>

          {/* Col 4: Contact & Help */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Contact & Support</h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Tech Hub Plaza, Bengaluru & Pan-India</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>+91 (800) 555-AUTO (2886)</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                <span>support@kkauto.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>
            &copy; {new Date().getFullYear()} <span className="text-slate-300 font-semibold">Kk_Auto Inc.</span> All rights reserved.
          </div>
          <div className="flex items-center gap-1">
            <span>Crafted for modern urban commuters with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </div>
        </div>
      </div>
    </footer>
  );
};
