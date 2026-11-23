import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

interface CloudAuthValue {
  session: Session | null;
  ready: boolean;
}

const CloudAuthContext = createContext<CloudAuthValue>({ session: null, ready: false });

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setReady(true);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <CloudAuthContext.Provider value={{ session, ready }}>{children}</CloudAuthContext.Provider>;
}

export function useCloudAuth() {
  return useContext(CloudAuthContext);
}