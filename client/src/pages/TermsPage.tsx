import React from 'react';
import { Logo } from '../components/Logo';
import {
  FileText,
  ShieldCheck,
  MapPin,
  IndianRupee,
  Car,
  XCircle,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  Scale,
  Clock,
  Mail,
  ArrowLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface TermsPageProps {
  navigate: (path: string) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ navigate }) => {
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
            onClick={() => navigate('/privacy')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C6FF3D] hover:underline"
          >
            <span>View Privacy Policy</span>
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
            Terms & Conditions
          </h1>

          <p className="text-sm sm:text-base text-[#A1A1AA] leading-relaxed">
            Welcome to <strong className="text-white">Clik2Go</strong>. These Terms & Conditions (&quot;Terms&quot;) govern your access to and use of our point-to-point auto-rickshaw ride-booking platform, website, and related services. By registering an account, booking a ride, or partner-driving on Clik2Go, you agree to comply with and be legally bound by these Terms.
          </p>

          {/* Legal Draft Advisory Notice */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/60 text-amber-200/90 text-xs leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Notice for Platform Users & Administration:</p>
              <p className="mt-0.5 text-amber-200/80">
                This document serves as an operational terms of service draft for Clik2Go within our operating jurisdiction. It reflects confirmed platform business rules and requires periodic owner review against evolving local regulations, drivers&apos; committee resolutions, and applicable Indian laws.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Highlights Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#171719] border border-[#303034] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center font-bold">
              <IndianRupee className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Committee-Decided Fares</h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Fares follow rates established by the local drivers&apos; committee. Zero surge multipliers or unapproved surcharges.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#171719] border border-[#303034] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center font-bold">
              <XCircle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Free Cancellation</h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Customers can cancel any booking free of charge at any time before a driver partner accepts and is assigned.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#171719] border border-[#303034] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center font-bold">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Designated Service Area</h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Services operate strictly within our single designated operating town/service area and authorized zone routes.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-10 border border-[#303034] shadow-card space-y-8 text-sm text-[#D4D4D8] leading-relaxed">

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">1</span>
              <span>About Clik2Go & The Service Platform</span>
            </h2>
            <p>
              Clik2Go provides a technology platform that connects passengers seeking point-to-point auto-rickshaw transportation with independent, local auto-rickshaw driver partners operating within our designated service area.
            </p>
            <p>
              Clik2Go acts as a digital intermediary facilitating booking coordination, fixed route fare calculation, and communications between passengers and independent drivers. Drivers operate as independent transport providers and are responsible for their vehicles, licensing, and compliance with local road safety laws.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">2</span>
              <span>Designated Service Area & Coverage</span>
            </h2>
            <p>
              Clik2Go currently operates in <strong className="text-white">one designated local town/city and its surrounding authorized route zones only</strong>.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs text-[#A1A1AA]">
              <li>Bookings are valid only for pickups and destinations located within the established zone boundaries of our designated operating town.</li>
              <li>Ride requests originating outside the authorized service perimeter cannot be accepted through the local auto-booking service.</li>
              <li>Separate outstation car/trip packages may connect to external destinations where explicitly confirmed through the specialized trip booking interface.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">3</span>
              <span>Fare Policy & Local Drivers&apos; Committee Rates</span>
            </h2>
            <p>
              Transparent, fair pricing is central to Clik2Go. All ride fares on Clik2Go strictly follow the rate structures determined and approved by the <strong className="text-white">local drivers&apos; committee</strong>:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                <strong className="text-white">Fixed Committee Rates:</strong> Fares displayed at the time of booking are calculated from verified zone-to-zone tariffs established in coordination with the local drivers&apos; committee.
              </li>
              <li>
                <strong className="text-white">No Additional Charges:</strong> There are no surge pricing multipliers, arbitrary platform markups, or hidden night-time fees added beyond the applicable committee-approved fare.
              </li>
              <li>
                <strong className="text-white">Binding Upfront Fare:</strong> The fare confirmed upon booking represents the full amount due for the booked pickup and destination points. Drivers may not demand and passengers are not obligated to pay amounts in excess of the displayed booking fare.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">4</span>
              <span>Booking, Driver Assignment & Ride Stages</span>
            </h2>
            <p>
              When you submit a ride request:
            </p>
            <ol className="list-decimal list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                <strong className="text-white">Searching for Auto:</strong> Your ride request is broadcast to available, verified drivers in the vicinity of your pickup point.
              </li>
              <li>
                <strong className="text-white">Driver Assigned:</strong> An available driver accepts the request. Once accepted, driver details (name, auto model, registration number, and contact number) appear in your booking status screen.
              </li>
              <li>
                <strong className="text-white">Driver Arriving & Pickup:</strong> The driver proceeds to your pickup location. Your pickup point and phone number are visible to the driver strictly for pickup coordination.
              </li>
              <li>
                <strong className="text-white">Ride Started & Completed:</strong> The driver transports you to the requested destination. Upon arrival, the status transitions to Ride Completed, and payment is settled.
              </li>
            </ol>
            <p className="text-xs text-[#71717A]">
              Note: Driver availability is subject to physical real-world traffic, weather, and active vehicles on duty. While the platform strives for prompt dispatches, Clik2Go does not guarantee arrival times.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">5</span>
              <span>Cancellation Policy</span>
            </h2>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] space-y-1.5">
                <h4 className="font-bold text-white text-sm">Customer Cancellation:</h4>
                <p className="text-[#A1A1AA]">
                  • <strong className="text-white">Free before assignment:</strong> Customers may cancel their ride request free of charge at any time while the status remains &quot;Searching for Auto&quot; before a driver is assigned.
                </p>
                <p className="text-[#A1A1AA]">
                  • <strong className="text-white">Post-assignment cancellations:</strong> If a customer repeatedly cancels bookings after a driver has been assigned and traveled towards the pickup location, the account may be subject to review or temporary booking limits to protect driver partners from wasted fuel and time.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] space-y-1.5">
                <h4 className="font-bold text-white text-sm">Driver Cancellation & Acceptance Responsibilities:</h4>
                <p className="text-[#A1A1AA]">
                  • Driver partners are expected to honor accepted ride requests.
                </p>
                <p className="text-[#A1A1AA]">
                  • If a driver cancels a booking after accepting it without valid operational or safety justification, a <strong className="text-white">cancellation penalty may apply</strong>.
                </p>
                <p className="text-[#A1A1AA]">
                  • The applicable penalty, policy terms, and enforcement are determined by the <strong className="text-white">Owner/Admin</strong> based on operational records and committee guidelines. Repeated unexcused cancellations may lead to dispatch suspension.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">6</span>
              <span>Payment Responsibilities & Supported Methods</span>
            </h2>
            <p>
              Customers are responsible for paying the exact booking fare upon reaching their destination. Clik2Go supports the following payment options:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                <strong className="text-white">Cash Payment:</strong> Pay the exact cash amount directly to the driver upon ride completion. The driver confirms receipt on their mobile application.
              </li>
              <li>
                <strong className="text-white">Driver UPI QR Payment:</strong> Scan the driver&apos;s dynamic or personal UPI QR code displayed on the driver&apos;s device using any UPI application (Google Pay, PhonePe, Paytm, BHIM, etc.) for the exact ride fare.
              </li>
              <li>
                <strong className="text-white">Online Gateway Payment:</strong> Available for confirmed intercity / outstation car trips through our integrated gateway partners.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">7</span>
              <span>Refund Policy for Duplicate Payments</span>
            </h2>
            <p>
              Because ride fares for daily auto rides are settled directly upon ride completion via Cash or direct UPI:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                <strong className="text-white">Eligibility for Duplicate Payments:</strong> If a customer is charged more than once for the same booking due to a technical error or double transfer, the duplicate transaction is <strong className="text-white">eligible for review for a refund</strong>.
              </li>
              <li>
                <strong className="text-white">Review Process:</strong> The customer must notify Clik2Go by emailing <a href="mailto:support@clik2go.in" className="text-[#C6FF3D] underline">support@clik2go.in</a> with the booking reference ID, payment transaction references, UPI UTR numbers, and banking proof of debit.
              </li>
              <li>
                <strong className="text-white">No Automatic Refund Promise:</strong> Clik2Go does not promise automated instant refunds or a fixed turnaround timeframe. Each duplicate payment claim is individually investigated against banking and driver ledger logs.
              </li>
              <li>
                Completed rides that were delivered as contracted are non-refundable.
              </li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">8</span>
              <span>Account Misuse, Fraud Prevention & Fair Handling</span>
            </h2>
            <p>
              To protect the safety and integrity of the local transit community, Clik2Go enforces a zero-tolerance policy against platform misuse:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                <strong className="text-white">Prohibited Activities:</strong> Creating fake accounts, placing false booking requests, abusive or harassing conduct towards drivers or riders, fare evasion, tampering with application software, or sharing unauthorized credentials.
              </li>
              <li>
                <strong className="text-white">Enforcement & Investigation:</strong> Any suspected fraudulent activity or misuse will be investigated fairly by the Owner/Admin. Clik2Go reserves the right to restrict features, suspend bookings, or deactivate accounts, subject to fair handling and applicable law.
              </li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">9</span>
              <span>Customer-Driver Dispute Resolution</span>
            </h2>
            <p>
              In the event of a disagreement regarding route selection, fare payment, lost items, or conduct during a ride:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs text-[#A1A1AA]">
              <li>
                Disputes should be promptly reported to <a href="mailto:support@clik2go.in" className="text-[#C6FF3D] underline">support@clik2go.in</a> with the relevant booking reference.
              </li>
              <li>
                The <strong className="text-white">Owner/Admin</strong> investigates and resolves customer-driver disputes based on digital trip logs, pickup timestamps, and established committee fare tables.
              </li>
              <li>
                The Owner/Admin&apos;s determination regarding platform-level disputes is aimed at fair and amicable resolution within the local community.
              </li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">10</span>
              <span>Service Availability & Disclaimers</span>
            </h2>
            <p>
              The Clik2Go platform is provided on an &quot;as-is&quot; and &quot;as-available&quot; basis. Clik2Go makes reasonable efforts to ensure smooth operational availability, but does not warrant that the website or dispatch service will be completely uninterrupted, timely, or error-free during network outages, server maintenance, or severe local conditions.
            </p>
            <p className="text-xs text-[#71717A]">
              Clik2Go does not provide commercial passenger insurance, does not guarantee vehicle arrival times, and does not promise monetary compensation for delays caused by traffic or driver availability.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">11</span>
              <span>Policy Updates & Modifications</span>
            </h2>
            <p>
              Clik2Go reserves the right to modify these Terms to reflect changes in business operations, committee fare agreements, or statutory requirements. When substantial updates occur, we will update the Effective Date at the top of this page and provide notice through the website. Continued use of Clik2Go following notice constitutes acceptance of the amended Terms.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3 pt-4 border-t border-[#303034]">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-black flex items-center justify-center">12</span>
              <span>Contact & Support Information</span>
            </h2>
            <p>
              For questions regarding these Terms, dispute reports, duplicate payment reviews, or account inquiries, please reach out to our administration:
            </p>
            <div className="p-4 rounded-2xl bg-[#202023] border border-[#303034] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#171719] border border-[#303034] flex items-center justify-center text-[#C6FF3D]">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Customer & Driver Support Email</div>
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