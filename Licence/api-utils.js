const apiUtils = {
    _onlineCache: null,
    _lastCheck: 0,

    async isOnline() {
        const now = Date.now();
        if (this._onlineCache !== null && (now - this._lastCheck < 10000)) {
            return { online: this._onlineCache, cached: true };
        }

        try {
            const url = await this.getApiUrl('health');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            const data = await res.json();
            this._onlineCache = data.status.toLowerCase() === 'ok';
            this._lastCheck = now;
            return { online: this._onlineCache, url };
        } catch (err) {
            this._onlineCache = false;
            this._lastCheck = now;
            return { online: false, error: err.message };
        }
    },

    async getApiUrl(endpoint) {
        // First priority: manually configured server IP
        const savedServerIp = localStorage.getItem('serverIp');
        if (savedServerIp) {
            return `http://${savedServerIp}:4000/api/${endpoint}`;
        }

        const host = window.location.hostname;
        const port = window.location.port;
        
        // If we are already accessing via the server port, use relative paths
        if (port === '4000') {
            return `/api/${endpoint}`;
        }
        
        // If we have a hostname (e.g. accessing via IP or server name), use it
        if (host && host !== 'localhost') {
            return `http://${host}:4000/api/${endpoint}`;
        }
        
        // Default fallback to localhost (for local development/server machine)
        return `http://localhost:4000/api/${endpoint}`;
    },

    async login(username, password) {
        const status = await this.isOnline();
        if (status.online) {
            const url = await this.getApiUrl('login');
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await res.json();
            if (result.success) {
                localStorage.setItem('currentUser', JSON.stringify(result.user));
            }
            return result;
        }
        return { success: false, message: 'Server offline' };
    },

    async getTasks() {
        const localTasks = JSON.parse(localStorage.getItem('freshLicenseTasks') || '[]');
        const sortedLocal = this._sortTasks(this._deduplicateTasks(localTasks));

        // Start fetching from server in background
        this.isOnline().then(async status => {
            if (status.online) {
                try {
                    const url = await this.getApiUrl('tasks');
                    const res = await fetch(url);
                    if (res.ok) {
                        const serverTasks = await res.json();
                        const tasks = this._sortTasks(this._deduplicateTasks(serverTasks));
                        localStorage.setItem('freshLicenseTasks', JSON.stringify(tasks));
                    }
                } catch (error) {
                    console.error('Background fetch failed:', error);
                }
            }
        });

        return sortedLocal;
    },

    _sortTasks(tasks) {
        const parseDate = (dateStr, timeStr) => {
            if (!dateStr) return new Date(0);
            let datePart = dateStr;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    datePart = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return new Date(`${datePart} ${timeStr || '00:00:00'}`);
        };

        return tasks.sort((a, b) => {
            const dateA = parseDate(a.creationDate, a.creationTime);
            const dateB = parseDate(b.creationDate, b.creationTime);
            if (dateB - dateA !== 0) return dateB - dateA;
            return String(b.id).localeCompare(String(a.id));
        });
    },

    _deduplicateTasks(tasks) {
        const uniqueTasks = new Map();
        tasks.forEach(t => {
            t.mobile = t.mobile || t.mobileNumber || '';
            t.mobileNumber = t.mobile || t.mobileNumber || '';
            const key = String(t.id);
            const existing = uniqueTasks.get(key);
            if (!existing || (t.statusHistory?.length || 0) > (existing.statusHistory?.length || 0)) {
                uniqueTasks.set(key, t);
            }
        });
        return Array.from(uniqueTasks.values());
    },

    async saveTask(task) {
        console.log('Attempting to save task:', task.id);
        const status = await this.isOnline();
        
        if (status.online) {
            try {
                const url = await this.getApiUrl('tasks');
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                });
                
                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error || `Server responded with ${response.status}`);
                
                console.log('Task saved to server successfully:', responseData);
                
                // Update local cache to keep it in sync
                const tasks = JSON.parse(localStorage.getItem('freshLicenseTasks') || '[]');
                const idx = tasks.findIndex(t => String(t.id) === String(task.id));
                if (idx > -1) tasks[idx] = task;
                else tasks.push(task);
                localStorage.setItem('freshLicenseTasks', JSON.stringify(tasks));
                
                return { success: true, savedToServer: true, data: responseData };
            } catch (error) {
                console.error('Failed to save task to server:', error);
                return { success: false, error: 'Server save failed: ' + error.message };
            }
        }
        
        // If truly offline, save locally as fallback
        const tasks = JSON.parse(localStorage.getItem('freshLicenseTasks') || '[]');
        const idx = tasks.findIndex(t => String(t.id) === String(task.id));
        if (idx > -1) tasks[idx] = task;
        else tasks.push(task);
        localStorage.setItem('freshLicenseTasks', JSON.stringify(tasks));
        return { success: true, savedToServer: false, message: 'Saved locally (offline)' };
    },

    async deleteTask(id) {
        const status = await this.isOnline();
        if (status.online) {
            const url = await this.getApiUrl(`tasks/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const tasks = JSON.parse(localStorage.getItem('freshLicenseTasks') || '[]').filter(t => String(t.id) !== String(id));
        localStorage.setItem('freshLicenseTasks', JSON.stringify(tasks));
    },

    async getSettings(key, defaultValue = null) {
        const status = await this.isOnline();
        if (status.online) {
            const url = await this.getApiUrl(`settings/${key}`);
            const res = await fetch(url);
            const data = await res.json();
            if (data.value !== null) {
                localStorage.setItem(key, JSON.stringify(data.value));
                return data.value;
            }
        }
        const localValue = localStorage.getItem(key);
        return localValue ? JSON.parse(localValue) : defaultValue;
    },

    async saveSettings(key, value) {
        const status = await this.isOnline();
        if (status.online) {
            const url = await this.getApiUrl(`settings/${key}`);
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
        }
        localStorage.setItem(key, JSON.stringify(value));
    },

    async getLicenseHolderServices() {
        const localServices = JSON.parse(localStorage.getItem('licenseHolderServices') || '[]');
        const sortedLocal = this._sortServices(this._deduplicateServices(localServices));

        // Start fetching from server in background
        this.isOnline().then(async status => {
            if (status.online) {
                try {
                    const url = await this.getApiUrl('license-holder-services');
                    const res = await fetch(url);
                    if (res.ok) {
                        const serverServices = await res.json();
                        const services = this._sortServices(this._deduplicateServices(serverServices));
                        localStorage.setItem('licenseHolderServices', JSON.stringify(services));
                    }
                } catch (error) {
                    console.error('Background fetch failed:', error);
                }
            }
        });

        return sortedLocal;
    },

    _sortServices(services) {
        const parseDate = (dateStr, timeStr) => {
            if (!dateStr) return new Date(0);
            let datePart = dateStr;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    datePart = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return new Date(`${datePart} ${timeStr || '00:00:00'}`);
        };

        return services.sort((a, b) => {
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            return dateB - dateA;
        });
    },

    _deduplicateServices(services) {
        const unique = new Map();
        services.forEach(s => {
            s.mobile = s.mobile || s.mobileNumber || '';
            s.mobileNumber = s.mobile || s.mobileNumber || '';
            const key = String(s.id || s.licenseNumber);
            const existing = unique.get(key);
            if (!existing || (s.statusHistory?.length || 0) > (existing.statusHistory?.length || 0)) {
                unique.set(key, s);
            }
        });
        return Array.from(unique.values());
    },

    async saveLicenseHolderService(service) {
        console.log('Attempting to save license holder service:', service.id || service.licenseNumber);
        const status = await this.isOnline();
        
        if (status.online) {
            try {
                const url = await this.getApiUrl('license-holder-services');
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(service)
                });
                
                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error || `Server responded with ${response.status}`);
                
                console.log('License holder service saved to server successfully');
                
                // Update local cache
                const services = JSON.parse(localStorage.getItem('licenseHolderServices') || '[]');
                const idx = services.findIndex(s => String(s.id || s.licenseNumber) === String(service.id || service.licenseNumber));
                if (idx > -1) services[idx] = service;
                else services.push(service);
                localStorage.setItem('licenseHolderServices', JSON.stringify(services));
                
                return { success: true, savedToServer: true, data: responseData };
            } catch (error) {
                console.error('Failed to save license holder service to server:', error);
                return { success: false, error: 'Server save failed: ' + error.message };
            }
        }
        
        const services = JSON.parse(localStorage.getItem('licenseHolderServices') || '[]');
        const idx = services.findIndex(s => String(s.id || s.licenseNumber) === String(service.id || service.licenseNumber));
        if (idx > -1) services[idx] = service;
        else services.push(service);
        localStorage.setItem('licenseHolderServices', JSON.stringify(services));
        return { success: true, savedToServer: false, message: 'Saved locally (offline)' };
    },

    async saveLicenseHolderServices(services) {
        console.log('Bulk saving license holder services:', services.length);
        const status = await this.isOnline();
        
        if (status.online) {
            try {
                // If the server doesn't have a bulk endpoint, we save individually
                // But for now, we'll assume we save them all to local storage and try to save the changed ones
                // To keep it simple and consistent with other modules, we'll just save them all locally.
                // However, the "Server is Authoritative" rule says we should try to sync.
                for (const service of services) {
                    await this.saveLicenseHolderService(service);
                }
                return { success: true, savedToServer: true };
            } catch (error) {
                console.error('Bulk save failed:', error);
                return { success: false, error: error.message };
            }
        }
        
        localStorage.setItem('licenseHolderServices', JSON.stringify(services));
        return { success: true, savedToServer: false };
    },

    async deleteLicenseHolderService(id) {
        const status = await this.isOnline();
        if (status.online) {
            const url = await this.getApiUrl(`license-holder-services/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const services = JSON.parse(localStorage.getItem('licenseHolderServices') || '[]')
            .filter(s => String(s.id || s.licenseNumber) !== String(id));
        localStorage.setItem('licenseHolderServices', JSON.stringify(services));
    },

    // --- RC API ---
    async getRcTasks() {
        const parseDate = (dateStr, timeStr) => {
            if (!dateStr) return new Date(0);
            let datePart = dateStr;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    // Assuming DD/MM/YYYY
                    datePart = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return new Date(`${datePart} ${timeStr || '00:00:00'}`);
        };

        const sortRcTasks = (tasks) => {
            return tasks.sort((a, b) => {
                const dateA = parseDate(a.creationDate, a.creationTime);
                const dateB = parseDate(b.creationDate, b.creationTime);
                return dateB - dateA; // Sort descending (newest first)
            });
        };

        const deduplicateRcTasks = (tasks) => {
            const unique = new Map();
            tasks.forEach(t => {
                // Ensure mobile property consistency
                t.mobile = t.mobile || t.mobileNumber || '';
                t.mobileNumber = t.mobile || t.mobileNumber || '';

                const key = String(t.id);
                const existing = unique.get(key);
                
                if (!existing) {
                    unique.set(key, t);
                } else {
                    // If same ID exists, pick the one with more status history
                    if ((t.statusHistory?.length || 0) > (existing.statusHistory?.length || 0)) {
                        unique.set(key, t);
                    }
                }
            });
            return Array.from(unique.values());
        };

        if (await this.isOnline()) {
            try {
                const url = await this.getApiUrl('rc-tasks');
                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch from server');
                let serverTasks = await res.json();
                
                // Server data is authoritative.
                let tasks = deduplicateRcTasks(serverTasks);
                tasks = sortRcTasks(tasks);
                
                localStorage.setItem('tasks', JSON.stringify(tasks));
                console.log('Successfully fetched RC tasks from server. Total:', tasks.length);
                return tasks;
            } catch (error) {
                console.error('Error fetching RC tasks from server:', error);
            }
        }
        
        console.warn('Using local storage fallback for RC tasks');
        const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        return sortRcTasks(deduplicateRcTasks(localTasks));
    },

    async saveRcTask(task) {
        console.log('Attempting to save RC task:', task.id);
        const isOnline = await this.isOnline();
        
        if (isOnline) {
            try {
                const url = await this.getApiUrl('rc-tasks');
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                });
                if (!response.ok) throw new Error(`Server responded with ${response.status}`);
                
                console.log('RC task saved to server successfully');
                
                // Update local cache
                const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
                const idx = tasks.findIndex(t => String(t.id) === String(task.id));
                if (idx > -1) tasks[idx] = task;
                else tasks.push(task);
                localStorage.setItem('tasks', JSON.stringify(tasks));
                
                return { success: true, savedToServer: true };
            } catch (error) {
                console.error('Failed to save RC task to server:', error);
                return { success: false, error: 'Server save failed: ' + error.message };
            }
        }
        
        // If truly offline, save locally as fallback
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const idx = tasks.findIndex(t => String(t.id) === String(task.id));
        if (idx > -1) tasks[idx] = task;
        else tasks.push(task);
        localStorage.setItem('tasks', JSON.stringify(tasks));
        console.log('RC task saved to local storage. Total local RC tasks:', tasks.length);
        return { success: true, savedToServer: false, message: 'Saved locally (offline)' };
    },

    // --- FC API ---
    async getFcTasks() {
        if (await this.isOnline()) {
            try {
                const url = await this.getApiUrl('fc-tasks');
                const res = await fetch(url);
                const tasks = (await res.json()).map(t => {
                    t.mobile = t.mobile || t.mobileNumber || '';
                    t.mobileNumber = t.mobile || t.mobileNumber || '';
                    return t;
                });
                localStorage.setItem('fcTasks', JSON.stringify(tasks));
                return tasks;
            } catch (error) {
                console.error('Error fetching FC tasks:', error);
            }
        }
        return (JSON.parse(localStorage.getItem('fcTasks') || '[]')).map(t => {
            t.mobile = t.mobile || t.mobileNumber || '';
            t.mobileNumber = t.mobile || t.mobileNumber || '';
            return t;
        });
    },

    async saveFcTask(task) {
        let savedToServer = false;
        if (await this.isOnline()) {
            try {
                const url = await this.getApiUrl('fc-tasks');
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                });
                if (res.ok) savedToServer = true;
            } catch (error) {
                console.error('Failed to save FC task to server:', error);
            }
        }
        
        // Always update local cache to keep it in sync
        const tasks = JSON.parse(localStorage.getItem('fcTasks') || '[]');
        const idx = tasks.findIndex(t => String(t.id) === String(task.id));
        if (idx > -1) tasks[idx] = task;
        else tasks.push(task);
        localStorage.setItem('fcTasks', JSON.stringify(tasks));
        
        return { success: true, savedToServer: savedToServer };
    },

    async updateExpiredFcTasksStatus() {
        const fcTasks = await this.getFcTasks();
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date to midnight

        let updatedTasks = [];
        for (const task of fcTasks) {
             if (task.expiryDate && task.status !== 'LLR Expired' && task.status !== 'Completed') {
                 const hasTestCompleted = (task.statusHistory || []).some(s => String(s.status || s.to).toLowerCase() === 'test completed');
                 if (hasTestCompleted) continue;
                const expiry = new Date(task.expiryDate);
                expiry.setHours(0, 0, 0, 0); // Normalize expiry date to midnight

                if (expiry < today) {
                    task.status = 'LLR Expired';
                    if (!task.statusHistory) task.statusHistory = [];
                    task.statusHistory.push({
                        status: 'LLR Expired',
                        date: new Date().toLocaleDateString(),
                        time: new Date().toLocaleTimeString(),
                        note: 'Automatically updated due to expiry'
                    });
                    updatedTasks.push(task);
                }
            }
        }

        if (updatedTasks.length > 0) {
            console.log(`Updating status for ${updatedTasks.length} expired FC tasks.`);
            // Save all updated tasks back
            for (const task of updatedTasks) {
                await this.saveFcTask(task);
            }
            // Re-fetch to ensure local storage is fully consistent after bulk updates
            await this.getFcTasks(); 
        }
    },

    async deleteFcTask(id) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl(`fc-tasks/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const tasks = JSON.parse(localStorage.getItem('fcTasks') || '[]').filter(t => String(t.id) !== String(id));
        localStorage.setItem('fcTasks', JSON.stringify(tasks));
    },

    // --- PAYMENTS API ---
    async getPayments() {
        if (await this.isOnline()) {
            try {
                const url = await this.getApiUrl('payments');
                const res = await fetch(url);
                const payments = await res.json();
                localStorage.setItem('payments', JSON.stringify(payments));
                return payments;
            } catch (error) {
                console.error('Error fetching payments:', error);
            }
        }
        return JSON.parse(localStorage.getItem('payments') || '[]');
    },

    async savePayment(payment) {
        if (await this.isOnline()) {
            try {
                const url = await this.getApiUrl('payments');
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payment)
                });
                if (res.ok) return { success: true, savedToServer: true };
            } catch (error) {
                console.error('Failed to save payment to server:', error);
            }
        }
        const payments = JSON.parse(localStorage.getItem('payments') || '[]');
        const idx = payments.findIndex(p => String(p.id) === String(payment.id));
        if (idx > -1) payments[idx] = payment;
        else payments.push(payment);
        localStorage.setItem('payments', JSON.stringify(payments));
        return { success: true, savedToServer: false };
    },

    async deletePayment(id) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl(`payments/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const payments = JSON.parse(localStorage.getItem('payments') || '[]').filter(p => String(p.id) !== String(id));
        localStorage.setItem('payments', JSON.stringify(payments));
    },

    async getTaxVehicles() {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('tax-vehicles');
            const res = await fetch(url);
            const vehicles = (await res.json()).map(v => {
                v.mobile = v.mobile || v.mobileNumber || '';
                v.mobileNumber = v.mobile || v.mobileNumber || '';
                return v;
            });
            localStorage.setItem('taxVehicles', JSON.stringify(vehicles));
            return vehicles;
        }
        return (JSON.parse(localStorage.getItem('taxVehicles') || '[]')).map(v => {
            v.mobile = v.mobile || v.mobileNumber || '';
            v.mobileNumber = v.mobile || v.mobileNumber || '';
            return v;
        });
    },

    async saveTaxVehicle(vehicle) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('tax-vehicles');
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vehicle)
            });
        }
        const vehicles = JSON.parse(localStorage.getItem('taxVehicles') || '[]');
        const idx = vehicles.findIndex(v => v.vehicleNumber === vehicle.vehicleNumber);
        if (idx > -1) vehicles[idx] = vehicle;
        else vehicles.push(vehicle);
        localStorage.setItem('taxVehicles', JSON.stringify(vehicles));
    },

    async deleteTaxVehicle(vehicleNumber) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl(`tax-vehicles/${vehicleNumber}`);
            await fetch(url, { method: 'DELETE' });
        }
        const vehicles = JSON.parse(localStorage.getItem('taxVehicles') || '[]').filter(v => v.vehicleNumber !== vehicleNumber);
        localStorage.setItem('taxVehicles', JSON.stringify(vehicles));
    },

    async getCustomers() {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('customers');
            const res = await fetch(url);
            const customers = (await res.json()).map(c => {
                c.mobile = c.mobile || c.mobileNumber || '';
                c.mobileNumber = c.mobile || c.mobileNumber || '';
                return c;
            });
            localStorage.setItem('customers', JSON.stringify(customers));
            return customers;
        }
        return (JSON.parse(localStorage.getItem('customers') || '[]')).map(c => {
            c.mobile = c.mobile || c.mobileNumber || '';
            c.mobileNumber = c.mobile || c.mobileNumber || '';
            return c;
        });
    },

    async saveCustomer(customer) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('customers');
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customer)
            });
        }
        const customers = JSON.parse(localStorage.getItem('customers') || '[]');
        const idx = customers.findIndex(c => String(c.id) === String(customer.id));
        if (idx > -1) customers[idx] = customer;
        else customers.push(customer);
        localStorage.setItem('customers', JSON.stringify(customers));
    },

    // --- MAINTENANCE API ---
    async getMaintenanceVehicles() {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('maintenance-vehicles');
            const res = await fetch(url);
            const vehicles = (await res.json()).map(v => {
                v.mobile = v.mobile || v.mobileNumber || '';
                v.mobileNumber = v.mobile || v.mobileNumber || '';
                return v;
            });
            localStorage.setItem('maintenanceVehicles', JSON.stringify(vehicles));
            return vehicles;
        }
        return (JSON.parse(localStorage.getItem('maintenanceVehicles') || '[]')).map(v => {
            v.mobile = v.mobile || v.mobileNumber || '';
            v.mobileNumber = v.mobile || v.mobileNumber || '';
            return v;
        });
    },

    async saveMaintenanceVehicle(vehicle) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('maintenance-vehicles');
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vehicle)
            });
        }
        const vehicles = JSON.parse(localStorage.getItem('maintenanceVehicles') || '[]');
        const idx = vehicles.findIndex(v => String(v.id) === String(vehicle.id));
        if (idx > -1) vehicles[idx] = vehicle;
        else vehicles.push(vehicle);
        localStorage.setItem('maintenanceVehicles', JSON.stringify(vehicles));
    },

    async deleteMaintenanceVehicle(id) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl(`maintenance-vehicles/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const vehicles = JSON.parse(localStorage.getItem('maintenanceVehicles') || '[]').filter(v => String(v.id) !== String(id));
        localStorage.setItem('maintenanceVehicles', JSON.stringify(vehicles));
    },

    // Driving Licenses
    async getLicenses() {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('licenses');
            const res = await fetch(url);
            const licenses = (await res.json()).map(l => {
                l.mobile = l.mobile || l.mobileNumber || '';
                l.mobileNumber = l.mobile || l.mobileNumber || '';
                return l;
            });
            localStorage.setItem('licenses', JSON.stringify(licenses));
            return licenses;
        }
        return (JSON.parse(localStorage.getItem('licenses') || '[]')).map(l => {
            l.mobile = l.mobile || l.mobileNumber || '';
            l.mobileNumber = l.mobile || l.mobileNumber || '';
            return l;
        });
    },

    async saveLicense(license) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('licenses');
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(license)
            });
        }
        const licenses = JSON.parse(localStorage.getItem('licenses') || '[]');
        const idx = licenses.findIndex(l => String(l.id) === String(license.id));
        if (idx > -1) licenses[idx] = license;
        else licenses.push(license);
        localStorage.setItem('licenses', JSON.stringify(licenses));
    },

    async deleteLicense(id) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl(`licenses/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const licenses = JSON.parse(localStorage.getItem('licenses') || '[]').filter(l => String(l.id) !== String(id));
        localStorage.setItem('licenses', JSON.stringify(licenses));
    },

    // Management Permits
    async getPermits() {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('permits');
            const res = await fetch(url);
            const permits = (await res.json()).map(p => {
                p.mobile = p.mobile || p.mobileNumber || '';
                p.mobileNumber = p.mobile || p.mobileNumber || '';
                return p;
            });
            localStorage.setItem('permits', JSON.stringify(permits));
            return permits;
        }
        return (JSON.parse(localStorage.getItem('permits') || '[]')).map(p => {
            p.mobile = p.mobile || p.mobileNumber || '';
            p.mobileNumber = p.mobile || p.mobileNumber || '';
            return p;
        });
    },

    async savePermit(permit) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('permits');
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(permit)
            });
        }
        const permits = JSON.parse(localStorage.getItem('permits') || '[]');
        const idx = permits.findIndex(p => String(p.id) === String(permit.id));
        if (idx > -1) permits[idx] = permit;
        else permits.push(permit);
        localStorage.setItem('permits', JSON.stringify(permits));
    },

    async deletePermit(id) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl(`permits/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const permits = JSON.parse(localStorage.getItem('permits') || '[]').filter(p => String(p.id) !== String(id));
        localStorage.setItem('permits', JSON.stringify(permits));
    },

    // Maintenance Accounts
    async getMaintenanceAccounts() {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('maintenance-accounts');
            const res = await fetch(url);
            const accounts = (await res.json()).map(a => {
                a.mobile = a.mobile || a.mobileNumber || '';
                a.mobileNumber = a.mobile || a.mobileNumber || '';
                return a;
            });
            localStorage.setItem('maintenanceAccounts', JSON.stringify(accounts));
            return accounts;
        }
        return (JSON.parse(localStorage.getItem('maintenanceAccounts') || '[]')).map(a => {
            a.mobile = a.mobile || a.mobileNumber || '';
            a.mobileNumber = a.mobile || a.mobileNumber || '';
            return a;
        });
    },

    async saveMaintenanceAccount(account) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('maintenance-accounts');
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(account)
            });
        }
        const accounts = JSON.parse(localStorage.getItem('maintenanceAccounts') || '[]');
        const idx = accounts.findIndex(a => String(a.id) === String(account.id));
        if (idx > -1) accounts[idx] = account;
        else accounts.push(account);
        localStorage.setItem('maintenanceAccounts', JSON.stringify(accounts));
    },

    async deleteMaintenanceAccount(id) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl(`maintenance-accounts/${id}`);
            await fetch(url, { method: 'DELETE' });
        }
        const accounts = JSON.parse(localStorage.getItem('maintenanceAccounts') || '[]').filter(a => String(a.id) !== String(id));
        localStorage.setItem('maintenanceAccounts', JSON.stringify(accounts));
    },

    async restoreBackup(backup) {
        if (await this.isOnline()) {
            const url = await this.getApiUrl('import-backup');
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backup)
            });
            const data = await res.json();
            if (data.success) {
                // Force a fresh fetch after restore
                await this.getTasks();
            }
            return data;
        }
        return { success: false, message: 'Server offline' };
    },

    async syncData() {
        if (!(await this.isOnline())) return;
        
        // Sync settings
        const keys = ['freshLicenseStatuses', 'vehicleClasses', 'createLicenseVehicleClasses', 'lastDrivingRollNumber', 'users'];
        for (const key of keys) {
            const val = localStorage.getItem(key);
            if (val) {
                try {
                    await this.saveSettings(key, JSON.parse(val));
                } catch (e) {
                    await this.saveSettings(key, val);
                }
            }
        }
    },

    async syncAllDataFromServer() {
        const status = await this.isOnline();
        if (!status.online) return { success: false, message: 'Server offline' };

        try {
            console.log('Starting full sync from server...');
            
            // Fetch all modules
            await Promise.all([
                this.getTasks(),
                this.getLicenseHolderServices(),
                this.getRcTasks(),
                this.getPayments(),
                this.getTaxVehicles(),
                this.getCustomers(),
                this.getMaintenanceVehicles(),
                this.getLicenses(),
                this.getPermits(),
                this.getMaintenanceAccounts(),
                this.getUsers()
            ]);

            // Fetch specific settings
            const settingsKeys = [
                'freshLicenseStatuses', 
                'vehicleClasses', 
                'createLicenseVehicleClasses', 
                'lastDrivingRollNumber',
                'rcVehicleClasses',
                'rcStatuses',
                'rcWorkItems',
                'financiers',
                'bills',
                'TaxVehicleClassesList'
            ];

            for (const key of settingsKeys) {
                await this.getSettings(key);
            }

            console.log('Full sync complete');
            return { success: true };
        } catch (error) {
            console.error('Full sync failed:', error);
            return { success: false, error: error.message };
        }
    },

    // --- USER MANAGEMENT ---
    async getUsers() {
        return await this.getSettings('users', []);
    },

    async saveUser(user) {
        const users = await this.getUsers();
        const idx = users.findIndex(u => String(u.id) === String(user.id));
        if (idx > -1) users[idx] = user;
        else users.push(user);
        await this.saveSettings('users', users);
    },

    async deleteUser(id) {
        const users = await this.getUsers();
        const updatedUsers = users.filter(u => String(u.id) !== String(id));
        await this.saveSettings('users', updatedUsers);
    },

    // --- VAHAN API ---
    async getVehicleDetails(vehicleNumber) {
        if (await this.isOnline()) {
            try {
                const url = await this.getApiUrl(`vahan/vehicle-details/${vehicleNumber}`);
                const res = await fetch(url);
                return await res.json();
            } catch (error) {
                console.error('Error fetching vehicle details:', error);
                return { success: false, message: 'Connection error' };
            }
        }
        return { success: false, message: 'Server offline' };
    },

    async getEChallanDetails(vehicleNumber) {
        if (await this.isOnline()) {
            try {
                const url = await this.getApiUrl(`vahan/e-challan/${vehicleNumber}`);
                const res = await fetch(url);
                return await res.json();
            } catch (error) {
                console.error('Error fetching e-challan details:', error);
                return { success: false, message: 'Connection error' };
            }
        }
        return { success: false, message: 'Server offline' };
    }
};

// Auto-sync on load if online
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => apiUtils.syncData());
}
