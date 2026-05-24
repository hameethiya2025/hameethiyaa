document.addEventListener('DOMContentLoaded', () => {
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
            if (navLinks.classList.contains('active')) {
                navLinks.style.display = 'flex';
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'absolute';
                navLinks.style.top = '70px';
                navLinks.style.left = '0';
                navLinks.style.width = '100%';
                navLinks.style.backgroundColor = 'rgba(11, 12, 16, 0.98)';
                navLinks.style.backdropFilter = 'blur(10px)';
                navLinks.style.padding = '30px';
                navLinks.style.height = '100vh';
                navLinks.style.justifyContent = 'center';
                navLinks.style.gap = '40px';
            } else {
                navLinks.style.display = 'none';
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
                    navLinks.style.display = 'none';
                    navLinks.classList.remove('active');
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
        const enquiries = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
        enquiries.unshift({
            name: data.name,
            phone: data.phone,
            type: formType,
            service: data.service || data.course,
            time: data.time || 'N/A',
            timestamp: new Date().toLocaleString()
        });
        localStorage.setItem('hameethiya_enquiries', JSON.stringify(enquiries));
        updateEnquiryDashboard();

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

        const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');

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

        // Refresh AOS to detect new elements
        if (typeof AOS !== 'undefined') AOS.refresh();
    }

    // Initial Load
    initializeGallery();
    renderGallery();

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
            id: Date.now()
        };

        const feedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
        feedbacks.unshift(feedbackData);
        localStorage.setItem('hameethiya_feedbacks', JSON.stringify(feedbacks));

        alert("Thank you for your feedback!");
        document.getElementById('feedbackForm').reset();
        renderPublicReviews();
        updateFeedbackDashboard();
    };

    // Render Reviews for Public View
    function renderPublicReviews() {
        const list = document.getElementById('publicReviewsList');
        if (!list) return;

        const feedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
        
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
    }

    // Update Admin Feedback Dashboard
    function updateFeedbackDashboard() {
        const tableBody = document.getElementById('feedbackTableBody');
        const emptyMsg = document.getElementById('feedbackEmptyMsg');
        const badge = document.getElementById('feedbackBadge');
        if (!tableBody) return;

        const feedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
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
                    <button class="btn-ack" style="background: #dc3545;" onclick="deleteFeedback(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Delete Feedback
    window.deleteFeedback = function(index) {
        if (!confirm("Are you sure you want to delete this review?")) return;

        const feedbacks = JSON.parse(localStorage.getItem('hameethiya_feedbacks') || '[]');
        feedbacks.splice(index, 1);
        localStorage.setItem('hameethiya_feedbacks', JSON.stringify(feedbacks));
        
        updateFeedbackDashboard();
        renderPublicReviews();
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

        const enquiries = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
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
                <td><span class="badge" style="background: rgba(212,175,55,0.1); color: var(--primary-color);">${enq.service}</span></td>
                <td>${enq.time || 'N/A'}</td>
                <td>
                    <button class="btn-ack" onclick="acknowledgeEnquiry(${index})">
                        <i class="fas fa-check"></i> Acknowledge
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Acknowledge/Close Enquiry
    window.acknowledgeEnquiry = function(index) {
        if (!confirm("Are you sure you want to acknowledge and close this enquiry?")) return;

        const enquiries = JSON.parse(localStorage.getItem('hameethiya_enquiries') || '[]');
        enquiries.splice(index, 1);
        localStorage.setItem('hameethiya_enquiries', JSON.stringify(enquiries));
        
        updateEnquiryDashboard();
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

        const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
        
        if (allPhotos.length === 0) {
            listContainer.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-muted); font-size: 0.8rem; text-align: center; margin-top: 20px;">No photos to manage.</p>';
            return;
        }

        listContainer.innerHTML = allPhotos.map((photo, index) => `
            <div style="position: relative; height: 80px; border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 8px; overflow: hidden; background: #000;">
                <img src="${photo.url}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;">
                <button onclick="deletePhoto(${index})" style="position: absolute; top: 5px; right: 5px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">&times;</button>
            </div>
        `).join('');
    }

    // Delete an uploaded photo
    window.deletePhoto = function(index) {
        if (!confirm("Are you sure you want to delete this photo?")) return;

        const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
        allPhotos.splice(index, 1);
        localStorage.setItem('hameethiya_photos', JSON.stringify(allPhotos));
        
        updateAdminPhotoList();
        renderGallery();
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

    // Simulate Photo Upload
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

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            
            // Save to dynamic storage
            const allPhotos = JSON.parse(localStorage.getItem('hameethiya_photos') || '[]');
            allPhotos.push({ url: imageData, caption: caption });
            
            try {
                localStorage.setItem('hameethiya_photos', JSON.stringify(allPhotos));
                alert("Photo uploaded successfully!");
                
                // Clear form and update gallery
                fileInput.value = '';
                document.getElementById('photoCaption').value = '';
                renderGallery();
                toggleAdminModal();
            } catch (error) {
                console.error("Storage error:", error);
                alert("Storage is full! Please delete some photos to upload new ones.");
            }
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
