import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Blog = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 lg:px-8 py-32">
        <h1 className="text-5xl font-bold mb-6 text-gray-900">Blog</h1>
        <p className="text-xl text-gray-700">
          Latest insights and updates from our team.
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default Blog;
