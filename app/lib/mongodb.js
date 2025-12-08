import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = 'n_trips';
const MONGODB_COLLECTION = 'tripplans';

console.log('📝 [MONGO] Environment:', process.env.NODE_ENV);
console.log('🔍 [MONGO] MONGODB_URI configured:', !!MONGODB_URI);

if (!MONGODB_URI) {
    console.error('❌ [MONGO] MONGODB_URI environment variable is not set!');
    if (process.env.NODE_ENV === 'production') {
        console.error('   For Vercel: Add MONGODB_URI to Environment Variables');
        console.error('   Example: mongodb+srv://username:password@cluster.mongodb.net/n_trips');
    } else {
        console.error('   For Local Development: Set MONGODB_URI in .env.local');
        console.error('   Example: mongodb://localhost:27017/n_trips');
    }
}

let mongoClient = null;
let mongoDb = null;
let connectionAttempts = 0;
const MAX_RETRIES = 3;

async function initializeConnection() {
    connectionAttempts++;
    
    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not configured');
        }

        if (mongoClient && mongoDb) {
            console.log('✅ [MONGO] Using existing connection');
            return { client: mongoClient, db: mongoDb };
        }

        console.log(`🔄 [MONGO] Initializing connection (attempt ${connectionAttempts}/${MAX_RETRIES})...`);
        console.log('🔍 [MONGO] URI starts with:', MONGODB_URI.substring(0, 30) + '...');

        mongoClient = new MongoClient(MONGODB_URI, {
            maxPoolSize: 5,
            minPoolSize: 1,
            maxIdleTimeMS: 60000,
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
            family: 4,
            retryWrites: true,
        });

        console.log('🔄 [MONGO] Calling client.connect()...');
        await mongoClient.connect();
        console.log('✅ [MONGO] Connected successfully');

        mongoDb = mongoClient.db(MONGODB_DB);
        console.log('✅ [MONGO] Database selected:', MONGODB_DB);

        // Test the connection with ping
        console.log('🔄 [MONGO] Running ping test...');
        await mongoDb.admin().ping();
        console.log('✅ [MONGO] Ping successful');

        // Reset retry counter on success
        connectionAttempts = 0;

        return { client: mongoClient, db: mongoDb };

    } catch (error) {
        console.error('❌ [MONGO] Connection error (attempt', connectionAttempts + ')');
        console.error('   Message:', error.message);
        console.error('   Code:', error.code);
        console.error('   Name:', error.name);
        
        // Provide specific guidance
        if (error.message.includes('ECONNREFUSED')) {
            console.error('   ⚠️  MongoDB is not running on localhost:27017');
            console.error('   Solution: Start MongoDB or use MongoDB Atlas (cloud)');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            console.error('   ⚠️  Cannot resolve MongoDB hostname');
            console.error('   Solution: Check connection string hostname');
        } else if (error.message.includes('authentication')) {
            console.error('   ⚠️  Authentication failed');
            console.error('   Solution: Check username/password in connection string');
        } else if (error.message.includes('timeout')) {
            console.error('   ⚠️  Connection timeout');
            console.error('   Solution: Check network/firewall and MongoDB Atlas IP whitelist');
        } else if (error.message.includes('MONGODB_URI')) {
            console.error('   ⚠️  MONGODB_URI not configured');
            console.error('   Solution: Set MONGODB_URI environment variable');
        }
        
        mongoClient = null;
        mongoDb = null;

        if (connectionAttempts < MAX_RETRIES) {
            console.log('🔄 [MONGO] Retrying connection...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return initializeConnection();
        }

        throw new Error(`MongoDB connection failed after ${MAX_RETRIES} attempts: ${error.message}`);
    }
}

export async function connectToMongoDB() {
    try {
        const connection = await initializeConnection();
        const tripPlans = connection.db.collection(MONGODB_COLLECTION);
        
        return { 
            db: connection.db, 
            tripPlans,
            client: connection.client
        };

    } catch (error) {
        console.error('❌ [MONGO] connectToMongoDB failed:', error.message);
        throw error;
    }
}