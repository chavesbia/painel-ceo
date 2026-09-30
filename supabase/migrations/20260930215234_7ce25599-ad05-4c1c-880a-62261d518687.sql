UPDATE public.invoices p
SET situacao = 'Paga',
    data_pagamento = COALESCE(p.data_pagamento, x.data_pagamento)
FROM (
  SELECT DISTINCT ON (numero, entidade_doc, unidade_negocio) numero, entidade_doc, unidade_negocio, data_pagamento
  FROM public.invoices
  WHERE kind = 'payable' AND situacao ILIKE 'paga%'
  ORDER BY numero, entidade_doc, unidade_negocio, data_pagamento DESC NULLS LAST
) x
WHERE p.kind = 'payable'
  AND p.situacao IN ('Pendente','Protestada')
  AND p.numero = x.numero
  AND p.entidade_doc IS NOT DISTINCT FROM x.entidade_doc
  AND p.unidade_negocio IS NOT DISTINCT FROM x.unidade_negocio;