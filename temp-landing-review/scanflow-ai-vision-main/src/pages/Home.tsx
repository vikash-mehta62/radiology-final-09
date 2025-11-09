import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import CloudStorage from "@/components/CloudStorage";
import HospitalIntegration from "@/components/HospitalIntegration";
import Footer from "@/components/Footer";

const Home = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Services />
      <CloudStorage />
      <HospitalIntegration />
      <Footer />
    </div>
  );
};

export default Home;
