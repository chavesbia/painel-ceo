import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ImportInputSchema, DeleteImportSchema } from "./imports.schema";

export const importInvoices = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ImportInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { runImportInvoices } = await import("./imports.server");
    return runImportInvoices(data);
  });

export const deleteImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteImportSchema.parse(data))
  .handler(async ({ data, context }) => {
    const [{ data: isOp }, { data: isAdmin }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "operator" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (!isOp && !isAdmin) throw new Error("Sem permissão para excluir importações");
    const { runDeleteImport } = await import("./imports.server");
    return runDeleteImport(data.id);
  });
