document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyAY8aW7751YUvDdv4xZYnXSF5AZevOBIxI",
        authDomain: "hameethiya.firebaseapp.com",
        projectId: "hameethiya",
        storageBucket: "hameethiya.firebasestorage.app",
        messagingSenderId: "206037846",
        appId: "1:206037846:web:0bcbcfd67f6989e46d6cf7",
        measurementId: "G-8ZQ1Y0CPQZ"
    };

    // Initialize Firebase
    let db = null;
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } catch (e) {
        console.warn("Firebase failed to initialize. Falling back to LocalStorage.");
    }

    // --- Authentication Logic ---
    window.handleAdminLogin = function(e) {
        e.preventDefault();
        const user = document.getElementById('admin_user').value;
        const pass = document.getElementById('admin_pass').value;

        if (user === "admin" && pass === "hameethiya123") {
            sessionStorage.setItem('hameethiya_admin_logged_in', 'true');
            showDashboard();
        } else {
            alert("Invalid credentials. Please try again.");
        }
    };

    window.adminLogout = function() {
        if (confirm("Are you sure you want to logout?")) {
            sessionStorage.removeItem('hameethiya_admin_logged_in');
            window.location.reload();
        }
    };

    function checkAuth() {
        if (sessionStorage.getItem('hameethiya_admin_logged_in') === 'true') {
            showDashboard();
        }
    }

    function showDashboard() {
        document.getElementById('adminLoginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        initDashboard();
    }

    // --- Tab Management ---
    window.switchAdminTab = function(tabName) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(`tab-${tabName}`).classList.add('active');
        const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText.toLowerCase().includes(tabName));
        if (activeBtn) activeBtn.classList.add('active');
    };

    // --- Dashboard Initialization ---
    function initDashboard() {
        updateAdminPhotoList();
        updateEnquiryDashboard();
        updateFeedbackDashboard();
        updatePaymentDashboard();
        updateLLRDashboard();
        cleanupExpiredLLR(); // Auto-delete LLR older than 180 days
        loadPackages();
        
        // Listeners for live preview
        ['edit_package_price', 'edit_package_duration', 'edit_package_features', 'edit_package_name'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePackagePreview);
        });
    }

    // --- Payments Management ---
    let allPayments = [];

    function updatePaymentDashboard() {
        const tableBody = document.getElementById('paymentTableBody');
        const emptyMsg = document.getElementById('paymentEmptyMsg');
        if (!tableBody) return;

        const renderPayments = (payments) => {
            allPayments = payments;
            filterPayments(); // Apply current filters
        };

        if (db) {
            db.collection("payments").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderPayments(payments);
            });
        } else {
            // Fallback for demo
            const localPayments = [
                { timestamp: '2024-05-25 10:30', name: 'John Doe', course: 'Beginner', transactionId: 'TXN8923471', amount: '₹4,999', status: 'Completed' },
                { timestamp: '2024-05-26 14:15', name: 'Alice Smith', course: 'Intermediate', transactionId: 'TXN1122334', amount: '₹3,999', status: 'Initiated' }
            ];
            renderPayments(localPayments);
        }
    }

    window.filterPayments = function() {
        const search = document.getElementById('paymentSearch').value.toLowerCase();
        const dateFilter = document.getElementById('paymentDateFilter').value;
        const tableBody = document.getElementById('paymentTableBody');
        const emptyMsg = document.getElementById('paymentEmptyMsg');

        const filtered = allPayments.filter(p => {
            const matchesName = p.name.toLowerCase().includes(search);
            const matchesDate = !dateFilter || p.timestamp.includes(dateFilter);
            return matchesName && matchesDate;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = '';
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';
        tableBody.innerHTML = filtered.map(p => `
            <tr>
                <td>${p.timestamp}</td>
                <td><strong>${p.name}</strong></td>
                <td><span class="badge" style="background: rgba(157, 80, 187, 0.1); color: var(--primary-color);">${p.course}</span></td>
                <td style="font-family: monospace;">${p.transactionId || 'N/A'}</td>
                <td>${p.amount}</td>
                <td>
                    <span class="status-badge status-${(p.status || 'Initiated').toLowerCase()}">
                        ${p.status || 'Initiated'}
                    </span>
                </td>
                <td>
                    <button class="btn-ack" style="background: #444; padding: 5px 10px;" onclick="viewPaymentDetails('${p.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    };

    window.resetPaymentFilters = function() {
        document.getElementById('paymentSearch').value = '';
        document.getElementById('paymentDateFilter').value = '';
        filterPayments();
    };

    window.viewPaymentDetails = function(id) {
        const payment = allPayments.find(p => p.id === id);
        if (payment) {
            alert(`Payment Details:\nName: ${payment.name}\nCourse: ${payment.course}\nTXN ID: ${payment.transactionId}\nStatus: ${payment.status}\nDate: ${payment.timestamp}`);
        }
    };

    // --- LLR Documents Management ---
    window.handleLLRUpload = function(e) {
        e.preventDefault();
        const mobile = document.getElementById('llr_mobile').value;
        const date = document.getElementById('llr_date').value;
        const fileInput = document.getElementById('llr_file');
        const file = fileInput.files[0];

        if (!/^[0-9]{10}$/.test(mobile)) return alert("Invalid mobile number.");
        if (new Date(date) > new Date()) return alert("LLR date cannot be in the future.");
        if (!file) return alert("Please select a file.");
        
        // File type and size validation
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.type)) return alert("Only PDF, JPG, and PNG files are allowed.");
        if (file.size > 10 * 1024 * 1024) return alert("File size exceeds 10MB limit.");

        const btn = e.target.querySelector('button[type="submit"]');
        btn.innerText = "Encrypting & Uploading...";
        btn.disabled = true;

        const reader = new FileReader();
        reader.onload = function(event) {
            const fileData = event.target.result;
            const llrData = {
                mobile: mobile,
                llrDate: date,
                file: fileData, // Encrypted/Secured storage would normally be a bucket URL
                fileName: file.name,
                fileType: file.type,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                timestamp: new Date().toLocaleString()
            };

            if (db) {
                db.collection("llr_documents").add(llrData)
                    .then(() => {
                        alert("LLR Document uploaded successfully!");
                        e.target.reset();
                    })
                    .catch(err => alert("Upload error: " + err.message))
                    .finally(() => {
                        btn.innerHTML = '<i class="fas fa-file-upload"></i> Upload LLR Document';
                        btn.disabled = false;
                    });
            } else {
                const local = JSON.parse(localStorage.getItem('hameethiya_llr') || '[]');
                local.push(llrData);
                localStorage.setItem('hameethiya_llr', JSON.stringify(local));
                updateLLRDashboard();
                alert("Saved locally!");
                e.target.reset();
                btn.innerHTML = '<i class="fas fa-file-upload"></i> Upload LLR Document';
                btn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    };

    function updateLLRDashboard() {
        const tableBody = document.getElementById('llrTableBody');
        if (!tableBody) return;

        const render = (docs) => {
            tableBody.innerHTML = docs.map((doc, index) => `
                <tr>
                    <td>${doc.mobile}</td>
                    <td>${doc.llrDate}</td>
                    <td>
                        <button class="btn-ack" style="background: #dc3545;" onclick="deleteLLR('${doc.id || index}', ${!!doc.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        };

        if (db) {
            db.collection("llr_documents").orderBy("uploadedAt", "desc").onSnapshot(snapshot => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                render(docs);
            });
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_llr') || '[]');
            render(local);
        }
    }

    window.deleteLLR = function(id, isCloud) {
        if (!confirm("Delete this LLR record?")) return;
        if (isCloud && db) {
            db.collection("llr_documents").doc(id).delete();
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_llr') || '[]');
            local.splice(id, 1);
            localStorage.setItem('hameethiya_llr', JSON.stringify(local));
            updateLLRDashboard();
        }
    };

    function cleanupExpiredLLR() {
        const EXPIRY_DAYS = 180;
        const now = new Date();
        
        const isExpired = (llrDateStr) => {
            const llrDate = new Date(llrDateStr);
            const diffTime = Math.abs(now - llrDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > EXPIRY_DAYS;
        };

        if (db) {
            db.collection("llr_documents").get().then(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (isExpired(data.llrDate)) {
                        db.collection("llr_documents").doc(doc.id).delete()
                            .then(() => console.log(`Auto-deleted expired LLR: ${doc.id}`))
                            .catch(err => console.error("Auto-delete error:", err));
                    }
                });
            });
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_llr') || '[]');
            const filtered = local.filter(doc => !isExpired(doc.llrDate));
            if (filtered.length !== local.length) {
                localStorage.setItem('hameethiya_llr', JSON.stringify(filtered));
                updateLLRDashboard();
                console.log("Auto-deleted expired LLR records from LocalStorage");
            }
        }
    }

    // --- Enquiries Management ---
    function updateEnquiryDashboard() {
        const tableBody = document.getElementById('enquiryTableBody');
        const badge = document.getElementById('enquiryBadge');
        if (!tableBody) return;

        const render = (enquiries) => {
            badge.innerText = enquiries.length;
            if (enquiries.length === 0) {
                document.getElementById('enquiryEmptyMsg').style.display = 'block';
                tableBody.innerHTML = '';
                return;
            }
            document.getElementById('enquiryEmptyMsg').style.display = 'none';
            tableBody.innerHTML = enquiries.map((enq, index) => `
                <tr>
                    <td>${enq.timestamp}</td>
                    <td><strong>${enq.name}</strong></td>
                    <td>${enq.phone}</td>
                    <td><span class="badge" style="background: rgba(157, 80, 187, 0.1); color: var(--primary-color);">${enq.service}</span></td>
                    <td>${enq.time || 'N/A'}</td>
                    <td>
                        <button class="btn-ack" onclick="acknowledgeEnquiry('${enq.id || index}', ${!!enq.id})">
                            <i class="fas fa-check"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        };

        if (db) {
            db.collection("enquiries").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const enqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                render(enqs);
            });
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
            render(local);
        }
    }

    window.acknowledgeEnquiry = function(id, isCloud) {
        if (!confirm("Close this enquiry?")) return;
        if (isCloud && db) {
            db.collection("enquiries").doc(id).delete();
        } else {
            const enqs = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
            enqs.splice(id, 1);
            localStorage.setItem('hameethiya_enquiries', JSON.stringify(enqs));
            updateEnquiryDashboard();
        }
    };

    window.clearAllEnquiries = function() {
        if (confirm("Clear all enquiries?")) {
            localStorage.removeItem('hameethiya_enquiries');
            updateEnquiryDashboard();
        }
    };

    // --- Feedbacks Management ---
    function updateFeedbackDashboard() {
        const tableBody = document.getElementById('feedbackTableBody');
        const badge = document.getElementById('feedbackBadge');
        if (!tableBody) return;

        const render = (feedbacks) => {
            badge.innerText = feedbacks.length;
            if (feedbacks.length === 0) {
                document.getElementById('feedbackEmptyMsg').style.display = 'block';
                tableBody.innerHTML = '';
                return;
            }
            document.getElementById('feedbackEmptyMsg').style.display = 'none';
            tableBody.innerHTML = feedbacks.map((rev, index) => `
                <tr>
                    <td>${rev.timestamp}</td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <strong>${rev.name}</strong>
                            ${rev.adminReply ? `<span class="status-badge status-completed" style="font-size: 0.65rem; width: fit-content;">Replied</span>` : `<span class="status-badge status-initiated" style="font-size: 0.65rem; width: fit-content;">Pending</span>`}
                        </div>
                    </td>
                    <td>
                        <div style="color: var(--primary-color);">
                            ${Array(5).fill(0).map((_, i) => `<i class="${i < rev.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                        </div>
                    </td>
                    <td style="max-width: 300px; white-space: normal;">
                        ${rev.comment}
                        ${rev.adminReply ? `<div style="margin-top: 10px; padding: 8px; background: rgba(212, 175, 55, 0.1); border-left: 2px solid var(--primary-color); font-size: 0.85rem; color: var(--primary-color);"><strong>Admin:</strong> ${rev.adminReply}</div>` : ''}
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-ack" style="background: var(--primary-color); color: var(--secondary-color);" onclick="replyToFeedback('${rev.id || index}', ${!!rev.id})">
                                <i class="fas fa-reply"></i> Reply
                            </button>
                            <button class="btn-ack" style="background: #dc3545;" onclick="deleteFeedback('${rev.id || index}', ${!!rev.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        };

        if (db) {
            db.collection("feedbacks").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const revs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                render(revs);
            });
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
            render(local);
        }
    }

    window.replyToFeedback = function(id, isCloud) {
        const reply = prompt("Enter your reply to this feedback:");
        if (reply === null) return;

        if (isCloud && db) {
            db.collection("feedbacks").doc(id).update({
                adminReply: reply,
                repliedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => alert("Reply sent!"));
        } else {
            const revs = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
            if (revs[id]) {
                revs[id].adminReply = reply;
                revs[id].repliedAt = new Date().toLocaleString();
                localStorage.setItem('hameethiya_feedbacks', JSON.stringify(revs));
                updateFeedbackDashboard();
                alert("Reply saved locally!");
            }
        }
    };

    window.deleteFeedback = function(id, isCloud) {
        if (!confirm("Delete this feedback?")) return;
        if (isCloud && db) {
            db.collection("feedbacks").doc(id).delete();
        } else {
            const revs = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
            revs.splice(id, 1);
            localStorage.setItem('hameethiya_feedbacks', JSON.stringify(revs));
            updateFeedbackDashboard();
        }
    };

    window.clearAllFeedbacks = function() {
        if (confirm("Clear all feedbacks?")) {
            localStorage.removeItem('hameethiya_feedbacks');
            updateFeedbackDashboard();
        }
    };

    // --- Photos Management ---
    function updateAdminPhotoList() {
        const list = document.getElementById('uploadedPhotosList');
        if (!list) return;

        const render = (photos) => {
            if (photos.length === 0) {
                list.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-muted); font-size: 0.8rem; text-align: center;">No photos found.</p>';
                return;
            }
            list.innerHTML = photos.map((p, index) => `
                <div style="position: relative; height: 100px; border: 1px solid var(--glass-border); border-radius: 8px; overflow: hidden;">
                    <img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button onclick="deletePhoto('${p.id || index}', ${!!p.id})" style="position: absolute; top: 5px; right: 5px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">&times;</button>
                </div>
            `).join('');
        };

        if (db) {
            db.collection("gallery").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                render(photos);
            });
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
            render(local);
        }
    }

    window.simulateUpload = function() {
        const file = document.getElementById('photoUpload').files[0];
        const caption = document.getElementById('photoCaption').value;
        if (!file || !caption) return alert("Select file and caption");

        const btn = document.querySelector('[onclick="simulateUpload()"]');
        btn.innerText = "Uploading...";
        btn.disabled = true;

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 1000;
                let w = img.width, h = img.height;
                if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } }
                else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                
                const photoData = { url: dataUrl, caption, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
                if (db) {
                    db.collection("gallery").add(photoData).then(() => {
                        alert("Uploaded!");
                        document.getElementById('photoUpload').value = '';
                        document.getElementById('photoCaption').value = '';
                    }).finally(() => {
                        btn.innerText = "Upload to Gallery";
                        btn.disabled = false;
                    });
                } else {
                    const local = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
                    local.push(photoData);
                    localStorage.setItem('hameethiya_photos', JSON.stringify(local));
                    updateAdminPhotoList();
                    btn.innerText = "Upload to Gallery";
                    btn.disabled = false;
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.deletePhoto = function(id, isCloud) {
        if (!confirm("Delete photo?")) return;
        if (isCloud && db) {
            db.collection("gallery").doc(id).delete();
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
            local.splice(id, 1);
            localStorage.setItem('hameethiya_photos', JSON.stringify(local));
            updateAdminPhotoList();
        }
    };

    // --- Packages Management ---
    function loadPackages() {
        if (db) {
            db.collection("packages").onSnapshot(snapshot => {
                const pkgs = {};
                snapshot.docs.forEach(doc => pkgs[doc.id] = doc.data());
                renderPackageDropdown(pkgs);
            });
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
            renderPackageDropdown(local);
        }
    }

    function renderPackageDropdown(packages) {
        const select = document.getElementById('edit_package_id');
        if (!select) return;
        const current = select.value;
        select.innerHTML = Object.keys(packages).map(id => `<option value="${id}">${packages[id].name || id}</option>`).join('');
        if (packages[current]) select.value = current;
        else if (Object.keys(packages).length > 0) {
            select.value = Object.keys(packages)[0];
            loadPackageToForm();
        }
    }

    window.loadPackageToForm = function() {
        const id = document.getElementById('edit_package_id').value;
        const local = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
        const pkg = local[id];
        if (pkg) {
            document.getElementById('edit_package_name').value = pkg.name || id;
            document.getElementById('edit_package_price').value = pkg.price;
            document.getElementById('edit_package_duration').value = pkg.duration;
            document.getElementById('edit_package_features').value = pkg.features.join('\n');
            document.getElementById('edit_package_button').value = pkg.buttonId || '';
            updatePackagePreview();
        }
    };

    window.handlePackageUpdate = function(e) {
        e.preventDefault();
        const id = document.getElementById('edit_package_id').value;
        const pkg = {
            name: document.getElementById('edit_package_name').value,
            price: document.getElementById('edit_package_price').value,
            duration: document.getElementById('edit_package_duration').value,
            features: document.getElementById('edit_package_features').value.split('\n').filter(f => f.trim()),
            buttonId: document.getElementById('edit_package_button').value
        };
        if (db) {
            db.collection("packages").doc(id).set(pkg).then(() => alert("Updated Cloud!"));
        }
        const local = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
        local[id] = pkg;
        localStorage.setItem('hameethiya_packages', JSON.stringify(local));
        alert("Updated Locally!");
    };

    window.addNewPackagePrompt = function() {
        const name = prompt("Enter package ID:");
        if (!name) return;
        const local = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
        local[name] = { name, price: '₹0', duration: 'New', features: ['Feature 1'], buttonId: '' };
        localStorage.setItem('hameethiya_packages', JSON.stringify(local));
        loadPackages();
    };

    window.deletePackagePrompt = function() {
        const id = document.getElementById('edit_package_id').value;
        if (id && confirm(`Delete ${id}?`)) {
            if (db) db.collection("packages").doc(id).delete();
            const local = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
            delete local[id];
            localStorage.setItem('hameethiya_packages', JSON.stringify(local));
            loadPackages();
        }
    };

    function updatePackagePreview() {
        const name = document.getElementById('edit_package_name').value;
        const price = document.getElementById('edit_package_price').value;
        const duration = document.getElementById('edit_package_duration').value;
        const features = document.getElementById('edit_package_features').value.split('\n').filter(f => f.trim());
        document.getElementById('packagePreview').innerHTML = `
            <div class="pricing-plan" style="transform: scale(0.9); background: rgba(255,255,255,0.02); border: 1px solid var(--primary-color);">
                <div class="plan-header"><h4>${name}</h4><div class="price">${price}</div><p>${duration}</p></div>
                <ul class="plan-features">${features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}</ul>
            </div>`;
    }

    checkAuth();
});
