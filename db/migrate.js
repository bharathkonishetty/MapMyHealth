const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('./env')();

async function runMigration() {
  const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'mapmyhealth',
    password: process.env.DB_PASSWORD || '***REMOVED***',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database for migration.');

    // 1. Check if the old users table exists and identify schema
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `;
    const tableExistsRes = await client.query(checkTableQuery);
    const usersTableExists = tableExistsRes.rows[0].exists;

    let hasOldSchema = false;
    if (usersTableExists) {
      // Check if it uses the old schema (has 'name' column instead of 'username')
      const columnCheckQuery = `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'name';
      `;
      const columnCheckRes = await client.query(columnCheckQuery);
      if (columnCheckRes.rows.length > 0) {
        hasOldSchema = true;
        console.log('Old monolithic users table identified.');
      }
    }

    // 2. Rename old users table if it has the old schema
    if (usersTableExists && hasOldSchema) {
      console.log('Renaming users to users_old for schema transition...');
      await client.query('DROP TABLE IF EXISTS users_old CASCADE;');
      await client.query('ALTER TABLE users RENAME TO users_old;');
    }

    // 3. Execute init.sql DDL to create new schema
    console.log('Executing DDL schema initialization from init.sql...');
    const initSqlPath = path.join(__dirname, 'init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    await client.query(initSql);
    console.log('Schema initialized successfully.');

    // 4. Migrate data from users_old if it exists
    if (usersTableExists && hasOldSchema) {
      console.log('Migrating rows from users_old to normalized tables...');
      const oldUsersRes = await client.query('SELECT * FROM users_old;');
      
      for (const oldUser of oldUsersRes.rows) {
        const username = oldUser.name;
        const email = oldUser.email;
        const mobile = oldUser.mobile;
        const passwordHash = oldUser.password;
        
        // Parse numerical/date attributes
        const age = oldUser.age && oldUser.age.trim() !== '' ? parseInt(oldUser.age, 10) : null;
        const height = oldUser.height && oldUser.height.trim() !== '' ? parseFloat(oldUser.height) : null;
        const weight = oldUser.weight && oldUser.weight.trim() !== '' ? parseFloat(oldUser.weight) : null;
        const createdAt = oldUser.createdAt ? new Date(oldUser.createdAt) : new Date();

        // Insert credentials into new users table
        const insertUserQuery = `
          INSERT INTO users (username, email, mobile, password_hash, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $5)
          RETURNING id;
        `;
        const newUserRes = await client.query(insertUserQuery, [username, email, mobile, passwordHash, createdAt]);
        const newUserId = newUserRes.rows[0].id;

        // Insert stats into user_profiles table
        const insertProfileQuery = `
          INSERT INTO user_profiles (user_id, age, height_cm, updated_at)
          VALUES ($1, $2, $3, $4);
        `;
        await client.query(insertProfileQuery, [newUserId, age, height, createdAt]);

        // Log baseline weight into progress_logs if weight exists
        if (weight !== null) {
          const insertProgressQuery = `
            INSERT INTO progress_logs (user_id, log_date, weight, created_at)
            VALUES ($1, $2, $3, $4);
          `;
          await client.query(insertProgressQuery, [newUserId, createdAt.toISOString().split('T')[0], weight, createdAt]);
        }
      }
      
      console.log(`Successfully migrated ${oldUsersRes.rows.length} users.`);
      
      // Keep users_old as a backup, print instruction to clean up
      console.log('Original users_old kept as a backup. You can drop it when verification completes.');

    } else {
      // 5. Seed from data/users.json if database is empty and json exists
      const usersJsonPath = path.join(__dirname, '..', 'data', 'users.json');
      const countUsersQuery = 'SELECT COUNT(*) FROM users;';
      const countRes = await client.query(countUsersQuery);
      const userCount = parseInt(countRes.rows[0].count, 10);

      if (userCount === 0 && fs.existsSync(usersJsonPath)) {
        console.log('Database is empty. Seeding users from data/users.json...');
        const usersJsonStr = fs.readFileSync(usersJsonPath, 'utf8');
        const usersData = JSON.parse(usersJsonStr);

        for (const key in usersData) {
          const u = usersData[key];
          const username = u.name;
          const email = u.email;
          const mobile = u.mobile;
          const passwordHash = u.password;
          
          const age = u.age && u.age.trim() !== '' ? parseInt(u.age, 10) : null;
          const height = u.height && u.height.trim() !== '' ? parseFloat(u.height) : null;
          const weight = u.weight && u.weight.trim() !== '' ? parseFloat(u.weight) : null;
          const createdAt = u.createdAt ? new Date(u.createdAt) : new Date();

          const insertUserQuery = `
            INSERT INTO users (username, email, mobile, password_hash, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id;
          `;
          const newUserRes = await client.query(insertUserQuery, [username, email, mobile, passwordHash, createdAt]);
          const newUserId = newUserRes.rows[0].id;

          const insertProfileQuery = `
            INSERT INTO user_profiles (user_id, age, height_cm, updated_at)
            VALUES ($1, $2, $3, $4);
          `;
          await client.query(insertProfileQuery, [newUserId, age, height, createdAt]);

          if (weight !== null) {
            const insertProgressQuery = `
              INSERT INTO progress_logs (user_id, log_date, weight, created_at)
              VALUES ($1, $2, $3, $4);
            `;
            await client.query(insertProgressQuery, [newUserId, createdAt.toISOString().split('T')[0], weight, createdAt]);
          }
        }
        console.log('Seeded database successfully from data/users.json.');
      } else {
        console.log('No database migration or seeding required.');
      }
    }

    console.log('Migration execution completed successfully.');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
