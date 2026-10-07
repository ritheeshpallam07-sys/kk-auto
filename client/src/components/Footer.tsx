import React from 'react';
import { Logo } from './Logo';
import { Phone, Mail } from 'lucide-react';

interface FooterProps {
  navigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="space-y-3">
            <Logo size="md" showTagline={true} theme="light" />

            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Simple and reliable auto rides with transparent fares and easy booking.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4">
              Quick Links
            </h4>

            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Home
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigate('/book')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Book an Auto
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigate('/my-rides')}
                  className="hover:text-amber-400 transition-colors"
                >
                  My Bookings
                </button>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4">
              Services
            </h4>

            <ul className="space-y-2 text-xs text-slate-400">
              <li>Ride Now</li>
              <li>Scheduled Rides</li>
              <li>Transparent Fares</li>
              <li>Up to 4 Passengers</li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4">
              Support
            </h4>

            <ul className="space-y-3 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>Booking Support</span>
              </li>

              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                <span>support@kkauto.com</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Kk_Auto. All rights reserved.
        </div>

      </div>
    </footer>
  );
};