import { VERIFIED_STATS } from '../../constants/landing.data';

export const StatsSection = () => {
  return (
    <section
      aria-label="Verified Institutional Statistics"
      className="relative z-20 mx-auto -mt-8 max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-card sm:p-8">
        <div className="grid grid-cols-2 gap-6 divide-y divide-gray-100 sm:divide-x sm:divide-y-0 lg:grid-cols-4 lg:gap-8">
          {VERIFIED_STATS.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className={`flex items-center space-x-4 ${
                  idx > 0 ? 'pt-4 sm:pl-6 sm:pt-0 lg:pl-8' : ''
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-miet-red">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-miet-navy sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    {stat.label}
                  </div>
                  <p className="text-xs font-normal text-gray-500">
                    {stat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
