-- Diet plan item definitions are editable until feeding runs snapshot them.
-- Plan deletion remains disabled; plans are paused/stopped instead.
create policy "diet_plan_items_delete_own"
  on public.diet_plan_items for delete to authenticated
  using (user_id = (select auth.uid()));
