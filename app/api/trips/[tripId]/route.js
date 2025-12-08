import { connectToMongoDB } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request, { params }) {
    try {
        console.log('📨 [GET] Fetching trip by ID');
        const { tripPlans } = await connectToMongoDB();
        const tripId = params.tripId;
        
        console.log('🔍 [GET] Trip ID:', tripId);
        
        const savedTrip = await tripPlans.findOne({ _id: ObjectId.createFromHexString(tripId) });
        console.log('✅ [GET] Trip found:', !!savedTrip);
        console.log('🔍 [GET] Trip data keys:', savedTrip ? Object.keys(savedTrip) : 'null');
        
        if (savedTrip) {
            return new Response(JSON.stringify(savedTrip), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            console.error('❌ [GET] Trip not found with ID:', tripId);
            return new Response(JSON.stringify({ error: 'Trip not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        console.error('❌ [GET] Error fetching trip:');
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        return new Response(JSON.stringify({ 
            error: 'Something went wrong',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// export async function PUT(request, { params }) {
//     const updatedTrip = await request.json();

//     // Ensure _id is not modified
//     if (updatedTrip._id && updatedTrip._id !== params.tripId) {
//         return new Response(JSON.stringify({ error: 'Cannot modify trip ID' }), {
//             status: 400,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     }

//     try {
//         const { tripPlans } = await connectToMongoDB();
//         const tripId = params.tripId;

//         // Convert tripId to ObjectId
//         const objectId = new ObjectId(tripId);

//         // Remove tripId if present to avoid conflicts
//         delete updatedTrip.tripId;

//         const result = await tripPlans.updateOne(
//             { _id: objectId },
//             { $set: updatedTrip },
//             { upsert: false }
//         );

//         if (result.matchedCount === 0) {
//             return new Response(JSON.stringify({ error: 'Trip not found' }), {
//                 status: 404,
//                 headers: { 'Content-Type': 'application/json' },
//             });
//         }

//         const updatedDocument = await collection.findOne({ _id: tripId });
//         return new Response(JSON.stringify(updatedDocument), {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     } catch (error) {
//         console.error('Update error:', error);
//         return new Response(JSON.stringify({ error: 'Something went wrong' }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     }
// }

export async function PUT(request, { params }) {
    const updatedTrip = await request.json();

    // Ensure _id is not modified
    if (updatedTrip._id && updatedTrip._id !== params.tripId) {
        return new Response(JSON.stringify({ error: 'Cannot modify trip ID' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { tripPlans } = await connectToMongoDB();
        const tripId = params.tripId;

        // Convert tripId to ObjectId
        const objectId = ObjectId.createFromHexString(tripId);

        // Remove tripId from the update payload to avoid conflicts
        delete updatedTrip.tripId;

        const result = await tripPlans.updateOne(
            { _id: objectId },
            { $set: updatedTrip },
            { upsert: false }
        );

        if (result.matchedCount === 0) {
            return new Response(JSON.stringify({ error: 'Trip not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const updatedDocument = await tripPlans.findOne({ _id: objectId });
        return new Response(JSON.stringify(updatedDocument), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Update error:', error);
        return new Response(JSON.stringify({ error: 'Something went wrong' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// export async function DELETE(request, { params }) {
//     try {
//         const { tripPlans } = await connectToMongoDB();
//         const result = await tripPlans.deleteOne({ _id: params.tripId });
//         if (result.deletedCount === 1) {
//             return new Response(JSON.stringify({ message: 'Trip deleted successfully' }), {
//                 status: 200,
//                 headers: { 'Content-Type': 'application/json' },
//             });
//         } else {
//             return new Response(JSON.stringify({ error: 'Trip not found' }), {
//                 status: 404,
//                 headers: { 'Content-Type': 'application/json' },
//             });
//         }
//     } catch (error) {
//         console.error('Delete error:', error);
//         return new Response(JSON.stringify({ error: 'Something went wrong' }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     }
// }

export async function DELETE(request, { params }) {
    try {
        const { tripPlans } = await connectToMongoDB();
        const tripId = params.tripId;

        // Convert tripId to ObjectId
        const objectId = ObjectId.createFromHexString(tripId);

        const result = await tripPlans.deleteOne({ _id: objectId });
        if (result.deletedCount === 1) {
            return new Response(JSON.stringify({ message: 'Trip deleted successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ error: 'Trip not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        console.error('Delete error:', error);
        return new Response(JSON.stringify({ error: 'Something went wrong' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}