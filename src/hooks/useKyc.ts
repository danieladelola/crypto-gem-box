import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useMyKyc() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-kyc", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("kyc_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
}
