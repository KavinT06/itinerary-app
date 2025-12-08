#!/usr/bin/env node

/**
 * Quick MongoDB Connection Test
 * Run: node test-mongodb.js
 */

console.log('🔍 MongoDB Connection Test');
console.log('==========================\n');

// Check environment variable
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is not set');
    console.log('\nTo set it:');
    console.log('  Windows (cmd):   set MONGODB_URI=mongodb+srv://...');
    console.log('  Windows (PS):    $env:MONGODB_URI="mongodb+srv://..."');
    console.log('  Linux/Mac:       export MONGODB_URI="mongodb+srv://..."');
    process.exit(1);
}

console.log('✅ MONGODB_URI is set');
console.log('   URI:', process.env.MONGODB_URI.substring(0, 50) + '...\n');

// Test import
try {
    console.log('🔄 Importing MongoDB driver...');
    const { MongoClient } = require('mongodb');
    console.log('✅ MongoDB driver imported successfully\n');

    // Test connection
    console.log('🔄 Attempting to connect...');
    const client = new MongoClient(process.env.MONGODB_URI, {
        maxPoolSize: 1,
        serverSelectionTimeoutMS: 15000,
    });

    client.connect().then(async () => {
        console.log('✅ Connected to MongoDB!\n');

        // Test database
        const db = client.db('n_trips');
        console.log('✅ Database selected: n_trips\n');

        // Test ping
        await db.admin().ping();
        console.log('✅ Ping successful\n');

        // Count documents
        const tripplans = db.collection('tripplans');
        const count = await tripplans.countDocuments();
        console.log('✅ Collection "tripplans" has', count, 'documents\n');

        console.log('🎉 All tests passed!');
        process.exit(0);

    }).catch(error => {
        console.error('❌ Connection failed:');
        console.error('   Error:', error.message);
        console.error('   Code:', error.code);
        console.error('   Name:', error.name);

        if (error.message.includes('ENOTFOUND')) {
            console.error('\n   Solution: Check MongoDB hostname in your URI');
        } else if (error.message.includes('authentication')) {
            console.error('\n   Solution: Check username/password in your URI');
        } else if (error.message.includes('timeout')) {
            console.error('\n   Solution: Check network access and IP whitelist');
        }

        process.exit(1);
    });

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
