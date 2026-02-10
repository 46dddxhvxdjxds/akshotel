// Google Apps Script Code for Hotel Booking
// Deploy as Web App: "Me", "Anyone"

const BOOKINGS_SHEET = "Bookings";
const ROOMS_SHEET = "Rooms";
const REVIEWS_SHEET = "Reviews";
const TOTAL_ROOMS_SHEET = "Total rooms";
const TIMEZONE = "GMT+5:30"; // Indian Standard Time

function doGet(e) {
    const params = e.parameter;
    const action = params.action;

    switch (action) {
        case 'get_bookings':
            return getBookings();
        case 'get_reviews':
            return getReviews();
        case 'get_room_bookings':
            return getRoomBookings();
        case 'getRooms': // New Action matching script.js
            return getRoomAvailability();
        default:
            return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid action" }))
                .setMimeType(ContentService.MimeType.JSON);
    }
}

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        if (action === 'book') {
            return createBooking(data);
        } else if (action === 'book_room') {
            return createHotelBooking(data);
        } else if (action === 'update_booking') {
            return updateBooking(data);
        } else if (action === 'update_room_booking') {
            return updateRoomBooking(data);
        } else if (action === 'add_review') {
            return addReview(data);
        } else if (action === 'bookRoom') {
            return bookSpecificRoom(data);
        } else if (action === 'checkoutRoom') {
            return checkoutRoom(data);
        }

        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid action" }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function getSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
        if (name === BOOKINGS_SHEET) {
            sheet.appendRow(["Full Name", "Mobile", "Location", "Booked Date", "Timestamp", "Status", "Payment", "Notepad"]);
        } else if (name === REVIEWS_SHEET) {
            sheet.appendRow(["Name", "Review", "Date", "Rating"]);
        } else if (name === ROOMS_SHEET) {
            // Updated columns for Rooms sheet
            sheet.appendRow(["Name", "Adults", "Childrens", "Price", "Payment Method", "No of Room", "Check In", "Check Out", "Types of Room", "Mobile", "Timestamp", "Status"]);
        }
    }
    return sheet;
}

function createHotelBooking(data) {
    const sheet = getSheet(ROOMS_SHEET);

    // Price is passed from frontend now
    const price = data.price || "Pending";

    sheet.appendRow([
        data.full_name,
        data.adults,
        data.children,
        price,
        data.payment_method,
        data.no_of_rooms,
        data.check_in,
        data.check_out,
        data.room_type,
        data.mobile,
        new Date(),
        'Pending' // Status (Column 12)
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Room Booking Created" }))
        .setMimeType(ContentService.MimeType.JSON);
}

function getBookings() {
    const sheet = getSheet(BOOKINGS_SHEET);
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Skip header

    const bookings = rows.map(row => {
        let dateStr = row[3];
        if (Object.prototype.toString.call(dateStr) === '[object Date]') {
            dateStr = Utilities.formatDate(dateStr, TIMEZONE, "yyyy-MM-dd");
        }

        return {
            full_name: row[0],
            mo_number: row[1],
            location: row[2],
            booked_date: dateStr,
            timestamp: row[4],
            status: row[5] || 'Pending',
            payment_status: row[6] || 'Pending',
            admin_notes: row[7] || ''
        };
    });

    return ContentService.createTextOutput(JSON.stringify({ success: true, bookings: bookings }))
        .setMimeType(ContentService.MimeType.JSON);
}

function getReviews() {
    const sheet = getSheet(REVIEWS_SHEET);
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);

    const reviews = rows.map(row => ({
        name: row[0],
        review: row[1],
        date: row[2],
        rating: row[3] || 5
    })).filter(r => r.review && r.review.trim() !== "");

    return ContentService.createTextOutput(JSON.stringify({ success: true, reviews: reviews.reverse() }))
        .setMimeType(ContentService.MimeType.JSON);
}

function getRoomBookings() {
    const sheet = getSheet(ROOMS_SHEET);
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Skip header

    // Columns: Name, Adults, Childrens, Price, Payment Method, No of Room, Check In, Check Out, Types of Room, Mobile, Timestamp, Status
    const bookings = rows.map(row => {
        let checkIn = row[6];
        let checkOut = row[7];

        if (Object.prototype.toString.call(checkIn) === '[object Date]') {
            checkIn = Utilities.formatDate(checkIn, TIMEZONE, "yyyy-MM-dd");
        }
        if (Object.prototype.toString.call(checkOut) === '[object Date]') {
            checkOut = Utilities.formatDate(checkOut, TIMEZONE, "yyyy-MM-dd");
        }

        let status = row[11]; // Updated index for Status (12th column)
        if (!status) {
            // Fallback for old rows where Status was in Price column
            status = row[3] || 'Pending';
            // If row[3] is a number (Price), status should be Pending.
            // But we can't easily distinguish "1000" (Price) from "Confirmed" (Status) if they are in same column.
            // Robustness: If row[3] contains digits only, it's likely a Price, so Status is Pending.
            // If it contains letters, it's likely Status.
            if (!isNaN(parseFloat(row[3])) && isFinite(row[3])) {
                status = 'Pending';
            }
        }

        return {
            full_name: row[0],
            adults: row[1],
            children: row[2],
            price: row[3],
            payment_method: row[4],
            no_of_rooms: row[5],
            check_in: checkIn,
            check_out: checkOut,
            room_type: row[8],
            mobile: row[9],
            timestamp: row[10], // Updated index for Timestamp (11th column)
            status: status
        };
    });

    return ContentService.createTextOutput(JSON.stringify({ success: true, bookings: bookings.reverse() }))
        .setMimeType(ContentService.MimeType.JSON);
}

function updateRoomBooking(data) {
    const sheet = getSheet(ROOMS_SHEET);
    const rows = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Use Timestamp to identify row (Column 11, Index 10)
    for (let i = 1; i < rows.length; i++) {
        let rowTs = rows[i][10];

        // 1. Direct String Match (Most reliable)
        if (String(rowTs) == String(data.timestamp)) {
            rowIndex = i + 1;
            break;
        }

        // 2. Date Object Match (Safe)
        let d1 = new Date(rowTs);
        let d2 = new Date(data.timestamp);
        // Check if valid dates and compare using time value (number)
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            if (d1.getTime() === d2.getTime()) {
                rowIndex = i + 1;
                break;
            }
        }
    }

    if (rowIndex === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Booking not found" }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Update Status in Column 12 (Index 12, 1-based)
    if (data.status !== undefined) {
        sheet.getRange(rowIndex, 12).setValue(data.status);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Room Updated" }))
        .setMimeType(ContentService.MimeType.JSON);
}

function createBooking(data) {
    const sheet = getSheet(BOOKINGS_SHEET);
    const bookings = sheet.getDataRange().getValues();

    for (let i = 1; i < bookings.length; i++) {
        let existingDate = bookings[i][3];
        if (Object.prototype.toString.call(existingDate) === '[object Date]') {
            existingDate = Utilities.formatDate(existingDate, TIMEZONE, "yyyy-MM-dd");
        }
        if (existingDate == data.booked_date) {
            return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Date already booked" }))
                .setMimeType(ContentService.MimeType.JSON);
        }
    }

    sheet.appendRow([
        data.full_name,
        data.mo_number,
        data.location,
        data.booked_date,
        new Date(),
        'Pending',
        'Pending',
        ''
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Booking Created" }))
        .setMimeType(ContentService.MimeType.JSON);
}

function updateBooking(data) {
    const sheet = getSheet(BOOKINGS_SHEET);
    const rows = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
        let rowDate = rows[i][3];
        if (Object.prototype.toString.call(rowDate) === '[object Date]') {
            rowDate = Utilities.formatDate(rowDate, TIMEZONE, "yyyy-MM-dd");
        }
        if (rowDate == data.booked_date) {
            rowIndex = i + 1;
            break;
        }
    }

    if (rowIndex === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Booking not found" }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.status !== undefined) sheet.getRange(rowIndex, 6).setValue(data.status);
    if (data.payment_status !== undefined) sheet.getRange(rowIndex, 7).setValue(data.payment_status);
    if (data.admin_notes !== undefined) sheet.getRange(rowIndex, 8).setValue(data.admin_notes);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Updated" }))
        .setMimeType(ContentService.MimeType.JSON);
}

function addReview(data) {
    const bookingsSheet = getSheet(BOOKINGS_SHEET);
    const bookings = bookingsSheet.getDataRange().getValues();
    let isValidUser = false;
    let reviewerName = "";

    const targetMobile = String(data.mobile).trim();

    for (let i = 1; i < bookings.length; i++) {
        const rowMobile = String(bookings[i][1]).trim();
        const status = bookings[i][5];
        const payment = bookings[i][6];

        if (rowMobile === targetMobile) {
            if ((status === 'Confirmed' || status === 'Booked') && (payment === 'Done' || payment === 'Paid')) {
                isValidUser = true;
                reviewerName = bookings[i][0];
                break;
            }
        }
    }

    if (!isValidUser) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: "You can only leave a review if you have a Confirmed Booking and Payment is Done."
        })).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getSheet(REVIEWS_SHEET);
    sheet.appendRow([reviewerName, data.review, new Date(), data.rating || 5]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Review Added Successfully!" }))
        .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================
   Room Availability Logic (Total rooms)
   ========================================= */

function getRoomAvailability() {
    const sheet = getSheet(TOTAL_ROOMS_SHEET);
    // If sheet doesn't exist or is empty, maybe init it?
    // Assuming user created it as per instructions.

    const data = sheet.getDataRange().getValues();
    const rooms = [];

    // Skip header (Row 1)
    for (let i = 1; i < data.length; i++) {
        // Col A: Room Number, Col B: Status
        rooms.push({
            number: data[i][0],
            status: data[i][1] // "available" or "booked"
        });
    }

    return ContentService.createTextOutput(JSON.stringify(rooms)).setMimeType(ContentService.MimeType.JSON);
}

function bookSpecificRoom(data) {
    const roomsSheet = getSheet(TOTAL_ROOMS_SHEET);
    const bookingSheet = getSheet(ROOMS_SHEET);

    const roomNumber = data.roomNumber;

    // 1. Check Availability First
    const roomData = roomsSheet.getDataRange().getValues();
    let roomRowIndex = -1;

    for (let i = 1; i < roomData.length; i++) {
        if (roomData[i][0] == roomNumber) { // Match Room Number
            roomRowIndex = i + 1; // 1-based index
            if (String(roomData[i][1]).toLowerCase() === "booked") {
                // Error: Room already taken
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: "Room " + roomNumber + " is already booked!"
                })).setMimeType(ContentService.MimeType.JSON);
            }
            break;
        }
    }

    if (roomRowIndex === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid Room Number" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Mark as Booked in "Total rooms"
    roomsSheet.getRange(roomRowIndex, 2).setValue("booked");

    // 3. Add to Rooms Sheet (Record)
    // Columns: Name, Adults, Childrens, Price, Payment Method, No of Room, Check In, Check Out, Types of Room, Mobile, Timestamp, Status
    bookingSheet.appendRow([
        data.name,
        data.adults,
        data.children,
        data.price,
        data.paymentMethod,
        data.noOfRooms,
        data.checkIn,
        data.checkOut,
        data.roomType,
        data.mobile,
        new Date(),
        "Pending"
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Room " + roomNumber + " Booked Successfully! Status is now Pending approval." })).setMimeType(ContentService.MimeType.JSON);
}

function checkoutRoom(data) {
    const roomsSheet = getSheet(TOTAL_ROOMS_SHEET);
    const roomNumber = data.roomNumber;
    const roomData = roomsSheet.getDataRange().getValues();

    for (let i = 1; i < roomData.length; i++) {
        if (roomData[i][0] == roomNumber) {
            roomsSheet.getRange(i + 1, 2).setValue("available"); // Reset to available
            return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Room " + roomNumber + " is now Available" })).setMimeType(ContentService.MimeType.JSON);
        }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Room not found" })).setMimeType(ContentService.MimeType.JSON);
}
