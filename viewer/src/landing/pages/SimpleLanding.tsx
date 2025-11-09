const SimpleLanding = () => {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          Welcome to Medical Imaging AI
        </h1>
        <p className="text-2xl text-gray-600 mb-8">
          Advanced AI-powered medical imaging platform
        </p>
        <div className="flex gap-4">
          <a 
            href="/app/login"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700"
          >
            Sign In
          </a>
          <a 
            href="/contact"
            className="border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-50"
          >
            Contact Us
          </a>
        </div>
        
        <div className="mt-16 grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">99.9%</div>
            <div className="text-gray-600">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">10M+</div>
            <div className="text-gray-600">Images</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">500+</div>
            <div className="text-gray-600">Facilities</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleLanding;
