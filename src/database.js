//src/databse.js
const mongoose = require('mongoose');

// Set strictQuery to false to prepare for Mongoose 7
mongoose.set('strictQuery', false);

// Event Schema
const eventSchema = new mongoose.Schema({
    contractId: { type: String, required: true },
    txId: { type: String, required: true, unique: true },
    eventName: { type: String, required: true },
    eventData: mongoose.Schema.Types.Mixed,
    blockHeight: { type: Number, required: true },
    timestamp: { type: Date, required: true }
}, { timestamps: true });

const Event = mongoose.model('Event', eventSchema);

// Contract Schema
const contractSchema = new mongoose.Schema({
    address: { type: String, required: true },
    contractName: { type: String, required: true },
    lastProcessedBlock: { type: Number, default: 0 }
}, { timestamps: true });

const Contract = mongoose.model('Contract', contractSchema);

// Connect to MongoDB
async function connectToDatabase() {
    try {
        // Using localhost connection string for local MongoDB
        const mongoURI = 'mongodb://127.0.0.1:27017/stacks-indexer';
        
        console.log('Attempting to connect to MongoDB...');
        
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // 5 second timeout
        });
        
        console.log('Connected to MongoDB successfully');
        
        // Test the connection
        await mongoose.connection.db.admin().ping();
        console.log('Database ping successful');
    } catch (error) {
        console.error('MongoDB connection error. Please make sure MongoDB is running locally.');
        console.error('Error details:', error);
        process.exit(1);
    }
}

// Database operations
async function saveEvent(eventData) {
    try {
        await Event.create(eventData);
        console.log(`Saved event: ${eventData.eventName}`);
    } catch (error) {
        if (error.code !== 11000) { // Ignore duplicate key errors
            console.error('Error saving event:', error);
        }
    }
}

async function updateContractBlock(address, contractName, blockHeight) {
    try {
        await Contract.findOneAndUpdate(
            { address, contractName },
            { lastProcessedBlock: blockHeight },
            { upsert: true }
        );
    } catch (error) {
        console.error('Error updating contract block:', error);
    }
}

module.exports = {
    connectToDatabase,
    saveEvent,
    updateContractBlock
};