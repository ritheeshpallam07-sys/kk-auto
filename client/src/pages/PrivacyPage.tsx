import React from 'react';
import { Logo } from '../components/Logo';
import {
  Lock,
  ShieldCheck,
  Eye,
  Database,
  Bell,
  UserCheck,
  Server,
  Trash2,
  Mail,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  FileText
} from 'lucide-react';

interface PrivacyPageProps {
  navigate: (path: string) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ navigate }) => {
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8 safe-top safe-bottom">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#A1A1AA] hover:text-white transition-colors px-3 py-1.5 rounded-xl bg-[#171719] border border-[#303034] hover:border-[#C6FF3D]/40"
          >
            <ArrowLeft className="w-4 h-4 text-[#C6FF3D]" />
            <span>Back to Home</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/terms')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C6FF3D] hover:underline"
          >
            <span>View Terms & Conditions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Header Hero */}
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-10 border border-[#303034] shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Logo size="md" showTagline={false} />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202023] border border-[#303034] text-xs font-bold text-[#C6FF3D]">
              <ShieldCheck className="w-4 h-4" />
              <span>Effective Date: 28 October 2026</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            Privacy Policy
          </h1>

          <p className="text-sm sm:text-base text-[#A1A1AA] leading-relaxed">
            At <strong className="text-white">Clik2Go</strong>, your personal privacy and the security of your information are important to us. This Privacy Policy describes how we collect, store, handle, and share your data when you use the Clik2Go auto-rickshaw ride-booking web application and services.
          </p>

          {/* Legal Draft Advisory Notice */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/60 text-amber-200/90 text-xs leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Notice for Platform Users & Administration:</p>
              <p className="mt-0.5 text-amber-200/80">
                This document serves as an operational privacy policy draft for Clik2Go. It describes the data handling mechanisms implemented in our platform and requires periodic review against evolving Indian data protection regulations (including the Digital Personal Data Protection Act, 2023) prior to formal legal sign-off.
              </p>
            </div>
          </div>
        </div>

        {/* Key Privacy Commitments */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#171719] border border-[#303034] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Cryptographic Passwords</h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Passwords are never stored in plain text. They are hashed using industry-standard bcrypt encryption before storage.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#171719] border border-[#303034] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Role-Based Ride Access</h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Customer pickup/drop details are revealed to an assigned driver only after the driver accepts the booking.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#171719] border border-[#303034] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center font-bold">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Statutory Record Retention</h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Ride and financial logs are preserved as required by Indian accounting and transport compliance laws.
            </p>
          </div>
        </div>

        {/* Detailed Privacy Sections */}
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-10 border border-[#303034] shadow-card space-y-8 text-sm text-[#D4D4D8] leading-relaxed">

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">1</span>
              <span>Information We Collect</span>
            </h2>
            <p>
              We collect information that is strictly necessary to create your account, coordinate auto-rickshaw rides, and maintain platform security:
            </p>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] space-y-1.5">
                <h4 className="font-bold text-white text-sm">A. Account Registration Information</h4>
                <p className="text-[#A1A1AA]">
                  • <strong className="text-white">Full Name:</strong> To identify you during pickups and account interactions.
                </p>
                <p className="text-[#A1A1AA]">
                  • <strong className="text-white">Phone Number:</strong> A valid 10-digit mobile number used for driver coordination and account authentication.
                </p>
                <p className="text-[#A1A1AA]">
                  • <strong className="text-white">Email Address:</strong> Used for account identity, transactional notices, and verification OTPs.
                </p>
                <p className="text-[#A1A1AA]">
                  • <strong className="text-white">Account Password:</strong> Securely salted and hashed using the bcrypt algorithm. Passwords are never stored in plain text and cannot be viewed by platform administrators.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] space-y-1.5">
                <h4 className="font-bold text-white text-sm">B. Driver Partner Verification Information</h4>
                <p className="text-[#A1A1AA]">
                  For registered driver partners, we additionally collect vehicle registration numbers (e.g. auto number plate), vehicle model, driving license numbers, and payout UPI ID / bank details for fare settlements and identity verification.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] space-y-1.5">
                <h4 className="font-bold text-white text-sm">C. Booking & Trip Records</h4>
                <p className="text-[#A1A1AA]">
                  Whenever a ride is requested, the system records:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-[#A1A1AA]">
                  <li>Pickup location name and GPS coordinates.</li>
                  <li>Destination address name and GPS coordinates.</li>
                  <li>Booking creation date, timestamp, and passenger count.</li>
                  <li>Calculated committee fare, payment method (Cash/UPI), and booking status updates.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">2</span>
              <span>How We Use Your Information</span>
            </h2>
            <p>
              Your data is collected and processed for the following operational purposes:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs text-[#A1A1AA]">
              <li><strong className="text-white">Ride Fulfillment:</strong> To broadcast your ride request, match you with an available driver partner, and enable driver pickup navigation.</li>
              <li><strong className="text-white">Fare Calculation:</strong> To compute exact point-to-point fares based on local drivers&apos; committee zone rates.</li>
              <li><strong className="text-white">Account Verification:</strong> To deliver one-time verification passcodes (OTPs) to your registered email address.</li>
              <li><strong className="text-white">Safety & Dispute Resolution:</strong> To verify trip history, investigate driver-customer complaints, and address duplicate payment claims.</li>
              <li><strong className="text-white">Legal & Accounting Compliance:</strong> To maintain required financial audit trails for tax and commercial records.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">3</span>
              <span>Information Sharing & Access Controls</span>
            </h2>
            <p>
              Clik2Go enforces strict access controls regarding who can see your personal data:
            </p>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] space-y-1.5">
                <h4 className="font-bold text-white text-sm">Sharing with Assigned Drivers:</h4>
                <p className="text-[#A1A1AA]">
                  • Personal customer identity details (passenger name and direct mobile number) are <strong className="text-white">revealed to the assigned driver only after that driver accepts the booking</strong>.
                </p>
                <p className="text-[#A1A1AA]">
                  • Available drivers in the &quot;Searching for Auto&quot; stage view the pickup area, destination, passenger count, and committee fare to decide whether to accept the ride, without seeing customer contact numbers or personal identity.
                </p>
                <p className="text-[#A1A1AA]">
                  • Once assigned, contact details are shared strictly to coordinate pickup and ride execution.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] space-y-1.5">
                <h4 className="font-bold text-white text-sm">Third-Party Infrastructure & Service Providers:</h4>
                <p className="text-[#A1A1AA]">
                  Clik2Go does <strong className="text-white">not</strong> sell, rent, or trade your personal information to advertisers. We share technical data only with essential infrastructure providers:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-[#A1A1AA]">
                  <li><strong className="text-white">Cloud Hosting & Database:</strong> Secure PostgreSQL database and application hosting infrastructure.</li>
                  <li><strong className="text-white">Transactional Email Delivery:</strong> Standard SMTP services (e.g. NodeMailer) used solely to transmit email verification OTPs and essential notices.</li>
                  <li><strong className="text-white">Payment Gateway Partners:</strong> Regulated payment gateways (such as Cashfree Payments) when processing authorized outstation car bookings.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">4</span>
              <span>Platform Notifications</span>
            </h2>
            <p>
              Notifications from Clik2Go are operational in nature and delivered through:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs text-[#A1A1AA]">
              <li><strong className="text-white">In-App Web Alerts:</strong> Real-time visual updates regarding driver assignment, arrival, and payment confirmation within the booking screen.</li>
              <li><strong className="text-white">Email Notifications:</strong> One-time password (OTP) verification emails sent during registration and important administrative updates.</li>
            </ul>
            <p className="text-xs text-[#71717A]">
              Clik2Go does not send unsolicited promotional marketing messages.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">5</span>
              <span>Data Retention & Ride History</span>
            </h2>
            <p>
              Your personal profile data and ride history are intended to be retained while your account remains active.
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                <strong className="text-white">Active Accounts:</strong> Registered users can review their completed and past rides from the &quot;My Rides&quot; section of the application.
              </li>
              <li>
                <strong className="text-white">Statutory & Accounting Records:</strong> Completed financial transactions, booking references, driver payout ledgers, and UPI confirmation records cannot be automatically erased upon account closure. These records are retained in compliance with applicable Indian commercial, tax, and transport regulatory requirements.
              </li>
              <li>
                We do not promise that all historical records are automatically deleted from internal audit backups upon account closure.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">6</span>
              <span>Account Deletion Feature & User Rights</span>
            </h2>
            <p>
              Clik2Go provides a functional, built-in account deletion workflow directly in your account settings:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                <strong className="text-white">How to Request Deletion:</strong> Authenticated customers and drivers can navigate to <strong className="text-white">Profile & Settings (/profile)</strong> and select the <strong className="text-rose-400">Request Account Deletion</strong> option in the Danger Zone area.
              </li>
              <li>
                <strong className="text-white">Safety Preconditions:</strong> Account deletion requests cannot be submitted while you have an active ride in progress. Active bookings must be completed or cancelled first.
              </li>
              <li>
                <strong className="text-white">Consequences of Deletion:</strong> Once processed by administration, your account access is permanently closed and you will not be able to log in or book rides. Driver partners are immediately taken offline and removed from dispatch queues. Non-personal financial and tax audit records are archived as required by law.
              </li>
              <li>
                <strong className="text-white">Assistance:</strong> For any inquiries or expedited assistance regarding account deletion, you may also email <a href="mailto:support@clik2go.in" className="text-[#C6FF3D] underline">support@clik2go.in</a>.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">7</span>
              <span>Security Practices</span>
            </h2>
            <p>
              We implement industry-standard technical measures to safeguard your personal data:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs text-[#A1A1AA]">
              <li><strong className="text-white">Encryption in Transit:</strong> All communications between your web browser and our servers are encrypted using Transport Layer Security (TLS / HTTPS).</li>
              <li><strong className="text-white">Password Hashing:</strong> User credentials are protected using one-way bcrypt cryptographic hashing with individual salt rounds.</li>
              <li><strong className="text-white">Token-Based Authentication:</strong> Secure JSON Web Tokens (JWT) are used for session verification with role-based authorization guards.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">8</span>
              <span>Policy Updates</span>
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect operational modifications, software enhancements, or legal compliance updates. Changes will be posted to this page with an updated &quot;Effective Date&quot;. Continued use of Clik2Go following notice indicates your acknowledgment of the updated policy.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3 pt-4 border-t border-[#303034]">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">9</span>
              <span>Privacy & Support Contact</span>
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact our team:
            </p>
            <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#171719] border border-[#303034] flex items-center justify-center text-[#C6FF3D]">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Clik2Go Support & Privacy Desk</div>
                  <a href="mailto:support@clik2go.in" className="text-sm font-bold text-white hover:text-[#C6FF3D] transition-colors">
                    support@clik2go.in
                  </a>
                </div>
              </div>
              <div className="text-[11px] text-[#A1A1AA]">
                Official Website:{' '}
                <a href="https://clik2go.in" target="_blank" rel="noopener noreferrer" className="text-[#C6FF3D] hover:underline">
                  https://clik2go.in
                </a>
              </div>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};