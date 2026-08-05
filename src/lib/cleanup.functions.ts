import { createServerFn } from "@tanstack/react-start";

export const runCleanupTrash = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("invoices")
      .delete({ count: "exact" })
      .or("entidade_doc.is.null,entidade_doc.eq.\"\"");
    
    if (error) throw new Error(error.message);
    return { count };
  });
