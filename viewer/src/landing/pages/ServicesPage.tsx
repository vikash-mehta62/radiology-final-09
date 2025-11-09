import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ServicesSection from "../components/ServicesSection";
import CloudStorageSection from "../components/CloudStorageSection";

const ServicesPage = () => {
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <div className="pt-32 pb-16">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-white">
            Our <span className="text-gradient bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Services</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Comprehensive AI-powered medical imaging solutions designed to transform healthcare workflows and enhance diagnostic accuracy.
          </p>
        </div>
      </div>
      <ServicesSection />
      <CloudStorageSection />
      <Footer />
    </div>
  );
};

export default ServicesPage;
