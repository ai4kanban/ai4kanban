-- Ended delivery rows of cards deleted before 0038 took them along (#1524).
--
-- They point at a number the workspace no longer holds. An `open` row stays: it still holds a
-- checkout somewhere.
delete from cloud.workspace_deliveries d
 where d.state <> 'open'
   and not exists (
     select 1 from cloud.workspace_cards c
      where c.workspace_id = d.workspace_id and c.card_id = d.card_id
   );
