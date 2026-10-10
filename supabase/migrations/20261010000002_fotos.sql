-- Fotos dos chamados no Supabase Storage (bucket privado, até 2 MB, só imagens).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "fotos: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'fotos');

create policy "fotos: envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos');
