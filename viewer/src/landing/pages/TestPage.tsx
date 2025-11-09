const TestPage = () => {
  return (
    <div className="min-h-screen bg-blue-500 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Tailwind Test Page
        </h1>
        <p className="text-gray-600">
          If you can see this styled, Tailwind is working!
        </p>
        <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
          Test Button
        </button>
      </div>
    </div>
  );
};

export default TestPage;
