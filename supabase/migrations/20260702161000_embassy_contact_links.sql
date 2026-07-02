alter table public.emergency_services
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists map_url text,
  add column if not exists office_hours text;

update public.emergency_services
set
  phone = '+4930 25926611',
  website = 'https://kenyaembassyberlin.de',
  address = 'Rheinbabenallee 49, 14199 Berlin, Germany',
  map_url = 'https://kenyanembassyberlin.de/contact-us/#',
  office_hours = 'Mon-Fri 09:00-13:00'
where name = 'Kenyan Embassy Berlin';
