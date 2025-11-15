import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import WalletModal from "./WalletModal";
import RewardsCenterModal from "./RewardsCenterModal";

const Header = () => {
  const { currentUser, userRole, userRoles } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      {/* Header - Apple Style */}
      <header className="bg-black/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <div className="text-base sm:text-lg md:text-xl font-light text-white tracking-tight">
                Voyago
              </div>
            </Link>

            {/* Center Navigation - Hidden on mobile, visible on desktop */}
            <div className="hidden lg:flex items-center gap-6 xl:gap-8 absolute left-1/2 transform -translate-x-1/2">
              <Link
                to="/"
                className="text-sm font-light text-white/90 hover:text-white transition-colors duration-200"
              >
                Home
              </Link>
              <Link
                to="/#listings"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  setTimeout(() => {
                    const listingsSection = document.querySelector('.listing-section');
                    if (listingsSection) {
                      listingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className="text-sm font-light text-white/90 hover:text-white transition-colors duration-200"
              >
                Explore
              </Link>
              <Link
                to={currentUser ? "/chat" : "/login"}
                className="text-sm font-light text-white/90 hover:text-white transition-colors duration-200"
              >
                Message
              </Link>
              <Link
                to={currentUser && (userRole === "guest" || (userRoles && userRoles.includes("guest"))) ? "/guest/dashboard" : "/login"}
                className="text-sm font-light text-white/90 hover:text-white transition-colors duration-200"
              >
                My Bookings
              </Link>
              <Link
                to={currentUser ? "/favorites" : "/login"}
                className="text-sm font-light text-white/90 hover:text-white transition-colors duration-200"
              >
                Favorites
              </Link>
            </div>

            {/* Right Side - Icons & Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Search Icon */}
              <button
                onClick={() => {
                  navigate("/");
                  setTimeout(() => {
                    const searchSection = document.querySelector('.search-nav-section');
                    if (searchSection) {
                      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setTimeout(() => {
                        const searchInput = searchSection.querySelector('input[type="text"]');
                        if (searchInput) searchInput.focus();
                      }, 500);
                    }
                  }, 100);
                }}
                className="text-white/90 hover:text-white transition-colors duration-200 p-1"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* User Menu / Login - Hidden on mobile, shown in menu */}
              <div className="hidden lg:flex items-center gap-3">
                {currentUser ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 text-sm font-light text-white/90 hover:text-white transition-all duration-200 group"
                    >
                      <span>{currentUser.displayName || currentUser.email?.split('@')[0] || 'User'}</span>
                      <div className="w-8 h-8 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-xs font-medium border-2 border-white/20 group-hover:border-white/40 transition-all duration-200">
                        {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                      </div>
                      <svg 
                        className={`w-4 h-4 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* User Dropdown Menu */}
                    {showUserMenu && (
                      <>
                        <div 
                          className="fixed inset-0 bg-black/20 backdrop-blur-sm" 
                          onClick={() => setShowUserMenu(false)}
                          style={{ 
                            animation: 'fadeIn 0.2s ease-out',
                            zIndex: 40
                          }}
                        ></div>
                        <div 
                          className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden user-dropdown-menu"
                          style={{ zIndex: 50 }}
                        >
                          <Link
                            to="/profile"
                            onClick={() => setShowUserMenu(false)}
                            className="user-dropdown-item w-full text-sm text-[#1C1C1E] hover:bg-gray-50 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] transform group"
                            style={{ animation: 'fadeInUp 0.3s ease-out 0.05s both' }}
                          >
                            <svg className="text-[#0071E3] transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-light">Profile</span>
                          </Link>

                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowRewards(true);
                            }}
                            className="user-dropdown-item w-full text-sm text-[#1C1C1E] hover:bg-gray-50 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] transform group"
                            style={{ animation: 'fadeInUp 0.3s ease-out 0.1s both' }}
                          >
                            <svg className="text-[#0071E3] transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                            </svg>
                            <span className="font-light">Points & Rewards</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowWallet(true);
                            }}
                            className="user-dropdown-item w-full text-sm text-[#1C1C1E] hover:bg-gray-50 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] transform group"
                            style={{ animation: 'fadeInUp 0.3s ease-out 0.15s both' }}
                          >
                            <svg className="text-[#0071E3] transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="font-light">My Wallet</span>
                          </button>

                          <div className="border-t border-gray-200 user-dropdown-separator"></div>

                          <button
                            onClick={() => {
                              handleLogout();
                              setShowUserMenu(false);
                            }}
                            className="user-dropdown-item w-full text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] transform group"
                            style={{ animation: 'fadeInUp 0.3s ease-out 0.2s both' }}
                          >
                            <svg className="text-red-500 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="font-light">Logout</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="text-sm font-light text-white/90 hover:text-white transition-colors duration-200"
                  >
                    Sign in
                  </Link>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden text-white/90 hover:text-white transition-colors duration-200 p-1 relative z-50"
                aria-label="Menu"
              >
                <div className="w-6 h-6 relative">
                  <span
                    className={`absolute top-0 left-0 w-6 h-0.5 bg-current transition-all duration-300 ease-out ${
                      mobileMenuOpen ? 'rotate-45 translate-y-2.5' : ''
                    }`}
                  />
                  <span
                    className={`absolute top-2.5 left-0 w-6 h-0.5 bg-current transition-all duration-300 ease-out ${
                      mobileMenuOpen ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  <span
                    className={`absolute top-5 left-0 w-6 h-0.5 bg-current transition-all duration-300 ease-out ${
                      mobileMenuOpen ? '-rotate-45 -translate-y-2.5' : ''
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden bg-black/95 backdrop-blur-xl border-t border-white/10 overflow-hidden transition-all duration-300 ease-out ${
            mobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className={`px-4 py-6 space-y-3 transform transition-all duration-300 ease-out ${
            mobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}>
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
            >
              Home
            </Link>
            <Link
              to="/#listings"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                navigate("/");
                setTimeout(() => {
                  const listingsSection = document.querySelector('.listing-section');
                  if (listingsSection) {
                    listingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }}
              className="block text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
            >
              Explore
            </Link>
            <Link
              to={currentUser ? "/chat" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
            >
              Message
            </Link>
            <Link
              to={currentUser && (userRole === "guest" || (userRoles && userRoles.includes("guest"))) ? "/guest/dashboard" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
            >
              My Bookings
            </Link>
            <Link
              to={currentUser ? "/favorites" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
            >
              Favorites
            </Link>
            {currentUser ? (
              <>
                <div className="border-t border-white/10 pt-3 mt-3">
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowRewards(true);
                    }}
                    className="block w-full text-left text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
                  >
                    Points & Rewards
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowWallet(true);
                    }}
                    className="block w-full text-left text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
                  >
                    My Wallet
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left text-sm font-light text-red-400 hover:text-red-300 transition-all duration-200 py-2 hover:translate-x-1"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-light text-white/90 hover:text-white transition-all duration-200 py-2 hover:translate-x-1"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <WalletModal isOpen={showWallet} onClose={() => setShowWallet(false)} />
      <RewardsCenterModal isOpen={showRewards} onClose={() => setShowRewards(false)} />
    </>
  );
};

export default Header;

