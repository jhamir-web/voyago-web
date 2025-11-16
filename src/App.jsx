import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./Login";
import Signup from "./Signup";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import CreateListing from "./pages/host/CreateListing";
import CreateListingFlow from "./pages/host/CreateListingFlow";
import ListingDetails from "./pages/guest/ListingDetails";
import GuestDashboard from "./pages/guest/GuestDashboard";
import HostDashboard from "./pages/host/HostDashboard";
import Chat from "./pages/chat/Chat";
import Profile from "./pages/Profile";
import Favorites from "./pages/Favorites";
import HostOnboarding from "./pages/host/HostOnboarding";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSetup from "./pages/admin/AdminSetup";
import HostHomePage from "./pages/host/HostHomePage";
import SelectListingType from "./pages/host/SelectListingType";
import EditListing from "./pages/host/EditListing";
import VerifyEmail from "./pages/VerifyEmail";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/guest/dashboard" element={<GuestDashboard />} />
        <Route path="/host/dashboard" element={<HostDashboard />} />
        <Route path="/host" element={<HostHomePage />} />
        <Route path="/host/onboarding" element={<HostOnboarding />} />
        <Route path="/host/select-listing-type" element={<SelectListingType />} />
        <Route path="/host/create-listing" element={<CreateListing />} />
        <Route path="/host/create-listing-flow" element={<CreateListingFlow />} />
        <Route path="/host/edit-listing/:id" element={<EditListing />} />
        <Route path="/host/listings" element={<HostHomePage />} />
        <Route path="/host/bookings" element={<HostHomePage />} />
        <Route path="/host/calendar" element={<HostHomePage />} />
        <Route path="/host/messages" element={<HostHomePage />} />
        <Route path="/listing/:id" element={<ListingDetails />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:bookingId" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/admin/setup" element={<AdminSetup />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
