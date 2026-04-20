const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function updateAttendanceIndex() {
  try {
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    

    const db = mongoose.connection.db;
    const collection = db.collection('attendances');

    
    const indexes = await collection.indexes();
    );

    // Drop old unique index if it exists
    try {
      
      await collection.dropIndex('userId_1_date_1');
      
    } catch (error) {
      if (error.code === 27) {
        
      } else {
        throw error;
      }
    }

    // Create new partial unique index
    
    await collection.createIndex(
      { userId: 1, date: 1 },
      { 
        unique: true, 
        partialFilterExpression: { isDeleted: false },
        name: 'userId_1_date_1_active'
      }
    );
    

    
    const finalIndexes = await collection.indexes();
    );

    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating index:', error);
    process.exit(1);
  }
}

updateAttendanceIndex();
