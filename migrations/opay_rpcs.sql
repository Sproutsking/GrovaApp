-- migrations/opay_rpcs.sql
-- Simple RPCs to record OPay purchases and return a consistent response shape.

create or replace function public.opay_buy_airtime(
  p_user_id uuid,
  p_network text,
  p_phone text,
  p_amount numeric
)
returns json language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into bill_payments(user_id,bill_type,provider,recipient,amount,status,meta,created_at)
  values(p_user_id,'airtime',p_network,p_phone,p_amount,'success',jsonb_build_object('network',p_network,'phone',p_phone),now())
  returning id into v_id;
  return json_build_object('success', true, 'transaction_id', v_id, 'reference', v_id::text);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end; $$;

create or replace function public.opay_buy_data(
  p_user_id uuid,
  p_network text,
  p_phone text,
  p_plan_id text,
  p_amount numeric
)
returns json language plpgsql security definer as $$
declare v_id uuid; begin
  insert into bill_payments(user_id,bill_type,provider,recipient,amount,status,meta,created_at)
  values(p_user_id,'data',p_network,p_phone,p_amount,'success',jsonb_build_object('network',p_network,'phone',p_phone,'plan_id',p_plan_id),now())
  returning id into v_id;
  return json_build_object('success', true, 'transaction_id', v_id, 'reference', v_id::text);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end; $$;

create or replace function public.opay_buy_electricity(
  p_user_id uuid,
  p_provider text,
  p_meter_number text,
  p_meter_type text,
  p_amount numeric,
  p_customer_name text
)
returns json language plpgsql security definer as $$
declare v_id uuid; begin
  insert into bill_payments(user_id,bill_type,provider,recipient,amount,status,meta,created_at)
  values(p_user_id,'electricity',p_provider,p_meter_number,p_amount,'success',jsonb_build_object('provider',p_provider,'meter_number',p_meter_number,'meter_type',p_meter_type,'customer_name',p_customer_name),now())
  returning id into v_id;
  return json_build_object('success', true, 'transaction_id', v_id, 'reference', v_id::text);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end; $$;

create or replace function public.opay_buy_cable(
  p_user_id uuid,
  p_provider text,
  p_smart_card text,
  p_package_id text,
  p_amount numeric
)
returns json language plpgsql security definer as $$
declare v_id uuid; begin
  insert into bill_payments(user_id,bill_type,provider,recipient,amount,status,meta,created_at)
  values(p_user_id,'cable_tv',p_provider,p_smart_card,p_amount,'success',jsonb_build_object('provider',p_provider,'package_id',p_package_id,'smart_card',p_smart_card),now())
  returning id into v_id;
  return json_build_object('success', true, 'transaction_id', v_id, 'reference', v_id::text);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end; $$;
