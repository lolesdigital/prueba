
(() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbygO20u3jSvivUgfwkD6kVBSZv5VP4fuvTjf-ejpv4hWmnckc_24uiWbA_f-DyLyUpH/exec";
  const WA_NUMBER = '5491178947062';

  document.body.classList.add('ns-active');

  const $ = id => document.getElementById(id);
  const money = n => '$' + Number(n || 0).toLocaleString('es-AR');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  const cakeImageFix = {
    'torta-a-chocotorta':'assets/torta-22000-chocolate.png',
    'torta-choco-ddl':'assets/torta-28000-chocolate.png',
    'torta-a-frutilla':'assets/torta-22000-frutilla.png',
    'torta-frutilla':'assets/torta-28000-frutilla.png'
  };

  const categoryMap = {
    tortas:'tortas', postres:'postres', paletas:'paletas', guapaletas:'guapaletas',
    franui:'franui', banana:'banana', hielo:'hielo'
  };

  function buildCatalog(){
    const list = [];
    if (typeof POTES !== 'undefined') {
      POTES.forEach(p => list.push({
        id:p.id,name:p.name,price:Number(p.price),img:p.img,desc:`Hasta ${p.gustos} gustos`,cat:'helados',kind:'helado',raw:p
      }));
    }
    if (typeof PRODUCTOS_EXTRA !== 'undefined') {
      PRODUCTOS_EXTRA.forEach(p => {
        const cat = categoryMap[p.categoria] || 'antojos';
        list.push({
          id:p.id,name:p.name,price:Number(p.price),img:cakeImageFix[p.id]||p.img,desc:p.desc||'',cat,kind:'producto',stock:p.stock,raw:p
        });
      });
    }
    return list;
  }

  const state = {
    catalog: buildCatalog(),
    cart: JSON.parse(localStorage.getItem('dm_new_cart') || '[]'),
    cat:'todos',
    shipping:{km:null,cost:0,duration:'',maps:''},
    mode:'delivery',
    config:null
  };

  const cats = [
    ['todos','Todo'],['helados','Helados'],['tortas','Tortas'],['postres','Postres'],
    ['paletas','Paletas'],['guapaletas','Guapaletas'],['franui','Franui'],
    ['banana','Banana Bites'],['hielo','Hielo'],['antojos','Otros']
  ];

  function levenshtein(a,b){
    a=norm(a); b=norm(b);
    const d=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=t;}}
    return d[b.length];
  }
  function score(p,q){
    q=norm(q).trim(); if(!q) return 1;
    const aliases = {
      p250:['cuarto kilo','un cuarto','1/4','¼','250','250g'],
      p500:['medio kilo','medio kg','1/2','½','500','500g','mwdio kulo','medio kulo'],
      p1k:['kilo','un kilo','1kg','1000g'],
      p2k:['dos kilos','2 kilos','2kg','2000g']
    };
    const pool=[p.name,p.desc,...(aliases[p.id]||[])].filter(Boolean).map(norm);
    let best=0;
    for(const x of pool){
      if(x===q) best=Math.max(best,100);
      else if(x.includes(q)||q.includes(x)) best=Math.max(best,90);
      else {
        const s=1-levenshtein(q,x)/Math.max(q.length,x.length,1);
        if(s>.62) best=Math.max(best,55+s*30);
      }
    }
    return best;
  }

  function saveCart(){
    localStorage.setItem('dm_new_cart', JSON.stringify(state.cart));
    renderCart();
    renderFloating();
    renderSummary();
  }

  function cartSubtotal(){
    return state.cart.reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||1),0);
  }
  function grandTotal(){
    return cartSubtotal() + (state.mode==='delivery' ? Number(state.shipping.cost||0) : 0);
  }

  function toast(msg){
    const t=$('nsToast'); t.textContent=msg; t.classList.add('show');
    clearTimeout(window.__nsToast); window.__nsToast=setTimeout(()=>t.classList.remove('show'),1400);
  }

  function goHome(){
    $('nsHome').classList.remove('ns-hidden');
    $('nsMenu').classList.add('ns-hidden');
    $('nsCheckout').classList.add('ns-hidden');
    closeAll(); window.scrollTo({top:0,behavior:'smooth'});
  }
  function goMenu(cat){
    $('nsHome').classList.add('ns-hidden');
    $('nsMenu').classList.remove('ns-hidden');
    $('nsCheckout').classList.add('ns-hidden');
    if(cat) state.cat=cat;
    renderTabs(); renderCatalog(); closeAll(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderTabs(){
    $('nsTabs').innerHTML=cats.map(([id,l])=>`<button class="ns-tab ${state.cat===id?'active':''}" onclick="NS.setCat('${id}')">${l}</button>`).join('');
  }

  function renderCatalog(){
    const q=$('nsSearch')?.value||'';
    let list=state.catalog
      .filter(p=>state.cat==='todos'||p.cat===state.cat||(state.cat==='antojos'&&['franui','banana','hielo','paletas','guapaletas'].includes(p.cat)))
      .map(p=>({p,s:score(p,q)}))
      .filter(x=>!q||x.s>=55)
      .sort((a,b)=>b.s-a.s)
      .map(x=>x.p);

    $('nsCatalog').innerHTML=list.map(p=>`
      <article class="ns-card">
        <div class="ns-card-img"><img src="${p.img||'assets/img-c2a4b8570ca4.webp'}" alt="${p.name}"></div>
        <div class="ns-card-body">
          <div class="ns-card-name">${p.name}</div>
          <div class="ns-card-desc">${p.desc||''}</div>
          ${p.stock===0?'<div class="ns-stock">Sin stock informado · consultanos</div>':''}
          <div class="ns-card-price">${money(p.price)}</div>
          <button class="ns-btn primary full" onclick="NS.pickProduct('${p.id}')">${p.kind==='helado'?'Elegir gustos':'Agregar'}</button>
        </div>
      </article>`).join('') || '<p>No encontré productos con esa búsqueda.</p>';
  }

  function pickProduct(id){
    const p=state.catalog.find(x=>String(x.id)===String(id)); if(!p)return;
    if(p.kind==='helado') return openConfigurator(id);
    addSimpleProduct(p);
  }

  function addSimpleProduct(p){
    const existing=state.cart.find(x=>x.type==='producto'&&x.id===p.id);
    if(existing) existing.qty++;
    else state.cart.push({type:'producto',id:p.id,name:p.name,img:p.img,price:p.price,qty:1,desc:p.desc||''});
    saveCart(); toast('Agregado al pedido');
  }

  function openConfigurator(id){
    const p=state.catalog.find(x=>x.id===id); if(!p)return;
    state.config={p,flavors:{},extras:{}};
    $('nsConfigTitle').textContent=p.name;
    $('nsConfigTotal').textContent=money(p.price);
    renderConfigurator();
    $('nsConfigurator').classList.add('open');
  }
  function closeConfigurator(){ $('nsConfigurator').classList.remove('open'); state.config=null; }

  function selectedFlavorCount(){
    return Object.values(state.config?.flavors||{}).reduce((a,b)=>a+Number(b||0),0);
  }

  function renderConfigurator(){
    const c=state.config;if(!c)return;
    const max=Number(c.p.raw.gustos||2);
    const used=selectedFlavorCount();
    const flavors=(typeof GUSTOS!=='undefined'?GUSTOS:[]);

    const flavorHtml=flavors.map(g=>{
      const n=Number(c.flavors[g.id]||0);
      return `<div class="ns-flavor ${n?'selected':''}">
        <img src="${g.img}" alt="${g.name}">
        <div><div class="ns-flavor-name">${g.name}</div><small>${n?`x${n}`:''}</small></div>
        <button onclick="NS.toggleFlavor('${g.id}')">${n?'−':'+'}</button>
      </div>`;
    }).join('');

    const extras=(typeof TOPPINGS!=='undefined'?TOPPINGS:[]);
    const extrasHtml=extras.map(e=>{
      const n=Number(c.extras[e.id]||0);
      const isSauce=['t2','t3','t4'].includes(e.id);
      return `<button class="ns-extra ${n?'selected':''}" onclick="NS.toggleExtra('${e.id}')">
        ${e.icon||'+'} ${e.name} ${n?`· x${n}`:''}
        <small>${isSauce?'1 salsa gratis por pote · adicionales $1.500':money(e.price)}</small>
      </button>`;
    }).join('');

    $('nsConfigBody').innerHTML=`
      <section class="ns-config-section">
        <h3>Elegí tus gustos</h3>
        <p>Podés elegir hasta ${max} · llevás ${used}.</p>
        <div class="ns-flavors">${flavorHtml}</div>
      </section>
      <section class="ns-config-section">
        <h3>Salsas y extras</h3>
        <p>La primera salsa del pote es gratis. Cada salsa adicional cuesta $1.500.</p>
        <div class="ns-extra-grid">${extrasHtml}</div>
      </section>`;

    const total=configTotal();
    $('nsConfigTotal').textContent=money(total);
    $('nsConfigAdd').disabled=used===0;
  }

  function toggleFlavor(id){
    const c=state.config;if(!c)return;
    const max=Number(c.p.raw.gustos||2);
    const current=Number(c.flavors[id]||0);
    if(current>0) delete c.flavors[id];
    else {
      if(selectedFlavorCount()>=max) return toast(`Podés elegir hasta ${max} gustos`);
      c.flavors[id]=1;
    }
    renderConfigurator();
  }

  function toggleExtra(id){
    const c=state.config;if(!c)return;
    const current=Number(c.extras[id]||0);
    if(current>=3) delete c.extras[id]; else c.extras[id]=current+1;
    renderConfigurator();
  }

  function configTotal(){
    const c=state.config;if(!c)return 0;
    let total=Number(c.p.price);
    let sauces=0;
    for(const [id,n] of Object.entries(c.extras)){
      const e=(typeof TOPPINGS!=='undefined'?TOPPINGS:[]).find(x=>x.id===id);
      if(!e)continue;
      if(['t2','t3','t4'].includes(id)) sauces+=Number(n);
      else total+=Number(e.price||0)*Number(n);
    }
    total+=Math.max(0,sauces-1)*1500;
    return total;
  }

  function addConfiguredIcecream(){
    const c=state.config;if(!c)return;
    if(selectedFlavorCount()===0) return toast('Elegí al menos un gusto');
    const flavorNames=Object.keys(c.flavors).map(id=>GUSTOS.find(g=>g.id===id)).filter(Boolean).map(g=>g.ticketName||g.name);
    const extrasArr=[];let sauceQty=0;
    for(const [id,n] of Object.entries(c.extras)){
      const e=TOPPINGS.find(x=>x.id===id);if(!e)continue;
      extrasArr.push({id:e.id,name:e.name,qty:Number(n),price:Number(e.price||0),type:['t2','t3','t4'].includes(id)?'sauce':'extra'});
      if(['t2','t3','t4'].includes(id)) sauceQty+=Number(n);
    }
    state.cart.push({
      type:'helado', id:c.p.id, name:c.p.name, img:c.p.img, price:configTotal(), basePrice:c.p.price, qty:1,
      flavors:flavorNames, extras:extrasArr, sauceQty
    });
    closeConfigurator();saveCart();toast('Helado agregado');
  }

  function changeQty(index,delta){
    const item=state.cart[index];if(!item)return;
    item.qty=Number(item.qty||1)+delta;
    if(item.qty<=0) state.cart.splice(index,1);
    saveCart();
  }

  function renderCart(){
    const root=$('nsCartItems'); if(!root)return;
    if(!state.cart.length) root.innerHTML='<p style="color:#75656B">Todavía no agregaste productos.</p>';
    else root.innerHTML=state.cart.map((x,i)=>`
      <div class="ns-cart-row">
        <img src="${x.img||'assets/img-c2a4b8570ca4.webp'}" alt="">
        <div>
          <div class="ns-cart-row-name">${x.name}</div>
          ${x.type==='helado'?`<div class="ns-cart-row-sub">${(x.flavors||[]).join(' · ')}${x.extras?.length?'<br>Extras: '+x.extras.map(e=>e.name+(e.qty>1?' x'+e.qty:'')).join(', '):''}</div>`:`<div class="ns-cart-row-sub">${x.desc||''}</div>`}
          <div class="ns-cart-row-price">${money(x.price)}</div>
        </div>
        <div class="ns-qty"><button onclick="NS.changeQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="NS.changeQty(${i},1)">+</button></div>
      </div>`).join('');
    $('nsCartTotal').textContent=money(cartSubtotal());
  }

  function renderFloating(){
    const count=state.cart.reduce((a,x)=>a+Number(x.qty||1),0);
    $('nsCartBadge').textContent=count;$('nsFloatingCount').textContent=count;$('nsFloatingTotal').textContent=money(cartSubtotal());
    $('nsFloatingCart').style.display=count?'flex':'none';
  }

  function openCart(){ $('nsCartDrawer').classList.add('open');$('nsScrim').classList.add('show');renderCart(); }
  function closeCart(){ $('nsCartDrawer').classList.remove('open');$('nsScrim').classList.remove('show'); }
  function closeAll(){ closeCart(); closeConfigurator(); }

  function openCheckout(){
    if(!state.cart.length) return toast('Primero agregá algo al pedido');
    closeAll();
    $('nsHome').classList.add('ns-hidden');$('nsMenu').classList.add('ns-hidden');$('nsCheckout').classList.remove('ns-hidden');
    renderSummary();window.scrollTo({top:0,behavior:'smooth'});
  }

  function setMode(mode){
    state.mode=mode;
    $('nsModeDelivery').classList.toggle('active',mode==='delivery');$('nsModePickup').classList.toggle('active',mode==='retiro');
    $('nsDeliveryFields').classList.toggle('ns-hidden',mode!=='delivery');$('nsPickupInfo').classList.toggle('ns-hidden',mode!=='retiro');
    if(mode==='retiro') state.shipping={km:null,cost:0,duration:'',maps:''};
    renderSummary();
  }

  async function api(action,data) {
    const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,data})});
    return await r.json();
  }

  async function quoteShipping(){
    const address=$('nsAddress').value.trim();if(!address)return toast('Escribí la dirección');
    $('nsShippingBox').textContent='Calculando…';
    try{
      const r=await api('quote',{address});
      if(!r.ok) throw new Error(r.error||'No pude calcular');
      state.shipping={km:Number(r.km),cost:r.costo==null?0:Number(r.costo),duration:r.duracion||'',maps:r.maps||''};
      $('nsShippingBox').innerHTML = r.costo==null
        ? `📍 ${Number(r.km).toFixed(1)} km · <b>envío a consultar</b>`
        : `📍 ${Number(r.km).toFixed(1)} km · ${r.duracion||''} · <b>${money(r.costo)}</b>`;
      renderSummary();
    }catch(e){ $('nsShippingBox').textContent='No pude calcular. Revisá la dirección e intentá otra vez.'; }
  }

  function paymentChanged(){
    const cash=$('nsPayment').value==='Efectivo';
    $('nsCashWrap').classList.toggle('ns-hidden',!cash);$('nsTransferWrap').classList.toggle('ns-hidden',cash);
    renderSummary();
  }

  function renderSummary(){
    if(!$('nsCheckoutItems'))return;
    $('nsCheckoutItems').innerHTML=state.cart.map(x=>`
      <div class="ns-check-item">
        <div><b>${x.qty} × ${x.name}</b>${x.type==='helado'?`<small>${(x.flavors||[]).join(', ')}</small>`:''}</div>
        <b>${money(Number(x.price)*Number(x.qty))}</b>
      </div>`).join('');
    const sub=cartSubtotal(), ship=state.mode==='delivery'?Number(state.shipping.cost||0):0,total=sub+ship;
    $('nsSubtotal').textContent=money(sub);$('nsShipCost').textContent=money(ship);$('nsGrandTotal').textContent=money(total);
    const cash=Number($('nsCash')?.value||0);$('nsChange').textContent='Vuelto: '+money(Math.max(0,cash-total));
  }

  function orderPayload(){
    const payment=$('nsPayment').value;
    const items=state.cart.map(x=>({id:x.id,nombre:x.name,precio:Number(x.price),cantidad:Number(x.qty)}));
    const notes=state.cart.filter(x=>x.type==='helado').map(x=>`${x.name}: ${(x.flavors||[]).join(', ')}${x.extras?.length?' | Extras: '+x.extras.map(e=>e.name+(e.qty>1?' x'+e.qty:'')).join(', '):''}`).join(' / ');
    return {
      canal:'Web Dulce Mora',
      cliente:$('nsName').value.trim(),telefono:$('nsPhone').value.trim(),
      direccion:state.mode==='delivery'?$('nsAddress').value.trim():'Retiro en local',
      referencias:state.mode==='delivery'?$('nsRefs').value.trim():'',
      con_envio:state.mode==='delivery',
      distancia_km:state.shipping.km??'',costo_envio:state.mode==='delivery'?Number(state.shipping.cost||0):0,
      maps_link:state.shipping.maps||'',medio_pago:payment,transferencia_pagada:'',
      paga_con:payment==='Efectivo'?Number($('nsCash').value||0):'',
      vuelto:payment==='Efectivo'?Math.max(0,Number($('nsCash').value||0)-grandTotal()):0,
      notas:[notes,$('nsNotes').value.trim()].filter(Boolean).join(' | '),
      items,extras:[],subtotal:cartSubtotal(),total:grandTotal()
    };
  }

  function whatsappMessage(p){
    let msg='🍦 *PEDIDO DULCE MORA*\n\n🛒 *PRODUCTOS*\n';
    state.cart.forEach((x,i)=>{
      msg+=`\n*${i+1}. ${x.name} x${x.qty}*\n`;
      if(x.type==='helado'){
        msg+=`Gustos: ${(x.flavors||[]).join(', ')}\n`;
        if(x.extras?.length) msg+=`Extras: ${x.extras.map(e=>e.name+(e.qty>1?' x'+e.qty:'')).join(', ')}\n`;
      }
      msg+=`Precio: ${money(Number(x.price)*Number(x.qty))}\n`;
    });
    msg+='\n━━━━━━━━━━━━━━━━━━━━\n';
    if(state.mode==='delivery'){
      msg+=`🛵 *DELIVERY*\n👤 ${p.cliente}\n📞 ${p.telefono}\n📍 ${p.direccion}\n`;
      if(p.referencias)msg+=`📝 ${p.referencias}\n`;
      if(state.shipping.km!=null)msg+=`📏 ${state.shipping.km.toFixed(1)} km\n`;
      msg+=`🛵 Envío: ${state.shipping.cost?money(state.shipping.cost):'A consultar'}\n`;
    }else{
      msg+=`🏠 *RETIRO*\n👤 ${p.cliente}\n📞 ${p.telefono}\n📍 Luis Santiago Genoud 2102\n`;
    }
    msg+=`\n💳 Pago: ${p.medio_pago}\n`;
    if(p.medio_pago==='Efectivo'&&p.paga_con) msg+=`Paga con: ${money(p.paga_con)} · Vuelto: ${money(p.vuelto)}\n`;
    if($('nsNotes').value.trim())msg+=`📝 Nota: ${$('nsNotes').value.trim()}\n`;
    msg+=`\n*TOTAL: ${money(p.total)}*\n\nGracias por elegir Dulce Mora 🐾`;
    return msg;
  }

  async function confirmOrder(){
    const p=orderPayload();
    if(!p.cliente||!p.telefono)return toast('Completá nombre y teléfono');
    if(state.mode==='delivery'&&!p.direccion)return toast('Completá la dirección');
    if(state.mode==='delivery'&&state.shipping.km==null)return toast('Calculá el envío antes de confirmar');
    $('nsConfirmBtn').disabled=true;$('nsConfirmBtn').textContent='Preparando pedido…';

    try{ await api('saveOrder',p); }catch(e){ console.warn('No se pudo registrar en panel',e); }
    const url='https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(whatsappMessage(p));
    window.open(url,'_blank');
    $('nsConfirmBtn').disabled=false;$('nsConfirmBtn').textContent='Confirmar por WhatsApp';
  }

  window.NS={
    goHome,goMenu,setCat:(c)=>{state.cat=c;renderTabs();renderCatalog()},renderCatalog,pickProduct,
    openCart,closeCart,closeAll,openCheckout,setMode,quoteShipping,paymentChanged,renderSummary,
    openConfigurator,closeConfigurator,toggleFlavor,toggleExtra,addConfiguredIcecream,changeQty,confirmOrder
  };

  renderTabs();renderCatalog();renderCart();renderFloating();setMode('delivery');paymentChanged();
})();
