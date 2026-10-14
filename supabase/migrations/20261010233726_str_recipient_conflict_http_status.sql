-- Expected edit conflicts must return HTTP 409 without PostgREST transaction retries.
-- Keep this an application error, not the engine serialization_failure SQLSTATE.
create or replace function public.save_str_appraisal_recipient(
  p_agency_id uuid, p_report_id uuid, p_recipient jsonb, p_expected_updated_at timestamptz
) returns public.str_appraisals
language plpgsql security invoker set search_path = '' as $$
declare
  v_appraisal public.str_appraisals;
  v_contact uuid;
  v_mode text := p_recipient->>'mode';
begin
  if current_user <> 'service_role' and not public.is_agency_member(p_agency_id) then
    raise exception 'Agency access required' using errcode='42501';
  end if;
  select * into v_appraisal from public.str_appraisals
    where report_id=p_report_id and agency_id=p_agency_id for update;
  if not found then raise exception 'STR appraisal not found'; end if;
  if p_expected_updated_at is null or v_appraisal.updated_at <> p_expected_updated_at then
    raise exception 'Customer details changed in another session. Reload before saving.' using errcode='PT409';
  end if;
  if exists (select 1 from public.reports where id=p_report_id and status='archived') then
    raise exception 'Restore this appraisal before editing its customer.';
  end if;
  if v_mode is null or v_mode not in ('named','general') then raise exception 'Invalid recipient mode'; end if;
  if v_mode='named' then
    if coalesce(length(btrim(p_recipient->>'name')),0)=0 then raise exception 'Customer name is required'; end if;
    v_contact := nullif(p_recipient->>'contact_id','')::uuid;
    if v_contact is not null then
      if not exists (select 1 from public.agency_contacts where id=v_contact and agency_id=p_agency_id and archived_at is null) then
        raise exception 'Customer not found in this agency';
      end if;
    else
      insert into public.agency_contacts (agency_id,name,email,phone,phone_e164,created_by)
      values (p_agency_id,btrim(p_recipient->>'name'),nullif(p_recipient->>'email',''),
        nullif(p_recipient->>'phone',''),nullif(p_recipient->>'phone_e164',''),auth.uid()) returning id into v_contact;
    end if;
  end if;
  update public.str_appraisals set contact_id=v_contact, recipient_mode=v_mode,
    recipient_name=case when v_mode='named' then btrim(p_recipient->>'name') end,
    recipient_email=case when v_mode='named' then nullif(p_recipient->>'email','') end,
    recipient_phone=case when v_mode='named' then nullif(p_recipient->>'phone','') end,
    recipient_phone_e164=case when v_mode='named' then nullif(p_recipient->>'phone_e164','') end
  where report_id=p_report_id and agency_id=p_agency_id returning * into v_appraisal;
  return v_appraisal;
end;
$$;
