import { WHY_SABMS_FEATURES } from '../../constants/landing.data';

export const WhySabmsSection = () => {
  return (
    <section id="why-sabms" className="bg-miet-bg py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="inline-flex items-center rounded-full bg-red-100/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-miet-red">
            WHY CHOOSE SABMS?
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-miet-navy sm:text-4xl">
            A Smarter Way to Manage Events at MIET
          </h2>
          <p className="text-base font-normal leading-relaxed text-gray-600 sm:text-lg">
            SABMS simplifies the process of discovering venues, checking
            availability and submitting booking requests while keeping the
            process transparent and organized.
          </p>
        </div>

        {/* 6 Feature Cards Grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {WHY_SABMS_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className="group flex flex-col justify-between rounded-xl border border-gray-200/80 bg-white p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
              >
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-miet-red transition-colors duration-200 group-hover:bg-miet-red group-hover:text-white">
                    <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-miet-navy">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {feature.description}
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

export default WhySabmsSection;
