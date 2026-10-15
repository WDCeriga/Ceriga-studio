import { Link } from 'react-router';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '../../components/ui/utils';
import {
  calculateProfileCompleteness,
  loadCompleteManufacturerProfile,
} from '../../data/manufacturerOnboardingStore';

export function ManufacturerProfileCompletenessCard() {
  const profile = loadCompleteManufacturerProfile();
  const { totalPercentage, sections } = calculateProfileCompleteness(profile);

  // Determine progress color
  const strokeColor =
    totalPercentage >= 80
      ? '#10B981' // emerald
      : totalPercentage >= 50
        ? '#F59E0B' // amber
        : '#CC2D24'; // ceriga red

  return (
    <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-5">
      {/* Header with Circular / Bar Progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <TrendingUp className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Profile Completeness
            </span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Manufacturing Profile Strength: {totalPercentage}%
          </h2>
          <p className="mt-0.5 text-xs text-white/45">
            A complete profile gives Ceriga the exact parameters required to route high-match brand orders to your floor.
          </p>
        </div>

        {/* Circular Percentage Pill */}
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 flex items-center justify-center">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-white/10"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3.5"
                strokeDasharray={`${totalPercentage}, 100`}
                stroke={strokeColor}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold text-white tabular-nums">
              {totalPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${totalPercentage}%`, backgroundColor: strokeColor }}
        />
      </div>

      {/* Breakdown Checklist */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-[#252528]">
        {sections.map((sec) => (
          <Link
            key={sec.id}
            to={sec.link}
            className="flex items-start justify-between p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:border-white/15 hover:bg-white/[0.03] transition group"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="mt-0.5">
                {sec.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 text-white/30" />
                )}
              </div>
              <div className="min-w-0">
                <span
                  className={cn(
                    'text-xs font-medium block truncate',
                    sec.completed ? 'text-white/90' : 'text-white/60',
                  )}
                >
                  {sec.name}
                </span>
                <span className="text-[10px] text-white/40 line-clamp-1 mt-0.5">
                  {sec.hint}
                </span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-[#CC2D24] transition shrink-0 ml-2" />
          </Link>
        ))}
      </div>
    </div>
  );
}
