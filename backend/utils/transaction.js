const mongoose = require('mongoose');

/**
 * Execute operations within a MongoDB transaction
 * @param {Function} callback - Async function that receives session
 * @param {Object} options - Transaction options
 * @returns {Promise} Result of the transaction
 */
async function withTransaction(callback, options = {}) {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      ...options
    });

    const result = await callback(session);
    
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Execute multiple operations atomically
 * @param {Array} operations - Array of {model, operation, data}
 * @returns {Promise} Results array
 */
async function executeAtomic(operations) {
  return withTransaction(async (session) => {
    const results = [];
    
    for (const op of operations) {
      const { model, operation, data, options = {} } = op;
      
      switch (operation) {
        case 'create':
          const created = await model.create([data], { session, ...options });
          results.push(created[0]);
          break;
        case 'update':
          const updated = await model.findByIdAndUpdate(
            data._id || data.id,
            data.update,
            { session, new: true, ...options }
          );
          results.push(updated);
          break;
        case 'delete':
          const deleted = await model.findByIdAndDelete(
            data._id || data.id,
            { session, ...options }
          );
          results.push(deleted);
          break;
        case 'softDelete':
          const softDeleted = await model.findByIdAndUpdate(
            data._id || data.id,
            { 
              isDeleted: true, 
              deletedAt: new Date(),
              deletedBy: data.deletedBy,
              deletionReason: data.reason
            },
            { session, new: true, ...options }
          );
          results.push(softDeleted);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
    
    return results;
  });
}

module.exports = {
  withTransaction,
  executeAtomic
};
