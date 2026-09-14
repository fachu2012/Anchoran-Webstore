function S(f,h){let u=`anchoran-plugin-style-${f}`;if(document.getElementById(u))return;let s=document.createElement("style");s.id=u,s.textContent=h,document.head.appendChild(s)}var N=`
.pk-root{height:100%;display:flex;flex-direction:column;color:var(--anchoran-text-primary,#F3F4F6);font-family:system-ui,sans-serif;}
.pk-toolbar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);flex-shrink:0;flex-wrap:wrap;}
.pk-btn{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);background:var(--anchoran-surface,#1c1d22);color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;cursor:pointer;}
.pk-btn:hover{background:var(--anchoran-border,#2a2c33);}
.pk-btn:disabled{opacity:.45;cursor:default;pointer-events:none;}
.pk-btn[data-active="true"],.pk-btn[data-op="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border-color:var(--anchoran-accent,#5B8DEF);color:var(--anchoran-accent,#5B8DEF);}
.pk-content{flex:1;min-height:0;overflow:auto;padding:16px;}
.pk-input{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:6px 8px;}
.pk-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 20px;color:var(--anchoran-text-secondary,#9aa0ab);text-align:center;}
`;var D=N+`
.cc-root{height:100%;display:flex;flex-direction:column;padding:16px;gap:12px;color:var(--anchoran-text-primary,#F3F4F6);}
.cc-memory-row{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.cc-mem-btn{border:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);border-radius:6px;font-size:12px;padding:5px 10px;color:var(--anchoran-text-primary,#F3F4F6);cursor:pointer;}
.cc-mem-btn:disabled{opacity:.4;cursor:default;}
.cc-mem-indicator{margin-left:auto;font-size:11px;font-weight:600;color:var(--anchoran-accent,#5B8DEF);}
.cc-display{flex-shrink:0;text-align:right;font-size:32px;font-weight:300;padding:12px 6px;overflow-x:auto;}
.cc-grid{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.cc-btn{border:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);border-radius:6px;font-size:16px;color:var(--anchoran-text-primary,#F3F4F6);cursor:pointer;}
.cc-btn:hover{background:var(--anchoran-border,#2a2c33);}
.cc-btn[data-op="true"]{color:var(--anchoran-accent,#5B8DEF);}
.cc-btn[data-equals="true"]{background:var(--anchoran-accent,#5B8DEF);color:#fff;border-color:var(--anchoran-accent,#5B8DEF);}
.cc-history{flex-shrink:0;max-height:120px;overflow-y:auto;border-top:1px solid var(--anchoran-border,#2a2c33);padding-top:8px;}
.cc-history-header{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);margin-bottom:4px;}
.cc-history-clear{border:none;background:transparent;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;font-size:11px;text-decoration:underline;}
.cc-history-row{display:flex;justify-content:space-between;gap:8px;padding:3px 2px;font-size:12px;cursor:pointer;color:var(--anchoran-text-secondary,#9aa0ab);}
.cc-history-row:hover{color:var(--anchoran-text-primary,#F3F4F6);}
.cc-history-result{color:var(--anchoran-text-primary,#F3F4F6);flex-shrink:0;}
`,B=["C","\xB1","%","\xF7","7","8","9","\xD7","4","5","6","\u2212","1","2","3","+","0",".","="];function $(f,h){S("calculator",D);let{React:u,ReactDOM:s}=h,{createElement:n,useState:o}=u;function C(){let[c,t]=o("0"),[i,x]=o(null),[l,g]=o(null),[v,p]=o(!1),[d,y]=o(null),[F,k]=o([]);function M(r){if(v){t(r==="."?"0.":r),p(!1);return}r==="."&&c.includes(".")||t(c==="0"&&r!=="."?r:c+r)}function w(r,a,e){switch(e){case"+":return r+a;case"\u2212":return r-a;case"\xD7":return r*a;case"\xF7":return a===0?NaN:r/a;default:return a}}function E(r){let a=parseFloat(c);if(r==="C"){t("0"),x(null),g(null),p(!1);return}if(r==="\xB1"){t(String(a*-1));return}if(r==="%"){t(String(a/100));return}if(r==="="){if(l&&i!==null){let e=w(i,a,l),O=`${i} ${l} ${a}`;t(String(e)),k(z=>[{expression:O,result:String(e)},...z].slice(0,30)),x(null),g(null),p(!0)}return}if(l&&i!==null&&!v){let e=w(i,a,l);x(e),t(String(e))}else x(a);g(r),p(!0)}function m(r){let a=parseFloat(c);r==="MC"?y(null):r==="MR"?d!==null&&(t(String(d)),p(!1)):r==="M+"?y(e=>(e??0)+a):r==="M-"&&y(e=>(e??0)-a)}return n("div",{className:"cc-root"},n("div",{className:"cc-memory-row"},n("button",{className:"cc-mem-btn",onClick:()=>m("MC"),disabled:d===null},"MC"),n("button",{className:"cc-mem-btn",onClick:()=>m("MR"),disabled:d===null},"MR"),n("button",{className:"cc-mem-btn",onClick:()=>m("M+")},"M+"),n("button",{className:"cc-mem-btn",onClick:()=>m("M-")},"M\u2212"),d!==null&&n("span",{className:"cc-mem-indicator"},"M")),n("div",{className:"cc-display"},c),n("div",{className:"cc-grid"},B.map(r=>{let a=["\xF7","\xD7","\u2212","+"].includes(r);return n("button",{key:r,className:"cc-btn","data-op":a,"data-equals":r==="=",style:r==="0"?{gridColumn:"span 2"}:void 0,onClick:()=>/[0-9.]/.test(r)?M(r):E(r)},r)})),F.length>0&&n("div",{className:"cc-history"},n("div",{className:"cc-history-header"},n("span",null,"History"),n("button",{className:"cc-history-clear",onClick:()=>k([])},"Clear")),F.map((r,a)=>n("div",{key:a,className:"cc-history-row",onClick:()=>t(r.result)},n("span",null,r.expression),n("span",{className:"cc-history-result"},`= ${r.result}`)))))}let b=s.createRoot(f);return b.render(n(C)),()=>b.unmount()}export{$ as mount};
