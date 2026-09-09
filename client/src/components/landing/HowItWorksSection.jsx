import { ArrowRight, ShieldCheck } from 'lucide-react';
import { HOW_IT_WORKS_STEPS } from '../../constants/landing.data';

export const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-miet-red">
            HOW IT WORKS
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-miet-navy sm:text-4xl">
            Book an Auditorium in 4 Simple Steps
          </h2>
          <p className="text-base font-normal text-gray-600 sm:text-lg">
            From initial venue selection to official administrative
            confirmation, SABMS makes the process completely transparent.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="relative mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="group relative flex flex-col items-start rounded-xl border border-gray-200/80 bg-miet-bg p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
              >
                {/* Step Number Tag */}
                <div className="mb-5 flex w-full items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-miet-red transition-colors duration-200 group-hover:bg-miet-red group-hover:text-white">
                    <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  </div>
                  <span className="text-2xl font-black text-gray-300 transition-colors group-hover:text-miet-red/40">
                    {step.step}
                  </span>
                </div>

                <h3 className="mb-2 text-base font-bold text-gray-900 transition-colors group-hover:text-miet-navy">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
                  {step.description}
                </p>

                {/* Arrow Connector for Desktop */}
                {idx < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Booking Guidelines Box (Neutral Policy Statement) */}
        <div
          id="guidelines"
          className="mt-16 flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-200/90 bg-gray-50 p-6 sm:flex-row"
        >
          <div className="flex items-start space-x-3 space-y-1 text-center sm:text-left">
            <ShieldCheck className="mt-0.5 hidden h-5 w-5 shrink-0 text-miet-navy sm:inline" />
            <div>
              <h4 className="text-sm font-bold text-miet-navy">
                Institutional Booking Policy
              </h4>
              <p className="text-xs text-gray-600">
                Booking requirements will follow the configured institutional
                policy. All requests are logged and routed through the
                designated administrative workflow.
              </p>
            </div>
          </div>
          <a
            href="#contact"
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-miet-navy transition-colors hover:bg-gray-100"
          >
            Contact Help & Support
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
