(async function(){
const home=document.getElementById('home-view');if(!home)return;
const section=document.createElement('section');section.id='published-market-areas';
section.setAttribute('aria-label','Yayındaki ülke ve dönem pazarları');
section.className='max-w-7xl mx-auto px-4 mt-7 mb-6';
section.hidden=true;
const heading=document.createElement('div');heading.className='flex flex-wrap items-center justify-between gap-3 mb-4';
const title=document.createElement('div');title.innerHTML='<span class="text-xs font-bold uppercase tracking-widest text-brand">GastroPazar</span><h2 class="text-xl md:text-2xl font-serif font-bold text-gray-800">Şu anda açık pazarlar</h2><p class="text-sm text-gray-500">Ülke ve döneme özel yayınlanan alanlar</p>';
heading.appendChild(title);
const cards=document.createElement('div');cards.className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4';
section.append(heading,cards);
const anchor=home.querySelector('main')||home.firstElementChild;
if(anchor)anchor.parentNode.insertBefore(section,anchor);else home.append(section);
try{
 const resp=await fetch('/api/market-areas',{cache:'no-store'});
 if(!resp.ok)throw Error('Pazar verileri erişilemiyor');
 const data=await resp.json();const areas=Array.isArray(data.areas)?data.areas:[];
 cards.replaceChildren();
 const countryNames={NL:'Hollanda',TR:'Türkiye',DE:'Almanya',BE:'Belçika',FR:'Fransa',GB:'Birleşik Krallık'};
 const flags={NL:'🇳🇱',TR:'🇹🇷',DE:'🇩🇪',BE:'🇧🇪',FR:'🇫🇷',GB:'🇬🇧'};
 for(const a of areas){
  const card=document.createElement('a');
  card.href='/alan.html?country='+encodeURIComponent(a.country_code)+'&period='+encodeURIComponent(a.period_key);
  card.className='block rounded-2xl border border-orange-100 bg-white hover:shadow-lg hover:border-orange-300 transition overflow-hidden';
  const body=document.createElement('div');body.className='p-5';
  const flag=document.createElement('div');flag.className='text-3xl mb-3';flag.textContent=flags[a.country_code]||'🍲';
  const badge=document.createElement('span');badge.className='text-xs font-bold text-green-700 bg-green-50 rounded-full px-3 py-1';badge.textContent='● Yayında';
  const h=document.createElement('h3');h.className='font-serif text-lg font-bold mt-3 text-gray-800';h.textContent=a.title;
  const sub=document.createElement('p');sub.className='text-sm text-gray-500 mt-2';sub.textContent=(countryNames[a.country_code]||a.country_code)+' · '+a.period_key.replaceAll('-',' ');
  const more=document.createElement('p');more.className='mt-4 text-sm font-bold text-orange-600';more.textContent='Alanı keşfet →';
  body.append(flag,badge,h,sub,more);card.append(body);cards.append(card);
 }
 section.hidden=areas.length===0;
}catch(e){console.warn('Published areas unavailable',e)}
})();