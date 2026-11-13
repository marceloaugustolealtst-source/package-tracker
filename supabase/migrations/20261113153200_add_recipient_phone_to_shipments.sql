alter table public.shipments add column if not exists recipient_phone text;

create or replace function public.get_admin_shipments()
returns setof jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'id',s.id,
    'tracking_number',s.tracking_number,
    'sender_name',s.sender_name,
    'sender_phone',s.sender_phone,
    'recipient_name',s.recipient_name,
    'recipient_email',s.recipient_email,
    'recipient_phone',s.recipient_phone,
    'origin',s.origin,
    'destination',s.destination,
    'service',s.service,
    'weight',s.weight,
    'package_description',s.package_description,
    'package_type',s.package_type,
    'pieces',s.pieces,
    'dimensions',s.dimensions,
    'declared_value',s.declared_value,
    'currency',s.currency,
    'transport_mode',s.transport_mode,
    'status',s.status,
    'estimated_delivery',s.estimated_delivery,
    'created_at',s.created_at,
    'updated_at',s.updated_at,
    'tracking_events',coalesce(
      (select jsonb_agg(to_jsonb(e) order by e.event_time desc)
       from public.tracking_events e where e.shipment_id=s.id),
      '[]'::jsonb
    )
  )
  from public.shipments s
  where public.is_admin()
  order by s.created_at desc
$$;
