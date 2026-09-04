const topListings = [
  { badge: "VIP", price: "860 mln so‘m", title: "2 xonali zamonaviy kvartira", location: "Toshkent, Yunusobod", meta: "58 m² · 2 xona · 5/9 qavat", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85", seller: "Sotuvchi" },
  { badge: "VIP", price: "1,24 mlrd so‘m", title: "Yangi qurilgan premium uy", location: "Toshkent, Mirzo Ulug‘bek", meta: "120 m² · 4 xona · 2 qavat", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85", seller: "Rieltor" },
  { badge: "VIP", price: "950 mln so‘m", title: "3 xonali yorug‘ kvartira", location: "Toshkent, Chilonzor", meta: "72 m² · 3 xona · 7/12 qavat", image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85", seller: "Sotuvchi" },
];

const latestListings = [
  { badge: "Yangi", price: "185 000 y.e.", title: "Keng hovlili xususiy uy", location: "Toshkent, Mirzo Ulug‘bek", meta: "190 m² · 5 xona · 2 qavat", image: "https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=800&q=85", seller: "Sotuvchi" },
  { badge: "Yangi", price: "149 000 y.e.", title: "Hovlili uy, tayyor holatda", location: "Toshkent, Sergeli", meta: "200 m² · 5 xona · 2 qavat", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=85", seller: "Rieltor" },
  { badge: "TOP", price: "90 000 y.e.", title: "2 xonali kvartira", location: "Toshkent, Yakkasaroy", meta: "64 m² · 2 xona · 4/9 qavat", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=85", seller: "Sotuvchi" },
  { badge: "Yangi", price: "135 000 y.e.", title: "Tijorat uchun qulay bino", location: "Toshkent, Chilonzor", meta: "123 m² · 1 qavat", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=85", seller: "Rieltor" },
];

const categories = ["Kvartiralar", "Xususiy uylar", "Yer uchastkalari", "Tijorat mulki", "Yangi binolar", "Ipoteka", "Rieltorlar", "Barcha toifalar"];

export default function Home() {
  return (
    <main>
      <header className="header">
        <div className="container nav">
          <a className="brand" href="#"><span className="brand-mark">⌂</span><span>Pro<span>house</span></span></a>
          <nav className="main-nav">
            <a className="active" href="#">Sotib olish</a><a href="#">Ijara</a><a href="#">Yangi uylar</a><a href="#">Uy qurish</a><a href="#">Ipoteka</a><a href="#">Xizmatlar</a><a href="#">Rieltorlar</a><a href="#">Barchasi⌄</a>
          </nav>
          <div className="nav-actions"><span className="location-pill">⌖ Toshkent⌄</span><button className="round-btn">♡</button><button className="round-btn">♧</button><button className="account-btn">Kirish / Ro‘yxatdan o‘tish</button></div>
        </div>
      </header>

      <section className="hero-modern">
        <div className="hero-bg" />
        <div className="container hero-inner">
          <div className="hero-content">
            <span className="hero-kicker">O‘ZBEKISTONDA KO‘CHMAS MULK</span>
            <h1>Orzuyingizdagi uy<br /><span>Prohouse’da</span></h1>
            <p>Sotib oling, ijaraga oling, investitsiya qiling.<br />Barchasi bir platformada.</p>
          </div>
          <aside className="hero-stats"><div><b>10 000+</b><span>faol e’lonlar</span></div><div><b>1 200+</b><span>tasdiqlangan rieltorlar</span></div><div><b>12+</b><span>bank ipoteka takliflari</span></div><div><b>✓</b><span>Prohouse kafolati</span></div></aside>
          <div className="search-card modern-search">
            <div className="search-tabs"><button className="selected">Sotuv</button><button>Ijara</button><button>Kunlik</button><button>Yangi uylar</button></div>
            <div className="search-row"><div className="field"><small>Joylashuv</small><strong>⌖ Toshkent</strong></div><div className="field"><small>Tuman</small><strong>Barcha tumanlar⌄</strong></div><div className="field"><small>Ko‘chmas mulk turi</small><strong>Barcha turlar⌄</strong></div><div className="field"><small>Narx oralig‘i</small><strong>Istalgan narx⌄</strong></div><button className="search-btn">⌕ Qidirish</button></div>
            <div className="quick-filters"><button>♙ Egasi</button><button>▣ Ipotekaga mumkin</button><button>⌂ Yangi qurilish</button><button>◷ Oxirgi hafta</button><button>□ Oxirgi oy</button><button className="all-filter">☷ Batafsil filtrlar</button></div>
          </div>
        </div>
      </section>

      <section className="container category-row">{categories.map((category, i) => <a href="#" className="category" key={category}><span className={`cat-icon c${i}`}>{["▥","⌂","⌁","▣","▥","₿","♙","••"][i]}</span><b>{category}</b></a>)}</section>

      <section className="container marketplace-section">
        <div className="section-head"><div><h2>♛ Top e’lonlar</h2><p>Tasdiqlangan va eng yaxshi takliflar</p></div><a href="#">Barchasini ko‘rish →</a></div>
        <div className="market-layout"><div className="listing-grid top-grid">{topListings.map((p) => <PropertyCard key={p.title} p={p} />)}</div><MapCard /></div>
      </section>

      <section className="container marketplace-section latest-section">
        <div className="section-head"><div><h2>So‘nggi e’lonlar</h2><p>Topildi: <strong>86 146</strong> ta e’lon</p></div><div className="sort">Saralash: <b>Yangi qo‘shilganlar⌄</b> <button>▦</button><button>☷</button></div></div>
        <div className="market-layout"><div className="listing-grid latest-grid">{latestListings.map((p) => <PropertyCard key={p.title} p={p} compact />)}</div><div className="side-stack"><MortgageCard /><AppCard /></div></div>
      </section>

      <section className="why-section"><div className="container"><div className="section-head"><div><h2>Nega aynan Prohouse?</h2><p>Uy topishdan bitimgacha — kerakli xizmatlar bir joyda.</p></div></div><div className="why-grid">{[["◈","Ishonchli e’lonlar","Har bir e’lon moderatsiyadan o‘tadi"],["▥","Keng tanlov","100 000+ real e’lonlar"],["⌖","Xarita orqali qidiring","Hududni xaritada ko‘ring"],["₿","Ipoteka imkoniyatlari","Banklar shartlarini solishtiring"],["♙","Professional rieltorlar","Tasdiqlangan agentliklar"],["✓","Xavfsiz bitim","Xotirjamligingiz biz uchun muhim"]].map(([icon,title,text])=><div className="why-card" key={title}><span>{icon}</span><b>{title}</b><p>{text}</p></div>)}</div></div></section>

      <section className="container partners"><span>Hamkorlarimiz</span><div><b>IPOTEKA BANK</b><b>HAMKORBANK</b><b>TBC BANK</b><b>XALQ BANKI</b><b>O‘ZBEKINVEST</b><b>KAPITALBANK</b></div></section>

      <section className="container cta"><div><span className="muted-label">SOTUVCHILAR VA RIELTORLAR UCHUN</span><h2>Mulkingizni Prohouse’da soting yoki ijaraga bering</h2><p>E’lon joylashtiring, mijozlarni qabul qiling va statistika orqali natijani kuzating.</p></div><button className="green-btn">E’lon joylashtirish →</button></section>

      <footer><div className="container footer-grid"><div><a className="brand" href="#"><span className="brand-mark">⌂</span><span>Pro<span>house</span></span></a><p>O‘zbekistonning zamonaviy ko‘chmas mulk platformasi.</p></div><div><b>Ko‘chmas mulk</b><a href="#">Sotib olish</a><a href="#">Ijara</a><a href="#">Yangi uylar</a><a href="#">Uy qurish</a></div><div><b>Xizmatlar</b><a href="#">Ipoteka</a><a href="#">Baholash</a><a href="#">Sug‘urta</a><a href="#">Notarius</a></div><div><b>Prohouse</b><a href="#">Biz haqimizda</a><a href="#">Yangiliklar</a><a href="#">Yordam</a><a href="#">Aloqa</a></div><div><b>Yangiliklardan xabardor bo‘ling</b><div className="subscribe"><input placeholder="Email manzilingiz" /><button>Obuna</button></div><p>Telegram · Instagram · YouTube</p></div></div><div className="container footer-bottom">© 2026 Prohouse. Barcha huquqlar himoyalangan.</div></footer>
    </main>
  );
}

function PropertyCard({ p, compact = false }: { p: typeof topListings[number] | typeof latestListings[number]; compact?: boolean }) {
  return <article className={`property-card ${compact ? "compact" : ""}`}><div className="property-image" style={{ backgroundImage: `url(${p.image})` }}><span className={`badge ${p.badge === "TOP" ? "top" : ""}`}>{p.badge}</span><button className="heart">♡</button></div><div className="property-body"><h3>{p.price}</h3><p className="property-title">{p.title}</p><p className="location">⌖ {p.location}</p><div className="meta">{p.meta}</div><div className="seller">◉ {p.seller} <span>✓</span></div></div></article>;
}

function MapCard() {
  return <aside className="map-card"><div className="map-toolbar"><span>✓ Bu hududda qidirish</span><b>＋</b><b>−</b></div><div className="map-art"><span className="map-city">Toshkent</span>{[[25,32,"850 mln"],[54,25,"1.2 mlrd"],[72,52,"950 mlrd"],[35,68,"620 mln"],[59,76,"1.6 mlrd"]].map(([x,y,label])=><span className="map-pin" style={{left:`${x}%`,top:`${y}%`}} key={`${x}-${y}`}><i />{label}</span>)}</div><button className="map-open">Xaritani ochish →</button></aside>;
}

function MortgageCard() { return <div className="side-card mortgage-card"><span className="side-icon">₿</span><div><h3>Ipoteka kalkulyatori</h3><p>Uy narxi va boshlang‘ich to‘lovni kiriting — oylik to‘lovni biling.</p><button>Hisoblash →</button></div></div>; }
function AppCard() { return <div className="side-card app-card"><div><h3>Prohouse ilovasi</h3><p>Uy izlash endi yanada qulay.</p><span>App Store · Google Play</span></div><div className="phone">▯</div></div>; }
