const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Migration schema to track applied migrations
const migrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['PENDING', 'APPLIED', 'FAILED'], default: 'APPLIED' },
  error: String,
  version: Number
});

const Migration = mongoose.model('Migration', migrationSchema);

class MigrationRunner {
  constructor(migrationsPath) {
    this.migrationsPath = migrationsPath || path.join(__dirname, '../migrations');
  }

  /**
   * Get all migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(f => f.endsWith('.js'))
        .sort(); // Migrations run in alphabetical order
    } catch (error) {
      console.error('Error reading migrations directory:', error);
      return [];
    }
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    const applied = await Migration.find({ status: 'APPLIED' }).sort({ version: 1 });
    return applied.map(m => m.name);
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations() {
    const allFiles = await this.getMigrationFiles();
    const applied = await this.getAppliedMigrations();
    return allFiles.filter(f => !applied.includes(f));
  }

  /**
   * Run a single migration
   */
  async runMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    const migration = require(migrationPath);

    if (!migration.up || typeof migration.up !== 'function') {
      throw new Error(`Migration ${filename} must export an 'up' function`);
    }

    
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await migration.up(mongoose, session);
      
      // Record migration
      await Migration.create([{
        name: filename,
        appliedAt: new Date(),
        status: 'APPLIED',
        version: this.extractVersion(filename)
      }], { session });

      await session.commitTransaction();
      
      return true;
    } catch (error) {
      await session.abortTransaction();
      
      // Record failed migration
      await Migration.create({
        name: filename,
        status: 'FAILED',
        error: error.message,
        version: this.extractVersion(filename)
      });

      console.error(`✗ Migration ${filename} failed:`, error.message);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Run all pending migrations
   */
  async runPending() {
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      
      return;
    }

    `);

    for (const filename of pending) {
      await this.runMigration(filename);
    }

    
  }

  /**
   * Rollback last migration
   */
  async rollback() {
    const lastMigration = await Migration.findOne({ status: 'APPLIED' })
      .sort({ appliedAt: -1 });

    if (!lastMigration) {
      
      return;
    }

    const migrationPath = path.join(this.migrationsPath, lastMigration.name);
    const migration = require(migrationPath);

    if (!migration.down || typeof migration.down !== 'function') {
      throw new Error(`Migration ${lastMigration.name} must export a 'down' function for rollback`);
    }

    

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await migration.down(mongoose, session);
      await Migration.findByIdAndDelete(lastMigration._id, { session });
      
      await session.commitTransaction();
      
    } catch (error) {
      await session.abortTransaction();
      console.error(`✗ Rollback of ${lastMigration.name} failed:`, error.message);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get migration status
   */
  async status() {
    const allFiles = await this.getMigrationFiles();
    const applied = await this.getAppliedMigrations();

    
    

    for (const file of allFiles) {
      const status = applied.includes(file) ? '✓ APPLIED' : '○ PENDING';
      
    }

    
  }

  /**
   * Extract version number from filename
   */
  extractVersion(filename) {
    const match = filename.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Create a new migration file
   */
  async create(name) {
    const timestamp = Date.now();
    const filename = `${timestamp}_${name}.js`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  /**
   * Run migration
   * @param {mongoose} mongoose - Mongoose instance
   * @param {ClientSession} session - MongoDB session for transaction
   */
  async up(mongoose, session) {
    // Write your migration logic here
    // Example:
    // await mongoose.model('User').updateMany(
    //   {},
    //   { $set: { newField: 'defaultValue' } },
    //   { session }
    // );
  },

  /**
   * Rollback migration
   * @param {mongoose} mongoose - Mongoose instance
   * @param {ClientSession} session - MongoDB session for transaction
   */
  async down(mongoose, session) {
    // Write your rollback logic here
    // Example:
    // await mongoose.model('User').updateMany(
    //   {},
    //   { $unset: { newField: '' } },
    //   { session }
    // );
  }
};
`;

    await fs.writeFile(filepath, template);
    
    return filename;
  }
}

module.exports = MigrationRunner;
