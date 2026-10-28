-- Studio is off the product (#2118): its waitlist and the function that filled it go.
-- Dropping the function takes its grants with it.

drop function if exists api.join_studio_waitlist(text, uuid, integer);
drop table if exists cloud.studio_waitlist;
