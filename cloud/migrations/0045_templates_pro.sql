-- Templates are Pro by default (#1931): every template already published becomes Pro.
-- A later publish still keeps whatever `access` it names.

update cloud.templates set access = 'pro' where access <> 'pro';
