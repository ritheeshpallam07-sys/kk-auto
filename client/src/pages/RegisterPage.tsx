import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Car, 
  CreditCard,
  Building2,
  FileBadge,
  ShieldCheck,
  Clock
} from 'lucide-react';

interface RegisterPageProps {
  navigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ navigate }) => {
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'driver'>('customer');

  // Driver specific state
  const [autoNumber, setAutoNumber] = useState('KA-01-AK-2024');
  const [autoModel, setAutoModel] = useState('Bajaj Compact 4S');
  const [licenseNumber, setLicenseNumber] = useState('DL-KA-2024-8899');
  const [payoutUpi, setPayoutUpi] = useState('driver@upi');
  const [payoutBankAccount, setPayoutBankAccount] = useState('');
  const [payoutIfsc, setPayoutIfsc] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password strength logic
  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strengthScore = calculatePasswordStrength(password);
  const strengthLabels = ['Too weak', 'Weak', 'Good', 'Strong', 'Very Strong'];
  const strengthColors = ['bg-slate-200', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!mobile.trim() || mobile.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-check.');
      return;
    }
    if (role === 'driver') {
      if (!autoNumber.trim()) {
        setError('Auto registration number is required for drivers.');
        return;
      }
      if (!payoutUpi.trim() && !payoutBankAccount.trim()) {
        setError('Please provide at least one payout method (UPI ID or Bank Account).');
        return;
      }
    }
    if (!agreeTerms) {
      setError('Please accept the Terms and Conditions to continue.');
      return;
    }

    setIsSubmitting(true);
    const res = await register({
      name,
      email,
      mobile,
      password,
      confirmPassword,
      role,
      autoNumber: role === 'driver' ? autoNumber : undefined,
      autoModel: role === 'driver' ? autoModel : undefined,
      licenseNumber: role === 'driver' ? licenseNumber : undefined,
      payoutUpi: role === 'driver' ? payoutUpi : undefined,
      payoutBankAccount: role === 'driver' ? payoutBankAccount : undefined,
      payoutIfsc: role === 'driver' ? payoutIfsc : undefined
    });
    setIsSubmitting(false);

    if (res.success) {
      if (role === 'driver') {
        navigate('/driver');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(res.error || 'Failed to create account.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-xl w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Logo size="md" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Create your account
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sign up to start booking or driving auto-rickshaws with Kk_Auto
          </p>
        </div>

        {/* Role switcher tab */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`flex-1 py-2.5 rounded-lg transition-all ${
              role === 'customer'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            👤 Customer Account
          </button>
          <button
            type="button"
            onClick={() => setRole('driver')}
            className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              role === 'driver'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>🛺 Driver Partner Account</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Babu"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Mobile Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9876543210"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>
            </div>
          </div>

          {/* DRIVER SPECIFIC FIELDS */}
          {role === 'driver' && (
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-amber-600" />
                  <span>Auto Vehicle & Payout Details</span>
                </span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Pending Admin Review</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Auto Registration Number *
                  </label>
                  <input
                    type="text"
                    value={autoNumber}
                    onChange={(e) => setAutoNumber(e.target.value)}
                    placeholder="KA-01-AK-1234"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-mono font-bold uppercase bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Auto Model / Type *
                  </label>
                  <input
                    type="text"
                    value={autoModel}
                    onChange={(e) => setAutoModel(e.target.value)}
                    placeholder="Bajaj Compact 4S"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Driving License Number
                </label>
                <div className="relative">
                  <FileBadge className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="DL-AUTO-2024-8899"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-amber-300 text-xs font-semibold uppercase bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/80 space-y-2">
                <span className="text-[11px] font-bold text-amber-900 block">
                  Driver Payout Bank / UPI Details (For Earnings Settlement)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-amber-700" />
                      <span>UPI ID *</span>
                    </label>
                    <input
                      type="text"
                      value={payoutUpi}
                      onChange={(e) => setPayoutUpi(e.target.value)}
                      placeholder="driver@oksbi"
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-amber-700" />
                      <span>Bank Account No.</span>
                    </label>
                    <input
                      type="text"
                      value={payoutBankAccount}
                      onChange={(e) => setPayoutBankAccount(e.target.value)}
                      placeholder="12-16 digit account number"
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Bank IFSC Code
                  </label>
                  <input
                    type="text"
                    value={payoutIfsc}
                    onChange={(e) => setPayoutIfsc(e.target.value)}
                    placeholder="SBIN0001234"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-mono uppercase bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="text-[11px] text-amber-800 bg-amber-100/70 p-2.5 rounded-xl flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Approval Notice:</strong> When you register as a driver, your account will be set to <strong>PENDING</strong>. You will be able to accept passenger rides once verified and approved by the Owner/Admin.
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>

            {/* Password strength meter */}
            {password && (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500">Strength:</span>
                  <span className="font-bold text-slate-700">{strengthLabels[strengthScore]}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full flex-1 transition-all ${
                        strengthScore >= step ? strengthColors[strengthScore] : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>
            {confirmPassword && password === confirmPassword && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Passwords match</span>
              </p>
            )}
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
              required
            />
            <label htmlFor="terms" className="text-xs text-slate-600 leading-tight">
              I agree to the <span className="font-bold text-slate-800 underline">Terms of Service</span> and <span className="font-bold text-slate-800 underline">Privacy Policy</span>.
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-all hover:scale-102 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>{role === 'driver' ? 'Register Driver Account' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-slate-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-bold text-amber-600 hover:text-amber-700 underline"
          >
            Login here
          </button>
        </div>
      </div>
    </div>
  );
};
