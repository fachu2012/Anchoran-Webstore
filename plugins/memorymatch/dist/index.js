function S(c,e){let r=`anchoran-plugin-style-${c}`;if(document.getElementById(r))return;let n=document.createElement("style");n.id=r,n.textContent=e,document.head.appendChild(n)}var w=`
.pk-root{height:100%;display:flex;flex-direction:column;color:var(--anchoran-text-primary,#F3F4F6);font-family:system-ui,sans-serif;}
.pk-toolbar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);flex-shrink:0;flex-wrap:wrap;}
.pk-btn{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);background:var(--anchoran-surface,#1c1d22);color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;cursor:pointer;}
.pk-btn:hover{background:var(--anchoran-border,#2a2c33);}
.pk-btn:disabled{opacity:.45;cursor:default;pointer-events:none;}
.pk-btn[data-active="true"],.pk-btn[data-op="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border-color:var(--anchoran-accent,#5B8DEF);color:var(--anchoran-accent,#5B8DEF);}
.pk-content{flex:1;min-height:0;overflow:auto;padding:16px;}
.pk-input{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:6px 8px;}
.pk-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 20px;color:var(--anchoran-text-secondary,#9aa0ab);text-align:center;}
`;var L=w+`
.mm-moves{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.mm-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.mm-board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:min(100%,320px);}
.mm-card{position:relative;aspect-ratio:1/1;border:none;background:transparent;cursor:pointer;perspective:600px;padding:0;}
.mm-card-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:var(--anchoran-radius-md,10px);backface-visibility:hidden;transition:transform 300ms ease;font-size:22px;}
.mm-card-front{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);transform:rotateY(0deg);}
.mm-card-back{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border:1px solid var(--anchoran-accent,#5B8DEF);color:var(--anchoran-accent,#5B8DEF);transform:rotateY(180deg);}
.mm-card[data-open="true"] .mm-card-front{transform:rotateY(-180deg);}
.mm-card[data-open="true"] .mm-card-back{transform:rotateY(0deg);}
.mm-card[data-matched="true"] .mm-card-back{opacity:.7;}
.mm-won{font-size:13.5px;color:var(--anchoran-accent,#5B8DEF);}
`,F=["\u25C6","\u25CF","\u25A0","\u25B2","\u2605","\u271A","\u25C9","\u25C8"];function O(c){let e=[...c];for(let r=e.length-1;r>0;r--){let n=Math.floor(Math.random()*(r+1));[e[r],e[n]]=[e[n],e[r]]}return e}function N(){return O([...F,...F]).map((c,e)=>({id:e,symbol:c,flipped:!1,matched:!1}))}function $(c,e){S("memorymatch",L);let{React:r,ReactDOM:n,Icon:h}=e,{createElement:t,useState:i,useEffect:E,useMemo:C}=r;function j(){let[d,l]=i(N),[m,u]=i([]),[b,g]=i(0),[B,f]=i(!1),D=C(()=>d.every(a=>a.matched),[d]);E(()=>{if(m.length!==2)return;f(!0),g(s=>s+1);let[a,o]=m,p=window.setTimeout(()=>{l(s=>{let v=s[a].symbol===s[o].symbol;return s.map((y,k)=>k===a||k===o?{...y,matched:v,flipped:v}:y)}),u([]),f(!1)},600);return()=>window.clearTimeout(p)},[m]);function M(a){B||d[a].flipped||d[a].matched||m.includes(a)||(l(o=>o.map((p,s)=>s===a?{...p,flipped:!0}:p)),u(o=>[...o,a]))}function z(){l(N()),u([]),g(0),f(!1)}return t("div",{className:"pk-root"},t("div",{className:"pk-toolbar"},t("button",{className:"pk-btn",onClick:z},h?t(h,{name:"restart",size:14}):null," New game"),t("div",{className:"mm-moves"},`Moves: ${b}`)),t("div",{className:"pk-content mm-content"},t("div",{className:"mm-board"},d.map((a,o)=>t("button",{key:a.id,className:"mm-card","data-open":a.flipped||a.matched,"data-matched":a.matched,onClick:()=>M(o)},t("span",{className:"mm-card-face mm-card-front"}),t("span",{className:"mm-card-face mm-card-back"},a.symbol)))),D&&t("div",{className:"mm-won"},`Solved in ${b} moves!`)))}let x=n.createRoot(c);return x.render(t(j)),()=>x.unmount()}export{$ as mount};
