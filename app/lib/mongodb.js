
import { MongoClient } from 'mongodb';

const mongoURL = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
const databaseName = 'n_trips';

let client;
let db;
let tripPlans;

export async function connectToMongoDB() {
    if (db && tripPlans) {
        return { db, tripPlans };
    }

    try {
        client = new MongoClient(mongoURL);
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(databaseName);
        tripPlans = db.collection("tripplans");
        return { db, tripPlans };
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw new Error('Failed to connect to MongoDB');
    }
}