-- DRAFT ONLY. Configure Vault secrets and test the worker before scheduling.
-- Requires pg_cron and pg_net enabled in the target project.
-- Vault names: gerontik_reminder_worker_url and gerontik_reminder_worker_token.
select cron.schedule('gerontik-reminder-delivery','* * * * *',
 $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='gerontik_reminder_worker_url'),
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='gerontik_reminder_worker_token')),
  body := '{}'::jsonb,
  timeout_milliseconds := 100000
 );
 $job$
);
