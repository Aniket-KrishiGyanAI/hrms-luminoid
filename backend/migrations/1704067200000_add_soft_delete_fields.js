/**
 * Migration: Add soft delete fields to all models
 * Created: 2024-01-01
 */

module.exports = {
  async up(mongoose, session) {
    const collections = [
      'users',
      'leaverequests',
      'announcements',
      'assets',
      'departments',
      'files',
      'holidays',
      'tasks',
      'trainings'
    ];

    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.collection(collectionName).updateMany(
          { isDeleted: { $exists: false } },
          {
            $set: {
              isDeleted: false,
              deletedAt: null,
              deletedBy: null,
              deletionReason: null
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
      'users',
      'leaverequests',
      'announcements',
      'assets',
      'departments',
      'files',
      'holidays',
      'tasks',
      'trainings'
    ];

    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.collection(collectionName).updateMany(
          {},
          {
            $unset: {
              isDeleted: '',
              deletedAt: '',
              deletedBy: '',
              deletionReason: ''
            }
          },
          { session }
        );
        
      } catch (error) {
        
      }
    }
  }
};
