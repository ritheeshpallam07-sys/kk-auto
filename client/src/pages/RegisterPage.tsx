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
  const strengthColors = ['bg-[#303034]', 'bg-rose-500', 'bg-amber-500', 'bg-[#C6FF3D]', 'bg-[#9ECE1E]'];

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
      setError('You must agree to the Terms & Conditions and acknowledge the Privacy Policy to register.');
      return;
    }
    setIsSubmitting(true);
    try {
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

      if (res.success) {
        if (res.requiresVerification && res.email) {
          navigate(`/verify-email?email=${encodeURIComponent(res.email)}`);
        } else if (role === 'driver') {
          navigate('/driver');
        } else {
          navigate('/accept-terms');
        }
      } else {
        setError(res.error || 'Failed to create account.');
      }
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8 sm:py-16 px-4 sm:px-6 lg:px-8 bg-[#0B0B0D] text-white safe-top safe-bottom">
      <div className="max-w-xl w-full space-y-6 sm:space-y-7 bg-[#171719] p-6 sm:p-10 rounded-3xl shadow-card border border-[#303034]">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Create your account
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Sign up to start booking or driving auto-rickshaws with Clik2Go
          </p>
        </div>

        {/* Role switcher tab */}
        <div className="flex flex-col sm:flex-row rounded-2xl bg-[#202023] p-1 text-xs font-bold border border-[#303034] gap-1">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              role === 'customer'
                ? 'bg-[#171719] text-[#C6FF3D] border border-[#C6FF3D]/40 shadow-xs'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            👤 Customer Account
          </button>
          <button
            type="button"
            onClick={() => setRole('driver')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              role === 'driver'
                ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-xs'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>🛺 Driver Partner Account</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Babu"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] text-sm focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
                Mobile Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9876543210"
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] text-sm focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mail.com"
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] text-sm focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                  required
                />
              </div>
            </div>
          </div>

          {/* DRIVER SPECIFIC FIELDS */}
          {role === 'driver' && (
            <div className="p-5 bg-[#202023] rounded-3xl border border-[#303034] space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                <span className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-[#C6FF3D]" />
                  <span>Auto Vehicle & Payout Details</span>
                </span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/40 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Pending Admin Review</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">
                    Auto Registration Number *
                  </label>
                  <input
                    type="text"
                    value={autoNumber}
                    onChange={(e) => setAutoNumber(e.target.value)}
                    placeholder="KA-01-AK-1234"
                    className="w-full px-3 py-2 rounded-xl border border-[#303034] text-xs bg-[#171719] text-white focus:outline-none focus:border-[#C6FF3D]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">
                    Auto Model / Make
                  </label>
                  <input
                    type="text"
                    value={autoModel}
                    onChange={(e) => setAutoModel(e.target.value)}
                    placeholder="Bajaj Compact RE"
                    className="w-full px-3 py-2 rounded-xl border border-[#303034] text-xs bg-[#171719] text-white focus:outline-none focus:border-[#C6FF3D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">
                  Driving License Number
                </label>
                <div className="relative">
                  <FileBadge className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#A1A1AA]" />
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="DL-0420240012345"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#303034] text-xs bg-[#171719] text-white focus:outline-none focus:border-[#C6FF3D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">
                  Payout UPI ID (Instant direct settlement)
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#A1A1AA]" />
                  <input
                    type="text"
                    value={payoutUpi}
                    onChange={(e) => setPayoutUpi(e.target.value)}
                    placeholder="driver@okaxis"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#303034] text-xs bg-[#171719] text-white focus:outline-none focus:border-[#C6FF3D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">
                    Bank Account Number (Optional)
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#A1A1AA]" />
                    <input
                      type="text"
                      value={payoutBankAccount}
                      onChange={(e) => setPayoutBankAccount(e.target.value)}
                      placeholder="123456789012"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#303034] text-xs bg-[#171719] text-white focus:outline-none focus:border-[#C6FF3D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">
                    Bank IFSC Code
                  </label>
                  <input
                    type="text"
                    value={payoutIfsc}
                    onChange={(e) => setPayoutIfsc(e.target.value)}
                    placeholder="SBIN0001234"
                    className="w-full px-3 py-2 rounded-xl border border-[#303034] text-xs bg-[#171719] text-white uppercase focus:outline-none focus:border-[#C6FF3D]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Passwords */}
          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
              Password (at least 6 characters) *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] text-sm focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                required
              />
            </div>
            {password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[#303034] rounded-full overflow-hidden flex">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 ${i < strengthScore ? strengthColors[strengthScore] : 'bg-[#303034]'} ${i > 0 ? 'ml-0.5' : ''}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-[#A1A1AA]">
                  {strengthLabels[strengthScore]}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] text-sm focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                required
              />
            </div>
            {confirmPassword && password === confirmPassword && (
              <p className="text-[11px] text-[#C6FF3D] font-semibold mt-1 flex items-center gap-1">
                <Check className="w-3 h-3 text-[#C6FF3D]" />
                <span>Passwords match</span>
              </p>
            )}
          </div>

          {/* Mandatory Registration Consent Checkbox */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#202023]/60 border border-[#303034] hover:border-[#3E3E44] transition-colors">
            <input
              type="checkbox"
              id="registration-terms"
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                if (error) setError(null);
              }}
              className="w-4 h-4 mt-0.5 rounded text-[#C6FF3D] bg-[#0B0B0D] border-[#303034] focus:ring-[#C6FF3D] focus:ring-offset-0 cursor-pointer flex-shrink-0"
              required
              aria-required="true"
            />
            <label htmlFor="registration-terms" className="text-xs text-[#A1A1AA] leading-relaxed cursor-pointer select-none">
              By creating an account, I agree to the{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate('/terms');
                }}
                className="font-bold text-white hover:text-[#C6FF3D] underline underline-offset-2 transition-colors focus:outline-none focus:ring-1 focus:ring-[#C6FF3D] rounded px-0.5"
              >
                Terms & Conditions
              </button>{' '}
              and acknowledge the{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate('/privacy');
                }}
                className="font-bold text-white hover:text-[#C6FF3D] underline underline-offset-2 transition-colors focus:outline-none focus:ring-1 focus:ring-[#C6FF3D] rounded px-0.5"
              >
                Privacy Policy
              </button>.
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>{role === 'driver' ? 'Register Driver Partner' : 'Create Customer Account'}</span>
                <ArrowRight className="w-4 h-4 text-[#0B0B0D]" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-[#A1A1AA]">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-bold text-[#C6FF3D] hover:underline"
          >
            Login here
          </button>
        </div>
      </div>
    </div>
  );
};
