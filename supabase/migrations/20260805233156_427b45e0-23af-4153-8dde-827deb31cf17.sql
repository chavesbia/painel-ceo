UPDATE invoices 
SET situacao = 'Cancelada', 
    import_id = 'a5627327-5351-4dad-880d-2271661c37e4', 
    updated_at = now() 
WHERE numero IN ('8721/1', '9026/1') 
AND entidade_doc = '45.221.537/0001-10';