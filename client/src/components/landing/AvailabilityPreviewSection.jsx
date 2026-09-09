import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Layers,
  ArrowRight,
  Info,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { EVENT_TYPES } from '../../constants/landing.data';

export const AvailabilityPreviewSection = () => {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '09:00',
    endTime: '12:00',
    eventType: EVENT_TYPES[0],
    attendees: '150',
  });

  const [errors, setErrors] = useState({});
  const [previewResult, setPreviewResult] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const validate = () => {
    const errs = {};
    let firstErrorField = null;

    if (!formData.date) {
      errs.date = 'Please select an event date';
      if (!firstErrorField) firstErrorField = 'avail-date';
    } else {
      const selected = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        errs.date = 'Event date cannot be in the past';
        if (!firstErrorField) firstErrorField = 'avail-date';
      }
    }

    if (!formData.startTime) {
      errs.startTime = 'Select a start time';
      if (!firstErrorField) firstErrorField = 'avail-start';
    }
    if (!formData.endTime) {
      errs.endTime = 'Select an end time';
      if (!firstErrorField) firstErrorField = 'avail-end';
    }
    if (
      formData.startTime &&
      formData.endTime &&
      formData.startTime >= formData.endTime
    ) {
      errs.endTime = 'End time must be after start time';
      if (!firstErrorField) firstErrorField = 'avail-end';
    }

    const count = parseInt(formData.attendees, 10);
    if (isNaN(count) || count <= 0) {
      errs.attendees = 'Enter valid attendee count';
      if (!firstErrorField) firstErrorField = 'avail-attendees';
    } else if (count > 600) {
      errs.attendees = 'Maximum single-hall capacity is 600';
      if (!firstErrorField) firstErrorField = 'avail-attendees';
    }

    setErrors(errs);

    // Accessibility requirement: Focus moves appropriately when validation fails
    if (firstErrorField) {
      setTimeout(() => {
        document.getElementById(firstErrorField)?.focus();
      }, 50);
      return false;
    }

    return true;
  };

  const handlePreview = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsPreviewing(true);
    setPreviewResult(null);

    setTimeout(() => {
      setIsPreviewing(false);
      setPreviewResult({
        requestedDate: formData.date,
        timeSlot: `${formData.startTime} - ${formData.endTime}`,
        eventType: formData.eventType,
        count: parseInt(formData.attendees, 10),
      });
    }, 350);
  };

  return (
    <section
      id="availability-preview"
      className="border-b border-gray-200 bg-white py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-miet-navyLight bg-gradient-to-br from-miet-navy to-miet-navyDark text-white shadow-xl">
          <div className="p-8 sm:p-10 lg:p-12">
            {/* Header */}
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center space-x-2 rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
                <span>VENUE AVAILABILITY PREVIEW</span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                Check Venue Availability
              </h2>
              <p className="text-sm text-gray-300 sm:text-base">
                Select your preferred date, time, and attendee count to preview
                booking parameters before submitting an official reservation
                request.
              </p>
            </div>

            {/* Availability Preview Form */}
            <form onSubmit={handlePreview} className="mt-8" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* Date */}
                <div>
                  <label
                    htmlFor="avail-date"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Event Date
                  </label>
                  <div className="relative">
                    <input
                      id="avail-date"
                      type="date"
                      value={formData.date}
                      min={new Date().toISOString().split('T')[0]}
                      aria-invalid={errors.date ? 'true' : 'false'}
                      aria-describedby={
                        errors.date ? 'avail-date-error' : undefined
                      }
                      onChange={(e) => {
                        setFormData({ ...formData, date: e.target.value });
                        if (errors.date) setErrors({ ...errors, date: null });
                      }}
                      className={`w-full rounded-lg border bg-white/10 px-3.5 py-2.5 text-sm text-white transition-all [color-scheme:dark] focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red ${
                        errors.date ? 'border-red-400' : 'border-white/20'
                      }`}
                    />
                    <CalendarIcon className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                  {errors.date && (
                    <p
                      id="avail-date-error"
                      className="mt-1 flex items-center gap-1 text-xs text-red-400"
                    >
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.date}</span>
                    </p>
                  )}
                </div>

                {/* Start Time */}
                <div>
                  <label
                    htmlFor="avail-start"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Start Time
                  </label>
                  <div className="relative">
                    <select
                      id="avail-start"
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData({ ...formData, startTime: e.target.value })
                      }
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white transition-all [color-scheme:dark] focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                    >
                      {[
                        '08:30',
                        '09:00',
                        '10:00',
                        '11:00',
                        '12:00',
                        '13:00',
                        '14:00',
                        '15:00',
                        '16:00',
                      ].map((t) => (
                        <option
                          key={t}
                          value={t}
                          className="bg-gray-900 text-white"
                        >
                          {t}
                        </option>
                      ))}
                    </select>
                    <Clock className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* End Time */}
                <div>
                  <label
                    htmlFor="avail-end"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    End Time
                  </label>
                  <div className="relative">
                    <select
                      id="avail-end"
                      value={formData.endTime}
                      aria-invalid={errors.endTime ? 'true' : 'false'}
                      aria-describedby={
                        errors.endTime ? 'avail-end-error' : undefined
                      }
                      onChange={(e) => {
                        setFormData({ ...formData, endTime: e.target.value });
                        if (errors.endTime)
                          setErrors({ ...errors, endTime: null });
                      }}
                      className={`w-full rounded-lg border bg-white/10 px-3.5 py-2.5 text-sm text-white transition-all [color-scheme:dark] focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red ${
                        errors.endTime ? 'border-red-400' : 'border-white/20'
                      }`}
                    >
                      {[
                        '10:00',
                        '11:00',
                        '12:00',
                        '13:00',
                        '14:00',
                        '15:00',
                        '16:00',
                        '17:00',
                        '18:00',
                      ].map((t) => (
                        <option
                          key={t}
                          value={t}
                          className="bg-gray-900 text-white"
                        >
                          {t}
                        </option>
                      ))}
                    </select>
                    <Clock className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                  {errors.endTime && (
                    <p
                      id="avail-end-error"
                      className="mt-1 flex items-center gap-1 text-xs text-red-400"
                    >
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.endTime}</span>
                    </p>
                  )}
                </div>

                {/* Event Type */}
                <div>
                  <label
                    htmlFor="avail-type"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Event Type
                  </label>
                  <div className="relative">
                    <select
                      id="avail-type"
                      value={formData.eventType}
                      onChange={(e) =>
                        setFormData({ ...formData, eventType: e.target.value })
                      }
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white transition-all [color-scheme:dark] focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                    >
                      {EVENT_TYPES.map((type) => (
                        <option
                          key={type}
                          value={type}
                          className="bg-gray-900 text-white"
                        >
                          {type}
                        </option>
                      ))}
                    </select>
                    <Layers className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* Expected Attendees */}
                <div>
                  <label
                    htmlFor="avail-attendees"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Expected Attendees
                  </label>
                  <div className="relative">
                    <input
                      id="avail-attendees"
                      type="number"
                      placeholder="e.g. 150"
                      value={formData.attendees}
                      aria-invalid={errors.attendees ? 'true' : 'false'}
                      aria-describedby={
                        errors.attendees ? 'avail-attendees-error' : undefined
                      }
                      onChange={(e) => {
                        setFormData({ ...formData, attendees: e.target.value });
                        if (errors.attendees)
                          setErrors({ ...errors, attendees: null });
                      }}
                      className={`w-full rounded-lg border bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder-gray-400 transition-all focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red ${
                        errors.attendees ? 'border-red-400' : 'border-white/20'
                      }`}
                    />
                    <Users className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                  {errors.attendees && (
                    <p
                      id="avail-attendees-error"
                      className="mt-1 flex items-center gap-1 text-xs text-red-400"
                    >
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.attendees}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Action */}
              <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-4 sm:flex-row">
                <div className="flex items-center space-x-2 text-xs text-gray-400">
                  <Info className="h-4 w-4 shrink-0 text-gray-300" />
                  <span>
                    Frontend preview mode. Live scheduling verification connects
                    upon login.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isPreviewing}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-miet-red px-6 py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:bg-miet-redHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2 focus-visible:ring-offset-miet-navy disabled:opacity-50 sm:w-auto"
                >
                  {isPreviewing ? (
                    <span>Configuring Slot...</span>
                  ) : (
                    <>
                      <span>Preview Availability</span>
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Results Preview Card (No Fabricated Counts) */}
            {previewResult && (
              <div className="mt-8 animate-fade-in rounded-xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                      <FileCheck2 className="h-5 w-5 text-miet-red" />
                      <span>Slot Configuration Preview Generated</span>
                    </div>
                    <p className="text-xs text-gray-300">
                      Proposed Date:{' '}
                      <strong className="text-white">
                        {previewResult.requestedDate}
                      </strong>{' '}
                      ({previewResult.timeSlot}) • Intended Capacity:{' '}
                      {previewResult.count} attendees • Event:{' '}
                      {previewResult.eventType}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      to="/login"
                      className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-xs font-bold text-miet-navy transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-miet-navy sm:text-sm"
                    >
                      <span>Proceed to Official Request</span>
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AvailabilityPreviewSection;
