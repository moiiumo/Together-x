"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext(null);

const LAST_USERNAME_KEY = "together-x:last-username";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null);       // row from public.users
  const router = useRouter();

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("Failed to load user profile:", error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadProfile(session?.user?.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadProfile(session?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  // "Remember username, always require password" — spec section 1.
  // We only ever persist the username locally; Supabase session handles
  // the rest, and the login form always renders the password field empty.
  const rememberUsername = (usernameOrEmail) => {
    try {
      localStorage.setItem(LAST_USERNAME_KEY, usernameOrEmail);
    } catch {
      /* localStorage may be unavailable (SSR/privacy mode) — ignore */
    }
  };

  const getRememberedUsername = () => {
    try {
      return localStorage.getItem(LAST_USERNAME_KEY) || "";
    } catch {
      return "";
    }
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) rememberUsername(email);
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const hasRole = (...roles) => !!profile && roles.includes(profile.role);

  const value = {
    session,
    profile,
    loading: session === undefined,
    signIn,
    signOut,
    hasRole,
    getRememberedUsername,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
