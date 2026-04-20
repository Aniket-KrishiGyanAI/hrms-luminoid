/**
 * Migration: Add timestamps to models missing them
 * Created: 2024-01-01
 */

module.exports = {
  async up(mongoose, session) {
    const collections = [
      'favorites',
      'permissions',
      'roles',
      'documentacknowledgments'
    ];

    const now = new Date();

    for (const collectionName of collections) {
      try {
        // Add createdAt and updatedAt to documents that don't have them
        await mongoose.connection.db.collection(collectionName).updateMany(
          { 
            $or: [
              { createdAt: { $exists: false } },
              { updatedAt: { $exists: false } }
            ]
          },
          {
            $set: {
              createdAt: now,
              updatedAt: now
            }
          },
          { session }
        );
        
      } catch (error) {
        
      }
    }
  },

  async down(mongoose, session) {
    const collections = [
      'favorites',
      'permissions',
      'roles',
      'documentacknowledgments'
    ];

    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.collection(collectionName).updateMany(
          {},
          {
            $unset: {
              createdAt: '',
              updatedAt: ''
            }
          },
          { session }
        );
        
      } catch (error) {
        
      }
    }
  }
};
