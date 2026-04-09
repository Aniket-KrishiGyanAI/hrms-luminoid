const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function updateAttendanceIndex() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('Connected successfully');

    const db = mongoose.connection.db;
    const collection = db.collection('attendances');

    console.log('Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    // Drop old unique index if it exists
    try {
      console.log('Dropping old index userId_1_date_1...');
      await collection.dropIndex('userId_1_date_1');
      console.log('Old index dropped successfully');
    } catch (error) {
      if (error.code === 27) {
        console.log('Old index does not exist, skipping...');
      } else {
        throw error;
      }
    }

    // Create new partial unique index
    console.log('Creating new partial unique index...');
    await collection.createIndex(
      { userId: 1, date: 1 },
      { 
        unique: true, 
        partialFilterExpression: { isDeleted: false },
        name: 'userId_1_date_1_active'
      }
    );
    console.log('New index created successfully');

    console.log('\nFinal indexes:');
    const finalIndexes = await collection.indexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log('\n✅ Index migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating index:', error);
    process.exit(1);
  }
}

updateAttendanceIndex();
