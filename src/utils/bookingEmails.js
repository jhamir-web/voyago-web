import emailjs from '@emailjs/browser';
import { 
  EMAILJS_BOOKING_SERVICE_ID,
  EMAILJS_BOOKING_PUBLIC_KEY,
  EMAILJS_CONFIRMATION_TEMPLATE_ID,
  EMAILJS_CANCELLATION_TEMPLATE_ID
} from '../config/emailjs';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

// Initialize EmailJS for booking emails (both confirmation and cancellation use same account)
let bookingEmailjsInitialized = false;
const initBookingEmailJS = () => {
  if (!bookingEmailjsInitialized && EMAILJS_BOOKING_PUBLIC_KEY && EMAILJS_BOOKING_PUBLIC_KEY !== "YOUR_BOOKING_PUBLIC_KEY") {
    try {
      emailjs.init(EMAILJS_BOOKING_PUBLIC_KEY);
      bookingEmailjsInitialized = true;
    } catch (error) {
      console.error("Failed to initialize Booking EmailJS:", error);
    }
  }
};

/**
 * Format date for email display
 */
const formatDateForEmail = (dateString) => {
  if (!dateString) return 'Not provided';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

/**
 * Format currency for email display
 */
const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return '0.00';
  return amount.toFixed(2);
};

/**
 * Send booking confirmation email to guest when host confirms booking
 */
export const sendBookingConfirmationEmail = async (bookingId) => {
  console.log("📧 sendBookingConfirmationEmail called with bookingId:", bookingId);
  try {
    // Initialize EmailJS if not already initialized
    console.log("📧 Initializing EmailJS...");
    initBookingEmailJS();
    console.log("📧 EmailJS initialized, fetching booking data...");

    // Fetch booking data
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    if (!bookingDoc.exists()) {
      throw new Error('Booking not found');
    }

    const booking = { id: bookingDoc.id, ...bookingDoc.data() };

    // Fetch guest data
    const guestDoc = await getDoc(doc(db, 'users', booking.guestId));
    const guestData = guestDoc.exists() ? guestDoc.data() : {};
    
    // Get guest name (prefer displayName, then firstName + lastName, then name, then email username)
    const guestName = guestData.displayName || 
                     (guestData.firstName && guestData.lastName ? `${guestData.firstName} ${guestData.lastName}` : '') ||
                     guestData.name || 
                     booking.guestName || 
                     booking.guestEmail?.split('@')[0] || 
                     'Guest';

    const guestEmail = booking.guestEmail || guestData.email;
    if (!guestEmail) {
      throw new Error('Guest email not found');
    }

    // Get the app URL
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const viewTripUrl = `${appUrl}/guest-dashboard`;

    // Format dates
    const checkInDate = formatDateForEmail(booking.checkIn);
    const checkOutDate = formatDateForEmail(booking.checkOut);

    // Format currency
    const totalAmount = formatCurrency(booking.totalPrice || 0);

    // Prepare email template parameters
    // Note: Both 'email' and 'to_email' are included because EmailJS templates may use either
    const templateParams = {
      to_name: guestName,
      to_email: guestEmail,
      email: guestEmail, // EmailJS template expects {{email}} for "To Email" field
      listing_name: booking.listingTitle || 'Listing',
      location: booking.listingLocation || 'Location not specified',
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      guests: booking.guests ? `${booking.guests} ${booking.guests === 1 ? 'guest' : 'guests'}` : 'Not specified',
      booking_id: booking.id || bookingId,
      total_amount: `$${totalAmount}`,
      view_trip_url: viewTripUrl,
    };

    // Check if template ID is configured
    if (!EMAILJS_CONFIRMATION_TEMPLATE_ID || EMAILJS_CONFIRMATION_TEMPLATE_ID === "YOUR_CONFIRMATION_TEMPLATE_ID") {
      console.error('EMAILJS_CONFIRMATION_TEMPLATE_ID is not configured. Please update src/config/emailjs.js');
      return { success: false, error: 'Email template ID not configured' };
    }

    // Send email via EmailJS
    console.log('Attempting to send confirmation email with params:', {
      serviceId: EMAILJS_BOOKING_SERVICE_ID,
      templateId: EMAILJS_CONFIRMATION_TEMPLATE_ID,
      templateParams: templateParams
    });

    const response = await emailjs.send(
      EMAILJS_BOOKING_SERVICE_ID,
      EMAILJS_CONFIRMATION_TEMPLATE_ID,
      templateParams
    );

    console.log('✅ Booking confirmation email sent successfully', response);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error);
    
    // EmailJS error response structure
    const errorDetails = {
      text: error.text,
      status: error.status,
      message: error.message,
      statusText: error.statusText,
    };
    
    // Try to get more details from EmailJS response
    if (error.response) {
      errorDetails.response = error.response;
    }
    if (error.statusText) {
      errorDetails.statusText = error.statusText;
    }
    
    console.error('Error details:', errorDetails);
    console.error('Full error object:', error);
    
    // Log template params for debugging
    console.error('Template params that were sent:', templateParams);
    console.error('Service ID:', EMAILJS_BOOKING_SERVICE_ID);
    console.error('Template ID:', EMAILJS_CONFIRMATION_TEMPLATE_ID);
    
    // Don't throw error - email failure shouldn't block booking confirmation
    return { success: false, error: error.message || error.text || error.statusText || 'Unknown error' };
  }
};

/**
 * Send booking cancellation email to guest when they cancel their booking
 */
export const sendBookingCancellationEmail = async (bookingId, refundAmount = 0, serviceFee = 0) => {
  try {
    // Initialize EmailJS if not already initialized
    initBookingEmailJS();

    // Fetch booking data
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    if (!bookingDoc.exists()) {
      throw new Error('Booking not found');
    }

    const booking = { id: bookingDoc.id, ...bookingDoc.data() };

    // Fetch guest data
    const guestDoc = await getDoc(doc(db, 'users', booking.guestId));
    const guestData = guestDoc.exists() ? guestDoc.data() : {};
    
    // Get guest name (prefer displayName, then firstName + lastName, then name, then email username)
    const guestName = guestData.displayName || 
                     (guestData.firstName && guestData.lastName ? `${guestData.firstName} ${guestData.lastName}` : '') ||
                     guestData.name || 
                     booking.guestName || 
                     booking.guestEmail?.split('@')[0] || 
                     'Guest';

    const guestEmail = booking.guestEmail || guestData.email;
    if (!guestEmail) {
      throw new Error('Guest email not found');
    }

    // Get the app URL
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const viewTripsUrl = `${appUrl}/guest-dashboard`;

    // Format dates
    const checkInDate = formatDateForEmail(booking.checkIn);
    const checkOutDate = formatDateForEmail(booking.checkOut);

    // Format currency
    const originalAmount = formatCurrency(booking.totalPrice || 0);
    const refundAmountFormatted = formatCurrency(refundAmount || 0);
    const serviceFeeFormatted = formatCurrency(serviceFee || 0);

    // Determine status based on whether cancelled within 24 hours of booking creation
    const bookingCreatedAt = booking.createdAt || '';
    const bookingCreated = bookingCreatedAt ? new Date(bookingCreatedAt) : null;
    const now = new Date();
    const hoursSinceBooking = bookingCreated ? (now - bookingCreated) / (1000 * 60 * 60) : 999;
    const isWithin24HoursOfBooking = hoursSinceBooking > 0 && hoursSinceBooking <= 24;
    
    const cancellationStatus = refundAmount > 0 && isWithin24HoursOfBooking ? 'APPROVED' : 'PROCESSED';
    const statusColor = refundAmount > 0 && isWithin24HoursOfBooking ? '#34C759' : '#8E8E93';

    // Prepare email template parameters
    // Note: Both 'email' and 'to_email' are included because EmailJS templates may use either
    const templateParams = {
      to_name: guestName,
      to_email: guestEmail,
      email: guestEmail, // EmailJS template expects {{email}} for "To Email" field
      listing_name: booking.listingTitle || 'Listing',
      location: booking.listingLocation || 'Location not specified',
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      guests: booking.guests ? `${booking.guests} ${booking.guests === 1 ? 'guest' : 'guests'}` : 'Not specified',
      booking_id: booking.id || bookingId,
      original_amount: `$${originalAmount}`,
      refund_amount: `$${refundAmountFormatted}`,
      service_fee: `$${serviceFeeFormatted}`,
      cancellation_status: cancellationStatus,
      status_color: statusColor,
      view_trips_url: viewTripsUrl,
    };

    // Check if template ID is configured
    if (!EMAILJS_CANCELLATION_TEMPLATE_ID || EMAILJS_CANCELLATION_TEMPLATE_ID === "YOUR_CANCELLATION_TEMPLATE_ID") {
      console.error('EMAILJS_CANCELLATION_TEMPLATE_ID is not configured. Please update src/config/emailjs.js');
      return { success: false, error: 'Email template ID not configured' };
    }

    // Send email via EmailJS
    console.log('Attempting to send cancellation email with params:', {
      serviceId: EMAILJS_BOOKING_SERVICE_ID,
      templateId: EMAILJS_CANCELLATION_TEMPLATE_ID,
      templateParams: templateParams
    });

    const response = await emailjs.send(
      EMAILJS_BOOKING_SERVICE_ID,
      EMAILJS_CANCELLATION_TEMPLATE_ID,
      templateParams
    );

    console.log('✅ Booking cancellation email sent successfully', response);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking cancellation email:', error);
    
    // EmailJS error response structure
    const errorDetails = {
      text: error.text,
      status: error.status,
      message: error.message,
      statusText: error.statusText,
    };
    
    // Try to get more details from EmailJS response
    if (error.response) {
      errorDetails.response = error.response;
    }
    if (error.statusText) {
      errorDetails.statusText = error.statusText;
    }
    
    console.error('Error details:', errorDetails);
    console.error('Full error object:', error);
    
    // Log template params for debugging
    console.error('Template params that were sent:', templateParams);
    console.error('Service ID:', EMAILJS_BOOKING_SERVICE_ID);
    console.error('Template ID:', EMAILJS_CANCELLATION_TEMPLATE_ID);
    
    // Don't throw error - email failure shouldn't block booking cancellation
    return { success: false, error: error.message || error.text || error.statusText || 'Unknown error' };
  }
};

