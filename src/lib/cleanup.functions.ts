import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const runCleanupTrash = createServerFn({ method: "POST" })
  .validator((d: { confirm: boolean }) => d)
  .handler(async ({ data }) => {
    if (!data.confirm) return { count: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("invoices")
      .delete({ count: "exact" })
      .or("entidade_doc.is.null,entidade_doc.eq.\"\"");
    
    if (error) throw new Error(error.message);
    return { count };
  });
