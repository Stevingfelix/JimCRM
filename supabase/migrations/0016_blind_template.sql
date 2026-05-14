-- Register the Blind / white-label PDF template so it appears in the
-- template picker on the quote builder.

insert into public.pdf_templates (name, react_component_key, is_default)
values ('Blind (no branding)', 'blind', false)
on conflict do nothing;
