-- Publish the first complete public and partner offer texts in Uzbek and Russian.
update public.offer_versions
set is_active = false
where is_active = true;

insert into public.offer_versions(version,title,content,audience,is_active)
values
(2,'RoyalHouse — Ommaviy oferta',$$ROYALHOUSE.UZ
OMMAVIY OFERTA (FOYDALANISH SHARTLARI)
Versiya 2.0
Platforma: https://royalhouse.uz
Operator: “Nafis house group” MChJ, STIR 307797554

O‘ZBEK TILIDAGI MATN

1. UMUMIY QOIDALAR
1.1. Ushbu Ommaviy oferta (keyingi o‘rinlarda — Oferta) RoyalHouse.uz platformasi operatori “Nafis house group” MChJ (keyingi o‘rinlarda — Operator) tomonidan Platformadan foydalanuvchi barcha jismoniy va yuridik shaxslarga yo‘llanadi.
1.2. Platformadan foydalanish, akkaunt yaratish, e’lon joylashtirish, murojaat yuborish, bron qilish yoki tegishli rozilik tugmasini bosish orqali Foydalanuvchi ushbu Ofertani elektron shaklda aksept qiladi. Aksept sanasi, Oferta versiyasi va foydalanuvchi identifikatori elektron qayd etilishi mumkin.
1.3. Ushbu Oferta Platformadan foydalanishning umumiy qoidalarini belgilaydi. Professional e’lon beruvchilar va xizmat ko‘rsatuvchi hamkorlar uchun alohida Hamkorlik ofertasi, bronlar uchun esa ushbu Oferta va bron sahifasida ko‘rsatilgan maxsus shartlar birgalikda qo‘llanadi.
1.4. Foydalanuvchi Oferta bilan rozi bo‘lmasa, Platformadan foydalanishni va tegishli elektron xizmatlarni buyurtma qilishni to‘xtatishi lozim.

2. ATAMALAR
2.1. Platforma — RoyalHouse.uz sayti, mobil/PWA interfeysi, Telegram Mini App va Operatorning rasmiy elektron xizmatlari.
2.2. Foydalanuvchi — Platformaga kiruvchi, ma’lumot ko‘ruvchi, ro‘yxatdan o‘tuvchi, e’lon joylashtiruvchi, murojaat yuboruvchi yoki bron qiluvchi shaxs.
2.3. E’lon — ko‘chmas mulkni sotish, sotib olish, ijaraga berish/olish yoki dam olish obyektlari va xizmatlari haqidagi axborot.
2.4. Hamkor — Platformada professional yoki tijorat maqsadida e’lon joylashtiruvchi, obyekt yoki xizmat taklif qiluvchi shaxs. Hamkorlar bilan munosabatlar Hamkorlik ofertasi bilan ham tartibga solinadi.
2.5. Bron — dam olish obyektini tanlangan sana va shartlarda band qilish uchun Platformada rasmiylashtiriladigan buyurtma.

3. PLATFORMANING XIZMATLARI
3.1. RoyalHouse ko‘chmas mulk e’lonlarini joylashtirish va ko‘rish, qidirish va filtrlash, xarita orqali obyektlarni ko‘rish, e’lon egasi bilan bog‘lanish, tavsiyalar va oxirgi ko‘rilgan e’lonlardan foydalanish imkoniyatlarini taqdim etishi mumkin.
3.2. Platformada yangi qurilish loyihalari, turar joy majmualari, binolar va xonadonlar haqidagi ma’lumotlar, shuningdek Developer va professional hamkorlar uchun alohida kabinet funksiyalari mavjud bo‘lishi mumkin.
3.3. “Dam olish” yo‘nalishi quyidagi kategoriyalarni qamrab oladi: “Dacha, kottej, villa”; “Resort va mehmonxona”; “Glamping, SPA va boshqa noyob dam olish joylari”. Obyekt mavjudligi, narxi va bron shartlari tegishli e’lon va bron sahifasida ko‘rsatiladi.
3.4. Platformada akkaunt, telefon raqami orqali SMS tasdiqlash, qo‘llab-quvvatlanadigan qurilma va brauzerlarda Passkey, Telegram bot xabarnomalari, PWA va boshqa funksiyalar mavjud bo‘lishi mumkin. Funksiyalar texnik imkoniyat va xavfsizlik talablariga bog‘liq.
3.5. RoyalHouse ayrim e’lonlarni ilgari surish, reklama, maxsus ko‘rinish, obuna yoki boshqa pulli xizmatlarni taklif qilishi mumkin. Xizmat narxi va amal qilish muddati buyurtma berishdan oldin ko‘rsatiladi.

4. ROYALHOUSE’NING MAQOMI
4.1. Agar alohida yozma shartnomada boshqacha belgilanmagan bo‘lsa, RoyalHouse e’londa ko‘rsatilgan ko‘chmas mulkning mulkdori, sotuvchisi, ijaraga beruvchisi, quruvchisi yoki dam olish obyektining operatori hisoblanmaydi.
4.2. Ko‘chmas mulkni sotish, sotib olish yoki ijaraga berish bo‘yicha bitim Foydalanuvchi va tegishli e’lon beruvchi o‘rtasida mustaqil tuziladi. RoyalHouse bunday bitimning narxi, huquqiy rasmiylashtirilishi, obyekt holati yoki tomonlar majburiyatlari bajarilishini kafolatlamaydi.
4.3. E’lon mazmuni, obyektga bo‘lgan huquq, narx, mavjudlik va taqdim etiladigan xizmatlar uchun e’lon beruvchi javob beradi. RoyalHouse shikoyat yoki qonunbuzarlik alomatlari bo‘yicha e’lonni tekshirishi, cheklashi yoki olib tashlashi mumkin.
4.4. Platformadagi qidiruv natijalari, reyting, tavsiya yoki e’lonlar tartibi avtomatik mezonlar, foydalanuvchi so‘rovi, dolzarblik, pulli ilgari surish va boshqa omillarga bog‘liq bo‘lishi mumkin. Pulli joylashtirish mavjud bo‘lsa, u tegishli tarzda belgilanadi.

5. RO‘YXATDAN O‘TISH VA AKKAUNT XAVFSIZLIGI
5.1. Ayrim funksiyalardan foydalanish uchun telefon raqamini SMS-kod bilan tasdiqlash va profil ma’lumotlarini kiritish talab qilinadi.
5.2. Foydalanuvchi to‘g‘ri va dolzarb ma’lumot taqdim etishi, akkauntga kirish vositalarini sir saqlashi va o‘z akkaunti orqali amalga oshirilgan harakatlar xavfsizligini ta’minlashi shart.
5.3. Foydalanuvchi telefon raqami, SMS-kod, parol, Passkey yoki qurilmasiga kirish huquqini uchinchi shaxslarga bermasligi kerak. Ruxsatsiz kirish gumoni bo‘lsa, Operatorga darhol xabar beriladi.
5.4. RoyalHouse xavfsizlik, firibgarlikning oldini olish yoki qonuniy talablarni bajarish uchun akkauntni vaqtincha cheklashi va qo‘shimcha tasdiqlash so‘rashi mumkin.

6. E’LONLAR VA FOYDALANUVCHI MAJBURIYATLARI
6.1. E’lon beruvchi joylashtirayotgan ma’lumotlarning haqqoniyligi, fotosurat va videolardan foydalanish huquqi, obyektni taklif qilish vakolati va e’lonning qonuniyligi uchun javob beradi.
6.2. E’londa narx, manzil/hudud, obyekt turi, maydon, holat, mavjudlik va Foydalanuvchi qaroriga ta’sir qiladigan muhim shartlar to‘g‘ri ko‘rsatilishi kerak.
6.3. Soxta, takroriy, chalg‘ituvchi, boshqa shaxs huquqlarini buzuvchi yoki qonun bilan taqiqlangan e’lonlar joylashtirish mumkin emas.
6.4. E’lon beruvchi narx yoki mavjudlik o‘zgarganda ma’lumotni yangilaydi, obyekt mavjud bo‘lmasa e’lonni vaqtida to‘xtatadi va murojaatlarga halol javob beradi.
6.5. Foydalanuvchi Platformadan noqonuniy faoliyat, spam, firibgarlik, zararli dastur tarqatish, ruxsatsiz ma’lumot yig‘ish yoki Platforma xavfsizligini buzish uchun foydalanmasligi shart.

7. DAM OLISH OBYEKTLARINI BRON QILISH
7.1. Bron qilishda obyekt, sanalar, mehmonlar soni, narx, minimal tunash muddati, kirish-chiqish vaqti, depozit, qo‘shimcha mehmon haqi va boshqa muhim shartlar bron sahifasida ko‘rsatiladi.
7.2. Bronni tasdiqlash uchun, bron sahifasida boshqacha ko‘rsatilmagan bo‘lsa, umumiy bron qiymatining 10 foizi miqdorida avans to‘lanadi. Avans to‘lov provayderi tasdiqlagandan keyin bron tasdiqlanadi va sana kalendarda band qilinadi.
7.3. Avans 15 (o‘n besh) daqiqa ichida muvaffaqiyatli to‘lanmasa, bron avtomatik bekor qilinishi va vaqtinchalik bandlik olib tashlanishi mumkin.
7.4. Qolgan 90 foiz, bron sahifasida boshqacha tartib ko‘rsatilmagan bo‘lsa, bevosita Hamkorga to‘lanadi. RoyalHouse ushbu summani o‘zi qabul qilmagan bo‘lsa, uning to‘langanini tasdiqlamaydi.
7.5. Mijoz bronni boshlanishiga kamida 72 soat qolganda bekor qilsa, avansning 15 foizi ushlab qolinadi va qolgan 85 foizi qaytariladi. 15 foiz bron umumiy qiymatidan emas, faqat avans summasidan hisoblanadi.
7.6. Bron boshlanishiga 72 soatdan kam vaqt qolganida odatiy tartibda avans qaytarilmaydi, qonunchilikda majburiy nazarda tutilgan holatlar yoki Operator tasdiqlagan istisnolar bundan mustasno.
7.7. Hamkor aybi bilan obyekt taqdim etilmasa yoki e’londagi muhim shartlar bajarilmasa, Mijozga avansning 100 foizi qaytariladi.
7.8. Qaytarish so‘rovi tegishli to‘lov provayderiga yuboriladi. Mablag‘ning hisobga tushish muddati bank yoki to‘lov provayderiga bog‘liq. Qaytarish summasi va sababi Platformada qayd etilishi mumkin.
7.9. Bronni rasmiylashtirishdan oldin ko‘rsatilgan maxsus shartlar ushbu umumiy qoidalarni to‘ldiradi. Qonunchilikdagi majburiy iste’molchi huquqlari cheklanmaydi.

8. TO‘LOVLAR VA PULLI XIZMATLAR
8.1. Platformadagi pulli xizmatlar narxi, muddati, tarkibi va bekor qilish shartlari buyurtma berishdan oldin ko‘rsatiladi.
8.2. To‘lov Payme, Click, bank yoki Platformada mavjud boshqa qonuniy to‘lov vositalari orqali amalga oshirilishi mumkin. To‘lov bank yoki provayder tasdiqlaganidan keyin muvaffaqiyatli hisoblanadi.
8.3. To‘lov qaytarilishi qonunchilik, xizmatning amalda ko‘rsatilgan qismi, buyurtma shartlari va provayder qoidalari asosida amalga oshiriladi. Qonunda belgilangan huquqlar saqlanadi.
8.4. Foydalanuvchi to‘lov rekvizitlari va tranzaksiya ma’lumotlarini uchinchi shaxslardan himoya qilishi kerak.

9. XABARNOMALAR VA MARKETING
9.1. RoyalHouse akkaunt, e’lon, murojaat, bron, to‘lov, qaytarish, xavfsizlik va texnik holatlar bo‘yicha xizmat xabarnomalarini sayt, elektron pochta, SMS yoki foydalanuvchi bog‘lagan Telegram bot orqali yuborishi mumkin.
9.2. Platforma faoliyati doirasida e’lonlar, platforma yangiliklari, reklama materiallari va maxsus takliflar ham yuborilishi mumkin. Bunday xabarlar amaldagi qonunchilik va foydalanuvchi tanlagan aloqa kanali sozlamalariga muvofiq yuboriladi.
9.3. Foydalanuvchi marketing xabarlarini tegishli kanal sozlamalari yoki Operatorga murojaat qilish orqali to‘xtatishni so‘rashi mumkin. Xizmat va xavfsizlikka oid zarur xabarnomalar bundan mustasno.

10. SHAXSIY MA’LUMOTLAR
10.1. Shaxsga doir ma’lumotlarni yig‘ish, saqlash, qayta ishlash, uzatish va himoya qilish tartibi Platformaning Maxfiylik siyosatida belgilanadi.
10.2. Foydalanuvchi boshqa shaxslarning ma’lumotlarini qonuniy asossiz joylashtirmasligi yoki tarqatmasligi kerak.
10.3. RoyalHouse ma’lumotlarni akkauntni boshqarish, e’lonlar, qidiruv, tavsiyalar, murojaatlar, bron, to‘lov, xavfsizlik, texnik yordam, statistika va qonuniy majburiyatlarni bajarish uchun zarur doirada qayta ishlashi mumkin.

11. INTELLEKTUAL MULK
11.1. Platformaning dasturiy ta’minoti, dizayni, logotipi va Operatorga tegishli boshqa materiallardan qonuniy ruxsatsiz nusxa olish, tarqatish yoki tijorat maqsadida foydalanish taqiqlanadi.
11.2. Foydalanuvchi joylashtirgan kontentga bo‘lgan huquqlar Foydalanuvchida qoladi. Foydalanuvchi RoyalHouse’ga ushbu kontentni Platformada joylashtirish, namoyish etish, formatlash, qidiruvda ko‘rsatish va xizmatni targ‘ib qilish uchun zarur bo‘lgan, bepul, oddiy (mutlaq bo‘lmagan) foydalanish ruxsatini beradi. Bu ruxsat e’lon Platformadan olib tashlanganda yoki qonuniy talab bo‘yicha cheklanadi.

12. XIZMATNING UZLUKSIZLIGI VA JAVOBGARLIK
12.1. RoyalHouse Platformani ishlatish va xavfsizligini ta’minlash uchun oqilona choralar ko‘radi, biroq uzluksiz yoki xatosiz ishlashni kafolatlamaydi.
12.2. Internet, aloqa operatorlari, banklar, to‘lov provayderlari va boshqa uchinchi tomon xizmatlaridagi uzilishlar Operatorning bevosita nazoratidan tashqarida bo‘lishi mumkin.
12.3. Har bir tomon o‘z aybi va qonunchilikka muvofiq javob beradi. Hech bir band Operatorni qonun bo‘yicha zimmasiga yuklatilgan majburiyatlardan ozod qilmaydi.
12.4. Foydalanuvchi va e’lon beruvchi o‘rtasidagi bitim, obyektning real holati, mulk huquqi, qurilish sifati yoki xizmat ko‘rsatish uchun tegishli e’lon beruvchi/Hamkor javob beradi.

13. CHEKLASH VA AKKAUNTNI YOPISH
13.1. Qonun, Oferta yoki Platforma qoidalari buzilganda, soxta ma’lumot yoki firibgarlik alomatlari aniqlanganda Operator e’lonni yashirishi, akkaunt funksiyalarini vaqtincha cheklashi yoki akkauntni bloklashi mumkin.
13.2. Foydalanuvchi akkauntini yopishni so‘rashi mumkin. Akkaunt yopilishi avval yuzaga kelgan to‘lov, bron, qaytarish, nizolar va qonuniy saqlash majburiyatlarini bekor qilmaydi.

14. FORS-MAJOR VA NIZOLAR
14.1. Tomonlar nazoratidan tashqaridagi, oldindan oqilona ko‘rib bo‘lmaydigan va bartaraf etib bo‘lmaydigan holatlar bo‘yicha javobgarlik qonunchilikka muvofiq belgilanadi.
14.2. Nizolar avvalo muzokara va yozma murojaat orqali hal etiladi. Kelishuvga erishilmasa, nizo O‘zbekiston Respublikasi qonunchiligiga muvofiq vakolatli sudda ko‘riladi.

15. OFERTA O‘ZGARISHLARI VA OPERATOR REKVIZITLARI
15.1. Operator Ofertaga o‘zgartirish kiritishi mumkin. Yangi tahrir Platformada e’lon qilinadi va ko‘rsatilgan sanadan kuchga kiradi. Muhim o‘zgarishlar bo‘yicha Foydalanuvchidan qayta aksept talab qilinishi mumkin.
15.2. Avval tasdiqlangan bronlarga bron rasmiylashtirilgan vaqtdagi shartlar, qonunchilikda boshqacha talab bo‘lmasa, tatbiq etiladi.
15.3. Operator: “Nafis house group” MChJ; STIR 307797554; manzil: Toshkent viloyati, Yangiyo‘l shahri, Navro‘z MFY, Samarqand ko‘chasi, 155-uy; hisob raqami 20208000905288969001; MFO 00450; e-mail: housenafis07@gmail.com; telefon: +998 99 824 44 94; sayt: https://royalhouse.uz.

РУССКИЙ ТЕКСТ

1. ОБЩИЕ ПОЛОЖЕНИЯ
1.1. Настоящая Публичная оферта (далее — Оферта) адресована всем физическим и юридическим лицам, использующим платформу RoyalHouse.uz. Оператор платформы — ООО «Nafis house group» (далее — Оператор).
1.2. Используя Платформу, создавая аккаунт, размещая объявление, отправляя заявку, оформляя бронирование или нажимая кнопку согласия, Пользователь акцептует настоящую Оферту в электронной форме. Дата акцепта, версия Оферты и идентификатор пользователя могут фиксироваться в электронном виде.
1.3. Оферта устанавливает общие правила использования Платформы. Для профессиональных рекламодателей и поставщиков услуг дополнительно применяется отдельная Оферта для партнёров, а для бронирований — специальные условия, показанные на странице бронирования.
1.4. Если Пользователь не согласен с Офертой, он должен прекратить использование Платформы и оформление соответствующих электронных услуг.

2. ТЕРМИНЫ
2.1. Платформа — сайт RoyalHouse.uz, мобильный/PWA-интерфейс, Telegram Mini App и официальные электронные сервисы Оператора.
2.2. Пользователь — лицо, просматривающее информацию, регистрирующееся, размещающее объявление, отправляющее заявку или оформляющее бронирование.
2.3. Объявление — информация о продаже, покупке или аренде недвижимости, а также об объектах и услугах для отдыха.
2.4. Партнёр — лицо, размещающее объявления или предлагающее объекты/услуги в профессиональных или коммерческих целях. Отношения с Партнёрами также регулируются отдельной Офертой для партнёров.
2.5. Бронирование — заказ на резервирование объекта отдыха на выбранные даты и на указанных условиях.

3. УСЛУГИ ПЛАТФОРМЫ
3.1. RoyalHouse может предоставлять возможность размещать и просматривать объявления о недвижимости, искать и фильтровать объекты, просматривать их на карте, связываться с рекламодателем, пользоваться рекомендациями и историей недавно просмотренных объявлений.
3.2. На Платформе могут размещаться сведения о новых строительных проектах, жилых комплексах, зданиях и квартирах, а также функции кабинета застройщика и профессиональных партнёров.
3.3. Направление «Отдых» включает категории: «Дача, коттедж, вилла»; «Курорты и гостиницы»; «Глэмпинг, SPA и другие уникальные места отдыха». Доступность объекта, цена и условия бронирования указываются в объявлении и на странице бронирования.
3.4. Платформа может поддерживать аккаунт, подтверждение номера телефона по SMS, Passkey на совместимых устройствах и в браузерах, уведомления Telegram, PWA и другие функции. Их доступность зависит от технических возможностей и требований безопасности.
3.5. RoyalHouse может предлагать продвижение объявлений, рекламу, выделенное отображение, подписки и другие платные услуги. Цена и срок действия указываются до оформления заказа.

4. СТАТУС ROYALHOUSE
4.1. Если иное прямо не предусмотрено отдельным письменным договором, RoyalHouse не является собственником, продавцом, арендодателем недвижимости, застройщиком или оператором объекта отдыха, указанного в объявлении.
4.2. Сделки купли-продажи или аренды недвижимости заключаются непосредственно между Пользователем и соответствующим рекламодателем. RoyalHouse не гарантирует цену, юридическое оформление сделки, состояние объекта или исполнение обязательств сторонами.
4.3. За содержание объявления, права на объект, цену, доступность и предоставляемые услуги отвечает рекламодатель. RoyalHouse вправе проверять жалобы и признаки нарушений, ограничивать или удалять объявления.
4.4. Порядок поисковой выдачи, рейтинг и рекомендации могут зависеть от автоматических критериев, запроса пользователя, актуальности, платного продвижения и иных факторов. Платное размещение, если оно используется, обозначается соответствующим образом.

5. РЕГИСТРАЦИЯ И БЕЗОПАСНОСТЬ АККАУНТА
5.1. Для отдельных функций может потребоваться подтверждение номера телефона SMS-кодом и заполнение профиля.
5.2. Пользователь обязан предоставлять достоверные и актуальные сведения, хранить средства доступа к аккаунту в тайне и обеспечивать безопасность действий, совершаемых через его аккаунт.
5.3. Пользователь не должен передавать третьим лицам номер телефона, SMS-код, пароль, Passkey или доступ к своему устройству. О подозрении на несанкционированный доступ необходимо немедленно сообщить Оператору.
5.4. В целях безопасности, предотвращения мошенничества и исполнения требований закона RoyalHouse может временно ограничить аккаунт или запросить дополнительное подтверждение.

6. ОБЪЯВЛЕНИЯ И ОБЯЗАННОСТИ ПОЛЬЗОВАТЕЛЯ
6.1. Размещающий объявление Пользователь отвечает за достоверность информации, право использования фотографий и видео, полномочия предлагать объект и законность объявления.
6.2. В объявлении должны быть корректно указаны цена, местоположение/район, тип объекта, площадь, состояние, доступность и иные существенные сведения.
6.3. Запрещено размещать фиктивные, повторяющиеся, вводящие в заблуждение объявления, материалы, нарушающие права третьих лиц, или запрещённый законом контент.
6.4. При изменении цены или доступности рекламодатель обновляет информацию, своевременно снимает недоступный объект с публикации и добросовестно отвечает на обращения.
6.5. Запрещается использовать Платформу для незаконной деятельности, спама, мошенничества, распространения вредоносного ПО, незаконного сбора данных или нарушения безопасности Платформы.

7. БРОНИРОВАНИЕ ОБЪЕКТОВ ОТДЫХА
7.1. При бронировании на странице заказа указываются объект, даты, количество гостей, цена, минимальный срок проживания, время заезда/выезда, депозит, доплата за дополнительных гостей и иные существенные условия.
7.2. Для подтверждения бронирования, если на странице бронирования не указано иное, оплачивается аванс в размере 10% от общей стоимости. После подтверждения платежа провайдером бронирование подтверждается, а дата блокируется в календаре.
7.3. Если аванс не оплачен успешно в течение 15 (пятнадцати) минут, бронирование может быть автоматически отменено, а временная блокировка даты снята.
7.4. Оставшиеся 90%, если на странице бронирования не установлен иной порядок, оплачиваются непосредственно Партнёру. Если RoyalHouse не принимал эту сумму, он не подтверждает факт её оплаты.
7.5. При отмене бронирования не менее чем за 72 часа до его начала удерживается 15% от суммы аванса, а оставшиеся 85% аванса возвращаются. 15% рассчитываются от суммы аванса, а не от общей стоимости бронирования.
7.6. Если до начала бронирования осталось менее 72 часов, обычный возврат аванса не производится, за исключением обязательных случаев, предусмотренных законом, или исключений, подтверждённых Оператором.
7.7. Если объект не предоставлен по вине Партнёра либо не соблюдены существенные условия объявления, Пользователю возвращается 100% аванса.
7.8. Запрос на возврат направляется соответствующему платёжному провайдеру. Срок зачисления средств зависит от банка или провайдера. Сумма и причина возврата могут фиксироваться на Платформе.
7.9. Специальные условия, показанные до оформления бронирования, дополняют настоящие общие правила. Обязательные права потребителей, установленные законом, не ограничиваются.

8. ПЛАТЕЖИ И ПЛАТНЫЕ УСЛУГИ
8.1. Цена, срок, состав и условия отмены платных услуг указываются до оформления заказа.
8.2. Оплата может осуществляться через Payme, Click, банк или иные доступные на Платформе законные способы. Платёж считается успешным после подтверждения банком или провайдером.
8.3. Возврат средств осуществляется с учётом закона, фактически оказанной части услуги, условий заказа и правил провайдера. Права, предусмотренные законом, сохраняются.
8.4. Пользователь обязан защищать платёжные реквизиты и сведения о транзакциях от третьих лиц.

9. УВЕДОМЛЕНИЯ И МАРКЕТИНГ
9.1. RoyalHouse может направлять сервисные уведомления об аккаунте, объявлениях, обращениях, бронировании, оплате, возвратах, безопасности и техническом состоянии через сайт, электронную почту, SMS или подключённый Пользователем Telegram-бот.
9.2. В рамках деятельности Платформы могут направляться объявления, новости Платформы, рекламные материалы и специальные предложения. Такие сообщения направляются в соответствии с законом и настройками выбранного Пользователем канала связи.
9.3. Пользователь может отказаться от маркетинговых сообщений через настройки соответствующего канала или обратившись к Оператору. Это не относится к необходимым сервисным и защитным уведомлениям.

10. ПЕРСОНАЛЬНЫЕ ДАННЫЕ
10.1. Порядок сбора, хранения, обработки, передачи и защиты персональных данных определяется Политикой конфиденциальности Платформы.
10.2. Пользователь не должен размещать или распространять данные других лиц без законного основания.
10.3. RoyalHouse может обрабатывать данные в необходимом объёме для управления аккаунтом, объявлений, поиска, рекомендаций, обращений, бронирования, платежей, безопасности, технической поддержки, статистики и исполнения требований закона.

11. ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ
11.1. Запрещается без законного разрешения копировать, распространять или использовать в коммерческих целях программное обеспечение, дизайн, логотип и другие материалы Платформы, принадлежащие Оператору.
11.2. Права на контент, размещённый Пользователем, сохраняются за Пользователем. Пользователь предоставляет RoyalHouse бесплатное неисключительное разрешение, необходимое для размещения, показа, форматирования, поиска и продвижения такого контента в рамках работы Платформы. Разрешение ограничивается при удалении объявления или по законному требованию.

12. НЕПРЕРЫВНОСТЬ СЕРВИСА И ОТВЕТСТВЕННОСТЬ
12.1. RoyalHouse принимает разумные меры для обеспечения работы и безопасности Платформы, но не гарантирует её непрерывную или безошибочную работу.
12.2. Сбои интернета, операторов связи, банков, платёжных провайдеров и иных сторонних сервисов могут находиться вне прямого контроля Оператора.
12.3. Каждая сторона отвечает в пределах своей вины и требований закона. Ни одно положение не освобождает Оператора от обязательств, возложенных на него законом.
12.4. За сделку между Пользователем и рекламодателем, фактическое состояние объекта, право собственности, качество строительства и оказание услуги отвечает соответствующий рекламодатель/Партнёр.

13. ОГРАНИЧЕНИЕ ДОСТУПА И ЗАКРЫТИЕ АККАУНТА
13.1. При нарушении закона, Оферты или правил Платформы, выявлении недостоверных сведений или признаков мошенничества Оператор может скрыть объявление, временно ограничить функции аккаунта или заблокировать его.
13.2. Пользователь может запросить закрытие аккаунта. Закрытие аккаунта не прекращает ранее возникшие обязательства по оплате, бронированию, возвратам, спорам и законному хранению данных.

14. ФОРС-МАЖОР И СПОРЫ
14.1. Ответственность за обстоятельства вне контроля сторон, которые нельзя было разумно предвидеть или предотвратить, определяется законодательством.
14.2. Споры сначала разрешаются путём переговоров и письменных обращений. При отсутствии соглашения спор рассматривается компетентным судом в соответствии с законодательством Республики Узбекистан.

15. ИЗМЕНЕНИЕ ОФЕРТЫ И РЕКВИЗИТЫ ОПЕРАТОРА
15.1. Оператор вправе изменять Оферту. Новая редакция публикуется на Платформе и вступает в силу с указанной даты. При существенных изменениях может потребоваться повторный акцепт Пользователя.
15.2. К ранее подтверждённым бронированиям применяется редакция условий, действовавшая на момент оформления бронирования, если иное не требуется законом.
15.3. Оператор: ООО «Nafis house group»; ИНН 307797554; адрес: Республика Узбекистан, Ташкентская область, город Янгиюль, МФЙ Навруз, улица Самарканд, дом 155; расчётный счёт 20208000905288969001; МФО 00450; e-mail: housenafis07@gmail.com; телефон: +998 99 824 44 94; сайт: https://royalhouse.uz.$$,'public',true),
(1,'RoyalHouse — Hamkorlik ofertasi',$$ROYALHOUSE.UZ
HAMKORLIK TO‘G‘RISIDAGI OMMAVIY OFERTA
Ko‘chmas mulk, yangi qurilish loyihalari va dam olish obyektlari bo‘yicha hamkorlar uchun
Versiya 2.0

O‘ZBEK TILIDAGI MATN

1. UMUMIY QOIDALAR
1.1. Ushbu Oferta RoyalHouse.uz operatori “Nafis house group” MChJ, STIR 307797554 (Operator) tomonidan Platformada professional yoki tijorat maqsadida e’lon joylashtiruvchi jismoniy shaxslar, YaTT va yuridik shaxslarga (Hamkor) yo‘llanadi.
1.2. Hamkor “Ofertani qabul qilaman” tugmasini bosish, tegishli katakchani belgilash yoki boshqa aniq elektron tasdiqlash orqali Ofertani aksept qiladi. Aksept sanasi, Hamkor identifikatori va Oferta versiyasi qayd etilishi mumkin.
1.3. Oferta Hamkorning ro‘yxatdan o‘tishi, e’lon joylashtirishi, professional kabinetdan foydalanishi, murojaatlarni qabul qilishi, bronlarni yuritishi, pulli xizmatlardan foydalanishi va javobgarligini tartibga soladi.
1.4. Mijozlar uchun Ommaviy oferta, Maxfiylik siyosati va bron sahifasida ko‘rsatilgan shartlar ham qo‘llanadi.

2. XIZMATLAR VA PLATFORMANING MAQOMI
2.1. RoyalHouse Hamkorga ko‘chmas mulk, yangi qurilish loyihalari va dam olish obyektlari haqidagi ma’lumotlarni joylashtirish, potensial mijozlardan murojaat olish, obyekt va loyihalarni boshqarish hamda Platforma funksiyalaridan foydalanish imkonini beradi.
2.2. Professional/Developer kabinetida kompaniya profili, turar joy majmualari, binolar, xonadonlar, foto/video, hujjatlar, murojaatlar (leadlar), statistika va mavjud bo‘lsa ommaviy Excel import funksiyalari bo‘lishi mumkin.
2.3. Dam olish yo‘nalishi uchta kategoriya: “Dacha, kottej, villa”; “Resort va mehmonxona”; “Glamping, SPA va boshqa noyob dam olish joylari”.
2.4. Alohida yozma shartnoma bo‘lmasa, RoyalHouse obyekt mulkdori, sotuvchisi, ijaraga beruvchisi, quruvchi yoki xizmat ko‘rsatuvchi emas; u elektron platforma va vositalarni taqdim etadi. Bitim va xizmatni bevosita bajarish Hamkor zimmasida.

3. HAMKORNING MAJBURIYATLARI
3.1. Hamkor obyekt, loyiha yoki xizmatni taklif qilish uchun qonuniy huquq va vakolatlarga ega bo‘lishi, Operator so‘roviga ko‘ra mulk, ijara, vakillik, kompaniya, litsenziya yoki boshqa tasdiqlovchi hujjatlarni taqdim etishi shart.
3.2. E’londagi narx, manzil, maydon, holat, mavjudlik, qurilish bosqichi, topshirish muddati, to‘lov rejasi, obyekt sig‘imi, qulayliklar va boshqa muhim ma’lumotlar haqqoniy va dolzarb bo‘lishi kerak.
3.3. Hamkor faqat foydalanish huquqiga ega bo‘lgan foto, video, loyiha chizmasi, hujjat va tovar belgilarini joylashtiradi; uchinchi shaxslar huquqlarini buzmasligi shart.
3.4. Narx yoki mavjudlik o‘zgarganda e’lonni yangilaydi, sotilgan yoki mavjud bo‘lmagan obyektni faol holatda qoldirmaydi va murojaatlarga oqilona muddatda javob beradi.
3.5. Developer loyihalar, majmualar, binolar va xonadonlar bo‘yicha ma’lumotlar, sotuv statuslari, narxlar, chizmalar, hujjatlar va import qilingan yozuvlarning to‘g‘riligi uchun javob beradi.
3.6. Hamkor Platformadan kelgan mijoz bilan Platforma komissiyasi yoki qoidalarini chetlab o‘tish maqsadida yashirin bitim tuzmasligi, tasdiqlangan bron sanasini boshqa mijozga bermasligi shart.

4. E’LONLARNI MODERATSIYA QILISH
4.1. RoyalHouse e’lonni tekshirishi, qo‘shimcha hujjat so‘rashi, tahrirga qaytarishi, vaqtincha yashirishi yoki qonun, Oferta va Platforma qoidalariga zid bo‘lsa olib tashlashi mumkin.
4.2. Soxta, takroriy, chalg‘ituvchi, huquqni buzuvchi yoki ruxsatsiz e’lonlar taqiqlanadi.
4.3. Moderatsiya e’lon mazmunining haqqoniyligi uchun Hamkor javobgarligini bekor qilmaydi.

5. TARIFLAR VA PULLI XIZMATLAR
5.1. E’lon joylashtirish limitlari, bepul hajm, obuna, reklama, ilgari surish va professional funksiyalar narxi xizmat buyurtma qilinishidan oldin Platformada yoki alohida kelishuvda ko‘rsatiladi.
5.2. Ko‘chmas mulk e’lonlari yoki Developer xizmatlari bo‘yicha komissiya faqat tegishli tarif yoki alohida kelishuvda aniq belgilangan bo‘lsa undiriladi. Ushbu Oferta ko‘chmas mulk bitimi qiymatidan avtomatik komissiya belgilamaydi.
5.3. To‘lov bank yoki to‘lov provayderi tasdiqlaganidan keyin muvaffaqiyatli hisoblanadi. Qaytarish buyurtma shartlari va qonunchilik asosida amalga oshiriladi.
5.4. Hamkor o‘z faoliyati bo‘yicha soliqlar, hisob-fakturalar, chek va boshqa majburiy hujjatlarni rasmiylashtirish uchun javob beradi.

6. DAM OLISH OBYEKTLARI BO‘YICHA BRON
6.1. Hamkor obyektni ijaraga berish yoki xizmat ko‘rsatish huquqiga ega bo‘lishi, real fotosuratlar, narx, mavjud sanalar, sig‘im, kirish-chiqish vaqti, minimal tunash muddati, depozit, qo‘shimcha mehmon haqi va foydalanish qoidalarini ko‘rsatishi shart.
6.2. Bronning umumiy qiymati tanlangan sanalar, kunlik yoki oylik tarif, mehmonlar soni, qo‘shimcha xizmatlar va bron sahifasida ko‘rsatilgan boshqa shartlar asosida hisoblanadi.
6.3. Bronni tasdiqlash uchun Mijoz, bron sahifasida boshqacha ko‘rsatilmagan bo‘lsa, umumiy qiymatning 10 foizi miqdorida avans to‘laydi. Avans RoyalHouse komissiyasini qoplashga yo‘naltiriladi. RoyalHouse komissiyasi bron umumiy qiymatining 10 foizini tashkil etadi.
6.4. Avans to‘lov provayderi tomonidan tasdiqlangach bron tasdiqlanadi va sana kalendarda band qilinadi. Avans 15 daqiqa ichida to‘lanmasa, bron bekor qilinishi va vaqtinchalik bandlik olib tashlanishi mumkin.
6.5. Qolgan 90 foiz, bron sahifasida boshqacha ko‘rsatilmagan bo‘lsa, Mijoz tomonidan bevosita Hamkorga to‘lanadi. Qolgan to‘lovni qabul qilish, chek berish va soliqlarni hisobga olish Hamkor zimmasida.
6.6. Mijoz bronni boshlanishiga kamida 72 soat qolganda bekor qilsa, avansning 15 foizi ushlab qolinadi va 85 foizi qaytariladi. Ushlab qolinadigan summa faqat avansdan hisoblanadi.
6.7. Bron boshlanishiga 72 soatdan kam vaqt qolganida odatiy tartibda avans qaytarilmaydi, qonunchilikda majburiy belgilangan holatlar yoki Operator tasdiqlagan istisnolar bundan mustasno.
6.8. Hamkor aybi bilan obyekt taqdim etilmasa, boshqa mijozga berilsa yoki e’londagi muhim shartlar bajarilmasa, Mijozga avansning 100 foizi qaytariladi. Hamkor qaytarilgan avansni RoyalHouse’ga qoplaydi va bank/provayder qaytarmagan, haqiqatda yuzaga kelgan hamda hujjatlar bilan tasdiqlangan qaytarish xarajatlarini qoplaydi.
6.9. Hamkor tasdiqlangan bronni bekor qilish zarurati tug‘ilganda RoyalHouse va Mijozni darhol xabardor qiladi. Hamkor aybi bilan bekor qilingan bron bo‘yicha RoyalHouse komissiyasi yakuniy daromad sifatida saqlanmaydi.
6.10. Hamkor kalendardagi band sanalarni yangilaydi, mavjud bo‘lmagan sanani ochiq qoldirmaydi va tasdiqlangan sanani boshqa mijozga bermaydi.

7. MUROJAATLAR VA MIJOZ MA’LUMOTLARI
7.1. Hamkor Platforma orqali olingan murojaat ma’lumotlaridan faqat murojaatga javob berish, obyektni ko‘rsatish, bitim yoki bronni bajarish va qonuniy majburiyatlar uchun foydalanadi.
7.2. Mijoz ma’lumotlarini roziliksiz reklama maqsadida tarqatish, sotish yoki qonunga xilof ravishda uchinchi shaxslarga berish taqiqlanadi.
7.3. Hamkor o‘z xodimlariga faqat zarur kabinet ruxsatlarini beradi va ularning harakatlari uchun javob beradi.

8. AKKAUNT VA XAVFSIZLIK
8.1. Hamkor profil va kompaniya ma’lumotlarini to‘g‘ri saqlaydi, kirish vositalarini himoya qiladi va ruxsatsiz kirish gumoni bo‘lsa Operatorni darhol xabardor qiladi.
8.2. Hamkor login, SMS-kod, parol yoki Passkey ma’lumotlarini uchinchi shaxslarga bermasligi shart.

9. ROYALHOUSE’NING HUQUQ VA MAJBURIYATLARI
9.1. RoyalHouse Platforma funksiyalarini texnik imkoniyatlar doirasida taqdim etadi, murojaat va bronlarni elektron qayd etadi hamda mavjud to‘lov integratsiyalari orqali to‘lov holatini aks ettiradi.
9.2. Operator qonunbuzarlik, firibgarlik, soxta ma’lumot, huquqiy vakolat yo‘qligi yoki xavfsizlikka tahdid aniqlansa, e’lonni yoki kabinet funksiyalarini cheklashi mumkin.
9.3. RoyalHouse qidiruv, dizayn, interfeys, tarif va funksiyalarni takomillashtirishi mumkin. Pulli xizmatning muhim shartlariga ta’sir qiluvchi o‘zgarishlar oldindan ko‘rsatiladi.
9.4. RoyalHouse internet, aloqa operatorlari, banklar va uchinchi tomon provayderlarining uzluksiz ishlashini kafolatlamaydi, biroq o‘z aybi va qonun bo‘yicha zimmasidagi majburiyatlar uchun javob beradi.

10. JAVOBGARLIK
10.1. Hamkor e’lon ma’lumotlari, obyektga bo‘lgan huquqi, narx, mavjudlik, obyektni taqdim etish, qurilish va sotuv haqidagi ma’lumotlar, Mijoz bilan kelishilgan shartlar va o‘z xodimlari harakatlari uchun javob beradi.
10.2. Hamkor aybi bilan RoyalHouse Mijozga mablag‘ qaytarishga yoki hujjatlashtirilgan xarajat qilishga majbur bo‘lsa, Hamkor o‘z aybi va sababiy bog‘liqlik doirasida tegishli summalarni qoplaydi.
10.3. RoyalHouse Hamkor joylashtirgan kontent yoki Hamkor va Mijoz o‘rtasidagi bitim bajarilishi uchun avtomatik ravishda javobgar bo‘lmaydi. Bu Operatorning o‘z aybi yoki qonun bo‘yicha majburiyatlari uchun javobgarligini istisno etmaydi.

11. CHEKLASH VA HAMKORLIKNI TUGATISH
11.1. Noto‘g‘ri ma’lumot, takroriy shikoyat, tasdiqlangan bronni bajarmaslik, qaytarish majburiyatini bajarmaslik, huquqiy vakolat yo‘qligi yoki qonun/Platforma qoidalarini buzish holatlarida RoyalHouse e’lonni cheklashi yoki hamkorlikni to‘xtatishi mumkin.
11.2. Hamkor hamkorlikni tugatishni so‘rashi mumkin. Bu avval tasdiqlangan bronlar, qaytarishlar, qarzdorlik va boshqa majburiyatlarni bekor qilmaydi.

12. SHAXSIY MA’LUMOTLAR, FORS-MAJOR VA NIZOLAR
12.1. Tomonlar shaxsiy ma’lumotlardan qonuniy maqsadlarda foydalanadi va ularni himoya qilish choralarini ko‘radi.
12.2. Fors-major holatlari bo‘yicha javobgarlik O‘zbekiston Respublikasi qonunchiligiga muvofiq belgilanadi.
12.3. Nizolar muzokara orqali hal qilinadi; kelishuvga erishilmasa, nizo O‘zbekiston Respublikasining vakolatli sudida ko‘riladi.

13. YAKUNIY QOIDALAR VA OPERATOR REKVIZITLARI
13.1. Operator Ofertaga o‘zgartirish kiritishi mumkin. Yangi tahrir Platformada e’lon qilinadi. Yangi tahrir kuchga kirishidan oldin tasdiqlangan bronlarga, qonunchilikda boshqacha talab bo‘lmasa, bron tasdiqlangan paytdagi shartlar qo‘llanadi.
13.2. Operator: “Nafis house group” MChJ; STIR 307797554; manzil: Toshkent viloyati, Yangiyo‘l shahri, Navro‘z MFY, Samarqand ko‘chasi, 155-uy; hisob raqami 20208000905288969001; MFO 00450; e-mail: housenafis07@gmail.com; telefon: +998 99 824 44 94; sayt: https://royalhouse.uz.

РУССКИЙ ТЕКСТ

1. ОБЩИЕ ПОЛОЖЕНИЯ
1.1. Настоящая Оферта адресована физическим лицам, индивидуальным предпринимателям и юридическим лицам, размещающим объявления или предлагающим услуги на RoyalHouse.uz в профессиональных или коммерческих целях. Оператор — ООО «Nafis house group», ИНН 307797554.
1.2. Партнёр акцептует Оферту нажатием кнопки «Принимаю оферту», установкой соответствующей отметки или иным однозначным электронным подтверждением. Дата акцепта, идентификатор Партнёра и версия Оферты могут фиксироваться.
1.3. Оферта регулирует регистрацию Партнёра, размещение объявлений, использование профессионального кабинета, получение обращений, бронирования, платные услуги и ответственность.
1.4. К отношениям с клиентами также применяются Публичная оферта для пользователей, Политика конфиденциальности и условия, показанные на странице бронирования.

2. УСЛУГИ И СТАТУС ПЛАТФОРМЫ
2.1. RoyalHouse предоставляет Партнёру возможность размещать сведения о недвижимости, новых строительных проектах и объектах отдыха, получать обращения потенциальных клиентов, управлять объектами и проектами и использовать функции Платформы.
2.2. Профессиональный кабинет/кабинет застройщика может включать профиль компании, жилые комплексы, здания, квартиры, фото и видео, документы, обращения (лиды), статистику и, при наличии, массовый импорт через Excel.
2.3. Направление «Отдых» включает три категории: «Дача, коттедж, вилла»; «Курорты и гостиницы»; «Глэмпинг, SPA и другие уникальные места отдыха».
2.4. Если иное не предусмотрено отдельным письменным договором, RoyalHouse не является собственником объекта, продавцом, арендодателем, застройщиком или непосредственным поставщиком услуги. RoyalHouse предоставляет электронную платформу и инструменты; сделку и услугу непосредственно исполняет Партнёр.

3. ОБЯЗАННОСТИ ПАРТНЁРА
3.1. Партнёр должен иметь законное право и полномочия предлагать объект, проект или услугу и по запросу Оператора предоставлять документы, подтверждающие право собственности, аренды, представительства, регистрацию компании, лицензию или иные полномочия.
3.2. Цена, адрес, площадь, состояние, доступность, стадия строительства, срок сдачи, план оплаты, вместимость объекта, удобства и иные существенные сведения должны быть достоверными и актуальными.
3.3. Партнёр размещает только фотографии, видео, проектные чертежи, документы и товарные знаки, на использование которых у него есть права; права третьих лиц не должны нарушаться.
3.4. При изменении цены или доступности Партнёр обновляет объявление, не оставляет проданный или недоступный объект активным и отвечает на обращения в разумный срок.
3.5. Застройщик отвечает за достоверность данных о проектах, жилых комплексах, зданиях, квартирах, статусах продаж, ценах, чертежах, документах и записях, загруженных массовым импортом.
3.6. Партнёр не должен заключать скрытые сделки с клиентами, пришедшими через Платформу, с целью обхода комиссии или правил Платформы, а также передавать подтверждённую дату бронирования другому клиенту.

4. МОДЕРАЦИЯ ОБЪЯВЛЕНИЙ
4.1. RoyalHouse вправе проверять объявления, запрашивать дополнительные документы, возвращать их на исправление, временно скрывать или удалять при нарушении закона, Оферты или правил Платформы.
4.2. Запрещены фиктивные, повторяющиеся, вводящие в заблуждение объявления, материалы, нарушающие права третьих лиц, или публикации без необходимых полномочий.
4.3. Модерация не освобождает Партнёра от ответственности за достоверность содержания объявления.

5. ТАРИФЫ И ПЛАТНЫЕ УСЛУГИ
5.1. Лимиты публикаций, бесплатный объём, подписки, реклама, продвижение и цены профессиональных функций указываются на Платформе до заказа услуги либо в отдельном соглашении.
5.2. Комиссия за объявления о недвижимости или услуги кабинета застройщика взимается только в случае, если она прямо указана в соответствующем тарифе или отдельном соглашении. Настоящая Оферта сама по себе не устанавливает комиссию от стоимости сделки с недвижимостью.
5.3. Оплата считается успешной после подтверждения банком или платёжным провайдером. Возврат осуществляется по условиям заказа и законодательству.
5.4. Партнёр отвечает за налоги, счета-фактуры, чеки и иные обязательные документы в рамках своей деятельности.

6. БРОНИРОВАНИЕ ОБЪЕКТОВ ОТДЫХА
6.1. Партнёр обязан иметь право сдавать объект или оказывать услугу и указывать реальные фотографии, цену, доступные даты, вместимость, время заезда/выезда, минимальный срок проживания, депозит, доплату за дополнительных гостей и правила использования.
6.2. Общая стоимость бронирования рассчитывается с учётом выбранных дат, дневного или месячного тарифа, количества гостей, дополнительных услуг и иных условий, указанных на странице бронирования.
6.3. Для подтверждения бронирования Клиент вносит аванс 10% от общей стоимости, если на странице бронирования не указано иное. Аванс направляется на покрытие комиссии RoyalHouse. Комиссия RoyalHouse составляет 10% от общей стоимости бронирования.
6.4. После подтверждения аванса платёжным провайдером бронирование подтверждается, а дата блокируется в календаре. Если аванс не оплачен в течение 15 минут, бронирование может быть отменено и временная блокировка снята.
6.5. Оставшиеся 90%, если на странице бронирования не указано иное, Клиент оплачивает непосредственно Партнёру. Партнёр отвечает за приём остатка, выдачу чека и учёт налогов.
6.6. При отмене Клиентом не менее чем за 72 часа до начала бронирования удерживается 15% от суммы аванса, а 85% возвращаются. Удержание рассчитывается только от суммы аванса.
6.7. Если до начала бронирования осталось менее 72 часов, обычный возврат аванса не производится, кроме обязательных случаев по закону или исключений, подтверждённых Оператором.
6.8. Если объект не предоставлен по вине Партнёра, передан другому клиенту или существенные условия объявления не соблюдены, Клиенту возвращается 100% аванса. Партнёр возмещает RoyalHouse возвращённый аванс и фактически понесённые, документально подтверждённые расходы на возврат, не возмещённые банком/провайдером.
6.9. При необходимости отменить подтверждённое бронирование Партнёр немедленно уведомляет RoyalHouse и Клиента. При отмене по вине Партнёра комиссия RoyalHouse не сохраняется как окончательный доход.
6.10. Партнёр обновляет календарь, закрывает недоступные даты и не передаёт подтверждённую дату другому клиенту.

7. ОБРАЩЕНИЯ И ДАННЫЕ КЛИЕНТОВ
7.1. Партнёр использует данные обращений, полученные через Платформу, только для ответа на обращение, показа объекта, исполнения сделки или бронирования и законных обязанностей.
7.2. Запрещается распространять данные Клиента в рекламных целях без согласия, продавать их или незаконно передавать третьим лицам.
7.3. Партнёр предоставляет сотрудникам только необходимые права доступа к кабинету и отвечает за их действия.

8. АККАУНТ И БЕЗОПАСНОСТЬ
8.1. Партнёр поддерживает профиль и сведения о компании в актуальном состоянии, защищает средства доступа и немедленно уведомляет Оператора о подозрении на несанкционированный доступ.
8.2. Партнёр не должен передавать третьим лицам логин, SMS-код, пароль или данные Passkey.

9. ПРАВА И ОБЯЗАННОСТИ ROYALHOUSE
9.1. RoyalHouse предоставляет функции Платформы в пределах технических возможностей, фиксирует обращения и бронирования в электронном виде и отображает статусы оплаты через доступные интеграции.
9.2. При выявлении нарушения закона, мошенничества, недостоверных сведений, отсутствия законных полномочий или угрозы безопасности Оператор может ограничить объявление или функции кабинета.
9.3. RoyalHouse может улучшать поиск, дизайн, интерфейс, тарифы и функции. Существенные изменения условий платных услуг сообщаются заранее.
9.4. RoyalHouse не гарантирует бесперебойную работу интернета, операторов связи, банков и сторонних провайдеров, но отвечает за собственную вину и обязанности, возложенные законом.

10. ОТВЕТСТВЕННОСТЬ
10.1. Партнёр отвечает за сведения в объявлениях, право на объект, цену, доступность, предоставление объекта, сведения о строительстве и продажах, согласованные с Клиентом условия и действия своих сотрудников.
10.2. Если по вине Партнёра RoyalHouse обязан вернуть Клиенту деньги или понести документально подтверждённые расходы, Партнёр возмещает соответствующие суммы в пределах своей вины и причинной связи.
10.3. RoyalHouse не несёт автоматическую ответственность за контент Партнёра или исполнение сделки между Партнёром и Клиентом. Это не исключает ответственность Оператора за собственную вину или обязательства по закону.

11. ОГРАНИЧЕНИЕ И ПРЕКРАЩЕНИЕ СОТРУДНИЧЕСТВА
11.1. При недостоверных сведениях, повторных жалобах, неисполнении подтверждённых бронирований, невыполнении возвратов, отсутствии законных полномочий или нарушении закона/правил Платформы RoyalHouse может ограничить объявление или прекратить сотрудничество.
11.2. Партнёр может запросить прекращение сотрудничества. Это не отменяет ранее подтверждённые бронирования, возвраты, задолженность и иные возникшие обязательства.

12. ПЕРСОНАЛЬНЫЕ ДАННЫЕ, ФОРС-МАЖОР И СПОРЫ
12.1. Стороны используют персональные данные в законных целях и принимают меры по их защите.
12.2. Ответственность за форс-мажорные обстоятельства определяется законодательством Республики Узбекистан.
12.3. Споры разрешаются путём переговоров; при отсутствии соглашения — компетентным судом Республики Узбекистан.

13. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ И РЕКВИЗИТЫ ОПЕРАТОРА
13.1. Оператор вправе изменять Оферту. Новая редакция публикуется на Платформе. К бронированиям, подтверждённым до вступления новой редакции в силу, применяется редакция, действовавшая на момент подтверждения, если иное не требуется законом.
13.2. Оператор: ООО «Nafis house group»; ИНН 307797554; адрес: Республика Узбекистан, Ташкентская область, город Янгиюль, МФЙ Навруз, улица Самарканд, дом 155; расчётный счёт 20208000905288969001; МФО 00450; e-mail: housenafis07@gmail.com; телефон: +998 99 824 44 94; сайт: https://royalhouse.uz.$$,'partner',true);
