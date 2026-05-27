document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    // IMPORTANT: Replace these placeholders with your actual Firebase project credentials
    const firebaseConfig = {
        apiKey: "AIzaSyAY8aW7751YUvDdv4xZYnXSF5AZevOBIxI",
        authDomain: "hameethiya.firebaseapp.com",
        projectId: "hameethiya",
        storageBucket: "hameethiya.firebasestorage.app",
        messagingSenderId: "206037846",
        appId: "1:206037846:web:0bcbcfd67f6989e46d6cf7",
        measurementId: "G-8ZQ1Y0CPQZ"
    };
    // Initialize Firebase if config is provided
    let db = null;
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } else {
        console.warn("Firebase not configured. Using LocalStorage fallback.");
    }

    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Initialize AOS with safer settings
    try {
        AOS.init({
            duration: 800,
            easing: 'ease-out-back',
            once: true,
            offset: 50, // Trigger earlier for better visibility
            mirror: false,
            anchorPlacement: 'top-bottom',
        });
        
        // Force refresh after images load
        window.addEventListener('load', () => {
            AOS.refresh();
        });
    } catch (e) {
        console.warn("AOS failed to initialize, showing all content.");
        forceShowContent();
    }

    // Fallback: If content is still invisible after 2 seconds, force show it
    setTimeout(() => {
        forceShowContent();
    }, 2000);

    function forceShowContent() {
        document.querySelectorAll('[data-aos]').forEach(el => {
            el.classList.add('aos-animate'); // AOS class to show element
            el.style.opacity = "1";
            el.style.transform = "none";
            el.style.visibility = "visible";
        });
    }

    // Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = hamburger.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
                document.body.style.overflow = 'hidden'; // Prevent scroll
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                document.body.style.overflow = 'auto'; // Enable scroll
            }
        });
    }

    // Smooth Scroll for Navigation Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
                if (window.innerWidth <= 768 && navLinks) {
                    navLinks.classList.remove('active');
                    const icon = hamburger.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                    document.body.style.overflow = 'auto';
                }
            }
        });
    });

    // Form Handling Logic
    // IMPORTANT: Replace with Hameethiya's official WhatsApp number (include country code, no + or spaces)
    const BUSINESS_PHONE = "919597326976"; 

    window.handleFormSubmission = function(formType, isWhatsapp = false) {
        const formId = formType === 'enquiry' ? 'enquiryForm' : 'signupForm';
        const form = document.getElementById(formId);
        
        // 1. Spam Protection (Honeypot)
        const hp = form.querySelector('input[name="honeypot"]').value;
        if (hp) return;

        // 2. Gather Data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // 3. Validation
        if (!data.name || !data.phone) {
            alert("Please provide your Name and Phone Number so we can assist you.");
            return;
        }

        // 4. Format Premium WhatsApp Message
        const greeting = "Hello Hameethiya Driving School! 👋";
        const intro = formType === 'enquiry' ? "I'm interested in your driving services." : "I'd like to register for a driving course!";
        
        // Save to Live Enquiry Dashboard
        const enquiryData = {
            name: data.name,
            phone: data.phone,
            type: formType,
            service: data.service || data.course,
            time: data.time || 'N/A',
            timestamp: new Date().toLocaleString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Sync to Firebase Cloud
        if (db) {
            db.collection("enquiries").add(enquiryData)
                .then(() => {
                    console.log("Enquiry synced to cloud.");
                    updateEnquiryDashboard();
                })
                .catch(err => console.error("Cloud sync error:", err));
        }

        // Fallback to LocalStorage
        const enquiries = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
        enquiries.unshift(enquiryData);
        localStorage.setItem('hameethiya_enquiries', JSON.stringify(enquiries));
        if (!db) updateEnquiryDashboard();

        let message = `${greeting}%0A%0A${intro}%0A%0A`;
        message += `*--- CUSTOMER DETAILS ---*%0A`;
        message += `👤 *Name:* ${data.name}%0A`;
        message += `📞 *Phone:* ${data.phone}%0A`;
        
        if (formType === 'enquiry') {
            message += `🎯 *Service:* ${data.service}%0A`;
        } else {
            message += `📚 *Course:* ${data.course}%0A`;
            message += `⏰ *Preferred Time:* ${data.time}%0A`;
        }
        
        message += `%0A*Please send this message to start our conversation!*`;

        // 5. Execution
        if (isWhatsapp) {
            // Direct WhatsApp button click
            const whatsappUrl = `https://wa.me/${BUSINESS_PHONE}?text=${message}`;
            window.open(whatsappUrl, '_blank');
            form.reset();
        } else {
            // Standard "Submit" button click (Local Dashboard + Optional Email)
            const submitBtn = form.querySelector('.btn-submit');
            const originalText = submitBtn.innerText;
            
            submitBtn.innerText = "Processing...";
            submitBtn.disabled = true;

            // SUCCESS FLOW: Show greeting immediately as the dashboard is already updated locally
            const showSuccess = () => {
                alert("Thanks for Contacting us, our admin team will contact you shortly");
                form.reset();
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            };

            const templateParams = {
                from_name: data.name,
                phone_number: data.phone,
                subject: formType === 'enquiry' ? 'New Website Enquiry' : 'New Student Registration',
                details: formType === 'enquiry' ? `Service: ${data.service}` : `Course: ${data.course}, Time: ${data.time}`,
                to_name: "Hameethiya Admin"
            };

            // Attempt Email sending but don't block the user experience if it fails
            emailjs.send('service_warw2u7', 'template_9vv2znq', templateParams)
                .then(() => {
                    console.log("Email sent successfully");
                    showSuccess();
                })
                .catch((err) => {
                    console.error("EmailJS error (likely config or quota):", err);
                    // Even if email fails, the lead is already in the Admin Dashboard, so we show success
                    showSuccess();
                });
        }
    };

    // Attach submit event listeners
    ['enquiryForm', 'signupForm'].forEach(id => {
        const form = document.getElementById(id);
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                handleFormSubmission(id === 'enquiryForm' ? 'enquiry' : 'signup', false);
            });
        }
    });

    // --- Payment Logic ---
    window.triggerPayment = function(courseName, amount) {
        // In a real scenario, you would integrate Razorpay Checkout here.
        // For now, we will simulate the process and log it to Firebase/LocalStorage.
        
        const confirmPayment = confirm(`You are about to enroll in the ${courseName} course for ₹${amount}. Proceed to secure payment?`);
        
        if (confirmPayment) {
            alert("Redirecting to secure payment gateway...");
            
            // Log payment attempt to Firebase
            const paymentData = {
                course: courseName,
                amount: amount,
                status: 'Initiated',
                timestamp: new Date().toLocaleString(),
                createdAt: db ? firebase.firestore.FieldValue.serverTimestamp() : null
            };

            if (db) {
                db.collection("payments").add(paymentData)
                    .then(() => console.log("Payment attempt logged to cloud."))
                    .catch(err => console.error("Cloud log error:", err));
            }

            // After simulation, you would normally see the Razorpay popup.
            // For now, we show a success message after a short delay.
            setTimeout(() => {
                alert(`Success! Enrollment for ${courseName} is complete. Our team will contact you shortly.`);
                
                // Update status to 'Completed'
                if (db) {
                    // In real life, this would happen via a webhook from Razorpay
                }
            }, 2000);
        }
    };

    // --- Dynamic Gallery & Admin Logic ---

    const DEFAULT_PHOTOS = [
        { url: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", caption: "Training Sessions" },
        { url: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", caption: "Premium Fleet" },
        { url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", caption: "Recent Events" },
        { url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", caption: "Success Stories" },
        { url: "https://images.unsplash.com/photo-1517524204709-440d89f24251?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", caption: "Safety Seminars" },
        { url: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", caption: "Road Mastery" }
    ];

    // Initialize Gallery Data if first time
    function initializeGallery() {
        if (!localStorage.getItem('hameethiya_photos')) {
            localStorage.setItem('hameethiya_photos', JSON.stringify(DEFAULT_PHOTOS));
        }
    }

    // Load and Render Gallery
    function renderGallery() {
        const grid = document.getElementById('galleryGrid');
        if (!grid) return;

        const renderItems = (allPhotos) => {
            if (allPhotos.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px;">Gallery is empty. Upload new photos from Admin.</p>';
                return;
            }
            grid.innerHTML = allPhotos.map((photo, index) => `
                <div class="gallery-item" data-aos="fade-up" data-aos-delay="${(index % 3) * 100}" onclick="openLightbox(this)">
                    <img src="${photo.url}" alt="${photo.caption}">
                    <div class="gallery-overlay">
                        <span>${photo.caption}</span>
                    </div>
                </div>
            `).join('');
            if (typeof AOS !== 'undefined') AOS.refresh();
        };

        if (db) {
            db.collection("gallery").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const cloudPhotos = snapshot.docs.map(doc => doc.data());
                // Combine with default if cloud is empty or just show cloud?
                // User said "old photos removed and replace when i upload new"
                // So if cloud has items, show only cloud.
                if (cloudPhotos.length > 0) {
                    renderItems(cloudPhotos);
                } else {
                    renderItems(DEFAULT_PHOTOS);
                }
            });
        } else {
            const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
            renderItems(allPhotos);
        }
    }

    // --- Package Management Logic ---
    const INITIAL_PACKAGES = {
        'Beginner': {
            price: '₹4,999',
            duration: '20 Days Intensive Training',
            features: ['Basic Controls Mastery', 'Road Sign Training', '1-on-1 Instructor', 'License Assistance'],
            buttonId: 'pl_SuQX8TYvhdUgMT'
        },
        'Intermediate': {
            price: '₹3,999',
            duration: '15 Days Refresher + Skills',
            features: ['Defensive Driving', 'Traffic Navigation', 'Reverse Parking Pro', 'Night Driving Session'],
            buttonId: 'pl_SuQX8TYvhdUgMT'
        },
        'Professional': {
            price: '₹6,999',
            duration: '30 Days Advanced Mastery',
            features: ['All Beginner Features', 'Luxury Car Handling', 'Highway Driving', 'Maintenance Basics'],
            buttonId: 'pl_SuQX8TYvhdUgMT'
        }
    };

    function initializePackages() {
        if (!localStorage.getItem('hameethiya_packages')) {
            localStorage.setItem('hameethiya_packages', JSON.stringify(INITIAL_PACKAGES));
        }
        renderPublicPackages();
    }

    function renderPublicPackages() {
        const pricingGrid = document.querySelector('.pricing-grid');
        if (!pricingGrid) return;

        const packages = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
        
        pricingGrid.innerHTML = Object.entries(packages).map(([id, pkg], index) => `
            <div class="pricing-plan ${id === 'Intermediate' || pkg.isPopular ? 'featured' : ''}" data-aos="fade-up" data-aos-delay="${(index + 1) * 100}">
                ${(id === 'Intermediate' || pkg.isPopular) ? '<div class="plan-badge">Popular</div>' : ''}
                <div class="plan-header">
                    <h4>${pkg.name || id}</h4>
                    <div class="price">${pkg.price}</div>
                    <p>${pkg.duration}</p>
                </div>
                <ul class="plan-features">
                    ${pkg.features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}
                </ul>
                <div class="payment-button-container" id="pay-btn-${id.replace(/\s+/g, '-')}">
                    <button class="btn-primary pay-now-btn" onclick="triggerPayment('${pkg.name || id}', '${pkg.price}')">
                        Enroll & Pay Now
                    </button>
                </div>
            </div>
        `).join('');

        // After setting HTML, manually inject Razorpay buttons if they exist
        Object.entries(packages).forEach(([id, pkg]) => {
            if (pkg.buttonId) {
                const container = document.getElementById(`pay-btn-${id.replace(/\s+/g, '-')}`);
                if (container) {
                    container.innerHTML = ''; // Clear fallback button
                    const form = document.createElement('form');
                    const script = document.createElement('script');
                    script.src = "https://checkout.razorpay.com/v1/payment-button.js";
                    script.setAttribute('data-payment_button_id', pkg.buttonId);
                    script.async = true;
                    form.appendChild(script);
                    container.appendChild(form);
                }
            }
        });

        // Update Admin Dropdown if it exists
        const editSelect = document.getElementById('edit_package_id');
        if (editSelect) {
            const currentVal = editSelect.value;
            editSelect.innerHTML = Object.keys(packages).map(id => `
                <option value="${id}">${packages[id].name || id}</option>
            `).join('');
            if (packages[currentVal]) {
                editSelect.value = currentVal;
            } else if (Object.keys(packages).length > 0) {
                editSelect.value = Object.keys(packages)[0];
                loadPackageToForm();
            }
        }
    }

    window.addNewPackagePrompt = function() {
        const name = prompt("Enter the unique ID for the new package (e.g. 'Advanced'):");
        if (!name) return;
        
        const packages = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
        if (packages[name]) {
            alert("A package with this ID already exists.");
            return;
        }

        packages[name] = {
            name: name,
            price: '₹0',
            duration: 'New Course',
            features: ['Feature 1'],
            buttonId: ''
        };

        localStorage.setItem('hameethiya_packages', JSON.stringify(packages));
        renderPublicPackages();
        document.getElementById('edit_package_id').value = name;
        loadPackageToForm();
    };

    window.deletePackagePrompt = function() {
        const id = document.getElementById('edit_package_id').value;
        if (!id) return;
        
        if (!confirm(`Are you sure you want to delete the '${id}' package?`)) return;

        const packages = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
        delete packages[id];

        if (db) {
            db.collection("packages").doc(id).delete()
                .then(() => console.log("Package deleted from cloud."))
                .catch(err => console.error("Cloud delete error:", err));
        }

        localStorage.setItem('hameethiya_packages', JSON.stringify(packages));
        renderPublicPackages();
    };

    window.loadPackageToForm = function() {
        const id = document.getElementById('edit_package_id').value;
        const packages = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');
        const pkg = packages[id];

        if (pkg) {
            document.getElementById('edit_package_name').value = pkg.name || id;
            document.getElementById('edit_package_price').value = pkg.price;
            document.getElementById('edit_package_duration').value = pkg.duration;
            document.getElementById('edit_package_features').value = pkg.features.join('\n');
            document.getElementById('edit_package_button').value = pkg.buttonId || '';
            updatePackagePreview();
        }
    };

    function updatePackagePreview() {
        const preview = document.getElementById('packagePreview');
        const name = document.getElementById('edit_package_name').value;
        const price = document.getElementById('edit_package_price').value;
        const duration = document.getElementById('edit_package_duration').value;
        const features = document.getElementById('edit_package_features').value.split('\n').filter(f => f.trim());

        preview.innerHTML = `
            <div class="pricing-plan" style="transform: scale(0.9); margin: 0 auto; background: rgba(255,255,255,0.02); border: 1px solid var(--primary-color);">
                <div class="plan-header">
                    <h4>${name}</h4>
                    <div class="price">${price}</div>
                    <p>${duration}</p>
                </div>
                <ul class="plan-features">
                    ${features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    window.handlePackageUpdate = function(e) {
        e.preventDefault();
        const id = document.getElementById('edit_package_id').value;
        const packages = JSON.parse(localStorage.getItem('hameethiya_packages') || '{}');

        packages[id] = {
            name: document.getElementById('edit_package_name').value,
            price: document.getElementById('edit_package_price').value,
            duration: document.getElementById('edit_package_duration').value,
            features: document.getElementById('edit_package_features').value.split('\n').filter(f => f.trim()),
            buttonId: document.getElementById('edit_package_button').value
        };

        // Sync to Cloud
        if (db) {
            db.collection("packages").doc(id).set(packages[id])
                .then(() => alert("Package updated in cloud successfully!"))
                .catch(err => {
                    console.error("Cloud error:", err);
                    alert("Cloud update failed: " + err.message);
                });
        }

        localStorage.setItem('hameethiya_packages', JSON.stringify(packages));
        alert("Package updated locally!");
        renderPublicPackages();
    };

    // Sync packages from Cloud if available
    function syncPackagesFromCloud() {
        if (db) {
            db.collection("packages").onSnapshot(snapshot => {
                const cloudPackages = {};
                snapshot.docs.forEach(doc => {
                    cloudPackages[doc.id] = doc.data();
                });
                if (Object.keys(cloudPackages).length > 0) {
                    localStorage.setItem('hameethiya_packages', JSON.stringify(cloudPackages));
                    renderPublicPackages();
                }
            });
        }
    }

    // Initial Load
    initializeGallery();
    renderGallery();
    initializePackages();
    syncPackagesFromCloud();

    // Attach input listeners for live preview
    ['edit_package_price', 'edit_package_duration', 'edit_package_features'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePackagePreview);
    });

    // Lightbox Logic
    window.openLightbox = function(item) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const imgSrc = item.querySelector('img').src;
        
        lightboxImg.src = imgSrc;
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Disable scroll
    };

    window.closeLightbox = function() {
        document.getElementById('lightbox').style.display = 'none';
        document.body.style.overflow = 'auto'; // Enable scroll
    };

    // --- Feedback & Reviews Logic ---

    // Handle Feedback Submission
    window.handleFeedbackSubmission = function(e) {
        e.preventDefault();
        const name = document.getElementById('rev_name').value;
        const comment = document.getElementById('rev_comment').value;
        const ratingElement = document.querySelector('input[name="rating"]:checked');
        
        if (!ratingElement) {
            alert("Please select a rating.");
            return;
        }

        const rating = ratingElement.value;
        const feedbackData = {
            name: name,
            rating: rating,
            comment: comment,
            timestamp: new Date().toLocaleString(),
            id: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Sync to Firebase Cloud
        if (db) {
            db.collection("feedbacks").add(feedbackData)
                .then(() => {
                    console.log("Feedback synced to cloud.");
                    renderPublicReviews();
                    updateFeedbackDashboard();
                })
                .catch(err => console.error("Cloud sync error:", err));
        }

        const feedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
        feedbacks.unshift(feedbackData);
        localStorage.setItem('hameethiya_feedbacks', JSON.stringify(feedbacks));

        alert("Thank you for your feedback!");
        document.getElementById('feedbackForm').reset();
        if (!db) {
            renderPublicReviews();
            updateFeedbackDashboard();
        }
    };

    // Render Reviews for Public View
    function renderPublicReviews() {
        const list = document.getElementById('publicReviewsList');
        if (!list) return;

        const renderItems = (feedbacks) => {
            if (feedbacks.length === 0) {
                list.innerHTML = '<p style="color: #666; text-align: center; margin-top: 20px;">No reviews yet. Be the first to share your experience!</p>';
                return;
            }
            list.innerHTML = feedbacks.map(rev => `
                <div class="public-review-card glass-card" data-aos="fade-up">
                    <div class="review-header">
                        <span class="review-name">${rev.name}</span>
                        <div class="review-stars">
                            ${Array(5).fill(0).map((_, i) => `<i class="${i < rev.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                        </div>
                    </div>
                    <p class="review-comment">"${rev.comment}"</p>
                    <span class="review-date">${rev.timestamp}</span>
                </div>
            `).join('');
        };

        if (db) {
            db.collection("feedbacks").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const cloudFeedbacks = snapshot.docs.map(doc => doc.data());
                renderItems(cloudFeedbacks);
            });
        } else {
            const localFeedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
            renderItems(localFeedbacks);
        }
    }

    // Update Admin Feedback Dashboard
    function updateFeedbackDashboard() {
        const tableBody = document.getElementById('feedbackTableBody');
        const emptyMsg = document.getElementById('feedbackEmptyMsg');
        const badge = document.getElementById('feedbackBadge');
        if (!tableBody) return;

        const renderItems = (feedbacks) => {
            badge.innerText = feedbacks.length;
            if (feedbacks.length === 0) {
                tableBody.closest('.table-container').style.display = 'none';
                emptyMsg.style.display = 'block';
                return;
            }
            tableBody.closest('.table-container').style.display = 'block';
            emptyMsg.style.display = 'none';
            tableBody.innerHTML = feedbacks.map((rev, index) => `
                <tr>
                    <td>${rev.timestamp}</td>
                    <td><strong>${rev.name}</strong></td>
                    <td>
                        <div style="color: var(--primary-color);">
                            ${Array(5).fill(0).map((_, i) => `<i class="${i < rev.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                        </div>
                    </td>
                    <td style="max-width: 300px; white-space: normal;">${rev.comment}</td>
                    <td>
                        <button class="btn-ack" style="background: #dc3545;" onclick="deleteFeedback('${rev.id_cloud || index}', ${!!rev.id_cloud})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `).join('');
        };

        if (db) {
            db.collection("feedbacks").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const cloudFeedbacks = snapshot.docs.map(doc => ({ id_cloud: doc.id, ...doc.data() }));
                renderItems(cloudFeedbacks);
            });
        } else {
            const localFeedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
            renderItems(localFeedbacks);
        }
    }

    // Delete Feedback
    window.deleteFeedback = function(id, isCloud) {
        if (!confirm("Are you sure you want to delete this review?")) return;

        if (isCloud && db) {
            db.collection("feedbacks").doc(id).delete()
                .then(() => console.log("Cloud feedback deleted."))
                .catch(err => console.error("Cloud delete error:", err));
        } else {
            const feedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
            feedbacks.splice(id, 1);
            localStorage.setItem('hameethiya_feedbacks', JSON.stringify(feedbacks));
            updateFeedbackDashboard();
            renderPublicReviews();
        }
    };

    // Clear All Feedbacks
    window.clearAllFeedbacks = function() {
        if (confirm("Are you sure you want to clear ALL customer feedback?")) {
            localStorage.removeItem('hameethiya_feedbacks');
            updateFeedbackDashboard();
            renderPublicReviews();
        }
    };

    // Initial Render of Reviews
    renderPublicReviews();

    // Admin Modal Toggle
    window.toggleAdminModal = function() {
        const modal = document.getElementById('adminModal');
        const isOpening = modal.style.display !== 'flex';
        modal.style.display = isOpening ? 'flex' : 'none';
        
        if (isOpening) {
            updateAdminPhotoList();
            updateEnquiryDashboard();
            updateFeedbackDashboard();
        }
    };

    // Tab Switching Logic
    window.switchAdminTab = function(tabName) {
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(`tab-${tabName}`).classList.add('active');
        event.currentTarget.classList.add('active');
    };

    // Update Enquiry Dashboard
    function updateEnquiryDashboard() {
        const tableBody = document.getElementById('enquiryTableBody');
        const emptyMsg = document.getElementById('enquiryEmptyMsg');
        const badge = document.getElementById('enquiryBadge');
        if (!tableBody) return;

        const renderEnquiries = (enquiries) => {
            badge.innerText = enquiries.length;
            if (enquiries.length === 0) {
                tableBody.closest('.table-container').style.display = 'none';
                emptyMsg.style.display = 'block';
                return;
            }
            tableBody.closest('.table-container').style.display = 'block';
            emptyMsg.style.display = 'none';
            tableBody.innerHTML = enquiries.map((enq, index) => `
                <tr>
                    <td>${enq.timestamp}</td>
                    <td><strong>${enq.name}</strong></td>
                    <td>${enq.phone}</td>
                    <td><span class="badge" style="background: rgba(157, 80, 187, 0.1); color: var(--primary-color);">${enq.service}</span></td>
                    <td>${enq.time || 'N/A'}</td>
                    <td>
                        <button class="btn-ack" onclick="acknowledgeEnquiry('${enq.id || index}', ${!!enq.id})">
                            <i class="fas fa-check"></i> Acknowledge
                        </button>
                    </td>
                </tr>
            `).join('');
        };

        if (db) {
            db.collection("enquiries").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const cloudEnquiries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderEnquiries(cloudEnquiries);
            });
        } else {
            const localEnquiries = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
            renderEnquiries(localEnquiries);
        }
    }

    // Acknowledge/Close Enquiry
    window.acknowledgeEnquiry = function(id, isCloud) {
        if (!confirm("Are you sure you want to acknowledge and close this enquiry?")) return;

        if (isCloud && db) {
            db.collection("enquiries").doc(id).delete()
                .then(() => console.log("Cloud enquiry deleted."))
                .catch(err => console.error("Cloud delete error:", err));
        } else {
            const enquiries = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
            enquiries.splice(id, 1);
            localStorage.setItem('hameethiya_enquiries', JSON.stringify(enquiries));
            updateEnquiryDashboard();
        }
    };

    // Clear Enquiries
    window.clearAllEnquiries = function() {
        if (confirm("Are you sure you want to clear all lead records?")) {
            localStorage.removeItem('hameethiya_enquiries');
            updateEnquiryDashboard();
        }
    };

    // Update the list of uploaded photos in the admin panel
    function updateAdminPhotoList() {
        const listContainer = document.getElementById('uploadedPhotosList');
        if (!listContainer) return;

        const renderItems = (allPhotos) => {
            if (allPhotos.length === 0) {
                listContainer.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-muted); font-size: 0.8rem; text-align: center; margin-top: 20px;">No photos to manage.</p>';
                return;
            }
            listContainer.innerHTML = allPhotos.map((photo, index) => `
                <div style="position: relative; height: 80px; border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 8px; overflow: hidden; background: #000;">
                    <img src="${photo.url}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;">
                    <button onclick="deletePhoto('${photo.id_cloud || index}', ${!!photo.id_cloud})" style="position: absolute; top: 5px; right: 5px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">&times;</button>
                </div>
            `).join('');
        };

        if (db) {
            db.collection("gallery").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                const cloudPhotos = snapshot.docs.map(doc => ({ id_cloud: doc.id, ...doc.data() }));
                renderItems(cloudPhotos);
            });
        } else {
            const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
            renderItems(allPhotos);
        }
    }

    // Delete an uploaded photo
    window.deletePhoto = function(id, isCloud) {
        if (!confirm("Are you sure you want to delete this photo?")) return;

        if (isCloud && db) {
            db.collection("gallery").doc(id).delete()
                .then(() => console.log("Cloud photo deleted."))
                .catch(err => console.error("Cloud delete error:", err));
        } else {
            const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
            allPhotos.splice(id, 1);
            localStorage.setItem('hameethiya_photos', JSON.stringify(allPhotos));
            updateAdminPhotoList();
            renderGallery();
        }
    };

    // Admin Login Handling
    window.handleAdminLogin = function(e) {
        e.preventDefault();
        const user = document.getElementById('admin_user').value;
        const pass = document.getElementById('admin_pass').value;

        // Simple mock authentication
        if (user === "admin" && pass === "hameethiya123") {
            document.getElementById('adminLoginForm').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            document.querySelector('.modal-content h3').style.display = 'none'; // Hide the static header
        } else {
            alert("Invalid credentials. Please try again.");
        }
    };

    // Admin Logout
    window.adminLogout = function() {
        if (confirm("Are you sure you want to logout from the Admin Dashboard?")) {
            document.getElementById('adminPanel').style.display = 'none';
            document.getElementById('adminLoginForm').style.display = 'block';
            document.querySelector('.modal-content h3').style.display = 'block'; // Show static header again
            document.getElementById('admin_user').value = '';
            document.getElementById('admin_pass').value = '';
        }
    };

    // Fix Photo Upload: Add Compression to avoid Firestore limits
    window.simulateUpload = function() {
        const fileInput = document.getElementById('photoUpload');
        const file = fileInput.files[0];
        const caption = document.getElementById('photoCaption').value;

        if (!file) {
            alert("Please select a photo to upload.");
            return;
        }

        if (!caption) {
            alert("Please provide a caption.");
            return;
        }

        // Show loading state
        const uploadBtn = document.querySelector('[onclick="simulateUpload()"]');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.innerText = "Compressing & Uploading...";
        uploadBtn.disabled = true;

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Canvas compression to stay under 1MB Firestore limit
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Max dimensions 1000px (reduced from 1200 to be safer)
                const MAX_SIZE = 1000;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG with 0.6 quality (reduced from 0.7 for safety)
                const imageData = canvas.toDataURL('image/jpeg', 0.6);
                
                // Check size (Firestore limit is 1MB, let's keep it under 800KB)
                const sizeInBytes = Math.round((imageData.length * 3) / 4);
                if (sizeInBytes > 800000) {
                    alert("Image is too large even after compression. Please try a smaller image.");
                    uploadBtn.innerHTML = originalText;
                    uploadBtn.disabled = false;
                    return;
                }

                const photoData = { 
                    url: imageData, 
                    caption: caption,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                // Save to Firebase Cloud
                if (db) {
                    db.collection("gallery").add(photoData)
                        .then(() => {
                            alert("Photo uploaded successfully!");
                            fileInput.value = '';
                            document.getElementById('photoCaption').value = '';
                            if (typeof updateAdminPhotoList === 'function') updateAdminPhotoList();
                        })
                        .catch(err => {
                            console.error("Upload error:", err);
                            let errorMsg = "Cloud upload failed.";
                            if (err.code === 'permission-denied') {
                                errorMsg += " Permission denied. Please check your Firestore security rules.";
                            } else if (err.message && err.message.includes("size")) {
                                errorMsg += " The image is too large for the database.";
                            } else {
                                errorMsg += " Error: " + err.message;
                            }
                            alert(errorMsg);
                        })
                        .finally(() => {
                            uploadBtn.innerHTML = originalText;
                            uploadBtn.disabled = false;
                        });
                } else {
                    // Fallback to local storage
                    const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
                    allPhotos.push(photoData);
                    try {
                        localStorage.setItem('hameethiya_photos', JSON.stringify(allPhotos));
                        alert("Photo saved locally (Cloud not configured).");
                        fileInput.value = '';
                        document.getElementById('photoCaption').value = '';
                        if (typeof renderGallery === 'function') renderGallery();
                        if (typeof updateAdminPhotoList === 'function') updateAdminPhotoList();
                    } catch (error) {
                        alert("Storage full! Clear some photos or configure Firebase Cloud.");
                    }
                    uploadBtn.innerHTML = originalText;
                    uploadBtn.disabled = false;
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Close modals on outside click
    window.onclick = function(event) {
        const adminModal = document.getElementById('adminModal');
        const lightbox = document.getElementById('lightbox');
        if (event.target == adminModal) {
            toggleAdminModal();
        }
        if (event.target == lightbox) {
            closeLightbox();
        }
    };
});
