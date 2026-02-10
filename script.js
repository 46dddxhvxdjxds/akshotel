window.onerror = function (msg, url, line) {
    alert("Script Error: " + msg + "\nLine: " + line);
    return false;
};

const API_URL = "https://script.google.com/macros/s/AKfycbwnPglDlaaHJbXqWxfPr144_K00bmv7agD4mcKbr_cfG4mfcQczpk3waQzN4AmUeMzV/exec";

// Global State
let currentDate = new Date();
let bookedDates = []; // Format: "YYYY-MM-DD"
let bookingsMap = {}; // Format: { "YYYY-MM-DD": "Booker Name" }

/* ===========================
   Room Gallery Logic (Moved to Top)
   =========================== */
const roomImages = {
    'Deluxe': [
        'https://lh3.googleusercontent.com/d/11l2b-SVJxYxelz7xE8jDZvFMfsm5z3_n',
        'https://lh3.googleusercontent.com/d/1yEyoCvlsLCYQeL55GBrP56C0lvp0m8Es',
        'https://lh3.googleusercontent.com/d/15kL9VoJBBPKgpLOpbE-lGizyZUeNERAr',
        'https://lh3.googleusercontent.com/d/11l2b-SVJxYxelz7xE8jDZvFMfsm5z3_n'
    ],
    'Suite': [
        'https://lh3.googleusercontent.com/d/11XAdg5nO484VYZp1ZO6lbURGwyCfAtw5',
        'https://lh3.googleusercontent.com/d/1RybirLRDnHWvfG85X3pcHAIeJE9vy6CR',
        'https://lh3.googleusercontent.com/d/1T45CLOTJdi3kXPmqeeoJG1kQh15VJbMK'
    ]
};

let currentRoomImages = [];
let currentRoomIndex = 0;

window.openRoomGallery = function (roomType) {
    currentRoomImages = roomImages[roomType] || [];
    currentRoomIndex = 0;

    const modal = document.getElementById('roomGalleryModal');
    if (modal && currentRoomImages.length > 0) {
        modal.classList.add('show');
        modal.style.display = 'flex';
        updateRoomGallery();

        // Add ESC key listener
        document.addEventListener('keydown', handleGalleryEscKey);
    }
};

// ESC key handler for gallery
function handleGalleryEscKey(e) {
    if (e.key === 'Escape') {
        closeRoomGallery();
    }
}

window.closeRoomGallery = function () {
    const modal = document.getElementById('roomGalleryModal');
    if (modal) {
        modal.style.display = 'none';
        const img = document.getElementById('roomGalleryImage');
        if (img) img.src = '';

        // Remove ESC key listener
        document.removeEventListener('keydown', handleGalleryEscKey);
    }
};

window.changeRoomSlide = function (direction) {
    currentRoomIndex += direction;

    // Wrap around
    if (currentRoomIndex < 0) {
        currentRoomIndex = currentRoomImages.length - 1;
    } else if (currentRoomIndex >= currentRoomImages.length) {
        currentRoomIndex = 0;
    }

    updateRoomGallery();
};

function updateRoomGallery() {
    const img = document.getElementById('roomGalleryImage');
    const counter = document.getElementById('roomGalleryCounter');

    if (img) {
        img.style.opacity = 0.5;
        img.src = currentRoomImages[currentRoomIndex];
        img.onload = () => img.style.opacity = 1;
    }

    if (counter) {
        counter.innerText = `${currentRoomIndex + 1} / ${currentRoomImages.length}`;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // Initialize Mobile Menu (Priority)
    initMobileMenu();

    // Check if we are on the admin page
    if (window.location.pathname.includes('admin.html')) {
        initAdmin();
    } else if (window.location.pathname.includes('booking.html')) {
        initBookingPage();
    } else {
        // Background sync on other pages (Home/Gallery)
        try { fetchBookedDates(true); } catch (e) { console.warn(e); }
        initQuickViewSlider(); // Initialize Slider on Home
        initReviews(); // Initialize Reviews
    }

    // Initialize Hotel Booking if elements exist
    initHotelBooking();
});

/* ===========================
   Tab Switching Logic
   =========================== */
function switchBookingTab(tab) {
    const weddingSection = document.getElementById('weddingBookingSection');
    const hotelSection = document.getElementById('hotelBookingSection');
    const btnWedding = document.getElementById('btnWeddingHall');
    const btnHotel = document.getElementById('btnHotelRoom');

    if (tab === 'wedding') {
        weddingSection.style.display = 'block';
        hotelSection.style.display = 'none';
        btnWedding.classList.add('active');
        btnHotel.classList.remove('active');
    } else {
        weddingSection.style.display = 'none';
        hotelSection.style.display = 'block';
        btnWedding.classList.remove('active');
        btnHotel.classList.add('active');
    }
}

/* ===========================
   Hotel Booking Logic
   =========================== */
function initHotelBooking() {
    const form = document.getElementById('hotelBookingForm');
    if (!form) return;

    // Date Validation Logic
    const checkInInput = document.getElementById('checkIn');
    const checkOutInput = document.getElementById('checkOut');

    // Set min date to today for Check-in
    const today = new Date().toISOString().split('T')[0];
    checkInInput.setAttribute('min', today);

    // Update Check-out min date when Check-in changes
    checkInInput.addEventListener('change', function () {
        if (this.value) {
            const checkInDate = new Date(this.value);
            const nextDay = new Date(checkInDate);
            nextDay.setDate(checkInDate.getDate() + 1);

            const nextDayStr = nextDay.toISOString().split('T')[0];
            checkOutInput.setAttribute('min', nextDayStr);

            // Allow user to pick, but if current value is invalid, clear it
            if (checkOutInput.value && checkOutInput.value <= this.value) {
                checkOutInput.value = nextDayStr;
            }
        }
    });

    // Price Calculation Logic
    function calculatePrice() {
        const roomType = document.getElementById('roomType').value;
        const noOfRooms = parseInt(document.getElementById('noOfRooms').value) || 1;
        const adults = parseInt(document.getElementById('adults').value) || 1;
        const children = parseInt(document.getElementById('children').value) || 0;
        const checkIn = document.getElementById('checkIn').value;
        const checkOut = document.getElementById('checkOut').value;

        if (!roomType || !checkIn || !checkOut) {
            document.getElementById('totalPriceDisplay').innerText = "₹0";
            return 0;
        }

        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);

        // Calculate nights (if same day, treat as 1 day, or invalid? Hotels usually are per night. 
        // User said "1 day stay". If CheckIn=CheckOut, that's usually 0 nights or day use. 
        // Standard logic: time difference. 
        let timeDiff = endDate.getTime() - startDate.getTime();
        let days = timeDiff / (1000 * 3600 * 24);

        if (days < 1) days = 1; // Minimum 1 day logic if user selects same dates or valid logic ensures min 1 night.
        // Input validation ensures checkout > checkin usually, but let's be safe.

        let baseRate1stNight = 0;
        let baseRateExtraNight = 0;
        let extraChildRate = 0;
        let extraAdultRate = 0;

        // "Standard room - ₹1190 for 2 adults for 1 day stay if user stay 2days increase price 700" 
        // "if user add one child increase price per child 200" 
        // "if user add one more adult 500 per adult"

        // "deluxe - ₹1690 for 2 adults 1 day stay if user stay 2days increase price 700"
        // "if user add one child increase price per child 300"
        // "if user add one more adult 500 per adult"

        // "executive suite - 2190 for 2 adults 1 day stay if user stay 2days increase price 800"
        // "if user add one child increase price per child 300"
        // "if user add one more adult 600 per adult"

        if (roomType === 'Standard') {
            baseRate1stNight = 1190;
            baseRateExtraNight = 700;
            extraChildRate = 200;
            extraAdultRate = 500;
        } else if (roomType === 'Deluxe') {
            baseRate1stNight = 1690;
            baseRateExtraNight = 700; // Same as standard? User prompt: "if user stay 2days increase price 700"
            extraChildRate = 300;
            extraAdultRate = 500;
        } else if (roomType === 'Suite') {
            baseRate1stNight = 2190;
            baseRateExtraNight = 800;
            extraChildRate = 300;
            extraAdultRate = 600;
        }

        // --- Room Cost Calculation ---
        // 1st Night Cost
        let totalRoomCost = baseRate1stNight;

        // Extra Nights Cost
        if (days > 1) {
            totalRoomCost += (days - 1) * baseRateExtraNight;
        }

        // --- Extra Person Cost Calculation (Per Day/Night) ---
        // Base covers 2 adults.
        const extraAdults = Math.max(0, adults - 2);

        const extraAdultCostPerDay = extraAdults * extraAdultRate;
        const childCostPerDay = children * extraChildRate;

        // Total Extra Person Cost for the entire stay
        // Assuming extra person charges apply for every night of the stay
        const totalExtraPersonCost = (extraAdultCostPerDay + childCostPerDay) * days;

        // Final Total per Room
        const costPerRoom = totalRoomCost + totalExtraPersonCost;

        // Grand Total
        const grandTotal = costPerRoom * noOfRooms;

        document.getElementById('totalPriceDisplay').innerText = "₹" + grandTotal;
        return grandTotal;
    }

    // Helper: Select Room from Card (Moved to global scope)


    // Event Listeners for Calculation
    const calcElements = ['roomType', 'noOfRooms', 'adults', 'children', 'checkIn', 'checkOut'];
    calcElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', calculatePrice);
        if (el) el.addEventListener('input', calculatePrice); // For number inputs typing
    });

    // Form Submission: Step 1 (Show Payment Selection)
    form.onsubmit = (e) => {
        e.preventDefault();

        // Basic Validation
        const roomNum = document.getElementById('selectedRoomNumber').value;
        if (!roomNum) {
            alert("Please select a room number selected from the grid.");
            document.getElementById('room-selection-error').style.display = 'block';
            document.getElementById('room-selection-section').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        // Hide Form, Show Payment Selection
        form.style.display = 'none';
        const paymentSection = document.getElementById('payment-selection-section');
        if (paymentSection) {
            paymentSection.style.display = 'block';
            paymentSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Global Functions for Payment Flow
    window.backToBookingForm = function () {
        document.getElementById('payment-selection-section').style.display = 'none';
        document.getElementById('hotelBookingForm').style.display = 'block';
    };

    window.confirmBooking = async function (paymentMethod) {
        // Show loading state on the clicked card? 
        // For simplicity, let's use a full screen overlay or just change cursor to wait
        document.body.style.cursor = 'wait';

        // Gather Data (from hidden form)
        const roomNum = document.getElementById('selectedRoomNumber').value;
        const totalPrice = calculatePrice(); // Ensure fresh calcs

        const data = {
            action: 'bookRoom',
            name: document.getElementById('hotelName').value,
            mobile: "'" + document.getElementById('hotelMobile').value,
            roomType: document.getElementById('roomType').value,
            roomNumber: roomNum,
            noOfRooms: 1,
            adults: document.getElementById('adults').value,
            children: document.getElementById('children').value,
            checkIn: document.getElementById('checkIn').value,
            checkOut: document.getElementById('checkOut').value,
            price: totalPrice,
            paymentMethod: paymentMethod // Passed from button click
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                showThankYouModal(data.name, 'Hotel Room');

                // Reset everything
                form.reset();
                document.getElementById('totalPriceDisplay').innerText = "₹0";

                // Reset View
                document.getElementById('payment-selection-section').style.display = 'none';
                document.getElementById('hotelBookingForm').style.display = 'none'; // Keep hidden until room selected again
                document.getElementById('room-selection-section').style.display = 'none'; // Hide grid too? Yes suitable

                // Deselect room buttons
                document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('selected'));
                document.getElementById('selectedRoomNumber').value = "";

            } else {
                alert("Booking Failed: " + result.message);
                // Go back to form to fix?
                backToBookingForm();
            }
        } catch (error) {
            console.error("Hotel Booking Error:", error);
            alert("Request sent! Use 'Check Status' to confirm later if processing delayed.");
        } finally {
            document.body.style.cursor = 'default';
        }
    };
}

/* ===========================
   Booking Page Logic
   =========================== */
async function initBookingPage() {
    // Check for tab parameter
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab) {
        switchBookingTab(tab);
    }

    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return; // Safety check

    // Visual Feedback: Syncing State
    calendarGrid.innerHTML = '';
    renderCalendarHeaders(); // Keep headers visible

    // Fast Load from Cache
    const cached = localStorage.getItem('bookingData');
    if (cached) {
        processBookingData(JSON.parse(cached));
        renderCalendar(currentDate);
    } else {
        // Show loader only if no cache
        const loader = document.createElement('div');
        loader.id = 'calendarLoader';
        loader.style.cssText = "grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--primary-color); font-weight: 600;";
        loader.innerHTML = '<div class="spinner"></div> Syncing data...';
        calendarGrid.appendChild(loader);
    }

    // Fetch fresh data in background
    await fetchBookedDates();

    // Remove loader if it exists
    const loader = document.getElementById('calendarLoader');
    if (loader) loader.remove();

    // Re-render with fresh data always
    renderCalendar(currentDate);

    // Event Listeners for Month Navigation
    // Use onclick to avoid duplicate listeners if re-initialized
    document.getElementById('prevMonth').onclick = () => {
        currentDate.setDate(1); // Fixes Jan 31 -> Mar bug
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    };

    document.getElementById('nextMonth').onclick = () => {
        currentDate.setDate(1);
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    };

    // Modal Events
    setupModal();
}

function renderCalendarHeaders() {
    const grid = document.getElementById('calendarGrid');
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    days.forEach(day => {
        const div = document.createElement('div');
        div.className = 'weekday-header';
        div.innerText = day;
        grid.appendChild(div);
    });
}

function renderCalendar(date) {
    const grid = document.getElementById('calendarGrid');
    const display = document.getElementById('currentMonthDisplay');

    // Clear previous days
    grid.innerHTML = '';
    renderCalendarHeaders();

    const year = date.getFullYear();
    const month = date.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    display.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    // Today for comparison (strip time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Padding for days before the 1st
    for (let i = 0; i < startingDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty-slot';
        grid.appendChild(empty);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = i;

        // Format date string YYYY-MM-DD
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayDiv.dataset.date = dateStr;

        // Date object for logic
        const cellDate = new Date(year, month, i);

        // Logic Hierarchy:
        // 1. Booked (Red) - takes precedence
        // 2. Past (Gray)
        // 3. Available (Green)
        if (bookingsMap[dateStr]) {
            dayDiv.classList.add('booked');
            dayDiv.title = `Booked by ${bookingsMap[dateStr]}`;
            dayDiv.onclick = () => alert(`This date is booked by: ${bookingsMap[dateStr]}`);
        } else if (cellDate < today) {
            dayDiv.classList.add('past');
            dayDiv.title = "Past Date";
        } else {
            dayDiv.classList.add('available');
            dayDiv.onclick = () => openBookingModal(dateStr);
        }

        grid.appendChild(dayDiv);
    }
}

/* ===========================
   API Integration Logic
   =========================== */
async function fetchBookedDates(silent = false) {
    try {
        if (!silent) console.log("Fetching full booking details...");
        const response = await fetch(API_URL + '?action=get_bookings');
        const data = await response.json();

        if (data.success && data.bookings) {
            // Save to cache
            localStorage.setItem('bookingData', JSON.stringify(data.bookings));
            processBookingData(data.bookings);
        }
    } catch (error) {
        console.error("Error fetching bookings:", error);
    }
}

function processBookingData(bookings) {
    bookingsMap = {}; // Reset
    bookedDates = [];

    bookings.forEach(b => {
        const dateKey = b.booked_date || b.date;
        const name = b.full_name || b.name || "Unknown";
        if (dateKey) {
            const d = new Date(dateKey).toISOString().split('T')[0];
            bookedDates.push(d);
            bookingsMap[d] = name;
        }
    });
}

function setupModal() {
    const modal = document.getElementById('bookingModal');
    const closeBtn = document.querySelector('.close-btn');
    const form = document.getElementById('bookingForm');

    closeBtn.onclick = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = "none", 300);
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = "none", 300);
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        await submitBooking();
    };
}

function openBookingModal(dateStr) {
    const modal = document.getElementById('bookingModal');
    document.getElementById('bookingDate').value = dateStr;
    modal.style.display = "flex";
    // Trigger reflow
    void modal.offsetWidth;
    modal.classList.add('show');
}

function showBookedDetails(dateStr) {
    alert(`This date (${dateStr}) is already booked!`);
}

async function submitBooking() {
    const btn = document.querySelector('#bookingForm button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    // Payload matching Google Apps Script doPost keys
    const data = {
        action: 'book',
        booked_date: document.getElementById('bookingDate').value,
        full_name: document.getElementById('fullName').value,
        mo_number: "'" + document.getElementById('mobile').value, // Add quote for sheet string format if desired
        location: document.getElementById('location').value
    };

    try {
        // Send as POST JSON
        // Note: Google Apps Script Web App must be deployed as "Anyone" for this to work without CORS issues
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(data)
        });

        // Try to parse JSON. If CORS opaque, this might fail or return empty.
        // If script is correct, it returns JSON.
        const result = await response.json();

        if (result.success) {
            showThankYouModal(data.full_name, 'Wedding Hall');

            // Optimistic update
            bookedDates.push(data.booked_date);
            if (data.booked_date) bookingsMap[data.booked_date] = data.full_name || "You";

            // Re-render
            renderCalendar(currentDate);

            // Close modal
            document.getElementById('bookingModal').classList.remove('show');
            setTimeout(() => document.getElementById('bookingModal').style.display = "none", 300);
            document.getElementById('bookingForm').reset();
        } else {
            alert("Booking failed: " + (result.message || "Unknown error"));
        }

    } catch (error) {
        console.error("Booking Error:", error);
        // Fallback: If network error or CORS opaque response that prohibits reading
        // but the request was actually sent.
        alert("Booking request sent! Note: If you don't see the date red immediately, please refresh.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function showToast(message) {
    const x = document.getElementById("toast");
    if (!x) return;
    x.innerText = message;
    x.style.visibility = "visible";
    setTimeout(function () { x.style.visibility = "hidden"; }, 3000);
}

/* ===========================
   Thank You Modal Logic
   =========================== */
function showThankYouModal(name, type) {
    const modal = document.getElementById('thankYouModal');
    const msgElement = document.getElementById('thankYouMessage');

    // Customize message based on type
    if (type === 'Hotel Room') {
        msgElement.innerHTML = `Dear <strong>${name}</strong>,<br>Thank you for booking a room at AKS International Hotel. We have received your request and will confirm your stay shortly.`;
    } else {
        msgElement.innerHTML = `Dear <strong>${name}</strong>,<br>Thank you for choosing AKS International Hotel for your special event. We have received your booking request for the Wedding Hall.`;
    }

    modal.style.display = "flex";
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeThankYouModal() {
    const modal = document.getElementById('thankYouModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = "none", 300);
}

/* ===========================
   Mobile Bottom Menu Logic
   =========================== */
/* ===========================
   Mobile Bottom Menu Logic
   =========================== */
/* ===========================
   Mobile Bottom Menu Logic (Sliding)
   =========================== */
function initMobileMenu() {
    console.log("Initializing Mobile Menu...");
    const navContainer = document.getElementById('mobileBottomNav');
    const toggleBtn = document.getElementById('mobileNavToggleBtn');

    if (!navContainer || !toggleBtn) {
        console.error("Mobile Menu Elements Not Found!", { navContainer, toggleBtn });
        return;
    }

    function toggleMenu(e) {
        e.preventDefault(); // Prevent default button behavior
        e.stopPropagation();

        console.log("Menu Toggle Clicked");

        // Toggle class on the main container
        const isActive = navContainer.classList.contains('slide-active');

        if (isActive) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    function openMenu() {
        console.log("Opening Menu");
        navContainer.classList.add('slide-active');
        toggleBtn.innerHTML = '&times;'; // Change to X
        toggleBtn.classList.add('active');
    }

    function closeMenu() {
        console.log("Closing Menu");
        navContainer.classList.remove('slide-active');
        toggleBtn.innerHTML = '&#9776;'; // Change to Hamburger
        toggleBtn.classList.remove('active');
    }

    // Remove existing listeners if any (though typically not needed if plain function)
    const newBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

    newBtn.addEventListener('click', toggleMenu);

    // Close on link click (inside the nav-links)
    const links = navContainer.querySelectorAll('.nav-links a');
    links.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (navContainer.classList.contains('slide-active') && !navContainer.contains(e.target)) {
            closeMenu();
        }
    });
}
function initAdmin() {
    const loginContainer = document.getElementById('loginContainer');
    const adminDashboard = document.getElementById('adminDashboard');
    const userDashboard = document.getElementById('userDashboard');

    // Check Admin Session
    if (localStorage.getItem('isAdmin') === 'true') {
        loginContainer.style.display = 'none';
        adminDashboard.style.display = 'block';
        loadAdminData();
    }
    // We don't persist User Session for simplicity/security in this static demo, 
    // forcing re-login each time for "Check Status".

    // Admin Login Logic
    const adminForm = document.getElementById('adminLoginForm');
    if (adminForm) {
        adminForm.onsubmit = (e) => {
            e.preventDefault();
            const u = document.getElementById('adminUsername').value;
            const p = document.getElementById('adminPassword').value;

            if (u === 'rohtas123' && p === 'Rohtas@1929') {
                localStorage.setItem('isAdmin', 'true');
                loginContainer.style.display = 'none';
                adminDashboard.style.display = 'block';
                loadAdminData();
            } else {
                alert('Invalid Credentials');
            }
        };
    }

    // User Login Logic
    const userForm = document.getElementById('userLoginForm');
    if (userForm) {
        userForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('userLoginName').value.trim();
            const mobile = document.getElementById('userLoginMobile').value.trim();

            const btn = userForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Checking...";
            btn.disabled = true;

            try {
                // Reuse the same API to get all bookings, then filter locally
                // Note via User: "user login requirements name and mobile number"
                const response = await fetch(API_URL + '?action=get_bookings');
                const data = await response.json();

                let bookings = [];
                if (data.success && data.bookings) bookings = data.bookings;
                else if (Array.isArray(data)) bookings = data; // Fallback

                // Filter logic
                const myBookings = bookings.filter(b => {
                    // Loose matching
                    const bMobile = (b.mo_number || b.mobile || '').toString().replace(/'/g, '').trim(); // Remove sheet quotes
                    const bName = (b.full_name || b.name || '').toLowerCase();
                    return bMobile === mobile && bName.includes(name.toLowerCase());
                });

                if (myBookings.length > 0) {
                    showUserDashboard(myBookings);
                } else {
                    alert('No bookings found with these details.');
                }

            } catch (err) {
                console.error(err);
                alert('Error fetching records.');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
    }

    // Logout Handlers
    const logoutBtn = document.getElementById('logoutBtn'); // Admin
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('isAdmin');
            window.location.reload();
        };
    }

    const userLogoutBtn = document.getElementById('userLogoutBtn'); // User
    if (userLogoutBtn) {
        userLogoutBtn.onclick = () => {
            // No local storage for user to clear, just reload
            window.location.reload();
        };
    }
}

function showUserDashboard(bookings) {
    document.getElementById('loginContainer').style.display = 'none';
    const dash = document.getElementById('userDashboard');
    const results = document.getElementById('userBookingResults');
    dash.style.display = 'block';

    results.innerHTML = bookings.map(b => `
        <div style="background: white; padding: 20px; border-radius: 12px; border-left: 5px solid ${b.status === 'Confirmed' ? '#2ecc71' : 'var(--primary-color)'}; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <h3 style="color: var(--secondary-color); margin-bottom: 10px;">Booking ${b.status === 'Confirmed' ? 'Confirmed' : 'Recieved'}</h3>
                <span style="padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; 
                    background: ${b.status === 'Confirmed' ? '#e6fffa' : '#fff3cd'}; 
                    color: ${b.status === 'Confirmed' ? '#00bfa5' : '#856404'};">
                    ${b.status || 'Pending'}
                </span>
            </div>
            <p><strong>Date:</strong> ${b.booked_date}</p>
            <p><strong>Name:</strong> ${b.full_name}</p>
            <p><strong>Location:</strong> ${b.location}</p>
            <p><strong>Mobile:</strong> ${b.mo_number}</p>
            <p><strong>Payment:</strong> <span style="font-weight: 600; color: ${b.payment_status === 'Paid' ? 'green' : 'orange'}">${b.payment_status || 'Pending'}</span></p>
        </div>
    `).join('');
}


let currentAdminTab = 'wedding';

function switchAdminTab(type) {
    currentAdminTab = type;
    const btnWedding = document.getElementById('btnAdminWedding');
    const btnHotel = document.getElementById('btnAdminHotel');

    if (type === 'wedding') {
        btnWedding.className = 'btn-modern';
        btnWedding.style.background = '';
        btnWedding.style.color = ''; // Clear inline color so CSS takes over

        btnHotel.className = 'btn-modern-outline';
        btnHotel.style.background = 'white';
        btnHotel.style.color = '#000000';
    } else {
        btnHotel.className = 'btn-modern';
        btnHotel.style.background = '';
        btnHotel.style.color = ''; // Clear inline color so CSS takes over

        btnWedding.className = 'btn-modern-outline';
        btnWedding.style.background = 'white';
        btnWedding.style.color = '#000000';
    }

    loadAdminData(type);
}

async function loadAdminData(type = 'wedding') {
    const tbody = document.getElementById('bookingTableBody');
    const thead = document.getElementById('adminTableHead');

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading data...</td></tr>';

    try {
        let action = type === 'wedding' ? 'get_bookings' : 'get_room_bookings';
        const response = await fetch(API_URL + '?action=' + action);
        const data = await response.json();

        let bookings = [];
        if (data.success && data.bookings) {
            bookings = data.bookings;
        }

        // Update Headers based on Type
        if (type === 'wedding') {
            thead.innerHTML = `
                <tr>
                    <th>Booked Date</th>
                    <th>Customer Name</th>
                    <th>Mobile</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Notes</th>
                </tr>`;
        } else {
            thead.innerHTML = `
                <tr>
                    <th>Timestamp</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Customer Name</th>
                    <th>Room Type</th>
                    <th>No. Rooms</th>
                    <th>Mobile</th>
                    <th>Status</th>
                </tr>`;
        }

        tbody.innerHTML = '';

        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No bookings found.</td></tr>';
            return;
        }

        bookings.forEach(b => {
            const tr = document.createElement('tr');

            if (type === 'wedding') {
                // Sort by date descending
                bookings.sort((a, b) => new Date(b.booked_date) - new Date(a.booked_date));

                // Payment Button Logic
                const isPaid = b.payment_status === 'Paid';
                const payBtn = `<button onclick="updateBooking(this, '${b.booked_date}', {payment_status: '${isPaid ? 'Pending' : 'Paid'}'})" 
                    class="btn-sm" style="background: ${isPaid ? '#2ecc71' : '#f1c40f'}; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; min-width: 80px;">
                    ${isPaid ? 'Paid' : 'Mark Paid'}
                </button>`;

                // Status Button Logic
                const isConfirmed = b.status === 'Confirmed';
                const statusBtn = `<button onclick="updateBooking(this, '${b.booked_date}', {status: '${isConfirmed ? 'Pending' : 'Confirmed'}'})" 
                    class="btn-sm" style="background: ${isConfirmed ? '#2ecc71' : '#95a5a6'}; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; min-width: 80px;">
                    ${isConfirmed ? 'Confirmed' : 'Confirm'}
                </button>`;

                const notesInput = `
                    <div style="display: flex; gap: 5px;">
                        <textarea id="note-${b.booked_date}" style="padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; resize: none;" rows="2">${b.admin_notes || ''}</textarea>
                        <button onclick="saveNote('${b.booked_date}')" style="border: none; background: var(--primary-color); color: white; border-radius: 4px; cursor: pointer; padding: 0 8px;">Save</button>
                    </div>
                `;

                tr.innerHTML = `
                    <td>${b.booked_date || 'N/A'}</td>
                    <td>
                        <div>${b.full_name || '-'}</div>
                        <small style="color: #666;">${b.location || '-'}</small>
                    </td>
                    <td>${b.mo_number || '-'}</td>
                    <td>${payBtn}</td>
                    <td>${statusBtn}</td>
                    <td style="min-width: 200px;">${notesInput}</td>
                `;
            } else {
                // Hotel Logic
                // Sort by check-in descending
                bookings.sort((a, b) => new Date(b.check_in) - new Date(a.check_in));

                // Status Button Logic for Rooms
                const isConfirmed = b.status === 'Confirmed';
                const statusBtn = `<button onclick="updateRoomStatus(this, '${b.timestamp}', '${isConfirmed ? 'Pending' : 'Confirmed'}')" 
                    class="btn-sm" style="background: ${isConfirmed ? '#2ecc71' : '#f1c40f'}; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; min-width: 80px;">
                    ${isConfirmed ? 'Confirmed' : 'Pending'}
                </button>`;

                let timestampStr = '-';
                try {
                    if (b.timestamp) timestampStr = new Date(b.timestamp).toLocaleString();
                } catch (e) { }

                tr.innerHTML = `
                    <td><small style="font-size: 0.8rem; color: #555;">${timestampStr}</small></td>
                    <td>${b.check_in || '-'}</td>
                    <td>${b.check_out || '-'}</td>
                    <td>
                        <div style="font-weight:600">${b.full_name || '-'}</div>
                        <small>Paid via: ${b.payment_method || '-'}</small>
                    </td>
                    <td>
                        ${b.room_type || '-'}<br>
                        <small style="color:green; font-weight:bold;">₹${b.price || 'N/A'}</small><br>
                        <small style="color:#666; font-size:0.8em;">A: ${b.adults}, C: ${b.children}</small>
                    </td>
                    <td>${b.no_of_rooms || '1'}</td>
                    <td>${b.mobile || '-'}</td>
                    <td>
                        ${statusBtn}
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8">Error loading data: ${e.message}</td></tr>`;
    }
}

async function updateRoomStatus(btn, timestamp, newStatus) {
    const originalText = btn.innerText;
    const originalColor = btn.style.background;

    // Loading State
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">↻</span>';
    btn.style.opacity = "0.7";

    const payload = {
        action: 'update_room_booking',
        timestamp: timestamp,
        status: newStatus
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.success) {
            showToast('Room Updated');

            // Optimistic Update
            btn.disabled = false;
            btn.style.opacity = "1";

            const isConfirmed = newStatus === 'Confirmed';
            btn.innerText = isConfirmed ? 'Confirmed' : 'Confirm';
            btn.style.background = isConfirmed ? '#2ecc71' : '#95a5a6';

            // Update onclick for next toggle
            btn.setAttribute('onclick', `updateRoomStatus(this, '${timestamp}', '${isConfirmed ? 'Pending' : 'Confirmed'}')`);

        } else {
            // Enhanced error feedback
            alert('Update failed: ' + res.message); // Alert instead of toast for visibility
            showToast('Update failed: ' + res.message);
            btn.innerHTML = originalText;
            btn.style.background = originalColor;
            btn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        showToast('Error connecting to server');
        btn.innerHTML = originalText;
        btn.style.background = originalColor;
        btn.disabled = false;
    }
}

async function updateBooking(btn, date, updates) {
    // btn is the button element
    const originalText = btn.innerText;
    const originalColor = btn.style.background;

    // Loading State
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">↻</span>';
    btn.style.opacity = "0.7";

    const payload = {
        action: 'update_booking',
        booked_date: date,
        ...updates
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.success) {
            showToast('Updated successfully');

            // Optimistic Update (No Full Reload)
            btn.disabled = false;
            btn.style.opacity = "1";

            // Determine new state based on updates
            if (updates.payment_status) {
                const isPaid = updates.payment_status === 'Paid';
                btn.innerText = isPaid ? 'Paid' : 'Mark Paid';
                btn.style.background = isPaid ? '#2ecc71' : '#f1c40f';
                // Toggle next action
                btn.setAttribute('onclick', `updateBooking(this, '${date}', {payment_status: '${isPaid ? 'Pending' : 'Paid'}'})`);
            } else if (updates.status) {
                const isConf = updates.status === 'Confirmed';
                btn.innerText = isConf ? 'Confirmed' : 'Confirm';
                btn.style.background = isConf ? '#2ecc71' : '#95a5a6';
                btn.setAttribute('onclick', `updateBooking(this, '${date}', {status: '${isConf ? 'Pending' : 'Confirmed'}'})`);
            } else if (updates.admin_notes) {
                // Notes usually come from separate save button, handled by safeNote which might not pass 'this' correctly yet
                // But saveNote calls updateBooking with button? No, let's check saveNote
            }

        } else {
            showToast('Update failed: ' + res.message);
            // Revert
            btn.innerHTML = originalText;
            btn.style.background = originalColor;
            btn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        showToast('Error connecting to server');
        btn.innerHTML = originalText;
        btn.style.background = originalColor;
        btn.disabled = false;
    }
}

async function saveNote(date) {
    const noteVal = document.getElementById(`note-${date}`).value;
    const btn = event.target; // Implicit event target from onclick
    await updateBooking(btn, date, { admin_notes: noteVal });
    // Restore text for Save button
    btn.innerText = "Save";
}

// Gallery Filter Logic
function filterGallery(category) {
    // 1. Update Buttons
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        if (btn.innerText.trim().toLowerCase() === category.toLowerCase() || (category === 'all' && btn.innerText.trim() === 'All')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 2. Filter Images
    const items = document.querySelectorAll('.gallery-item');
    const classFilter = 'category-' + category.toLowerCase().replace(/\s+/g, '-');

    items.forEach(item => {
        if (category === 'all') {
            item.style.display = 'block';
            setTimeout(() => item.style.opacity = '1', 50);
        } else {
            if (item.classList.contains(classFilter)) {
                item.style.display = 'block';
                setTimeout(() => item.style.opacity = '1', 50);
            } else {
                item.style.opacity = '0';
                setTimeout(() => item.style.display = 'none', 300);
            }
        }
    });
}

/* ===========================
   Gallery Lightbox Logic
   =========================== */
function initGalleryLightbox() {
    const lightbox = document.getElementById('galleryLightbox');
    const lightboxImg = document.getElementById('lightboxImage');
    const closeBtn = document.querySelector('.lightbox-close');

    if (!lightbox || !lightboxImg) return;

    // Open Lightbox
    document.querySelectorAll('.gallery-item img').forEach(img => {
        img.addEventListener('click', () => {
            lightboxImg.src = img.src;
            lightbox.style.display = 'flex';
            setTimeout(() => lightbox.classList.add('show'), 10);
        });
    });

    // Close Lightbox
    function closeLightbox() {
        lightbox.classList.remove('show');
        setTimeout(() => lightbox.style.display = 'none', 300);
        lightboxImg.src = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

    // Close on background click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.style.display === 'flex') {
            closeLightbox();
        }
    });
}

// Initialize Lightbox on Load
document.addEventListener('DOMContentLoaded', initGalleryLightbox);

/* ===========================
   Quick View Slider Logic
   =========================== */
function initQuickViewSlider() {
    const sliderWrapper = document.getElementById('quickViewSlider');
    if (!sliderWrapper) return;

    const slides = document.querySelectorAll('.slide');
    const prevBtn = document.getElementById('sliderPrev');
    const nextBtn = document.getElementById('sliderNext');
    const dotsContainer = document.getElementById('sliderDots');
    let currentIndex = 0;
    const totalSlides = slides.length;
    let slideInterval;

    // Create Dots
    if (dotsContainer) {
        dotsContainer.innerHTML = ''; // Clear existing
        slides.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (index === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(index));
            dotsContainer.appendChild(dot);
        });
    }

    const dots = document.querySelectorAll('.dot');

    function updateSlider() {
        // Use clientWidth of the container for precise pixel-based shifting
        const width = sliderWrapper.parentElement.clientWidth;
        sliderWrapper.style.transform = `translateX(-${currentIndex * width}px)`;

        // Update dots
        dots.forEach(dot => dot.classList.remove('active'));
        if (dots[currentIndex]) dots[currentIndex].classList.add('active');
    }

    function goToSlide(index) {
        currentIndex = index;
        if (currentIndex < 0) currentIndex = totalSlides - 1;
        if (currentIndex >= totalSlides) currentIndex = 0;
        updateSlider();
        resetTimer();
    }

    function nextSlide() {
        goToSlide(currentIndex + 1);
    }

    function prevSlide() {
        goToSlide(currentIndex - 1);
    }

    function resetTimer() {
        clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, 10000);
    }

    // Recalculate on resize to fix pixel offsets
    window.addEventListener('resize', updateSlider);

    // Event Listeners
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);

    // Filter swipes for mobile (basic support)
    let touchStartX = 0;
    let touchEndX = 0;

    sliderWrapper.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });

    sliderWrapper.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        if (touchStartX - touchEndX > 50) nextSlide();
        if (touchEndX - touchStartX > 50) prevSlide();
    }

    // Auto Slide
    resetTimer();
}

/* ===========================
   Reviews Logic
   =========================== */
let currentReviewSlide = 0;
let totalReviews = 0;

function initReviews() {
    const reviewsContainer = document.getElementById('reviewsContainer');
    if (!reviewsContainer) return;

    fetchReviews();
    setupReviewModal();
}

async function fetchReviews() {
    const container = document.getElementById('reviewsContainer');
    try {
        console.log("Fetching reviews...");
        container.innerHTML = '<div class="text-center" style="width:100%; padding:20px;">Loading reviews...</div>';

        // Cache busting with timestamp
        const response = await fetch(API_URL + '?action=get_reviews&_t=' + new Date().getTime());
        const data = await response.json();
        console.log("Reviews Data:", data);

        if (data.success) {
            if (data.reviews && data.reviews.length > 0) {
                renderReviews(data.reviews);
            } else {
                container.innerHTML = '<div class="text-center" style="width:100%; padding:20px;">No reviews yet. Be the first to share your experience!</div>';
            }
        } else {
            throw new Error(data.message || "Unknown error");
        }
    } catch (error) {
        console.error("Error fetching reviews:", error);
        container.innerHTML = `
            <div class="text-center" style="width:100%; color:red; padding: 20px;">
                <p>Failed to load reviews.</p>
                <button class="btn btn-sm btn-outline-dark" onclick="fetchReviews()">Retry</button>
            </div>`;
    }
}

function renderReviews(reviews) {
    const container = document.getElementById('reviewsContainer');
    container.innerHTML = '';
    totalReviews = reviews.length;
    currentReviewSlide = 0; // Reset

    reviews.forEach(r => {
        // Generate Stars
        let ratingVal = parseInt(r.rating) || 5;
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < ratingVal ? '★' : '☆';
        }

        // Format Date safely
        let d = "Recent";
        try {
            if (r.date) {
                const dateObj = new Date(r.date);
                if (!isNaN(dateObj.getTime())) {
                    d = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                }
            }
        } catch (e) { console.warn("Date parse error", e); }

        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
            <div class="review-rating">${stars}</div>
            <p class="review-text">"${r.review || ''}"</p>
            <div class="reviewer-name">${r.name || 'Guest'}</div>
            <div class="review-date">${d}</div>
        `;
        container.appendChild(card);
    });

    // Force strict reflow
    void container.offsetWidth;
    updateReviewSlider();
}

function updateReviewSlider() {
    const container = document.getElementById('reviewsContainer');
    const cards = document.querySelectorAll('.review-card');
    if (cards.length === 0) return;

    // Calculate width to shift
    const cardWidth = cards[0].offsetWidth; // includes padding/border if border-box
    const gap = 20;
    const moveAmount = (cardWidth + gap) * currentReviewSlide;

    container.style.transform = `translateX(-${moveAmount}px)`;
}

function slideReviews(direction) {
    const isDesktop = window.innerWidth >= 768;
    const visibleCount = isDesktop ? 3 : 1;

    const maxIndex = Math.max(0, totalReviews - visibleCount);

    currentReviewSlide += direction;

    if (currentReviewSlide < 0) currentReviewSlide = 0;
    if (currentReviewSlide > maxIndex) currentReviewSlide = maxIndex; // Stop at end

    updateReviewSlider();
}

// Listen for resize to adjust slider
window.addEventListener('resize', () => {
    slideReviews(0); // Recalc clamp
    updateReviewSlider();
});


/* Review Modal Logic */
function openReviewModal() {
    const modal = document.getElementById('reviewModal');
    // Reset state
    document.getElementById('reviewStep1').style.display = 'block';
    document.getElementById('reviewStep2').style.display = 'none';
    document.getElementById('reviewVerifyForm').reset();
    document.getElementById('reviewSubmitForm').reset();

    modal.style.display = "flex";
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = "none", 300);
}

function setupReviewModal() {
    // Step 1: Verify
    const verifyForm = document.getElementById('reviewVerifyForm');
    if (verifyForm) {
        verifyForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = verifyForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Verifying...";
            btn.disabled = true;

            const mobileInput = document.getElementById('reviewMobile').value.trim();

            try {
                // Check against bookings (API get all)
                const response = await fetch(API_URL + '?action=get_bookings');
                const data = await response.json();

                let foundUser = null;
                if (data.success && data.bookings) {
                    // Filter for Mobile + Status=Confirmed + Payment=Paid
                    foundUser = data.bookings.find(b => {
                        const bMobile = (b.mo_number || '').toString().replace(/'/g, '').trim();
                        const isConfirmed = (b.status === 'Confirmed' || b.status === 'Booked');
                        const isPaid = (b.payment_status === 'Paid' || b.payment_status === 'Done');
                        return bMobile === mobileInput && isConfirmed && isPaid;
                    });
                }

                if (foundUser) {
                    // Success
                    document.getElementById('reviewStep1').style.display = 'none';
                    document.getElementById('reviewStep2').style.display = 'block';
                    document.getElementById('reviewerNameDisplay').innerText = foundUser.full_name;
                } else {
                    alert("No confirmed and paid booking found for this mobile number.");
                }
            } catch (err) {
                console.error(err);
                alert("Verification failed. Please try again.");
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
    }

    // Step 2: Submit
    const submitForm = document.getElementById('reviewSubmitForm');
    if (submitForm) {
        submitForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = submitForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Submitting...";
            btn.disabled = true;

            const reviewText = document.getElementById('reviewText').value;
            const mobile = document.getElementById('reviewMobile').value.trim();
            const ratingSelector = document.querySelector('input[name="rating"]:checked');
            const rating = ratingSelector ? ratingSelector.value : 5;

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'add_review',
                        mobile: mobile,
                        review: reviewText,
                        rating: rating
                    })
                });
                const result = await response.json();

                if (result.success) {
                    showToast("Review Submitted! Thank you.");
                    closeReviewModal();
                    fetchReviews(); // Refresh list
                } else {
                    alert(result.message || "Submission failed.");
                }
            } catch (err) {
                console.error(err);
                alert("Error submitting review.");
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
    }
}



/* ===========================
   Room Selection Logic
   =========================== */
let selectedRoomNumber = null;


window.selectRoom = function (roomType) {
    // alert("selectRoom called for: " + roomType);

    // Show room selection grid
    const roomSelection = document.getElementById('room-selection-section');
    if (roomSelection) {
        roomSelection.style.display = 'block';
        fetchRoomAvailability();
    } else {
        console.error("Room selection section not found");
    }

    // Show form
    const form = document.getElementById('hotelBookingForm');
    if (form) {
        form.style.display = 'block';

        // Set hidden input and trigger change for price calc
        const roomTypeInput = document.getElementById('roomType');
        if (roomTypeInput) {
            roomTypeInput.value = roomType;
            // Native dispatch Event
            roomTypeInput.dispatchEvent(new Event('change'));
        }

        // Smooth scroll to selection area first as user needs to pick room before filling form
        if (roomSelection) {
            roomSelection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            form.scrollIntoView({ behavior: 'smooth' });
        }

    } else {
        console.error("Hotel booking form not found");
    }
};

function fetchRoomAvailability() {
    console.log("Fetching room availability...");
    const grid = document.getElementById('room-grid');
    if (!grid) return;

    // Show skeletons if empty
    if (grid.children.length === 0 || !grid.children[0].classList.contains('skeleton')) {
        grid.innerHTML = `
            <div class="room-btn skeleton"></div>
            <div class="room-btn skeleton"></div>
            <div class="room-btn skeleton"></div>
            <div class="room-btn skeleton"></div>
            <div class="room-btn skeleton"></div>
        `;
    }

    fetch(API_URL + "?action=getRooms")
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data)) {
                renderRoomGrid(data);
            } else {
                console.error("Invalid room data format", data);
                grid.innerHTML = '<p style="color:red; grid-column: span 5;">Error loading rooms</p>';
            }
        })
        .catch(error => {
            console.error("Error fetching rooms:", error);
            grid.innerHTML = '<p style="color:red; grid-column: span 5;">Connection failed</p>';
        });
}

function renderRoomGrid(rooms) {
    const grid = document.getElementById('room-grid');
    if (!grid) return;
    grid.innerHTML = ''; // Clear skeletons

    rooms.forEach(room => {
        const btn = document.createElement('div');
        // Sanitize status
        let status = room.status ? room.status.toString().trim().toLowerCase() : 'available';
        if (!status || status === 'unknown') status = 'available';

        btn.className = `room-btn ${status}`;
        btn.innerText = room.number;
        btn.style.position = 'relative'; // Ensure z-index works
        btn.style.zIndex = '10';

        // Always attach click listener for feedback
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent parent clicks
            console.log(`Clicked room ${room.number}, status: ${status}`);

            // Treat as available unless explicitly blocked (e.g. booked)
            // But visually if status is 'booked', we shouldn't allow select.
            if (status !== 'booked') { // Allow selection unless booked
                selectRoomNumber(room.number, btn);
            } else {
                alert(`This room is already booked.`);
            }
        });

        if (status === 'booked') {
            btn.title = "Already Booked";
        } else {
            btn.title = "Click to select";
        }

        grid.appendChild(btn);
    });
}

window.selectRoomNumber = function (number, btnElement) {
    console.log("Selected room:", number);
    selectedRoomNumber = number;
    const input = document.getElementById('selectedRoomNumber');
    if (input) input.value = number;

    const errorMsg = document.getElementById('room-selection-error');
    if (errorMsg) errorMsg.style.display = 'none';

    // Update visual state
    document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');
};
