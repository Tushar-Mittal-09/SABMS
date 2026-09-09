import TopUtilityBar from '../components/landing/TopUtilityBar';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import StatsSection from '../components/landing/StatsSection';
import WhySabmsSection from '../components/landing/WhySabmsSection';
import AboutSection from '../components/landing/AboutSection';
import ExploreVenuesSection from '../components/landing/ExploreVenuesSection';
import AvailabilityPreviewSection from '../components/landing/AvailabilityPreviewSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import CampusMapSection from '../components/landing/CampusMapSection';
import CtaSection from '../components/landing/CtaSection';
import Footer from '../components/landing/Footer';

export const LandingPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-gray-900 selection:bg-red-100 selection:text-miet-red">
      {/* 1. Top Utility Bar */}
      <TopUtilityBar />

      {/* 2. Main Navbar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* 3. Hero Section */}
        <HeroSection />

        {/* 4. Verified MIET/SABMS Statistics */}
        <StatsSection />

        {/* 5. Why SABMS */}
        <WhySabmsSection />

        {/* 6. About SABMS */}
        <AboutSection />

        {/* 7. Explore Venues */}
        <ExploreVenuesSection />

        {/* 8. Availability Preview */}
        <AvailabilityPreviewSection />

        {/* 9. How It Works */}
        <HowItWorksSection />

        {/* 10. Campus / Venue Map */}
        <CampusMapSection />

        {/* 11. Call To Action */}
        <CtaSection />
      </main>

      {/* 12. Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;
