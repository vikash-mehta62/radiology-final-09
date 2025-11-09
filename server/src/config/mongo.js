const mongoose = require('mongoose');

async function connectMongo(uri, retries = 3) {
  if (!uri) {
    console.error('❌ MongoDB URI is missing!');
    console.error('   Please set MONGODB_URI in your .env file');
    throw new Error('Missing MongoDB URI');
  }
  
  // Log connection attempt (hide password)
  const safeUri = uri.replace(/:([^:@]+)@/, ':****@');
  console.log(`Connecting to MongoDB: ${safeUri}`);
  
  mongoose.set('strictQuery', true);
  
  // Determine if we need TLS based on URI (Atlas uses mongodb+srv or explicit tls param)
  const needsTLS = uri.includes('mongodb+srv://') || uri.includes('tls=true');
  
  const options = {
    serverSelectionTimeoutMS: 10000, // 10 seconds
    socketTimeoutMS: 45000, // 45 seconds
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    retryReads: true,
  };
  
  // Only add TLS options for Atlas/remote connections
  if (needsTLS) {
    options.tls = true;
    options.tlsAllowInvalidCertificates = false;
    options.tlsAllowInvalidHostnames = false;
  }

  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`MongoDB connection attempt ${attempt}/${retries}...`);
      await mongoose.connect(uri, options);
      console.log('✅ MongoDB connected successfully');
      console.log(`   Database: ${mongoose.connection.name}`);
      console.log(`   Host: ${mongoose.connection.host}`);
      
      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
      });
      
      return;
    } catch (error) {
      lastError = error;
      console.error(`❌ MongoDB connection attempt ${attempt} failed:`, error.message);
      
      // Provide helpful error messages
      if (error.message.includes('ENOTFOUND')) {
        console.error('   → DNS lookup failed. Check your MongoDB host address.');
      } else if (error.message.includes('ETIMEDOUT')) {
        console.error('   → Connection timed out. Check your network and firewall settings.');
      } else if (error.message.includes('authentication failed')) {
        console.error('   → Authentication failed. Check your username and password.');
      } else if (error.message.includes('bad auth')) {
        console.error('   → Invalid credentials. Verify MONGODB_URI in .env file.');
      }
      
      if (attempt < retries) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`   Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  console.error('❌ Failed to connect to MongoDB after all retries');
  console.error('   Last error:', lastError.message);
  console.error('');
  console.error('   Troubleshooting steps:');
  console.error('   1. Check MONGODB_URI in node-server/.env file');
  console.error('   2. Verify MongoDB Atlas cluster is running');
  console.error('   3. Check network access settings in MongoDB Atlas');
  console.error('   4. Ensure your IP address is whitelisted');
  console.error('   5. Verify username and password are correct');
  console.error('');
  
  // Don't throw - allow server to start without MongoDB
  // Services will handle missing DB gracefully
  console.warn('⚠️  Server starting without MongoDB connection');
  console.warn('   ZIP uploads will save to filesystem but not database');
  console.warn('   You can still access uploaded files via filesystem');
}

module.exports = { connectMongo };