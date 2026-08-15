import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Mail,
  Phone,
  Building2,
  User,
} from 'lucide-react';
import { maskEmail, maskPhone } from '../../utils/validators';

/**
 * Detailed Verification Status and Account Summary Component.
 */
export const VerificationSummary = ({ user = {}, className = '' }) => {
  const isEmailVerified = Boolean(user.isEmailVerified);
  const isPhoneVerified = Boolean(user.isPhoneVerified);
  const status = (user.status || 'PENDING').toUpperCase();

  const getStatusBadge = () => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
            Active
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Pending Approval
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            {status}
          </span>
        );
    }
  };

  return (
    <div className={`flex w-full flex-col gap-5 ${className}`}>
      {/* Verification Checkpoints Card */}
      <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-dark-border dark:bg-dark-surface2/60">
        <div className="shadow-xs flex flex-col items-center rounded-lg bg-white p-2 text-center dark:bg-dark-surface">
          <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-semibold text-brand-text dark:text-dark-text">
            Account
          </span>
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            Created
          </span>
        </div>

        <div className="shadow-xs flex flex-col items-center rounded-lg bg-white p-2 text-center dark:bg-dark-surface">
          {isEmailVerified ? (
            <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Clock className="mb-1 h-5 w-5 text-amber-500" />
          )}
          <span className="text-[11px] font-semibold text-brand-text dark:text-dark-text">
            Email
          </span>
          <span
            className={`text-[10px] font-medium ${
              isEmailVerified
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {isEmailVerified ? 'Verified' : 'Pending'}
          </span>
        </div>

        <div className="shadow-xs flex flex-col items-center rounded-lg bg-white p-2 text-center dark:bg-dark-surface">
          {isPhoneVerified ? (
            <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Clock className="mb-1 h-5 w-5 text-amber-500" />
          )}
          <span className="text-[11px] font-semibold text-brand-text dark:text-dark-text">
            Phone
          </span>
          <span
            className={`text-[10px] font-medium ${
              isPhoneVerified
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {isPhoneVerified
              ? 'Verified'
              : user.phone
                ? 'Pending'
                : 'Not Provided'}
          </span>
        </div>
      </div>

      {/* Account Details Box */}
      <div className="divide-y divide-brand-border/60 overflow-hidden rounded-xl border border-brand-border text-xs dark:divide-dark-border/60 dark:border-dark-border">
        <div className="flex items-center justify-between bg-white p-3 dark:bg-dark-surface">
          <span className="flex items-center gap-1.5 text-brand-muted dark:text-dark-muted">
            <User className="h-3.5 w-3.5" /> Full Name
          </span>
          <span className="font-semibold text-brand-navy dark:text-dark-text">
            {user.name || 'University Member'}
          </span>
        </div>

        <div className="flex items-center justify-between bg-white p-3 dark:bg-dark-surface">
          <span className="flex items-center gap-1.5 text-brand-muted dark:text-dark-muted">
            <Mail className="h-3.5 w-3.5" /> University Email
          </span>
          <span className="font-mono font-medium text-brand-text dark:text-dark-text">
            {maskEmail(user.email)}
          </span>
        </div>

        {user.phone && (
          <div className="flex items-center justify-between bg-white p-3 dark:bg-dark-surface">
            <span className="flex items-center gap-1.5 text-brand-muted dark:text-dark-muted">
              <Phone className="h-3.5 w-3.5" /> Phone Number
            </span>
            <span className="font-mono font-medium text-brand-text dark:text-dark-text">
              {maskPhone(user.phone)}
            </span>
          </div>
        )}

        {user.department && (
          <div className="flex items-center justify-between bg-white p-3 dark:bg-dark-surface">
            <span className="flex items-center gap-1.5 text-brand-muted dark:text-dark-muted">
              <Building2 className="h-3.5 w-3.5" /> Department
            </span>
            <span className="font-medium text-brand-text dark:text-dark-text">
              {user.department}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between bg-white p-3 dark:bg-dark-surface">
          <span className="flex items-center gap-1.5 text-brand-muted dark:text-dark-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> Role
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-blue dark:text-dark-blue">
            {user.role || 'STUDENT'}
          </span>
        </div>

        <div className="flex items-center justify-between bg-white p-3 dark:bg-dark-surface">
          <span className="flex items-center gap-1.5 text-brand-muted dark:text-dark-muted">
            <AlertCircle className="h-3.5 w-3.5" /> Account Status
          </span>
          <div>{getStatusBadge()}</div>
        </div>
      </div>

      {/* Institutional Policy Note */}
      <div className="rounded-lg border border-blue-200/80 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
        {status === 'ACTIVE' ? (
          <p>
            Your account is verified and ready for campus booking access once
            login services are enabled in upcoming releases.
          </p>
        ) : (
          <p>
            Your verification is complete. Your account is awaiting
            administrative activation in accordance with university policy.
          </p>
        )}
      </div>
    </div>
  );
};

export default VerificationSummary;
