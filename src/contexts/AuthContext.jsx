import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // Current active role
  const [userRoles, setUserRoles] = useState([]); // All roles user has
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("Auth state changed - User:", user.email, "UID:", user.uid);
        setCurrentUser(user);
        // Reset roles to null first to clear previous user's roles
        setUserRole(null);
        setUserRoles([]);
        setLoading(true);
        
        // Fetch user roles from Firestore
        try {
          console.log("Fetching roles for user:", user.uid);
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log("User document data:", userData);
            
            // Support both old format (single role) and new format (roles array)
            let roles = [];
            if (userData.roles && Array.isArray(userData.roles)) {
              roles = userData.roles;
            } else if (userData.role) {
              // Legacy: single role field
              roles = [userData.role];
            } else {
              roles = ["guest"]; // Default
            }
            
            // Ensure all users have at least "guest" role
            if (!roles.includes("guest")) {
              roles.push("guest");
            }
            
            setUserRoles(roles);
            
            // Set current active role (prefer host if available, otherwise guest)
            const activeRole = roles.includes("host") ? "host" : "guest";
            setUserRole(activeRole);
            
            console.log("User roles:", roles);
            console.log("Active role:", activeRole);
          } else {
            console.warn("User document not found in Firestore, defaulting to guest");
            setUserRoles(["guest"]);
            setUserRole("guest");
          }
        } catch (error) {
          console.error("Error fetching user roles:", error);
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          // If Firestore fails (offline, etc.), keep default guest role
          // Only log if it's not an offline error
          if (error.code !== "unavailable" && !error.message?.includes("offline")) {
            console.warn("Error fetching user roles:", error);
          }
          setUserRoles(["guest"]);
          setUserRole("guest"); // Default to guest on error
        } finally {
          setLoading(false);
        }
      } else {
        console.log("Auth state changed - No user");
        setCurrentUser(null);
        setUserRole(null);
        setUserRoles([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    userRoles,
    loading,
    setUserRole, // Allow updating active role
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-[#1C1C1E] font-light">Loading...</div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

