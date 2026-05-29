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
        console.warn("Firebase failed to initialize.");
    }

    // --- Authentication ---
    window.handleStudentLogin = function(e) {
        e.preventDefault();
        const studentId = document.getElementById('student_id').value.toUpperCase();
        const mobile = document.getElementById('student_mobile').value;

        if (db) {
            db.collection("registrations")
              .where("studentId", "==", studentId)
              .where("mobile", "==", mobile)
              .get()
              .then(snapshot => {
                  if (snapshot.empty) {
                      alert("Invalid User ID or Mobile Number. Please check with the office.");
                  } else {
                      const studentData = snapshot.docs[0].data();
                      sessionStorage.setItem('hameethiya_student_logged_in', 'true');
                      sessionStorage.setItem('hameethiya_student_data', JSON.stringify(studentData));
                      showDashboard(studentData);
                  }
              })
              .catch(err => alert("Login error: " + err.message));
        } else {
            // Local Fallback
            const local = JSON.parse(localStorage.getItem('hameethiya_registrations') || '[]');
            const student = local.find(r => r.studentId === studentId && r.mobile === mobile);
            if (student) {
                sessionStorage.setItem('hameethiya_student_logged_in', 'true');
                sessionStorage.setItem('hameethiya_student_data', JSON.stringify(student));
                showDashboard(student);
            } else {
                alert("Invalid credentials.");
            }
        }
    };

    window.studentLogout = function() {
        sessionStorage.removeItem('hameethiya_student_logged_in');
        sessionStorage.removeItem('hameethiya_student_data');
        window.location.reload();
    };

    function checkAuth() {
        if (sessionStorage.getItem('hameethiya_student_logged_in') === 'true') {
            const data = JSON.parse(sessionStorage.getItem('hameethiya_student_data'));
            showDashboard(data);
        }
    }

    function showDashboard(data) {
        document.getElementById('studentLoginForm').style.display = 'none';
        document.getElementById('studentDashboard').style.display = 'block';
        
        // Fill Profile
        document.getElementById('display_name').innerText = data.name;
        document.getElementById('profile_name').innerText = data.name;
        document.getElementById('profile_id').innerText = `ID: ${data.studentId}`;
        document.getElementById('profile_email').innerText = data.email;
        document.getElementById('profile_mobile').innerText = data.mobile;
        document.getElementById('profile_course').innerHTML = `<span class="badge">${data.course}</span>`;
        
        const status = data.status || 'Pending';
        document.getElementById('profile_status').innerHTML = `<span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status.toUpperCase()}</span>`;

        fetchLLRData(data.mobile);
    }

    // --- LLR & Timeline Logic ---
    function fetchLLRData(mobile) {
        const content = document.getElementById('llr_content');
        const timeline = document.getElementById('llr_timeline');

        const processLLR = (doc) => {
            if (!doc) return;
            content.style.display = 'none';
            timeline.style.display = 'block';

            // Use dates from doc or calculate if missing
            const llrDateStr = doc.llrDate || '';
            const llrDate = llrDateStr ? new Date(llrDateStr) : null;
            
            if (llrDate && !isNaN(llrDate.getTime())) {
                const maturityDate = new Date(llrDate);
                maturityDate.setDate(llrDate.getDate() + 30);
                const expiryDate = new Date(llrDate);
                expiryDate.setDate(llrDate.getDate() + 180);

                document.getElementById('val_llr_date').innerText = llrDate.toISOString().split('T')[0];
                document.getElementById('val_maturity_date').innerText = maturityDate.toISOString().split('T')[0];
                document.getElementById('val_expiry_date').innerText = expiryDate.toISOString().split('T')[0];

                // Maturity Check (30 days)
                const now = new Date();
                if (now >= maturityDate) {
                    document.getElementById('maturity_notice').style.display = 'flex';
                } else {
                    document.getElementById('maturity_notice').style.display = 'none';
                }

                // Expiry Warning (30 days before expiry)
                const warningThreshold = new Date(expiryDate);
                warningThreshold.setDate(expiryDate.getDate() - 30);
                if (now >= warningThreshold && now < expiryDate) {
                    document.getElementById('expiry_warning').style.display = 'flex';
                } else {
                    document.getElementById('expiry_warning').style.display = 'none';
                }
            } else {
                document.getElementById('val_llr_date').innerText = 'Processing...';
                document.getElementById('val_maturity_date').innerText = 'Pending';
                document.getElementById('val_expiry_date').innerText = 'Pending';
            }

            if (doc.file) {
                document.getElementById('download_btn').style.display = 'inline-block';
                document.getElementById('download_btn').onclick = () => {
                    const link = document.createElement('a');
                    link.href = doc.file;
                    link.download = `LLR_${doc.mobile}.${doc.fileType ? doc.fileType.split('/')[1] : 'pdf'}`;
                    link.click();
                };
            } else {
                document.getElementById('download_btn').style.display = 'none';
            }
        };

        if (db) {
            db.collection("llr_documents").where("mobile", "==", mobile).get()
              .then(snapshot => {
                  if (!snapshot.empty) processLLR(snapshot.docs[0].data());
              });
        } else {
            const local = JSON.parse(localStorage.getItem('hameethiya_llr') || '[]');
            const doc = local.find(d => d.mobile === mobile);
            if (doc) processLLR(doc);
        }
    }

    checkAuth();
});
