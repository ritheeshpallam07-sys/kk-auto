import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SplashScreen } from './components/SplashScreen';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { OwnerLoginPage } from './pages/OwnerLoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { BookingFormPage } from './pages/BookingFormPage';
import { BookingStatusPage } from './pages/BookingStatusPage';
import { MyRidesPage } from './pages/MyRidesPage';
import { DriverDashboard } from './pages/DriverDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { ProfilePage } from './pages/ProfilePage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { TermsAcceptancePage } from './pages/TermsAcceptancePage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(
    () => window.location.pathname || '/'
  );

  const [showSplash, setShowSplash] = useState<boolean>(() => {
    return !sessionStorage.getItem('kk_splash_seen');
  });

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path.split('?')[0]);
    window.scrollTo(0, 0);
  };

  const isOwnerRoute =
    currentPath === '/owner/login' ||
    currentPath === '/owner/dashboard';

  const isBookingRoute =
    currentPath === '/book' ||
    currentPath === '/book/' ||
    currentPath === '/book-auto' ||
    currentPath === '/fare-estimate';

  const renderContent = () => {

    // =========================
    // PUBLIC ROUTES
    // =========================

    if (currentPath === '/' || currentPath === '') {
      return <LandingPage navigate={navigate} />;
    }

    if (currentPath === '/login') {
      return <LoginPage navigate={navigate} />;
    }

    if (currentPath === '/register') {
      return <RegisterPage navigate={navigate} />;
    }
    if (currentPath === '/verify-email') {
      return <VerifyEmailPage navigate={navigate} />;
    }

    if (currentPath === '/terms') {
      return <TermsPage navigate={navigate} />;
    }

    if (currentPath === '/privacy') {
      return <PrivacyPage navigate={navigate} />;
    }

    if (currentPath === '/accept-terms') {
      return (
        <ProtectedRoute
          allowedRoles={['customer', 'driver', 'admin']}
          navigate={navigate}
          skipTermsCheck={true}
        >
          <TermsAcceptancePage navigate={navigate} />
        </ProtectedRoute>
      );
    }

    // =========================
    // OWNER LOGIN
    // =========================

    if (currentPath === '/owner/login') {
      return <OwnerLoginPage navigate={navigate} />;
    }

    // =========================
    // OWNER DASHBOARD
    // =========================

    if (currentPath === '/owner/dashboard') {
      return (
        <ProtectedRoute
          allowedRoles={['admin']}
          navigate={navigate}
        >
          <AdminDashboard navigate={navigate} />
        </ProtectedRoute>
      );
    }

    // =========================
    // CUSTOMER DASHBOARD
    // =========================

    if (currentPath === '/dashboard') {
      return (
        <ProtectedRoute
          allowedRoles={['customer']}
          navigate={navigate}
        >
          <CustomerDashboard navigate={navigate} />
        </ProtectedRoute>
      );
    }

    // =========================
    // CUSTOMER BOOKING
    // =========================

    if (
      currentPath === '/book' ||
      currentPath === '/book-auto' ||
      currentPath === '/fare-estimate'
    ) {
      return (
        <ProtectedRoute
          allowedRoles={['customer']}
          navigate={navigate}
        >
          <BookingFormPage navigate={navigate} />
        </ProtectedRoute>
      );
    }

    // =========================
    // CUSTOMER RIDES
    // =========================

    if (currentPath === '/my-rides') {
      return (
        <ProtectedRoute
          allowedRoles={['customer']}
          navigate={navigate}
        >
          <MyRidesPage navigate={navigate} />
        </ProtectedRoute>
      );
    }

    // =========================
    // PROFILE
    // =========================

    if (currentPath === '/profile') {
      return (
        <ProtectedRoute
          allowedRoles={['customer', 'driver']}
          navigate={navigate}
        >
          <ProfilePage navigate={navigate} />
        </ProtectedRoute>
      );
    }

    // =========================
    // BOOKING STATUS
    // =========================

    if (currentPath.startsWith('/booking/')) {
      const id = currentPath.replace('/booking/', '');

      return (
        <ProtectedRoute
          allowedRoles={['customer']}
          navigate={navigate}
        >
          <BookingStatusPage
            bookingId={id}
            navigate={navigate}
          />
        </ProtectedRoute>
      );
    }

    // =========================
    // DRIVER DASHBOARD
    // =========================

    if (currentPath === '/driver') {
      return (
        <ProtectedRoute
          allowedRoles={['driver']}
          navigate={navigate}
        >
          <DriverDashboard navigate={navigate} />
        </ProtectedRoute>
      );
    }

    // =========================
    // 404
    // =========================

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-[#0B0B0D] text-white">
        <div className="w-14 h-14 rounded-2xl bg-[#171719] border border-[#303034] text-[#C6FF3D] flex items-center justify-center text-3xl mb-4 shadow-subtle">
          🛺
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Page Not Found
        </h2>

        <p className="text-sm text-[#A1A1AA] mb-6 max-w-sm">
          The page you requested does not exist or has been moved.
        </p>

        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all"
        >
          Go to Home
        </button>
      </div>
    );
  };

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-[#0B0B0D] text-white font-sans antialiased">

        {/* Splash screen on fresh browser open */}
        {showSplash && (
          <SplashScreen
            onComplete={() => {
              sessionStorage.setItem('kk_splash_seen', 'true');
              setShowSplash(false);
            }}
          />
        )}

        {/* Top Navbar */}
        {!isOwnerRoute && (
          <Navbar
            currentPath={currentPath}
            navigate={navigate}
          />
        )}

        <main className="flex-1">
          {renderContent()}
        </main>

        {/* Footer (hidden on Owner console and Book Auto screens) */}
        {!isOwnerRoute && !isBookingRoute && (
          <Footer navigate={navigate} />
        )}
      </div>
    </AuthProvider>
  );
};
