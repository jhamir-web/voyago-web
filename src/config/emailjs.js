// EmailJS Configuration
// Get these from https://www.emailjs.com/

// Email Verification Account (existing - Account 1)
export const EMAILJS_SERVICE_ID = "service_wk5tgmf"; // Replace with your EmailJS service ID
export const EMAILJS_TEMPLATE_ID = "template_eyg7gzp"; // Replace with your EmailJS template ID
export const EMAILJS_PUBLIC_KEY = "KrwjGD5NcNI95t7Tc"; // Replace with your EmailJS public key (found in Account → General)

// Booking Emails Account (Account 2 - used for both confirmation and cancellation)
// Since free tier allows 2 templates, we'll use one account with two templates
export const EMAILJS_BOOKING_SERVICE_ID = "service_zozu4oe"; // Replace with your EmailJS booking service ID (from Account 2)
export const EMAILJS_BOOKING_PUBLIC_KEY = "UMaJtIZUpdfdiuvqe"; // Replace with your EmailJS booking public key (from Account 2)

// Booking Confirmation Template (in Account 2)
// Order Confirmation template - Template ID from Settings page
export const EMAILJS_CONFIRMATION_TEMPLATE_ID = "template_mavz7ll"; // Order Confirmation template

// Booking Cancellation Template (in Account 2)
// Cancellation Update template - Need to get the correct Template ID from Settings page
export const EMAILJS_CANCELLATION_TEMPLATE_ID = "template_aokrw1u"; // Cancellation Update template (check Settings page for actual Template ID)

