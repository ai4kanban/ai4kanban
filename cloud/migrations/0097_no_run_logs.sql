-- A run's log is no longer kept once it ends (#2164): the logs already in R2 go through the
-- hourly drop queue, and nothing queues one again.

insert into cloud.dropped_files (key)
select 'jobs/' || id || '/log.json' from cloud.runner_jobs
on conflict do nothing;

drop trigger drop_run_log on cloud.runner_jobs;
drop function cloud.drop_run_log();
drop function api.v1_job_exists(uuid);
