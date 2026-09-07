-- Uy-joyni ijaraga berish Xizmatlar bo‘limidan olib tashlanadi.
-- Ijara e’lonlari alohida `rent` bo‘limi orqali joylashtiriladi.
-- Mavjud ma’lumotlar o‘chirilmaydi: taxonomy yozuvi soft-disable qilinadi.

update public.partner_listing_taxonomy
set
  is_active = false,
  allows_partner_listing = false,
  updated_at = now()
where code = 'services_rent';
