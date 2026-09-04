const properties = [
  { type: "Kvartira", title: "Yangi ta’mirlangan 2 xonali kvartira", location: "Toshkent, Yunusobod", price: "860 mln so‘m", meta: "58 m² · 2 xona · 5/9 qavat", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80" },
  { type: "Yangi uy", title: "Premium klassdagi yangi kvartira", location: "Toshkent, Mirzo Ulug‘bek", price: "1,24 mlrd so‘m", meta: "72 m² · 3 xona · 8/12 qavat", image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80" },
  { type: "Uy", title: "Hovlili zamonaviy uy", location: "Toshkent vil., Qibray", price: "1,58 mlrd so‘m", meta: "210 m² · 6 xona · 4 sotix", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80" },
];

export default function Home() {
  return (
    <main>
      <div className="topline">Ko‘chmas mulkingiz uchun imkoniyatlarni bir joyda toping</div>
      <header className="header"><div className="container nav">
        <a className="brand" href="#"><span className="brand-mark">P</span><span>Pro<span>house</span></span></a>
        <nav><a className="active" href="#">Sotib olish</a><a href="#">Ijara</a><a href="#">Yangi uylar</a><a href="#">Uy qurish</a><a href="#">Ipoteka</a><a href="#">Xizmatlar</a><a href="#">Rieltorlar</a></nav>
        <div className="nav-actions"><button className="icon-btn">⌕</button><button className="login">Kirish</button></div>
      </div></header>

      <section className="hero"><div className="container">
        <div className="hero-copy"><div className="eyebrow">O‘zbekiston bo‘ylab</div><h1>O‘zingizga mos<br /><span>uyingizni toping</span></h1><p>Uy, kvartira, yer yoki yangi qurilishni toping. Ipoteka to‘lovini oldindan hisoblang.</p></div>
        <div className="search-card"><div className="search-tabs"><button className="selected">Sotib olish</button><button>Ijara</button><button>Yangi uylar</button></div>
          <div className="search-grid"><div className="field wide"><small>Joylashuv</small><strong>📍 Toshkent</strong></div><div className="field"><small>Obyekt turi</small><strong>Kvartira</strong></div><div className="field"><small>Narx</small><strong>Istalgan narx</strong></div><div className="field"><small>Xonalar</small><strong>Istalgan</strong></div><button className="search-btn">Qidirish <span>→</span></button></div>
          <div className="search-bottom"><span>Shahar · tuman · mahalla · maydon · qavat · qurilgan yil</span><button>⚙ Barcha filtrlar</button><button>▣ Xarita</button></div>
        </div>
      </div></section>

      <section className="container quick-section"><div className="section-head"><div><span className="muted-label">PROHOUSE XIZMATLARI</span><h2>Sizga kerak bo‘lgan hamma narsa</h2></div><a href="#">Barchasini ko‘rish →</a></div>
        <div className="service-grid">
          <div className="service-card mortgage"><div><span className="service-icon">₿</span><h3>Ipoteka</h3><p>Uyingizga mos kreditni toping va oylik to‘lovni hisoblang.</p><button>Hisoblash →</button></div><div className="mini-house">⌂</div></div>
          <div className="service-card"><span className="service-icon">⌂</span><h3>Uy qiymatini bilish</h3><p>Mulkingizning taxminiy bozor qiymatini aniqlang.</p><a href="#">Baholash →</a></div>
          <div className="service-card"><span className="service-icon">♙</span><h3>Rieltor topish</h3><p>Hududingizdagi ishonchli mutaxassisni tanlang.</p><a href="#">Rieltorlarni ko‘rish →</a></div>
          <div className="service-card"><span className="service-icon">▣</span><h3>Kredit kalkulyatori</h3><p>Turli shartlarni solishtirib, o‘zingizga mos variantni toping.</p><a href="#">Hisoblash →</a></div>
        </div>
      </section>

      <section className="container mortgage-strip"><div className="mortgage-text"><span className="muted-label">PROHOUSE IPOTEKA</span><h2>Uyingizni toping.<br />To‘lovingizni oldindan biling.</h2><p>Uy narxi va boshlang‘ich to‘lovni kiriting — taxminiy oylik to‘lovni darhol ko‘ring.</p><button className="dark-btn">Ipoteka kalkulyatorini ochish →</button></div><div className="calculator"><div className="calc-row"><span>Uy narxi</span><b>900 000 000 so‘m</b></div><div className="slider"><i style={{width:"68%"}} /></div><div className="calc-row"><span>Boshlang‘ich to‘lov</span><b>250 000 000 so‘m</b></div><div className="slider"><i style={{width:"42%"}} /></div><div className="calc-result"><span>Taxminiy oylik to‘lov</span><strong>9,8 mln so‘m</strong><small>20 yil · bank shartlariga bog‘liq</small></div></div></section>

      <section className="container properties"><div className="section-head"><div><span className="muted-label">SIZ UCHUN</span><h2>Tavsiya etilgan uylar</h2></div><a href="#">Barchasini ko‘rish →</a></div><div className="property-grid">{properties.map((p)=><article className="property-card" key={p.title}><div className="property-image" style={{backgroundImage:`url(${p.image})`}}><span>{p.type}</span><button>♡</button></div><div className="property-body"><h3>{p.price}</h3><p className="property-title">{p.title}</p><p className="location">⌖ {p.location}</p><div className="meta">{p.meta}</div></div></article>)}</div></section>

      <section className="map-section"><div className="container map-wrap"><div className="map-copy"><span className="muted-label">XARITA</span><h2>Uyni xaritada<br />toping</h2><p>Joylashuv, mahalla va atrofdagi infratuzilmani bir qarashda ko‘ring.</p><button className="dark-btn">Xaritani ochish →</button></div><div className="fake-map"><div className="map-grid"/><span className="road r1"/><span className="road r2"/><span className="road r3"/><span className="pin p1">●</span><span className="pin p2">●</span><span className="pin p3">●</span><span className="pin p4">●</span><div className="map-label">Toshkent</div></div></div></section>

      <section className="container cta"><div><span className="muted-label">SOTUVCHILAR VA RIELTORLAR UCHUN</span><h2>Mulkingizni Prohouse’da soting yoki ijaraga bering</h2><p>E’lon joylashtiring, mijozlarni qabul qiling va statistika orqali natijani kuzating.</p></div><button className="green-btn">E’lon joylashtirish →</button></section>
      <footer><div className="container footer-grid"><div><a className="brand" href="#"><span className="brand-mark">P</span><span>Pro<span>house</span></span></a><p>O‘zbekistonning zamonaviy ko‘chmas mulk platformasi.</p></div><div><b>Ko‘chmas mulk</b><a href="#">Sotib olish</a><a href="#">Ijara</a><a href="#">Yangi uylar</a></div><div><b>Xizmatlar</b><a href="#">Ipoteka</a><a href="#">Uy qurish</a><a href="#">Rieltorlar</a></div><div><b>Prohouse</b><a href="#">Biz haqimizda</a><a href="#">Yordam</a><a href="#">Aloqa</a></div></div><div className="container footer-bottom">© 2026 Prohouse · Barcha huquqlar himoyalangan</div></footer>
    </main>
  );
}
