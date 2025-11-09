import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Footer from "../components/Footer";
import ServicesSection from "../components/ServicesSection";
import CloudStorageSection from "../components/CloudStorageSection";
import HospitalIntegrationSection from "../components/HospitalIntegrationSection";

const LandingHome = () => {
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <Hero />
      <ServicesSection />
      <CloudStorageSection />
      <HospitalIntegrationSection />
      <Footer />
    </div>
  );
};

export default LandingHome;
