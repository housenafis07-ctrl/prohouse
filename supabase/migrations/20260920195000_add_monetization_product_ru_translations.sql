alter table public.monetization_products
  add column if not exists name_ru text,
  add column if not exists description_ru text,
  add column if not exists badge_ru text;

update public.monetization_products set
  name_ru = case code
    when 'highlight' then 'Выделение'
    when 'premium' then 'Премиум'
    when 'top_1' then 'TOP 1 день'
    when 'top_3' then 'TOP 3 дня'
    when 'top_7' then 'TOP 7 дней'
    when 'top_14' then 'TOP 14 дней'
    when 'top_30' then 'TOP 30 дней'
    when 'up' then 'UP / Поднять'
    else name_ru end,
  description_ru = case code
    when 'highlight' then 'Выделение объявления.'
    when 'premium' then 'Премиальное отображение и приоритетное размещение объявления.'
    when 'top_1' then 'Поднять объявление выше в результатах поиска.'
    when 'top_3' then 'Поднять объявление выше в результатах поиска.'
    when 'top_7' then 'Поднять объявление выше в результатах поиска.'
    when 'top_14' then 'Поднять объявление выше в результатах поиска.'
    when 'top_30' then 'Поднять объявление выше в результатах поиска.'
    when 'up' then 'Однократно поднять объявление на новую позицию.'
    else description_ru end,
  badge_ru = case code
    when 'highlight' then 'Выделение'
    when 'premium' then 'Премиум'
    when 'top_1' then 'TOP'
    when 'top_3' then 'TOP'
    when 'top_7' then 'TOP'
    when 'top_14' then 'TOP'
    when 'top_30' then 'TOP'
    when 'up' then 'UP'
    else badge_ru end
where code in ('highlight','premium','top_1','top_3','top_7','top_14','top_30','up');
