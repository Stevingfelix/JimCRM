-- Dev seed data for CAP Hardware Quoting System.
-- Idempotent — safe to run multiple times (uses ON CONFLICT / DO $$ guards).

-- =========================================================================
-- PDF templates (init migration inserts cap-branded; 0016 inserts blind)
-- =========================================================================
insert into public.pdf_templates (name, react_component_key, is_default)
values ('CAP Branded', 'cap-branded', true)
on conflict (react_component_key) do nothing;

insert into public.pdf_templates (name, react_component_key, is_default)
values ('Blind (no branding)', 'blind', false)
on conflict (react_component_key) do nothing;

-- =========================================================================
-- Parts — realistic mil-spec & commercial hardware
-- =========================================================================
do $$
declare
  p_nas1352  uuid; p_ms35338  uuid; p_an960    uuid; p_nas1149  uuid;
  p_ms21044  uuid; p_an3      uuid; p_nas6204  uuid; p_ms20470  uuid;
  p_nas1097  uuid; p_ms24665  uuid; p_an315    uuid; p_an310    uuid;
  p_nas1291  uuid; p_ms51957  uuid; p_an525    uuid; p_ms9321   uuid;
  p_nas1801  uuid; p_an470    uuid;

  c_textron  uuid; c_l3harris uuid; c_northrop uuid; c_spirit   uuid; c_ducommun uuid;
  v_sps      uuid; v_cherry   uuid; v_pcc      uuid; v_wesco    uuid;
  q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid;
begin

  -- Parts ---------------------------------------------------------------
  insert into public.parts (internal_pn, description, target_margin_pct) values
    ('NAS1352N04-8',  'Socket head cap screw, 1/4-28 × 1/2, alloy steel',   30),
    ('MS35338-43',    'Machine screw, pan head, #8-32 × 3/8, steel zinc',    25),
    ('AN960-816',     'Flat washer, 1/2 ID, steel cadmium',                  35),
    ('NAS1149FN816P', 'Flat washer, 1/2 ID, CRES passivated',               35),
    ('MS21044N4',     'Self-locking nut, 1/4-28, steel cadmium',            30),
    ('AN3-5A',        'Clevis bolt, 3/16 × 21/32, steel cadmium',           28),
    ('NAS6204-10',    'Close tolerance bolt, 1/4-28 × 5/8, alloy steel',    32),
    ('MS20470AD4-6',  'Universal head rivet, 1/8 × 3/8, 2117-T4 aluminum', 25),
    ('NAS1097AD4-4',  'Reduced head rivet, 1/8 × 1/4, 2117-T4 aluminum',   25),
    ('MS24665-302',   'Cotter pin, 3/32 × 1, CRES',                        40),
    ('AN315-4R',      'Plain hex nut, 1/4-28, steel cadmium',               30),
    ('AN310-4',       'Castle nut, 1/4-28, steel cadmium',                  30),
    ('NAS1291-4',     'Structural hi-lock bolt, 1/4-28, alloy steel',       32),
    ('MS51957-31',    'Flat washer, #10, stainless 18-8',                    35),
    ('AN525-10R8',    'Washer head screw, #10-32 × 1/2, steel cadmium',     28),
    ('MS9321-04',     'Structural blind rivet, 1/8, Monel/CRES',            28),
    ('NAS1801-3-6',   'Hi-Lok pin, 3/16 × 3/8, titanium',                   35),
    ('AN470AD5-6',    'Universal head rivet, 5/32 × 3/8, 2117-T4 aluminum', 25)
  on conflict (internal_pn) do nothing;

  -- Grab IDs
  select id into p_nas1352  from public.parts where internal_pn = 'NAS1352N04-8';
  select id into p_ms35338  from public.parts where internal_pn = 'MS35338-43';
  select id into p_an960    from public.parts where internal_pn = 'AN960-816';
  select id into p_nas1149  from public.parts where internal_pn = 'NAS1149FN816P';
  select id into p_ms21044  from public.parts where internal_pn = 'MS21044N4';
  select id into p_an3      from public.parts where internal_pn = 'AN3-5A';
  select id into p_nas6204  from public.parts where internal_pn = 'NAS6204-10';
  select id into p_ms20470  from public.parts where internal_pn = 'MS20470AD4-6';
  select id into p_nas1097  from public.parts where internal_pn = 'NAS1097AD4-4';
  select id into p_ms24665  from public.parts where internal_pn = 'MS24665-302';
  select id into p_an315    from public.parts where internal_pn = 'AN315-4R';
  select id into p_an310    from public.parts where internal_pn = 'AN310-4';
  select id into p_nas1291  from public.parts where internal_pn = 'NAS1291-4';
  select id into p_ms51957  from public.parts where internal_pn = 'MS51957-31';
  select id into p_an525    from public.parts where internal_pn = 'AN525-10R8';
  select id into p_ms9321   from public.parts where internal_pn = 'MS9321-04';
  select id into p_nas1801  from public.parts where internal_pn = 'NAS1801-3-6';
  select id into p_an470    from public.parts where internal_pn = 'AN470AD5-6';

  -- Part aliases --------------------------------------------------------
  insert into public.part_aliases (part_id, alias_pn, source_type, source_name) values
    -- NAS1352N04-8 aliases
    (p_nas1352, 'BACB30NJ4C8',   'manufacturer', 'Boeing'),
    (p_nas1352, 'SL2504-008',    'vendor',       'SPS Technologies'),
    -- MS35338-43 aliases
    (p_ms35338, 'LM-35338-43',   'manufacturer', 'Lockheed Martin'),
    (p_ms35338, 'PP8325-43',     'vendor',       'Precision Castparts'),
    -- AN960-816 aliases
    (p_an960,   'BACW10EC16',    'manufacturer', 'Boeing'),
    (p_an960,   'TXT-W816-CD',   'customer',     'Textron Aviation'),
    -- NAS1149FN816P aliases
    (p_nas1149, 'BACW10BP816',   'manufacturer', 'Boeing'),
    -- MS21044N4 aliases
    (p_ms21044, 'BACE30NL428',   'manufacturer', 'Boeing'),
    (p_ms21044, 'LM-21044N4',    'manufacturer', 'Lockheed Martin'),
    -- AN3-5A aliases
    (p_an3,     'BACB30VU3K5',   'manufacturer', 'Boeing'),
    -- NAS6204-10 aliases
    (p_nas6204, 'HL510-04-10',   'vendor',       'Hi-Shear Corporation'),
    (p_nas6204, 'BACB30NN4-10',  'manufacturer', 'Boeing'),
    -- MS20470AD4-6 aliases
    (p_ms20470, 'CR2249-4-6',    'vendor',       'Cherry Aerospace'),
    (p_ms20470, 'BRV20470AD46',  'manufacturer', 'Boeing')
  on conflict do nothing;

  -- Customers -----------------------------------------------------------
  insert into public.customers (name, markup_multiplier, discount_pct, pricing_notes, billing_address) values
    ('Textron Aviation',      1.050, 5.00,  'Long-term contract pricing; match last quote when possible',
     '1 Cessna Blvd, Wichita KS 67215'),
    ('L3Harris Technologies', 1.100, 0.00,  null,
     '1025 W NASA Blvd, Melbourne FL 32919'),
    ('Northrop Grumman',      1.000, 8.00,  'Volume buyer — always check if qty tier drops the price',
     '2980 Fairview Park Dr, Falls Church VA 22042'),
    ('Spirit AeroSystems',    1.080, 3.00,  null,
     '3801 S Oliver St, Wichita KS 67210'),
    ('Ducommun',              1.000, 0.00,  'New customer — standard pricing, no discounts yet',
     '200 Sandpointe Ave #700, Santa Ana CA 92707')
  on conflict do nothing;

  select id into c_textron  from public.customers where name = 'Textron Aviation';
  select id into c_l3harris from public.customers where name = 'L3Harris Technologies';
  select id into c_northrop from public.customers where name = 'Northrop Grumman';
  select id into c_spirit   from public.customers where name = 'Spirit AeroSystems';
  select id into c_ducommun from public.customers where name = 'Ducommun';

  -- Customer contacts ---------------------------------------------------
  insert into public.customer_contacts (customer_id, name, email, phone, role) values
    (c_textron,  'Karen Mitchell',   'k.mitchell@txtav.com',     '316-555-0142', 'Procurement Lead'),
    (c_textron,  'Dave Ramirez',     'd.ramirez@txtav.com',      '316-555-0198', 'Buyer'),
    (c_l3harris, 'Tom Chen',         'tom.chen@l3harris.com',    '321-555-0233', 'Senior Buyer'),
    (c_northrop, 'Angela Brooks',    'a.brooks@ngc.com',         '703-555-0187', 'Commodity Manager'),
    (c_northrop, 'James Sullivan',   'j.sullivan@ngc.com',       '703-555-0204', 'Buyer'),
    (c_spirit,   'Lisa Patel',       'l.patel@spiritaero.com',   '316-555-0311', 'Procurement'),
    (c_ducommun, 'Robert Nakamura',  'r.nakamura@ducommun.com',  '714-555-0155', 'Purchasing')
  on conflict do nothing;

  -- Vendors -------------------------------------------------------------
  insert into public.vendors (name, categories) values
    ('SPS Technologies',    '{"fasteners","bolts","nuts","screws"}'),
    ('Cherry Aerospace',    '{"rivets","blind fasteners","installation tools"}'),
    ('Precision Castparts',  '{"forgings","castings","fasteners","structural"}'),
    ('Wesco Aircraft',      '{"distribution","fasteners","chemicals","bearings"}')
  on conflict do nothing;

  select id into v_sps    from public.vendors where name = 'SPS Technologies';
  select id into v_cherry from public.vendors where name = 'Cherry Aerospace';
  select id into v_pcc    from public.vendors where name = 'Precision Castparts';
  select id into v_wesco  from public.vendors where name = 'Wesco Aircraft';

  -- Vendor contacts -----------------------------------------------------
  insert into public.vendor_contacts (vendor_id, name, email, phone, role) values
    (v_sps,    'Bill Torres',     'btorres@sps-tech.com',        '860-555-0120', 'Account Manager'),
    (v_cherry, 'Sandra Kim',      'skim@cherryaero.com',         '714-555-0233', 'Sales Rep'),
    (v_pcc,    'Mark Hansen',     'mhansen@precast.com',         '503-555-0188', 'Inside Sales'),
    (v_wesco,  'Diane Crawford',  'dcrawford@wescoaircraft.com', '661-555-0145', 'Distribution Rep')
  on conflict do nothing;

  -- Quotes --------------------------------------------------------------
  -- Q1: Textron — draft, 3 lines
  insert into public.quotes (id, customer_id, status, validity_date, customer_notes, internal_notes)
  values (gen_random_uuid(), c_textron, 'draft', current_date + 30,
    'Per RFQ 2026-0512. Delivery to Wichita plant.',
    'Karen wants pricing by EOW. Check if we can beat last SPS quote.')
  returning id into q1;

  insert into public.quote_lines (quote_id, part_id, qty, unit_price, position) values
    (q1, p_nas1352, 500, 0.42, 1),
    (q1, p_ms21044, 500, 0.28, 2),
    (q1, p_an960,   1000, 0.09, 3);

  -- Q2: Northrop — sent, 4 lines
  insert into public.quotes (id, customer_id, status, validity_date, customer_notes, internal_notes, sent_at)
  values (gen_random_uuid(), c_northrop, 'sent', current_date + 21,
    'Quote per blanket PO NGC-FA-2026-3391.',
    'Volume discount applied. Angela confirmed 8% discount still active.',
    now() - interval '2 days')
  returning id into q2;

  insert into public.quote_lines (quote_id, part_id, qty, unit_price, position) values
    (q2, p_nas6204, 200, 1.85, 1),
    (q2, p_nas1291, 200, 2.10, 2),
    (q2, p_ms20470, 5000, 0.035, 3),
    (q2, p_nas1097, 5000, 0.038, 4);

  -- Q3: L3Harris — won, 2 lines
  insert into public.quotes (id, customer_id, status, validity_date, customer_notes, internal_notes, sent_at)
  values (gen_random_uuid(), c_l3harris, 'won', current_date + 14,
    null,
    'Tom accepted same day. Good margin on this one.',
    now() - interval '5 days')
  returning id into q3;

  insert into public.quote_lines (quote_id, part_id, qty, unit_price, position) values
    (q3, p_nas1801, 100, 4.75, 1),
    (q3, p_ms9321,  250, 1.20, 2);

  -- Q4: Spirit — draft, 2 lines
  insert into public.quotes (id, customer_id, status, validity_date, customer_notes, internal_notes)
  values (gen_random_uuid(), c_spirit, 'draft', current_date + 45,
    'Annual rebid for fuselage fastener kit.',
    'Lisa sent PDF with 47 lines — only two extracted so far, rest in review queue.')
  returning id into q4;

  insert into public.quote_lines (quote_id, part_id, qty, unit_price, position) values
    (q4, p_an525,  1000, 0.52, 1),
    (q4, p_ms51957, 2000, 0.06, 2);

  -- Q5: Ducommun — sent, 3 lines
  insert into public.quotes (id, customer_id, status, validity_date, customer_notes, internal_notes, sent_at)
  values (gen_random_uuid(), c_ducommun, 'sent', current_date + 30,
    'First order — sample quantities for qualification.',
    'New customer, standard pricing. Robert seems responsive.',
    now() - interval '1 day')
  returning id into q5;

  insert into public.quote_lines (quote_id, part_id, qty, unit_price, position) values
    (q5, p_an3,     25,  3.10, 1),
    (q5, p_an310,   50,  0.65, 2),
    (q5, p_an315,   50,  0.38, 3);

  -- Vendor quotes (historical pricing) ----------------------------------
  insert into public.vendor_quotes (vendor_id, part_id, qty, unit_price, lead_time_days, quoted_at, source_note) values
    (v_sps,    p_nas1352, 500,  0.31, 14, now() - interval '10 days', 'Email quote SPS-Q-44821'),
    (v_sps,    p_ms21044, 1000, 0.18, 14, now() - interval '10 days', 'Same email as above'),
    (v_sps,    p_nas6204, 200,  1.40, 21, now() - interval '15 days', 'Phone quote, Bill Torres'),
    (v_sps,    p_nas1291, 500,  1.55, 21, now() - interval '15 days', 'Phone quote, Bill Torres'),
    (v_cherry, p_ms20470, 10000, 0.022, 7, now() - interval '8 days', 'Cherry web portal quote'),
    (v_cherry, p_nas1097, 10000, 0.025, 7, now() - interval '8 days', 'Cherry web portal quote'),
    (v_cherry, p_ms9321,  500,  0.78,  10, now() - interval '12 days', 'Email quote from Sandra'),
    (v_pcc,    p_nas1801, 100,  3.50,  28, now() - interval '20 days', 'Formal bid PCC-2026-1187'),
    (v_wesco,  p_an960,   5000, 0.05,  5,  now() - interval '6 days',  'Stock item, ships from Valencia'),
    (v_wesco,  p_ms51957, 5000, 0.035, 5,  now() - interval '6 days',  'Stock item, ships from Valencia')
  on conflict do nothing;

  -- Delete the old placeholder part if it's still around
  delete from public.parts where internal_pn = 'CAP-1001' and description like '%replace with real%';

end;
$$;
