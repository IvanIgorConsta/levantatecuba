import{G as M,r as i,j as e,f as D,g as O,L,N as B,F as V,d as G,b as Y,h as q}from"./index-1606e3a6.js";import{p as z}from"./purify.es-ee0e7e34.js";import{n as X,b as C}from"./imageUtils-97dea50b.js";import{A as U}from"./arrow-left-0b0d6e68.js";import{C as J}from"./chevron-right-b6135664.js";function K(l){return M({tag:"svg",attr:{fill:"none",viewBox:"0 0 24 24",strokeWidth:"2",stroke:"currentColor","aria-hidden":"true"},child:[{tag:"path",attr:{strokeLinecap:"round",strokeLinejoin:"round",d:"M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"},child:[]}]})(l)}function Q(l){return M({tag:"svg",attr:{fill:"none",viewBox:"0 0 24 24",strokeWidth:"2",stroke:"currentColor","aria-hidden":"true"},child:[{tag:"path",attr:{strokeLinecap:"round",strokeLinejoin:"round",d:"M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"},child:[]}]})(l)}function P(l){return M({tag:"svg",attr:{fill:"none",viewBox:"0 0 24 24",strokeWidth:"2",stroke:"currentColor","aria-hidden":"true"},child:[{tag:"path",attr:{strokeLinecap:"round",strokeLinejoin:"round",d:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"},child:[]}]})(l)}const Z=({items:l,renderItem:_,label:v,gap:F=24})=>{const h=i.useRef(null),j=i.useRef({x:0,y:0}),[E,N]=i.useState(!1),[A,T]=i.useState(!1),x=l.length>=3,y=()=>{if(!h.current||!x)return;const{scrollLeft:r,scrollWidth:c,clientWidth:m}=h.current;N(r>2),T(r<c-m-2)};i.useEffect(()=>{const r=h.current;if(!r||!x)return;const c=n=>{Math.abs(n.deltaX)>Math.abs(n.deltaY)},m=n=>{j.current={x:n.touches[0].clientX,y:n.touches[0].clientY}},u=n=>{const g=Math.abs(n.touches[0].clientX-j.current.x),S=Math.abs(n.touches[0].clientY-j.current.y);g>S&&n.stopPropagation()};return r.addEventListener("wheel",c,{passive:!0}),r.addEventListener("touchstart",m,{passive:!0}),r.addEventListener("touchmove",u,{passive:!0}),()=>{r.removeEventListener("wheel",c),r.removeEventListener("touchstart",m),r.removeEventListener("touchmove",u)}},[x]),i.useEffect(()=>{if(!x)return;y();const r=()=>y();return window.addEventListener("resize",r),()=>window.removeEventListener("resize",r)},[x,l.length]);const f=r=>{if(!h.current)return;const c=h.current,m=c.scrollLeft,u=c.clientWidth,n=c.scrollWidth,g=Math.round(m/u);let p=(r==="next"?g+1:g-1)*u;p=Math.max(0,Math.min(p,n-u)),c.scrollTo({left:p,behavior:"smooth"})};return x?e.jsxs("div",{className:"hidden sm:block relative overflow-visible",children:[E&&e.jsx("button",{onClick:()=>f("prev"),"aria-label":"Anterior",role:"button",tabIndex:0,className:"custom-arrow left-arrow",children:e.jsx(D,{size:20})}),e.jsx("div",{ref:h,onScroll:y,role:"region","aria-label":v,className:"overflow-x-auto overflow-y-visible pl-6 pr-0 py-4 md:py-6 scroll-smooth [scrollbar-gutter:stable] hide-scrollbar relative",style:{touchAction:"pan-y",overscrollBehavior:"auto",scrollSnapType:"x mandatory",scrollPaddingLeft:"24px",scrollPaddingRight:"0px",WebkitMaskImage:"linear-gradient(to right, transparent 0, black 8px, black 100%)",askImage:"linear-gradient(to right, transparent 0, black 8px, black 100%)"},children:e.jsx("div",{className:"flex gap-6 py-1",children:l.map(r=>e.jsx("div",{className:"flex-shrink-0 w-full sm:w-[calc((100%_-_24px)_/_2)] lg:w-[calc((100%_-_48px)_/_3)]",style:{scrollSnapAlign:"start",scrollSnapStop:"always"},children:_(r)},r._id||r.id))})}),A&&e.jsx("button",{onClick:()=>f("next"),"aria-label":"Siguiente",role:"button",tabIndex:0,className:"custom-arrow right-arrow",children:e.jsx(O,{size:20})})]}):e.jsx("div",{className:"grid md:grid-cols-2 lg:grid-cols-3 gap-6",children:l.map(r=>e.jsx("div",{children:_(r)},r._id||r.id))})},ee=Z;function ie(){const[l,_]=i.useState([]),[v,F]=i.useState("Todas"),[h,j]=i.useState(""),[E,N]=i.useState(9),[A,T]=i.useState(!0),[x,y]=i.useState(!1),f=i.useRef(null);i.useLayoutEffect(()=>{window.scrollTo(0,0),setTimeout(()=>window.scrollTo(0,0),0)},[]),i.useEffect(()=>{const t=window.matchMedia("(max-width: 768px)"),a=()=>y(t.matches);return a(),t.addEventListener("change",a),()=>t.removeEventListener("change",a)},[]);const r=t=>t?(Date.now()-new Date(t))/(1e3*60*60)<=24:!1;i.useEffect(()=>{(async()=>{try{const a=await fetch("/api/news?limit=1000");if(!a.ok)throw new Error("Error al obtener noticias");const s=await a.json(),b=X(s.noticias||[]).filter(o=>o._id&&o.titulo&&o.contenido).map(o=>{const w=z.sanitize(o.titulo),k=z.sanitize(o.contenido,{ALLOWED_TAGS:["b","i","em","strong","p","h1","h2","h3","ul","ol","li","a","blockquote","br"],ALLOWED_ATTR:["href","target","rel"]}),H=k.replace(/<style[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<script[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(),$=H.length>280?H.slice(0,277)+"…":H;return{...o,titulo:w,contenido:k,extractoPlano:$,imagen:z.sanitize(o.imagen||""),autor:z.sanitize(o.autor||"Autor verificado"),categoria:z.sanitize(o.categoria||"General"),destacada:o.destacada===!0||o.destacada==="true",fecha:new Date(o.createdAt).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}),createdAt:o.createdAt}});_(b)}catch(a){console.error("Error:",a)}finally{T(!1)}})()},[]),i.useEffect(()=>{if(!x)return;const t=new IntersectionObserver(a=>{a[0].isIntersecting&&N(s=>s+6)},{threshold:1});return f.current&&t.observe(f.current),()=>t.disconnect()},[x]);const c=["Todas","General","Política","Economía","Internacional","Socio político","Tecnología","Tendencia"],m=l.filter(t=>{var k;const a=((k=t.categoria)==null?void 0:k.toLowerCase())||"",s=v.toLowerCase(),d=t.titulo.toLowerCase(),b=t.contenido.toLowerCase(),o=v==="Todas"||a===s,w=d.includes(h.toLowerCase())||b.includes(h.toLowerCase());return o&&w}),u=m.sort((t,a)=>{const s=(a.destacada===!0)-(t.destacada===!0);return s!==0?s:new Date(a.createdAt)-new Date(t.createdAt)}),n=x?u.slice(0,E):u,S=(t=>{const a=new Date,s={Hoy:[],"Esta semana":[],"Este mes":[],Anteriores:[]};return t.forEach(d=>{const b=new Date(d.createdAt),o=(a-b)/(1e3*60*60),w=(a-b)/(1e3*60*60*24);o<=24?s.Hoy.push(d):w<=7?s["Esta semana"].push(d):w<=30?s["Este mes"].push(d):s.Anteriores.push(d)}),s})(n),p=t=>e.jsx("div",{className:"news-card w-full max-w-full bg-zinc-800/80 hover:bg-zinc-700/80 rounded-2xl border border-zinc-700/50 shadow-lg shadow-black/40 hover:shadow-black/60 hover:-translate-y-1 hover:scale-[1.00] hover:z-10 transition-all duration-200 touch-action-manipulation will-change-transform origin-center relative z-0",children:e.jsxs("div",{className:"flex flex-col h-full",children:[e.jsxs(L,{to:`/noticias/${t._id}`,draggable:!1,className:"flex flex-col flex-none",children:[e.jsx("div",{className:"news-card__media relative overflow-hidden aspect-video bg-zinc-900 rounded-t-2xl",children:t._cover?t._cover.match(/\.(avif|webp|jpg|jpeg|png)$/i)?e.jsx("img",{src:C(t._cover,t._coverHash),alt:t.titulo,draggable:!1,className:"block w-full aspect-[16/9] object-cover sm:aspect-auto sm:h-full",loading:"lazy",decoding:"async"}):e.jsxs("picture",{children:[e.jsx("source",{type:"image/avif",srcSet:C(t._cover+".avif",t._coverHash)}),e.jsx("source",{type:"image/webp",srcSet:C(t._cover+".webp",t._coverHash)}),e.jsx("img",{src:C(t._cover+".jpg",t._coverHash),alt:t.titulo,className:"w-full h-full object-cover",loading:"lazy",decoding:"async"})]}):e.jsx("div",{className:"w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-400 text-xs",children:"Sin imagen"})},t._coverHash||t._id),e.jsxs("div",{className:"news-card__body p-4 md:p-5 relative flex flex-col",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2 min-h-[22px] md:min-h-[24px] mb-1",children:[t.categoria&&e.jsx("span",{className:`text-white text-[10px] sm:text-xs md:text-xs px-2 py-1 rounded font-medium shadow-sm ${t.categoria==="Socio político"?"bg-red-600":t.categoria==="Tecnología"?"bg-cyan-500":t.categoria==="Tendencia"?"bg-orange-500":"bg-red-600"}`,children:t.categoria}),t.destacada&&e.jsx("span",{className:"bg-yellow-400 text-black text-[10px] sm:text-xs md:text-xs px-2 py-1 rounded font-bold shadow-sm",children:"🌟 Destacada"}),r(t.createdAt)&&e.jsx("span",{className:"bg-blue-600 text-white text-[10px] sm:text-xs md:text-xs px-2 py-1 rounded font-bold shadow-sm",children:"New"})]}),e.jsx("h2",{className:"text-lg md:text-xl font-bold line-clamp-2 mt-0.5 mb-1 leading-snug text-white transition-colors duration-200",children:t.titulo}),e.jsx("p",{className:"excerpt text-sm sm:text-base md:text-base text-zinc-300 leading-snug break-words",children:t.extractoPlano})]})]}),e.jsx("div",{className:"news-card__footer px-4 md:px-5 pb-4 md:pb-5 flex-shrink-0 md:border-t md:border-zinc-700/30",children:e.jsxs("div",{className:"pt-1 sm:pt-1 flex flex-col gap-1 md:flex-row md:items-center md:justify-between",children:[e.jsxs("div",{children:[e.jsx("div",{className:"block md:hidden text-[11px] text-zinc-400",children:e.jsxs("div",{className:"flex items-center flex-wrap gap-2",children:[e.jsx("span",{className:"whitespace-nowrap",children:t.fecha.split(" a las ")[0]}),t.fecha.includes(" a las ")&&e.jsxs("span",{className:"whitespace-nowrap",children:["• ",t.fecha.split(" a las ")[1]]})]})}),e.jsx("div",{className:"hidden md:block text-xs text-zinc-400",children:t.fecha})]}),W(t._id,t.titulo)]})})]})}),R=t=>{switch(t){case"Hoy":return e.jsx(P,{className:"text-white/70",size:"1.5rem"});case"Esta semana":return e.jsx(Q,{className:"text-white/70",size:"1.5rem"});case"Este mes":return e.jsx(P,{className:"text-white/70",size:"1.5rem"});case"Anteriores":return e.jsx(K,{className:"text-white/70",size:"1.5rem"});default:return null}},W=(t,a)=>{const s=encodeURIComponent(`${window.location.origin}/noticias/${t}`),d=encodeURIComponent(a);return e.jsxs("div",{className:"flex gap-4 text-white text-xl",children:[e.jsx("a",{href:`https://wa.me/?text=${s}`,target:"_blank",rel:"noreferrer",className:"hover:text-green-400",children:e.jsx(V,{})}),e.jsx("a",{href:`https://www.facebook.com/sharer/sharer.php?u=${s}`,target:"_blank",rel:"noreferrer",className:"hover:text-blue-500",children:e.jsx(G,{})}),e.jsx("a",{href:`https://twitter.com/intent/tweet?url=${s}&text=${d}`,target:"_blank",rel:"noreferrer",className:"hover:text-sky-400",children:e.jsx(Y,{})}),e.jsx("a",{href:`https://t.me/share/url?url=${s}&text=${d}`,target:"_blank",rel:"noreferrer",className:"hover:text-blue-300",children:e.jsx(q,{})})]})},I=()=>e.jsxs("div",{className:"animate-pulse bg-zinc-800/80 rounded-2xl border border-zinc-700/50 shadow-lg shadow-black/40 w-full p-4 flex flex-col justify-between",style:{height:"var(--card-h)"},children:[e.jsx("div",{className:"bg-zinc-700/60 h-[45%] rounded-t-2xl mb-3"}),e.jsx("div",{className:"bg-zinc-700/60 h-4 rounded w-3/4 mb-2"}),e.jsx("div",{className:"bg-zinc-700/60 h-3 rounded w-2/3"})]});return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
/* ===== Altura fija + proporción de imagen (desktop más compacto) ===== */
:root { --card-h: 520px; --img-ratio: 0.45; }                  /* móvil / base */
@media (min-width: 1024px)  { :root { --card-h: 560px; --img-ratio: 0.42; } } /* ↑ antes 0.40 */
@media (min-width: 1280px)  { :root { --card-h: 580px; --img-ratio: 0.40; } } /* ↑ antes 0.36 */
@media (min-width: 1536px)  { :root { --card-h: 600px; --img-ratio: 0.38; } } /* ↑ antes 0.34 */

  /* Flechas del carrusel nativo - fuera del viewport, área táctil segura */
  .custom-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
    min-width: 40px;
    min-height: 40px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 20;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .custom-arrow:hover { 
    color: #ff4444; 
    background: rgba(0, 0, 0, 0.85);
    border-color: rgba(255, 68, 68, 0.4);
    transform: translateY(-50%) scale(1.08);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }
  .custom-arrow:focus-visible {
    outline: 2px solid #ff4444;
    outline-offset: 3px;
  }
  .left-arrow { left: -8px; }
  .right-arrow { right: -8px; }

  /* Desktop ≥1024px: offsets ±16px (flechas compactas) */
  @media (min-width: 1024px) {
    .left-arrow { left: -16px; }
    .right-arrow { right: -16px; }
  }

  /* Ocultar scrollbar en scroller móvil */
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* Evitar arrastre/selección en carrusel móvil (iOS Safari fix) */
  .carousel-touch-safe,
  .carousel-touch-safe * {
    -webkit-user-drag: none;
    user-drag: none;
    -webkit-touch-callout: none;
    user-select: none;
  }

  /* Ocultar scrollbar nativo pero mantener funcionalidad */
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  /* === Tarjeta: altura uniforme y sin "huecos" === */
  .news-card { display:flex; flex-direction:column; height:var(--card-h); min-height:var(--card-h); max-height:var(--card-h); overflow:hidden; }
  .news-card__media { width:100%; height: calc(var(--card-h) * var(--img-ratio)); overflow:hidden; flex-shrink:0; }
  .news-card__media img { width:100%; height:100%; object-fit:cover; }
  .news-card__body { flex: 0 0 auto; }              /* el cuerpo no "estira" la tarjeta */
  .news-card__footer { margin-top:auto; flex-shrink:0; } /* pie fijo al fondo */

  /* Clamps para evitar desbordes */
  .news-card h2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .news-card .excerpt{ display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  @media (min-width:1024px){ .news-card .excerpt{ -webkit-line-clamp:3; } } /* ↑ antes 2 líneas en desktop */

  /* Ajustes mobile */
  @media (max-width: 767px) {
    * { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
    .touch-action-manipulation { touch-action: manipulation !important; }
    .custom-arrow { background: rgba(0, 0, 0, 0.85); }
    .left-arrow { left: 8px; }
    .right-arrow { right: 8px; }
  }
`}),e.jsxs("div",{className:"min-h-screen bg-transparent text-white",children:[e.jsxs("header",{className:"max-w-6xl mx-auto px-4 md:px-6 pt-[calc(var(--nav-h,64px)+12px)] mb-4 md:mb-6",children:[e.jsx("div",{className:"flex sm:hidden items-center justify-between mb-3",children:e.jsxs(L,{to:"/",className:"inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 transition-colors",children:[e.jsx(U,{className:"w-4 h-4","aria-hidden":"true"}),"Volver al inicio"]})}),e.jsxs("nav",{"aria-label":"Breadcrumb",className:"hidden md:flex items-center gap-2 text-sm text-zinc-400 mb-2",children:[e.jsx(L,{to:"/",className:"hover:text-zinc-300 transition-colors",children:"Inicio"}),e.jsx(J,{className:"w-4 h-4","aria-hidden":"true"}),e.jsx("span",{className:"text-zinc-300",children:"Noticias"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60",children:e.jsx(B,{className:"w-5 h-5 text-zinc-300",strokeWidth:1.5,"aria-hidden":"true"})}),e.jsxs("h1",{className:"text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100",children:["Noticias ",e.jsx("span",{className:"text-zinc-400",children:"de LevántateCuba"})]})]})]}),e.jsxs("div",{className:"max-w-6xl mx-auto px-4 md:px-6",children:[e.jsx("div",{className:"mb-8 rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm p-4 md:p-5",children:e.jsxs("div",{className:"flex flex-col md:flex-row md:items-center md:justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-white font-semibold mb-1",children:"❤️ Apoya la causa"}),e.jsx("p",{className:"text-zinc-400 text-sm",children:"Visita nuestra tienda y ayuda a sostener esta plataforma independiente."})]}),e.jsx(L,{to:"/tienda",className:"inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 px-6 py-2.5 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-red-600/20 whitespace-nowrap",children:"Ver productos"})]})}),e.jsx("div",{className:"flex flex-wrap gap-2 justify-center mb-6",children:c.map(t=>e.jsx("button",{className:`px-4 py-1 rounded-full text-sm border transition ${v===t?"bg-red-600 border-red-600 text-white":"border-white/30 text-white/80 hover:bg-white/10"}`,onClick:()=>{F(t),N(9)},children:t},t))}),e.jsx("div",{className:"flex justify-center mb-8",children:e.jsx("input",{type:"text",placeholder:"Buscar noticias...",className:"px-4 py-2 w-full max-w-md rounded-lg bg-white/10 text-white border border-white/20",value:h,onChange:t=>{j(t.target.value),N(9)}})}),A?e.jsx("div",{className:"grid md:grid-cols-2 lg:grid-cols-3 gap-6",children:Array.from({length:6}).map((t,a)=>e.jsx(I,{},a))}):Object.entries(S).map(([t,a])=>a.length===0?null:e.jsxs("div",{className:"mb-10",children:[e.jsxs("h2",{className:"text-xl font-bold mb-6 text-white/90 flex items-center gap-3",children:[R(t),t]}),e.jsx("div",{className:"block sm:hidden",children:e.jsx("ul",{className:"flex flex-col gap-6 px-4 pb-8",children:a.map(s=>e.jsx("li",{className:"scroll-mb-4",children:p(s)},s._id||s.id))})}),e.jsx("div",{className:"hidden sm:block",children:e.jsx(ee,{items:a,label:`Carrusel de ${t}`,renderItem:p})})]},t)),m.length===0&&e.jsx("p",{className:"text-center text-gray-400 mt-10",children:"No se encontraron noticias con esos criterios."}),!1,e.jsx("div",{ref:f,className:"h-10 mt-10"})]})]})]})}export{ie as default};
