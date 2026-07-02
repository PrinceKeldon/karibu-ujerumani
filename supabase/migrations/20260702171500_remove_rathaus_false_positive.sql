delete from public.rathaus_offices
where source = 'openstreetmap'
  and lower(replace(name, ' ', '')) in ('rathausplatz', 'rathausstraße', 'rathausstrasse');
