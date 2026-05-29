const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

let db;

// Initialize Database
async function initDb() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Create Tables for all modules
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS rc_tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS fc_tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS license_holder_services (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tax_vehicles (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS maintenance_vehicles (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS permits (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS maintenance_accounts (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS registrations (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS llr_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, mobile TEXT NOT NULL, data TEXT NOT NULL);
    `);
    console.log('Database initialized');
}

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Generic Helper for Module APIs
const createModuleApi = (routeName, tableName) => {
    app.get(`/api/${routeName}`, async (req, res) => {
        try {
            const rows = await db.all(`SELECT data FROM ${tableName}`);
            res.json(rows.map(r => JSON.parse(r.data)));
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post(`/api/${routeName}`, async (req, res) => {
        try {
            const item = req.body;
            const id = item.id || item.vehicleNumber || item.licenseNumber || Date.now().toString();
            await db.run(`INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (?, ?)`, [id, JSON.stringify(item)]);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.delete(`/api/${routeName}/:id`, async (req, res) => {
        try {
            await db.run(`DELETE FROM ${tableName} WHERE id = ?`, [req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
};

// Register all modules
createModuleApi('tasks', 'tasks');
createModuleApi('rc-tasks', 'rc_tasks');
createModuleApi('fc-tasks', 'fc_tasks');
createModuleApi('license-holder-services', 'license_holder_services');
createModuleApi('payments', 'payments');
createModuleApi('tax-vehicles', 'tax_vehicles');
createModuleApi('customers', 'customers');
createModuleApi('maintenance-vehicles', 'maintenance_vehicles');
createModuleApi('licenses', 'licenses');
createModuleApi('permits', 'permits');
createModuleApi('maintenance-accounts', 'maintenance_accounts');
createModuleApi('registrations', 'registrations');

// Settings API (Customized for key/value structure)
app.get('/api/settings/:key', async (req, res) => {
    try {
        const row = await db.get('SELECT value FROM settings WHERE key = ?', [req.params.key]);
        res.json({ value: row ? JSON.parse(row.value) : null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/:key', async (req, res) => {
    try {
        await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [req.params.key, JSON.stringify(req.body.value)]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Backup/Restore
app.post('/api/import-backup', async (req, res) => {
    try {
        const { sections } = req.body;
        if (!sections) throw new Error('Invalid backup format');

        await db.run('BEGIN TRANSACTION');
        
        // Helper to import section
        const importSection = async (data, tableName, idField = 'id') => {
            if (!Array.isArray(data)) return;
            for (const item of data) {
                const id = item[idField] || Date.now().toString();
                await db.run(`INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (?, ?)`, [id, JSON.stringify(item)]);
            }
        };

        if (sections.licence) {
            await importSection(sections.licence.freshLicenseTasks, 'tasks');
            await importSection(sections.licence.licenseHolderServices, 'license_holder_services');
        }
        if (sections.rc) {
            await importSection(sections.rc.tasks, 'rc_tasks');
            await importSection(sections.rc.customers, 'customers');
            await importSection(sections.rc.payments, 'payments');
        }
        // ... add other sections as needed

        await db.run('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Start Server
initDb().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});