import { useEffect, useMemo, useState } from "react";
import {
  Search, Plus, MapPin, CalendarDays, Package, ShieldCheck, ArrowRight,
  X, Upload, LogIn, LogOut, UserRound, Clock3, CheckCircle2, AlertCircle,
  Image as ImageIcon, Sparkles, SlidersHorizontal, HandHeart, Menu
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const CATEGORIES = [
  "Electronics", "ID / Cards", "Books & Notes", "Bags", "Keys",
  "Clothing", "Accessories", "Stationery", "Other"
];

const DEMO_ITEMS = [
  { id: "demo-1", title: "Blue water bottle", description: "A blue insulated bottle left near the library entrance.", category: "Other", item_type: "found", location: "Central Library", item_date: new Date().toISOString().slice(0,10), image_url: "", status: "reported", created_at: new Date().toISOString(), profiles: { full_name: "Campus member" } },
  { id: "demo-2", title: "Black calculator", description: "Scientific calculator with a small sticker on the back.", category: "Electronics", item_type: "lost", location: "Engineering Block, Room 204", item_date: new Date().toISOString().slice(0,10), image_url: "", status: "reported", created_at: new Date().toISOString(), profiles: { full_name: "Campus member" } },
  { id: "demo-3", title: "Notebook with green cover", description: "Green notebook possibly left on a classroom desk.", category: "Books & Notes", item_type: "found", location: "Canteen seating area", item_date: new Date().toISOString().slice(0,10), image_url: "", status: "claimed", created_at: new Date().toISOString(), profiles: { full_name: "Campus member" } },
];

function formatDate(value) {
  if (!value) return "Date not provided";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function initials(name = "Campus member") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

function StatusPill({ status }) {
  const label = status === "reported" ? "Open" : status === "claimed" ? "Claim pending" : "Returned";
  return <span className={`status-pill status-${status}`}>{label}</span>;
}

function AuthModal({ onClose, onNotice }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName.trim() } }
        });
        if (error) throw error;
        onNotice("Account created. Check your email if confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onNotice("You are signed in.");
      }
      onClose();
    } catch (error) {
      onNotice(error.message || "Authentication failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal auth-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="modal-icon"><ShieldCheck size={23} /></div>
        <h2>{mode === "signin" ? "Welcome back" : "Join FoundIt"}</h2>
        <p className="muted">Sign in to post items and manage claims.</p>
        <form onSubmit={submit} className="form-stack">
          {mode === "signup" && <label>Full name<input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" maxLength={80} /></label>}
          <label>Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" autoComplete="email" /></label>
          <label>Password<input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>
          <button className="btn btn-primary btn-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">{mode === "signin" ? "New to FoundIt?" : "Already have an account?"} <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
      </section>
    </div>
  );
}

function ItemModal({ user, onClose, onCreated, onNotice }) {
  const [type, setType] = useState("lost");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true);
    let imageUrl = null;
    try {
      if (photo) {
        const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("item-photos").upload(path, photo, {
          cacheControl: "3600", upsert: false, contentType: photo.type
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
      const { error } = await supabase.from("items").insert({
        owner_id: user.id, title: title.trim(), description: description.trim(),
        category, location: location.trim(), item_date: date, item_type: type, image_url: imageUrl,
        status: "reported"
      });
      if (error) throw error;
      onNotice("Your item has been posted.");
      onCreated();
      onClose();
    } catch (error) {
      onNotice(error.message || "Could not create the listing.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal item-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="modal-icon"><Plus size={23} /></div>
        <h2>Post an item</h2>
        <p className="muted">Share enough detail to help the right person recognize it.</p>
        <form className="form-stack" onSubmit={submit}>
          <div className="segmented">
            <button type="button" className={type === "lost" ? "selected lost-select" : ""} onClick={() => setType("lost")}>I lost something</button>
            <button type="button" className={type === "found" ? "selected found-select" : ""} onClick={() => setType("found")}>I found something</button>
          </div>
          <label>Item name<input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Black wallet" /></label>
          <label>Description<textarea required value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} rows={3} placeholder="Color, brand, distinctive details…" /></label>
          <div className="form-grid">
            <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Date {type === "lost" ? "lost" : "found"}<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0,10)} /></label>
          </div>
          <label>Location<input required value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="e.g. Library, Block B" /></label>
          <label className="upload-field">
            <span className="upload-icon"><Upload size={18} /></span>
            <span><strong>{photo ? photo.name : "Add a photo (optional)"}</strong><small>JPG, PNG or WebP · max 5 MB</small></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.size > 5 * 1024 * 1024) { onNotice("Please choose an image under 5 MB.", "error"); e.target.value = ""; return; }
              setPhoto(file || null);
            }} />
          </label>
          <button className="btn btn-primary btn-full" disabled={busy}>{busy ? "Publishing…" : "Publish listing"} <ArrowRight size={17} /></button>
        </form>
      </section>
    </div>
  );
}

function ClaimModal({ item, onClose, onCreated, onNotice }) {
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("claims").insert({
        item_id: item.id, details: details.trim(), status: "pending"
      });
      if (error) throw error;
      onNotice("Claim submitted. The person who posted this item can review it.");
      onCreated();
      onClose();
    } catch (error) {
      onNotice(error.message || "Could not submit claim.", "error");
    } finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="modal-icon"><HandHeart size={23} /></div>
        <h2>Claim “{item.title}”</h2>
        <p className="muted">Describe a detail that helps verify the item belongs to you. Avoid sharing sensitive personal information.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Identifying details<textarea required minLength={8} maxLength={1000} rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Mention a unique mark, contents, or other detail only the owner would know…" /></label>
          <button className="btn btn-primary btn-full" disabled={busy}>{busy ? "Submitting…" : "Submit claim"} <ArrowRight size={17} /></button>
        </form>
      </section>
    </div>
  );
}

function ItemCard({ item, onClaim, user, onOpen }) {
  const isLost = item.item_type === "lost";
  return (
    <article className="item-card">
      <button className="item-image" onClick={() => onOpen(item)} aria-label={`View ${item.title}`}>
        {item.image_url ? <img src={item.image_url} alt={item.title} loading="lazy" /> : <div className={`image-placeholder ${isLost ? "placeholder-lost" : "placeholder-found"}`}><Package size={31} strokeWidth={1.5} /><span>{isLost ? "Lost item" : "Found item"}</span></div>}
        <span className={`type-pill ${isLost ? "type-lost" : "type-found"}`}>{isLost ? "Lost" : "Found"}</span>
      </button>
      <div className="item-content">
        <div className="item-title-row"><h3>{item.title}</h3><StatusPill status={item.status} /></div>
        <p className="item-description">{item.description}</p>
        <div className="item-meta"><span><MapPin size={14} />{item.location}</span><span><CalendarDays size={14} />{formatDate(item.item_date)}</span></div>
        <div className="item-footer"><span className="category-label">{item.category}</span>
          {item.status === "reported" && user && item.owner_id !== user.id && !String(item.id).startsWith("demo-") && <button className="text-button" onClick={() => onClaim(item)}>Claim item <ArrowRight size={15} /></button>}
          {item.status === "reported" && !user && <span className="small-muted">Sign in to claim</span>}
          {item.owner_id === user?.id && <span className="owner-label"><UserRound size={13} /> Your listing</span>}
        </div>
      </div>
    </article>
  );
}

function DetailModal({ item, onClose, user, onNotice, refresh }) {
  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const isOwner = item.owner_id && user?.id === item.owner_id;
  const isDemo = String(item.id).startsWith("demo-");

  useEffect(() => {
    let active = true;
    async function loadClaims() {
      if (!isOwner || isDemo) return;
      setLoadingClaims(true);
      const { data, error } = await supabase.from("claims")
        .select("id, details, status, created_at, claimant_id")
        .eq("item_id", item.id).order("created_at", { ascending: false });
      if (active) {
        if (error) onNotice(error.message, "error");
        else setClaims(data || []);
        setLoadingClaims(false);
      }
    }
    loadClaims();
    return () => { active = false; };
  }, [item.id, isOwner, isDemo]);

  async function updateClaim(claim, status) {
    setBusyId(claim.id);
    try {
      const { error } = await supabase.from("claims").update({ status }).eq("id", claim.id);
      if (error) throw error;
      if (status === "approved") {
        const { error: itemError } = await supabase.from("items").update({ status: "claimed" }).eq("id", item.id);
        if (itemError) throw itemError;
      }
      onNotice(status === "approved" ? "Claim approved." : "Claim rejected.");
      refresh();
      setClaims((current) => current.map((c) => c.id === claim.id ? { ...c, status } : c));
    } catch (error) { onNotice(error.message || "Could not update claim.", "error"); }
    finally { setBusyId(null); }
  }

  async function markReturned() {
    setBusyId("returned");
    const { error } = await supabase.from("items").update({ status: "returned" }).eq("id", item.id);
    if (error) onNotice(error.message, "error");
    else { onNotice("Item marked as returned."); refresh(); onClose(); }
    setBusyId(null);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal detail-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="detail-hero">
          {item.image_url ? <img src={item.image_url} alt={item.title} /> : <div className="detail-placeholder"><Package size={42} /></div>}
        </div>
        <div className="detail-heading"><span className={`type-pill ${item.item_type === "lost" ? "type-lost" : "type-found"}`}>{item.item_type === "lost" ? "Lost item" : "Found item"}</span><StatusPill status={item.status} /></div>
        <h2>{item.title}</h2>
        <p className="detail-description">{item.description}</p>
        <div className="detail-meta">
          <span><MapPin size={16} />{item.location}</span>
          <span><CalendarDays size={16} />{formatDate(item.item_date)}</span>
          <span><Package size={16} />{item.category}</span>
        </div>
        <div className="timeline">
          <div className="timeline-step done"><span><CheckCircle2 size={16} /></span><div><strong>Reported</strong><small>Listing created by the community</small></div></div>
          <div className={`timeline-step ${["claimed","returned"].includes(item.status) ? "done" : ""}`}><span><HandHeart size={16} /></span><div><strong>Claim review</strong><small>{item.status === "claimed" ? "A claim was approved" : item.status === "returned" ? "Claim completed" : "Waiting for a valid claim"}</small></div></div>
          <div className={`timeline-step ${item.status === "returned" ? "done" : ""}`}><span><CheckCircle2 size={16} /></span><div><strong>Returned</strong><small>{item.status === "returned" ? "Item marked as returned" : "Not yet marked as returned"}</small></div></div>
        </div>
        {isOwner && !isDemo && <div className="claims-section">
          <div className="section-heading"><h3>Claims on this item</h3><span className="count-badge">{claims.length}</span></div>
          {loadingClaims ? <p className="small-muted">Loading claims…</p> : claims.length === 0 ? <p className="empty-small">No claims yet. We'll show them here when someone submits one.</p> : claims.map((claim) => (
            <div className="claim-card" key={claim.id}>
              <p>{claim.details}</p><div className="claim-actions"><span className={`claim-status claim-${claim.status}`}>{claim.status}</span>
                {claim.status === "pending" && <><button className="btn btn-small btn-outline" disabled={busyId === claim.id} onClick={() => updateClaim(claim, "rejected")}>Reject</button><button className="btn btn-small btn-primary" disabled={busyId === claim.id} onClick={() => updateClaim(claim, "approved")}>Approve</button></>}
              </div>
            </div>
          ))}
          {item.status === "claimed" && <button className="btn btn-primary btn-full return-button" disabled={busyId === "returned"} onClick={markReturned}>{busyId === "returned" ? "Updating…" : "Mark as returned"} <CheckCircle2 size={16} /></button>}
        </div>}
        {isDemo && <p className="demo-note"><AlertCircle size={15} /> This is sample data. Connect Supabase to enable live claims and listings.</p>}
      </section>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState(DEMO_ITEMS);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("active");
  const [modal, setModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [notice, setNotice] = useState(null);
  const [noticeKind, setNoticeKind] = useState("success");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const user = session?.user || null;

  function notify(message, kind = "success") {
    setNotice(message); setNoticeKind(kind);
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setNotice(null), 4500);
  }

  async function loadItems() {
    if (!supabase) { setItems(DEMO_ITEMS); return; }
    setLoading(true);
    const { data, error } = await supabase.from("items")
      .select("id, owner_id, title, description, category, location, item_date, item_type, image_url, status, created_at")
      .order("created_at", { ascending: false });
    if (error) notify(error.message || "Could not load listings.", "error");
    else setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { loadItems(); }, [isSupabaseConfigured]);

  const filteredItems = useMemo(() => items.filter((item) => {
    const term = query.trim().toLowerCase();
    const matchesSearch = !term || [item.title, item.description, item.location, item.category].some((v) => (v || "").toLowerCase().includes(term));
    const matchesCategory = category === "All categories" || item.category === category;
    const matchesType = type === "all" || item.item_type === type;
    const matchesStatus = status === "all" || (status === "active" ? item.status !== "returned" : item.status === status);
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  }), [items, query, category, type, status]);

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) notify(error.message, "error"); else notify("Signed out.");
  }

  const liveCount = items.filter((i) => i.status !== "returned").length;
  const lostCount = items.filter((i) => i.item_type === "lost" && i.status !== "returned").length;
  const foundCount = items.filter((i) => i.item_type === "found" && i.status !== "returned").length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setType("all"); setQuery(""); setCategory("All categories"); setStatus("active"); }}>
            <span className="brand-mark"><Package size={21} strokeWidth={2.5} /></span><span>found<span className="brand-accent">it</span><small>CAMPUS LOST & FOUND</small></span>
          </a>
          <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
            <button className={type === "all" ? "nav-active" : ""} onClick={() => { setType("all"); setMenuOpen(false); }}>Explore items</button>
            <button className={type === "lost" ? "nav-active" : ""} onClick={() => { setType("lost"); setMenuOpen(false); }}>Lost items</button>
            <button className={type === "found" ? "nav-active" : ""} onClick={() => { setType("found"); setMenuOpen(false); }}>Found items</button>
          </nav>
          <div className="top-actions">
            {user ? <>
              <span className="user-chip"><span className="avatar">{initials(user.user_metadata?.full_name || user.email)}</span><span className="user-email">{user.user_metadata?.full_name || user.email}</span></span>
              <button className="btn btn-outline signout-btn" onClick={signOut}><LogOut size={16} /> Sign out</button>
            </> : <button className="btn btn-outline" onClick={() => isSupabaseConfigured ? setModal("auth") : notify("Add your Supabase URL and key to .env.local to enable sign in.", "error")}><LogIn size={16} /> Sign in</button>}
            <button className="btn btn-primary post-button" onClick={() => user ? setModal("item") : isSupabaseConfigured ? setModal("auth") : notify("Connect Supabase first to publish live listings.", "error")}><Plus size={17} /> Post an item</button>
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu"><Menu size={20} /></button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow"><Sparkles size={14} /> YOUR CAMPUS, CONNECTED</div>
            <h1>Lost something?<br /><span>Let's bring it home.</span></h1>
            <p className="hero-copy">A little help from your campus community goes a long way. Find lost belongings, return what you've found, and make someone's day.</p>
            <div className="hero-actions"><button className="btn btn-primary btn-large" onClick={() => { setType("lost"); document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" }); }}>Find an item <Search size={17} /></button><button className="btn btn-light btn-large" onClick={() => user ? setModal("item") : isSupabaseConfigured ? setModal("auth") : notify("Connect Supabase first to publish live listings.", "error")}>I found something <ArrowRight size={17} /></button></div>
            <div className="hero-trust"><ShieldCheck size={15} /> Community-powered · Simple · Free to use</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-glow"></div><div className="art-circle circle-one"></div><div className="art-circle circle-two"></div>
            <div className="floating-card card-wallet"><div className="float-icon wallet-icon"><Package size={22} /></div><div><strong>Lost wallet</strong><small>Student Center · Today</small></div><span className="float-check"><CheckCircle2 size={18} /></span></div>
            <div className="floating-card card-keys"><div className="float-icon keys-icon"><MapPin size={22} /></div><div><strong>Keys found!</strong><small>Library entrance</small></div></div>
            <div className="art-center"><div className="art-center-inner"><HandHeart size={62} strokeWidth={1.4} /><span>FOUND<br/>TOGETHER</span></div></div>
            <div className="floating-card card-bottle"><div className="float-icon bottle-icon"><CheckCircle2 size={22} /></div><div><strong>Back with owner</strong><small>One less lost thing</small></div></div>
            <div className="art-sparkle sparkle-one">✦</div><div className="art-sparkle sparkle-two">✧</div>
          </div>
        </section>

        {!isSupabaseConfigured && <div className="setup-banner"><div className="setup-banner-icon"><AlertCircle size={19} /></div><div><strong>Preview mode is on</strong><p>You're seeing sample listings. Follow the README to connect Supabase and enable accounts, uploads, and live data.</p></div></div>}

        <section className="stats-row">
          <div className="stat-card"><span className="stat-icon stat-purple"><Package size={19} /></span><div><strong>{liveCount}</strong><span>Active listings</span></div></div>
          <div className="stat-card"><span className="stat-icon stat-orange"><Search size={19} /></span><div><strong>{lostCount}</strong><span>Items reported lost</span></div></div>
          <div className="stat-card"><span className="stat-icon stat-green"><HandHeart size={19} /></span><div><strong>{foundCount}</strong><span>Items found</span></div></div>
          <div className="stat-note"><span className="online-dot"></span><span>{isSupabaseConfigured ? "Live community board" : "Sample data preview"}</span></div>
        </section>

        <section id="browse" className="browse-section">
          <div className="section-top">
            <div><div className="section-kicker">COMMUNITY BOARD</div><h2>Browse listings</h2><p>Every item has a story. Help it find its way back.</p></div>
            <button className="btn btn-primary desktop-post" onClick={() => user ? setModal("item") : isSupabaseConfigured ? setModal("auth") : notify("Connect Supabase first to publish live listings.", "error")}><Plus size={17} /> Post an item</button>
          </div>
          <div className="search-toolbar">
            <div className="search-box"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items, places, or keywords…" aria-label="Search listings" />{query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}</div>
            <button className={`filter-toggle ${showFilters ? "filter-on" : ""}`} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal size={17} /> Filters</button>
          </div>
          {showFilters && <div className="filters-row">
            <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Listing status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active listings</option><option value="all">All statuses</option><option value="reported">Open only</option><option value="claimed">Claim pending</option><option value="returned">Returned</option></select></label>
            <button className="reset-filters" onClick={() => { setCategory("All categories"); setStatus("active"); setType("all"); setQuery(""); }}>Reset filters</button>
          </div>}
          <div className="listing-tabs">
            <button className={type === "all" ? "tab-active" : ""} onClick={() => setType("all")}>All items <span>{items.length}</span></button>
            <button className={type === "lost" ? "tab-active" : ""} onClick={() => setType("lost")}>Lost <span>{items.filter((i) => i.item_type === "lost").length}</span></button>
            <button className={type === "found" ? "tab-active" : ""} onClick={() => setType("found")}>Found <span>{items.filter((i) => i.item_type === "found").length}</span></button>
          </div>
          {loading ? <div className="loading-state"><div className="spinner"></div><p>Loading community listings…</p></div> : filteredItems.length ? <div className="items-grid">{filteredItems.map((item) => <ItemCard key={item.id} item={item} user={user} onClaim={(selected) => setModal({ kind: "claim", item: selected })} onOpen={setSelectedItem} />)}</div> : <div className="empty-state"><div className="empty-icon"><Search size={26} /></div><h3>No listings found</h3><p>Try another keyword or adjust your filters. You can also be the first to post an item.</p><button className="btn btn-outline" onClick={() => { setQuery(""); setCategory("All categories"); setStatus("active"); setType("all"); }}>Clear filters</button></div>}
          <div className="community-cta"><div className="cta-icon"><HandHeart size={25} /></div><div><h3>Have you found something?</h3><p>One quick post could reunite someone with something important.</p></div><button className="btn btn-light" onClick={() => user ? setModal("item") : isSupabaseConfigured ? setModal("auth") : notify("Connect Supabase first to publish live listings.", "error")}>Post a found item <ArrowRight size={16} /></button></div>
        </section>
      </main>

      <footer className="footer"><a className="brand footer-brand" href="#" onClick={(e) => e.preventDefault()}><span className="brand-mark"><Package size={18} /></span><span>found<span className="brand-accent">it</span></span></a><p>Made for campuses. Powered by community.</p><span>© {new Date().getFullYear()} FoundIt</span></footer>

      {modal === "auth" && <AuthModal onClose={() => setModal(null)} onNotice={notify} />}
      {modal === "item" && user && <ItemModal user={user} onClose={() => setModal(null)} onCreated={loadItems} onNotice={notify} />}
      {modal?.kind === "claim" && user && <ClaimModal item={modal.item} onClose={() => setModal(null)} onCreated={loadItems} onNotice={notify} />}
      {selectedItem && <DetailModal item={selectedItem} user={user} onClose={() => setSelectedItem(null)} onNotice={notify} refresh={loadItems} />}
      {notice && <div className={`toast toast-${noticeKind}`} role="status"><span>{noticeKind === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}</span><p>{notice}</p><button onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  );
}
