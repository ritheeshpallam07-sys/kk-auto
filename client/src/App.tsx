import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

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

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(
    () => window.location.pathname || '/'
  );

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
    // OLD ADMIN ROUTE
    // =========================

    

    // =========================
    // 404
    // =========================

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-3">🛺</div>

        <h2 className="text-2xl font-black text-slate-900 mb-2">
          Page Not Found
        </h2>

        <p className="text-xs text-slate-500 mb-6">
          The page you requested does not exist.
        </p>

        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
        >
          Go to Home
        </button>
      </div>
    );
  };

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">

        {/* Hide normal navigation inside private Owner portal */}
        {!isOwnerRoute && (
          <Navbar
            currentPath={currentPath}
            navigate={navigate}
          />
        )}

        <main className="flex-1">
          {renderContent()}
        </main>

        {/* Hide normal footer inside private Owner portal */}
        {!isOwnerRoute && (
          <Footer navigate={navigate} />
        )}
      </div>
    </AuthProvider>
  );
};