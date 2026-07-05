/* ═══════════════════════════════════════════════════════════════
   CropPulse AI — app.js  v2
   Onboarding + Farm tab (indicators / grid / calendar)
                + AI Assistant tab (context / suggestions / chat)
═══════════════════════════════════════════════════════════════ */
'use strict';

// ─────────────────────────────────────────────────────────────
// GLOBAL STATE
// -------------------------------------------------------------
const APP = {
    userId:         'farmer_' + Math.random().toString(36).slice(2, 9),
    sessionId:      'session_' + Math.random().toString(36).slice(2, 9),
    profile:        null,   // localStorage farm profile
    indicators:     [],     // [{parcel, crop, status, pending_action, ...}]
    cropPlan:       [],     // [{date, parcel, crop, activity, status}]
    selectedParcel: null,   // { id, crop } or null
    calDate:        new Date(),
    selectedCalDay: null,
    weather:        null,   // {temp, humidity, condition}
    prices:         {},     // { cropId: { price, unit, change } }
    messages:       [],     // chat history
    pendingImage:   null,   // { base64, mimeType, dataUrl }
};

const STORAGE_KEY = 'croppulse_farm_profile';

// ─────────────────────────────────────────────────────────────
// CROP DEFINITIONS
// -------------------------------------------------------------
const CROPS = [
    { id:'cacao',    label:'Cacao',    icon:'🍫', bg:'#E1F5EE', tx:'#065f46', color:'#10b981' },
    { id:'banana',   label:'Banana',   icon:'🍌', bg:'#FAEEDA', tx:'#92400e', color:'#f59e0b' },
    { id:'coffee',   label:'Coffee',   icon:'☕', bg:'#FAECE7', tx:'#9a3412', color:'#f97316' },
    { id:'palm_oil', label:'Palm Oil', icon:'🌴', bg:'#E6F1FB', tx:'#1e40af', color:'#3b82f6' },
    { id:'rice',     label:'Rice',     icon:'🌾', bg:'#E6F1FB', tx:'#1e40af', color:'#3b82f6' },
    { id:'maize',    label:'Maize',    icon:'🌽', bg:'#FAEEDA', tx:'#92400e', color:'#f59e0b' },
    { id:'plantain', label:'Plantain', icon:'🍌', bg:'#E6F1FB', tx:'#1e40af', color:'#3b82f6' },
    { id:'cassava',  label:'Cassava',  icon:'🥔', bg:'#EEF2EE', tx:'#3f6212', color:'#84cc16' },
    { id:'other',    label:'Other',    icon:'🌱', bg:'#E6F1FB', tx:'#1e40af', color:'#3b82f6' },
    { id:'empty',    label:'Empty',    icon:'✕',  bg:null,      tx:null,      color:'#56708a'  },
];
const cropOf = id => CROPS.find(c => c.id === id) || null;

// WMO weather codes → short description
const WMO = {
    0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
    45:'Foggy', 48:'Rime fog', 51:'Light drizzle', 53:'Moderate drizzle', 55:'Dense drizzle',
    61:'Light rain', 63:'Moderate rain', 65:'Heavy rain',
    71:'Light snow', 73:'Moderate snow', 75:'Heavy snow',
    80:'Slight showers', 81:'Moderate showers', 82:'Violent showers',
    95:'Thunderstorm', 96:'Thunderstorm + hail', 99:'Thunderstorm + heavy hail',
};

// ─────────────────────────────────────────────────────────────
// LOCATION DATA (mirrors Python MCP lookup)
// -------------------------------------------------------------
const LOCATION_DATA = {
    ecuador: {
        'Azuay':['Cuenca','Girón','Santa Isabel','Sigsig','Pucará'],
        'Bolívar':['Guaranda','Chillanes','Caluma','Echeandía'],
        'Cañar':['Azogues','Biblián','Cañar','La Troncal'],
        'Carchi':['Tulcán','Montúfar','Espejo','Mira'],
        'Chimborazo':['Riobamba','Alausí','Chunchi','Guano','Penipe'],
        'Cotopaxi':['Latacunga','Pujilí','Salcedo','Sigchos','La Maná'],
        'El Oro':['Machala','Santa Rosa','Pasaje','Huaquillas','Arenillas'],
        'Esmeraldas':['Esmeraldas','Quinindé','San Lorenzo','Muisne','Atacames'],
        'Galápagos':['Puerto Ayora','Puerto Baquerizo Moreno','Puerto Villamil'],
        'Guayas':['Guayaquil','Durán','Milagro','Daule','Samborondón','Naranjal'],
        'Imbabura':['Ibarra','Otavalo','Cotacachi','Antonio Ante','Urcuquí'],
        'Loja':['Loja','Catamayo','Macará','Cariamanga','Zapotillo'],
        'Los Ríos':['Babahoyo','Quevedo','Vinces','Buena Fe','Valencia'],
        'Manabí':['Portoviejo','Manta','Chone','El Carmen','Pedernales','Jipijapa','Montecristi','Bahía de Caráquez'],
        'Morona Santiago':['Macas','Sucúa','Gualaquiza','Palora'],
        'Napo':['Tena','Archidona','El Chaco'],
        'Orellana':['Francisco de Orellana','Loreto','La Joya de los Sachas'],
        'Pastaza':['Puyo','Mera','Santa Clara'],
        'Pichincha':['Quito','Cayambe','Mejía','Rumiñahui','Pedro Moncayo'],
        'Santa Elena':['Santa Elena','Salinas','La Libertad'],
        'Santo Domingo de los Tsáchilas':['Santo Domingo'],
        'Sucumbíos':['Lago Agrio','Shushufindi','Cuyabeno'],
        'Tungurahua':['Ambato','Baños','Pelileo','Píllaro'],
        'Zamora Chinchipe':['Zamora','Yantzaza','Centinela del Cóndor'],
    },
    colombia: {
        'Antioquia':['Medellín','Bello','Envigado','Apartadó','Turbo'],
        'Atlántico':['Barranquilla','Soledad','Malambo'],
        'Bogotá D.C.':['Bogotá'],
        'Bolívar':['Cartagena','Magangué'],
        'Caldas':['Manizales','Chinchiná','Villamaría'],
        'Cauca':['Popayán','Santander de Quilichao'],
        'Cesar':['Valledupar','Aguachica'],
        'Córdoba':['Montería','Cereté'],
        'Cundinamarca':['Bogotá','Soacha','Fusagasugá'],
        'Huila':['Neiva','Pitalito','Garzón'],
        'La Guajira':['Riohacha','Maicao'],
        'Magdalena':['Santa Marta','Ciénaga'],
        'Meta':['Villavicencio','Acacías'],
        'Nariño':['Pasto','Tumaco','Ipiales'],
        'Norte de Santander':['Cúcuta','Ocaña'],
        'Quindío':['Armenia','Calarcá'],
        'Risaralda':['Pereira','Dosquebradas','Santa Rosa de Cabal'],
        'Santander':['Bucaramanga','Floridablanca','Barrancabermeja'],
        'Sucre':['Sincelejo','Corozal'],
        'Tolima':['Ibagué','Espinal','Melgar'],
        'Valle del Cauca':['Cali','Buenaventura','Palmira','Tuluá'],
    },
    peru: {
        'Amazonas':['Chachapoyas','Bagua'],
        'Áncash':['Huaraz','Chimbote','Carhuaz'],
        'Apurímac':['Abancay','Andahuaylas'],
        'Arequipa':['Arequipa','Mollendo','Camana'],
        'Ayacucho':['Ayacucho','Huanta'],
        'Cajamarca':['Cajamarca','Jaén','Chota'],
        'Cusco':['Cusco','Espinar','Quillabamba'],
        'Huancavelica':['Huancavelica','Acobamba'],
        'Huánuco':['Huánuco','Tingo María'],
        'Ica':['Ica','Pisco','Nazca'],
        'Junín':['Huancayo','Tarma','La Merced'],
        'La Libertad':['Trujillo','Chepén','Otuzco'],
        'Lambayeque':['Chiclayo','Ferreñafe','Lambayeque'],
        'Lima':['Lima','Barranca','Cañete'],
        'Loreto':['Iquitos','Yurimaguas'],
        'Madre de Dios':['Puerto Maldonado'],
        'Moquegua':['Moquegua','Ilo'],
        'Pasco':['Cerro de Pasco','Oxapampa'],
        'Piura':['Piura','Sullana','Talara','Paita'],
        'Puno':['Puno','Juliaca','Azángaro'],
        'San Martín':['Tarapoto','Moyobamba','Bellavista'],
        'Tacna':['Tacna'],
        'Tumbes':['Tumbes','Zarumilla'],
        'Ucayali':['Pucallpa','Aguaytía'],
    },
    bolivia: {
        'Cochabamba':['Cochabamba','Quillacollo','Sacaba'],
        'La Paz':['La Paz','El Alto','Caranavi'],
        'Santa Cruz':['Santa Cruz de la Sierra','Montero','Warnes'],
        'Oruro':['Oruro'],
        'Potosí':['Potosí','Uyuni'],
        'Sucre':['Sucre'],
        'Beni':['Trinidad','Riberalta'],
        'Pando':['Cobija'],
        'Tarija':['Tarija','Yacuiba'],
    },
    brazil: {
        'Amazonas':['Manaus','Parintins'],
        'Bahia':['Salvador','Feira de Santana','Vitória da Conquista'],
        'Goiás':['Goiânia','Anápolis'],
        'Mato Grosso':['Cuiabá','Sinop'],
        'Minas Gerais':['Belo Horizonte','Uberlândia'],
        'Pará':['Belém','Santarém'],
        'Paraná':['Curitiba','Londrina','Maringá'],
        'Rio de Janeiro':['Rio de Janeiro','Campos'],
        'Rio Grande do Sul':['Porto Alegre','Caxias do Sul'],
        'São Paulo':['São Paulo','Campinas','Ribeirão Preto'],
    },
    panama: {
        'Chiriquí':['David','Boquete','Bugaba'],
        'Coclé':['Penonomé','La Pintada'],
        'Herrera':['Chitré','Los Santos'],
        'Panamá':['Ciudad de Panamá','Arraiján'],
        'Veraguas':['Santiago','La Mesa'],
    },
    costa_rica: {
        'Alajuela':['Alajuela','San Ramón','Grecia'],
        'Cartago':['Cartago','Turrialba'],
        'Guanacaste':['Liberia','Nicoya'],
        'Heredia':['Heredia','San Isidro'],
        'Limón':['Limón','Guápiles'],
        'Puntarenas':['Puntarenas','Quepos'],
        'San José':['San José','Desamparados'],
    },
    mexico: {
        'Chiapas':['Tuxtla Gutiérrez','San Cristóbal de las Casas','Comitán'],
        'Guerrero':['Acapulco','Chilpancingo','Iguala'],
        'Jalisco':['Guadalajara','Zapopan','Tlaquepaque'],
        'Michoacán':['Morelia','Uruapan','Lázaro Cárdenas'],
        'Oaxaca':['Oaxaca de Juárez','Juchitán','Salina Cruz'],
        'Tabasco':['Villahermosa','Cárdenas'],
        'Veracruz':['Veracruz','Xalapa','Coatzacoalcos','Córdoba'],
        'Yucatán':['Mérida','Progreso','Valladolid'],
    },
};

// ─────────────────────────────────────────────────────────────
// COORD LOOKUP (canton → {lat, lng})
// -------------------------------------------------------------
const COORDS = {
    'El Carmen':      { lat:-0.2687,  lng:-79.4326 },
    'Quinindé':       { lat: 0.3273,  lng:-79.4666 },
    'Esmeraldas':     { lat: 0.9592,  lng:-79.6522 },
    'Pedernales':     { lat: 0.0716,  lng:-80.0573 },
    'Portoviejo':     { lat:-1.0545,  lng:-80.4545 },
    'Manta':          { lat:-0.9677,  lng:-80.7089 },
    'Chone':          { lat:-0.6934,  lng:-80.1001 },
    'Guayaquil':      { lat:-2.1952,  lng:-79.8869 },
    'Quito':          { lat:-0.1807,  lng:-78.4678 },
    'Cuenca':         { lat:-2.9001,  lng:-79.0059 },
    'Machala':        { lat:-3.2589,  lng:-79.9553 },
    'Ambato':         { lat:-1.2491,  lng:-78.6168 },
    'Ibarra':         { lat: 0.3517,  lng:-78.1222 },
    'Loja':           { lat:-3.9931,  lng:-79.2042 },
    'Babahoyo':       { lat:-1.8013,  lng:-79.5313 },
    'Quevedo':        { lat:-1.0225,  lng:-79.4612 },
    'Tulcán':         { lat: 0.8117,  lng:-77.7178 },
    'Riobamba':       { lat:-1.6635,  lng:-78.6544 },
    'Latacunga':      { lat:-0.9307,  lng:-78.6153 },
    'Santo Domingo':  { lat:-0.2543,  lng:-79.1719 },
    'Medellín':       { lat: 6.2308,  lng:-75.5906 },
    'Bogotá':         { lat: 4.7110,  lng:-74.0721 },
    'Cali':           { lat: 3.4372,  lng:-76.5225 },
    'Lima':           { lat:-12.0464, lng:-77.0428 },
    'Cusco':          { lat:-13.5170, lng:-71.9675 },
    'Arequipa':       { lat:-16.4090, lng:-71.5375 },
};

function coordsFor(canton) {
    if (COORDS[canton]) return COORDS[canton];
    // Default: El Carmen, Manabí, Ecuador
    return { lat:-0.2687, lng:-79.4326 };
}

// ─────────────────────────────────────────────────────────────
// SYNTHETIC CROP PLAN  (used when backend is offline)
// Builds N months of activities from the farm grid
// -------------------------------------------------------------
function buildCropPlan(profile) {
    const plan = [];
    const today = new Date();
    const schedules = {
        cacao:    ['Pruning','Fertilisation','Pest monitoring','Harvest prep','Irrigation','Soil analysis'],
        banana:   ['Bunch inspection','Fertilisation','Irrigation','Harvest','De-leafing','Disease check'],
        coffee:   ['Pruning','Flowering check','Shade management','Fertilisation','Harvest','Drying prep'],
        palm_oil: ['Frond pruning','Fertilisation','Pest check','Harvesting','Soil sampling'],
        rice:     ['Seeding','Water management','Fertilisation','Pest control','Harvest'],
        maize:    ['Planting','Weeding','Fertilisation','Pollination check','Harvest'],
        plantain: ['De-leafing','Fertilisation','Bunch support','Harvest','Irrigation'],
        cassava:  ['Weeding','Fertilisation','Soil mulching','Harvest','Replanting'],
    };
    (profile.parcels || []).forEach(p => {
        const acts = schedules[p.crop] || schedules['maize'];
        acts.forEach((act, i) => {
            const d = new Date(today);
            // Spread activities over 12 months
            d.setDate(d.getDate() + (i * 18) - 15 + Math.floor(Math.random()*5));
            const isPast = d < today;
            plan.push({
                date:     d.toISOString().split('T')[0],
                parcel:   p.id,
                crop:     p.crop,
                activity: act,
                status:   isPast ? (Math.random() > 0.5 ? 'Completed' : 'Pending') : 'Scheduled',
            });
        });
    });
    return plan.sort((a,b) => a.date.localeCompare(b.date));
}

// ─────────────────────────────────────────────────────────────
// STORAGE
// -------------------------------------------------------------
function loadProfile()       { try { const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; } catch{return null;} }
function saveProfile(p)      { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function resetProfile()      { localStorage.removeItem(STORAGE_KEY); }

// ─────────────────────────────────────────────────────────────
// ONBOARDING — Step 1: Location
// -------------------------------------------------------------
let _gridState = {};
let _selectedCell = null;

function initOnboarding() {
    initStep1();
    initStep2();
}

function initStep1() {
    const cEl = document.getElementById('ob-country');
    const pEl = document.getElementById('ob-province');
    const kEl = document.getElementById('ob-canton');
    const nxt = document.getElementById('ob-next-btn');
    const bdg = document.getElementById('ob-location-badge');
    const btx = document.getElementById('ob-location-text');

    function chk() {
        const ok = cEl.value && pEl.value && kEl.value;
        nxt.disabled = !ok;
        bdg.style.display = ok ? 'flex' : 'none';
        if (ok) btx.textContent = `${kEl.value}, ${pEl.value}, ${cEl.options[cEl.selectedIndex].text}`;
    }

    cEl.addEventListener('change', () => {
        const provinces = Object.keys(LOCATION_DATA[cEl.value] || {}).sort();
        pEl.innerHTML = '<option value="">Select province...</option>';
        provinces.forEach(p => { const o=document.createElement('option'); o.value=p; o.textContent=p; pEl.appendChild(o); });
        pEl.disabled = !provinces.length;
        kEl.innerHTML = '<option value="">Select province first...</option>';
        kEl.disabled = true;
        document.getElementById('ob-province-field').classList.toggle('ob-field-disabled', !provinces.length);
        document.getElementById('ob-canton-field').classList.add('ob-field-disabled');
        chk();
    });
    pEl.addEventListener('change', () => {
        const cantons = LOCATION_DATA[cEl.value]?.[pEl.value] || [];
        kEl.innerHTML = '<option value="">Select canton...</option>';
        cantons.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; kEl.appendChild(o); });
        kEl.disabled = !cantons.length;
        document.getElementById('ob-canton-field').classList.toggle('ob-field-disabled', !cantons.length);
        chk();
    });
    kEl.addEventListener('change', chk);
    nxt.addEventListener('click', () => {
        if (nxt.disabled) return;
        APP.profile = {
            country:       cEl.value,
            country_label: cEl.options[cEl.selectedIndex].text,
            province:      pEl.value,
            canton:        kEl.value,
        };
        goToStep2();
    });
}

function goToStep2() {
    document.getElementById('ob-step-1').style.display='none';
    document.getElementById('ob-step-2').style.display='block';
    document.getElementById('dot-1').classList.remove('active');
    document.getElementById('dot-2').classList.add('active');
    renderObGrid();
}

// Step 2: Grid
function obRows() { return Math.min(10, Math.max(1, parseInt(document.getElementById('ob-rows').value)||2)); }
function obCols() { return Math.min(10, Math.max(1, parseInt(document.getElementById('ob-cols').value)||3)); }

function cellId(r,c) { return String.fromCharCode(65+r)+(c+1); }

function renderObGrid() {
    const r=obRows(), c=obCols();
    const g=document.getElementById('ob-farm-grid');
    g.style.gridTemplateColumns=`repeat(${c},72px)`;
    g.innerHTML='';
    const ns={};
    for(let i=0;i<r;i++) for(let j=0;j<c;j++) { const id=cellId(i,j); ns[id]=_gridState[id]||null; }
    _gridState=ns;
    Object.entries(_gridState).forEach(([id,cid])=>{
        const el=document.createElement('div');
        el.className='ob-parcel'+(cid?' assigned':'');
        el.dataset.cell=id;
        if(cid&&cid!=='empty') {
            const cr=cropOf(cid);
            el.style.background=cr.bg; el.style.border=`2px solid ${cr.bg}`;
            el.innerHTML=`<span class="parcel-icon">${cr.icon}</span><span class="parcel-id" style="color:${cr.tx}">${id}</span><span class="parcel-crop" style="color:${cr.tx}">${cr.label}</span>`;
        } else {
            el.innerHTML=`<span class="parcel-id">${id}</span><i class="fa-solid fa-plus" style="color:rgba(255,255,255,0.2);font-size:.85rem"></i>`;
        }
        el.addEventListener('click',()=>openObModal(id));
        g.appendChild(el);
    });
}

function openObModal(id) {
    _selectedCell=id;
    document.getElementById('ob-crop-cell-label').textContent=id;
    const cur=_gridState[id];
    const opts=document.getElementById('ob-crop-options');
    opts.innerHTML='';
    CROPS.forEach(cr=>{
        const b=document.createElement('button');
        b.className='ob-crop-option'+(cr.id===cur?' selected':'');
        b.innerHTML=`<span style="font-size:1.6rem">${cr.icon}</span>${cr.label}`;
        b.addEventListener('click',()=>{ _gridState[id]=cr.id==='empty'?null:cr.id; closeObModal(); renderObGrid(); });
        opts.appendChild(b);
    });
    document.getElementById('ob-crop-modal').style.display='flex';
    document.body.style.overflow='hidden';
}
function closeObModal() {
    document.getElementById('ob-crop-modal').style.display='none';
    document.body.style.overflow='';
    _selectedCell=null;
}

function initStep2() {
    ['rows','cols'].forEach(dim=>{
        document.getElementById(`${dim}-dec`).addEventListener('click',()=>{
            const e=document.getElementById(`ob-${dim}`); e.value=Math.max(1,parseInt(e.value)-1); renderObGrid();
        });
        document.getElementById(`${dim}-inc`).addEventListener('click',()=>{
            const e=document.getElementById(`ob-${dim}`); e.value=Math.min(10,parseInt(e.value)+1); renderObGrid();
        });
        document.getElementById(`ob-${dim}`).addEventListener('change',renderObGrid);
    });
    document.getElementById('ob-back-btn').addEventListener('click',()=>{
        document.getElementById('ob-step-2').style.display='none';
        document.getElementById('ob-step-1').style.display='block';
        document.getElementById('dot-1').classList.add('active');
        document.getElementById('dot-2').classList.remove('active');
    });
    document.getElementById('ob-crop-modal-close').addEventListener('click',closeObModal);
    document.getElementById('ob-crop-modal').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeObModal(); });
    document.getElementById('ob-start-btn').addEventListener('click',finishOnboarding);
}

async function finishOnboarding() {
    const rows=obRows(), cols=obCols();
    const parcels=Object.entries(_gridState)
        .filter(([,c])=>c!==null)
        .map(([id,c])=>({ id, crop:c, area_ha:1.0, status:'Healthy' }));
    APP.profile = { ...APP.profile, rows, cols, grid:_gridState, parcels, setup_date:new Date().toISOString() };
    saveProfile(APP.profile);
    document.getElementById('ob-start-btn').disabled=true;
    document.getElementById('ob-saving-msg').style.display='flex';
    try { await persistFarm(APP.profile); } catch(e) { console.warn('Backend save skipped:',e.message); }
    document.getElementById('ob-saving-msg').style.display='none';
    launchApp();
}

async function persistFarm(profile) {
    const body = JSON.stringify({ user_id:APP.userId, session_id:APP.sessionId,
        new_message:{ parts:[{ text:`Save my farm profile: ${JSON.stringify({ rows:profile.rows, cols:profile.cols, parcels:profile.parcels, location:{ canton:profile.canton, province:profile.province, country:profile.country_label } })}` }] } });
    await fetch('/run',{ method:'POST', headers:{'Content-Type':'application/json'}, body, signal:AbortSignal.timeout(7000) });
}

// ─────────────────────────────────────────────────────────────
// LAUNCH APP
// -------------------------------------------------------------
function launchApp() {
    document.getElementById('onboarding-overlay').style.display='none';
    const app=document.getElementById('main-app');
    app.style.display='flex';

    // Apply profile to UI
    const loc=`${APP.profile.canton}, ${APP.profile.country_label||APP.profile.province}`;
    document.getElementById('topbar-location-text').textContent=loc;

    // Seed crop plan from profile if backend offline
    APP.cropPlan = buildCropPlan(APP.profile);

    // Build synthetic indicators from profile
    APP.indicators = (APP.profile.parcels||[]).map(p=>({
        parcel:        p.id,
        crop:          p.crop,
        status:        p.status || 'Healthy',
        pending_action:'None',
    }));

    // Render Farm tab
    renderFarmGrid();
    renderIndicators_farm();
    renderCalendar();
    renderEventsList();

    // Render AI tab
    renderContextBar();
    renderSuggestions();

    // Async: fetch real weather
    const coords=coordsFor(APP.profile.canton);
    fetchWeatherDirect(coords.lat, coords.lng).then(w=>{
        APP.weather=w;
        updateWeatherIndicator();
    }).catch(()=>{});

    // Async: fetch top price for main crop
    const mainCrop = (APP.profile.parcels||[])[0]?.crop || 'cacao';
    agentRun(`Get market price for ${mainCrop}.`).then(out=>{
        try {
            const d=JSON.parse(out);
            if(d.current_price_usd) {
                APP.prices[mainCrop]={ price:d.current_price_usd, unit:d.unit, change:d.daily_change_pct, trend:d.trend_direction };
                updatePriceIndicator(mainCrop);
            }
        } catch(e) {
            // non-JSON response, show placeholder
            document.getElementById('ind-price-sub').textContent='Data unavailable';
        }
    }).catch(()=>{ document.getElementById('ind-price-sub').textContent='Offline'; });

    // Deselect handler
    document.getElementById('btn-deselect')?.addEventListener('click', deselectParcel);

    // Reset button
    document.getElementById('btn-reset-ob')?.addEventListener('click',()=>{
        if(confirm('Reset your farm setup? This will clear all onboarding data.')) { resetProfile(); location.reload(); }
    });
}

// ─────────────────────────────────────────────────────────────
// TAB SWITCHING
// -------------------------------------------------------------
function switchTab(tabId) {
    document.querySelectorAll('.main-tab-btn').forEach(b=>{
        const active=b.dataset.tab===tabId;
        b.classList.toggle('active',active);
        b.setAttribute('aria-selected', active?'true':'false');
    });
    document.querySelectorAll('.tab-view').forEach(v=>v.classList.remove('active'));
    document.getElementById(`tab-${tabId}`)?.classList.add('active');
}

// ─────────────────────────────────────────────────────────────
// INDICATORS — farm-level
// -------------------------------------------------------------
function renderIndicators_farm() {
    const all    = APP.indicators;
    const total  = all.length || (APP.profile.parcels||[]).length;
    const healthy= all.filter(i=>i.status==='Healthy').length;
    const alerts = all.filter(i=>i.pending_action && i.pending_action!=='None').length;
    const pct    = total ? healthy/total : 1;

    // Health card
    document.getElementById('ind-health-val').textContent = total ? `${healthy}/${total}` : '—';
    document.getElementById('ind-health-sub').textContent = total ? 'parcels OK' : 'No parcels';
    const hCard = document.getElementById('ind-health');
    hCard.classList.remove('health-good','health-warn','health-bad');
    hCard.classList.add(pct>0.8?'health-good':pct>=0.5?'health-warn':'health-bad');

    // Alerts card
    document.getElementById('ind-alerts-val').textContent = String(alerts);
    document.getElementById('ind-alerts-sub').textContent = alerts ? 'Requires attention' : 'All clear';
    document.getElementById('ind-alerts').classList.toggle('alerts-warn', alerts>0);

    // Next activity
    updateNextActivityIndicator_farm();

    // Context title
    document.getElementById('indicators-context-title').textContent = 'Farm Overview';
    document.getElementById('parcel-selection-bar').style.display='none';
}

function updateNextActivityIndicator_farm() {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = APP.cropPlan.filter(e=>e.date>=today&&e.status!=='Completed').sort((a,b)=>a.date.localeCompare(b.date));
    if(upcoming.length) {
        const next=upcoming[0];
        const daysLeft=Math.ceil((new Date(next.date)-new Date())/(86400000));
        const crop=cropOf(next.crop);
        document.getElementById('ind-next-val').textContent = next.activity;
        document.getElementById('ind-next-sub').textContent =
            `${crop?crop.icon:''} ${next.parcel} • in ${daysLeft} day${daysLeft!==1?'s':''}`;
    } else {
        document.getElementById('ind-next-val').textContent='—';
        document.getElementById('ind-next-sub').textContent='No upcoming activities';
    }
}

// Parcel-level indicators
function renderIndicators_parcel(parcelId) {
    const ind  = APP.indicators.find(i=>i.parcel===parcelId) || {};
    const par  = (APP.profile.parcels||[]).find(p=>p.id===parcelId) || {};
    const crop = cropOf(par.crop);
    const status = ind.status || par.status || 'Healthy';

    // Health
    document.getElementById('ind-health-val').textContent = status;
    document.getElementById('ind-health-sub').textContent = 'Parcel diagnosis';
    const hCard=document.getElementById('ind-health');
    hCard.classList.remove('health-good','health-warn','health-bad');
    hCard.classList.add(status==='Healthy'?'health-good':status==='Warning'?'health-warn':'health-bad');

    // Alerts
    const pa = ind.pending_action || 'None';
    document.getElementById('ind-alerts-val').textContent = pa==='None'?'0':'1';
    document.getElementById('ind-alerts-sub').textContent = pa==='None'?'No pending actions':pa;
    document.getElementById('ind-alerts').classList.toggle('alerts-warn', pa!=='None');

    // Next activity for this parcel
    const today=new Date().toISOString().split('T')[0];
    const next=APP.cropPlan.filter(e=>e.parcel===parcelId&&e.date>=today&&e.status!=='Completed').sort((a,b)=>a.date.localeCompare(b.date))[0];
    if(next) {
        const dl=Math.ceil((new Date(next.date)-new Date())/86400000);
        document.getElementById('ind-next-val').textContent=next.activity;
        document.getElementById('ind-next-sub').textContent=`in ${dl} day${dl!==1?'s':''}`;
    } else {
        document.getElementById('ind-next-val').textContent='—';
        document.getElementById('ind-next-sub').textContent='Nothing scheduled';
    }

    // Price for this parcel's crop
    if(par.crop && APP.prices[par.crop]) {
        const pr=APP.prices[par.crop];
        const arrow=pr.trend==='up'?'▲':pr.trend==='down'?'▼':'—';
        document.getElementById('ind-price-val').textContent=`$${pr.price}`;
        document.getElementById('ind-price-sub').textContent=`${arrow} ${pr.change}% • ${pr.unit}`;
    } else if(par.crop) {
        document.getElementById('ind-price-val').textContent='—';
        document.getElementById('ind-price-sub').textContent='Fetching…';
        agentRun(`Get market price for ${par.crop}.`).then(out=>{
            try {
                const d=JSON.parse(out);
                if(d.current_price_usd) {
                    APP.prices[par.crop]={ price:d.current_price_usd, unit:d.unit, change:d.daily_change_pct, trend:d.trend_direction };
                    if(APP.selectedParcel?.id===parcelId) updatePriceIndicator(par.crop);
                }
            } catch {}
        }).catch(()=>{});
    }

    // Context bar update
    document.getElementById('indicators-context-title').textContent = `Parcel ${parcelId}`;
    const bar=document.getElementById('parcel-selection-bar');
    bar.style.display='flex';
    document.getElementById('selected-parcel-label').textContent =
        `${parcelId}${crop?' '+crop.icon+' '+crop.label:''}`;
}

function updateWeatherIndicator() {
    if(!APP.weather) return;
    const w=APP.weather;
    document.getElementById('ind-weather-val').textContent=`${w.temp}°C`;
    document.getElementById('ind-weather-sub').textContent=`${w.condition} • ${w.humidity}% RH`;
}

function updatePriceIndicator(cropId) {
    const pr=APP.prices[cropId];
    if(!pr) return;
    const arrow=pr.trend==='up'?'▲':pr.trend==='down'?'▼':'—';
    document.getElementById('ind-price-val').textContent=`$${pr.price}`;
    document.getElementById('ind-price-sub').textContent=`${arrow} ${pr.change}% • ${pr.unit}`;
}

// ─────────────────────────────────────────────────────────────
// FARM GRID
// -------------------------------------------------------------
function renderFarmGrid() {
    const profile=APP.profile;
    if(!profile) return;
    const rows=profile.rows||2, cols=profile.cols||3;
    const container=document.getElementById('farm-grid-view');
    container.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    container.innerHTML='';

    const grid=profile.grid||{};
    for(let r=0;r<rows;r++) {
        for(let c=0;c<cols;c++) {
            const id=cellId(r,c);
            const cropId=grid[id]||null;
            const crop=cropId?cropOf(cropId):null;
            const el=document.createElement('div');
            el.className='farm-parcel'+(crop?' assigned':'');
            el.dataset.parcel=id;
            el.setAttribute('role','gridcell');
            el.setAttribute('aria-label',`Parcel ${id}${crop?': '+crop.label:''}`);
            if(crop&&crop.bg) {
                el.style.background=crop.bg;
                el.style.border=`2px solid ${crop.bg}`;
                el.innerHTML=`<span class="fp-id" style="color:${crop.tx}">${id}</span>
                              <span class="fp-icon">${crop.icon}</span>
                              <span class="fp-crop" style="color:${crop.tx}">${crop.label}</span>`;
            } else {
                el.innerHTML=`<span class="fp-id">${id}</span><span class="fp-empty"><i class="fa-solid fa-plus"></i></span>`;
            }
            el.addEventListener('click',()=>selectParcel(id, cropId));
            container.appendChild(el);
        }
    }
}

function selectParcel(id, cropId) {
    // Toggle off if same parcel
    if(APP.selectedParcel?.id===id) { deselectParcel(); return; }

    APP.selectedParcel={ id, crop:cropId };

    // Highlight selected cell
    document.querySelectorAll('.farm-parcel').forEach(el=>{
        el.classList.toggle('selected', el.dataset.parcel===id);
    });

    // Switch indicators to parcel view
    renderIndicators_parcel(id);

    // Filter calendar events
    renderEventsList();

    // Update AI context bar
    renderContextBar();
}

function deselectParcel() {
    APP.selectedParcel=null;
    document.querySelectorAll('.farm-parcel').forEach(el=>el.classList.remove('selected'));
    renderIndicators_farm();
    renderEventsList();
    renderContextBar();
}

// ─────────────────────────────────────────────────────────────
// CALENDAR
// -------------------------------------------------------------
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

function renderCalendar() {
    const d=APP.calDate;
    const year=d.getFullYear(), month=d.getMonth();
    document.getElementById('cal-month-label').textContent=`${MONTHS[month]} ${year}`;

    const firstDay=new Date(year,month,1).getDay(); // 0=Sun
    // Convert to Mon-start: Mon=0 … Sun=6
    const startOffset=(firstDay+6)%7;
    const daysInMonth=new Date(year,month+1,0).getDate();
    const daysInPrev=new Date(year,month,0).getDate();
    const today=new Date();

    // Build events map for this month
    const eventsMap={};
    APP.cropPlan.forEach(ev=>{
        const evd=new Date(ev.date);
        if(evd.getFullYear()===year&&evd.getMonth()===month) {
            const key=evd.getDate();
            if(!eventsMap[key]) eventsMap[key]=[];
            eventsMap[key].push(ev);
        }
    });

    const grid=document.getElementById('cal-days-grid');
    grid.innerHTML='';

    const totalCells=Math.ceil((startOffset+daysInMonth)/7)*7;
    for(let i=0;i<totalCells;i++) {
        let dayNum, inMonth=false;
        if(i<startOffset) { dayNum=daysInPrev-startOffset+i+1; }
        else if(i<startOffset+daysInMonth) { dayNum=i-startOffset+1; inMonth=true; }
        else { dayNum=i-startOffset-daysInMonth+1; }

        const cell=document.createElement('div');
        cell.className='cal-day'+(inMonth?'':' other-month');
        const isToday=inMonth&&dayNum===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
        if(isToday) cell.classList.add('today');
        const selDay=APP.selectedCalDay;
        if(selDay&&inMonth&&dayNum===selDay) cell.classList.add('selected-day');

        // Day number
        const numEl=document.createElement('div');
        numEl.className='cal-day-num';
        numEl.textContent=dayNum;
        cell.appendChild(numEl);

        // Event dots
        if(inMonth&&eventsMap[dayNum]) {
            const dots=document.createElement('div');
            dots.className='cal-dots';
            // Show up to 3 dots
            const evs=eventsMap[dayNum].slice(0,3);
            // If parcel filter active, only show dots for that parcel
            const filtered=APP.selectedParcel
                ? evs.filter(e=>e.parcel===APP.selectedParcel.id)
                : evs;
            filtered.forEach(ev=>{
                const dot=document.createElement('span');
                dot.className='cal-dot';
                const cr=cropOf(ev.crop);
                dot.style.background=cr?cr.color:'#56708a';
                dots.appendChild(dot);
            });
            if(dots.children.length) cell.appendChild(dots);
        }

        if(inMonth) {
            cell.addEventListener('click',()=>{
                APP.selectedCalDay = (APP.selectedCalDay===dayNum)?null:dayNum;
                renderCalendar();
                renderEventsList();
                // Scroll to events list
                document.getElementById('events-list').scrollIntoView({behavior:'smooth',block:'start'});
            });
        }
        grid.appendChild(cell);
    }
}

function renderEventsList() {
    const container=document.getElementById('events-list');
    const d=APP.calDate;
    const year=d.getFullYear(), month=d.getMonth();
    const today=new Date().toISOString().split('T')[0];

    let events=APP.cropPlan.filter(ev=>{
        const evd=new Date(ev.date);
        return evd.getFullYear()===year&&evd.getMonth()===month;
    });

    // Filter by selected parcel
    if(APP.selectedParcel) events=events.filter(e=>e.parcel===APP.selectedParcel.id);

    // Filter by selected day
    if(APP.selectedCalDay) events=events.filter(e=>new Date(e.date).getDate()===APP.selectedCalDay);

    if(!events.length) {
        container.innerHTML=`<div class="events-empty"><i class="fa-solid fa-calendar-xmark" style="margin-bottom:.5rem;font-size:1.5rem;opacity:.3"></i><br>${APP.selectedParcel?`No activities for parcel ${APP.selectedParcel.id} this month`:'No activities scheduled this month'}</div>`;
        return;
    }

    events.sort((a,b)=>a.date.localeCompare(b.date));
    container.innerHTML='';
    events.forEach(ev=>{
        const cr=cropOf(ev.crop);
        const evDate=new Date(ev.date+'T12:00:00');
        const dateLabel=evDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
        const isPast=ev.date<today;
        const isOverdue=isPast&&ev.status!=='Completed';

        const item=document.createElement('div');
        item.className='event-item';
        let badge='';
        if(ev.status==='Completed') badge=`<span class="event-badge badge-done">Done</span>`;
        else if(isOverdue)           badge=`<span class="event-badge badge-overdue">Overdue</span>`;
        else if(ev.status==='Pending') badge=`<span class="event-badge badge-pending">Pending</span>`;

        item.innerHTML=`
            <div class="event-dot" style="background:${cr?cr.color:'#56708a'}"></div>
            <div class="event-body">
                <div class="event-date">${dateLabel}</div>
                <div class="event-activity">${ev.activity}</div>
                <div class="event-meta">
                    <span class="event-parcel-tag">${ev.parcel}${cr?' '+cr.icon+' '+cr.label:''}</span>
                    ${badge}
                </div>
            </div>`;
        container.appendChild(item);
    });
}

// ─────────────────────────────────────────────────────────────
// AI ASSISTANT — Context bar + Suggestions
// -------------------------------------------------------------
function renderContextBar() {
    const badge=document.getElementById('ai-context-badge');
    const hint=document.getElementById('ai-context-hint');
    const text=document.getElementById('ai-context-text');

    if(APP.selectedParcel) {
        const cr=cropOf(APP.selectedParcel.crop);
        text.textContent=`${APP.selectedParcel.id}${cr?' '+cr.icon+' '+cr.label:''}`;
        hint.textContent='Tap Deselect in Farm tab to remove filter';
    } else {
        text.textContent='General farm';
        hint.textContent='Select a parcel in Farm tab for specific advice';
    }
}

function renderSuggestions() {
    const container=document.getElementById('ai-suggestions');
    if(!container) return;
    const sugs=buildSuggestions();
    container.innerHTML='';
    sugs.forEach(s=>{
        const card=document.createElement('button');
        card.className='suggestion-card';
        card.innerHTML=`
            <div class="sug-icon-wrap" style="background:${s.iconBg}">${s.icon}</div>
            <div class="sug-body">
                <div class="sug-text">${s.text}</div>
            </div>
            <span class="sug-pill pill-${s.category}">${s.category}</span>
        `;
        card.addEventListener('click',()=>{
            const inp=document.getElementById('chat-input');
            inp.value=s.text;
            inp.focus();
            document.getElementById('chat-send-btn').disabled=false;
        });
        container.appendChild(card);
    });
}

function buildSuggestions() {
    const sugs=[];
    const parcels=APP.profile?.parcels||[];
    const alerted=APP.indicators.filter(i=>i.pending_action&&i.pending_action!=='None');
    const emptyParcels=parcels.filter(p=>!p.crop||p.crop==='empty');
    const crops=[...new Set(parcels.map(p=>p.crop).filter(Boolean))];
    const mainCrop=crops[0]||'cacao';

    if(alerted.length) {
        const a=alerted[0];
        sugs.push({ icon:'<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i>',
            iconBg:'rgba(245,158,11,.12)', category:'alert',
            text:`Review ${a.pending_action} in parcel ${a.parcel}` });
    }
    if(emptyParcels.length) {
        const ids=emptyParcels.slice(0,2).map(p=>p.id).join(' and ');
        sugs.push({ icon:'<i class="fa-solid fa-seedling" style="color:#10b981"></i>',
            iconBg:'rgba(16,185,129,.12)', category:'plan',
            text:`What can I plant in parcel${emptyParcels.length>1?'s':''} ${ids}?` });
    }
    if(crops.length) {
        sugs.push({ icon:'<i class="fa-solid fa-magnifying-glass" style="color:#a855f7"></i>',
            iconBg:'rgba(168,85,247,.12)', category:'harvest',
            text:`Is my ${cropOf(mainCrop)?.label||mainCrop} ready to harvest?` });
    }
    sugs.push({ icon:'<i class="fa-solid fa-star" style="color:#a855f7"></i>',
        iconBg:'rgba(168,85,247,.12)', category:'quality',
        text:`Analyze the quality of my harvested ${cropOf(mainCrop)?.label||'cacao'}` });
    sugs.push({ icon:'<i class="fa-solid fa-chart-line" style="color:#38bdf8"></i>',
        iconBg:'rgba(56,189,248,.12)', category:'market',
        text:`Is it a good time to sell my ${cropOf(mainCrop)?.label||mainCrop}?` });
    if(crops.length>1) {
        sugs.push({ icon:'<i class="fa-solid fa-cloud-sun" style="color:#38bdf8"></i>',
            iconBg:'rgba(56,189,248,.12)', category:'plan',
            text:'How will this week\'s weather affect my crops?' });
    }
    return sugs.slice(0,6);
}

// ─────────────────────────────────────────────────────────────
// CHAT
// -------------------------------------------------------------
function addMessage(role, text, imageDataUrl=null) {
    const area=document.getElementById('chat-messages');
    // Hide greeting on first user message
    if(role==='user') {
        const greet=document.getElementById('ai-greeting');
        if(greet) greet.style.display='none';
    }

    const div=document.createElement('div');
    div.className=`chat-msg ${role}`;

    const avatar=document.createElement('div');
    avatar.className=`msg-avatar ${role}`;
    avatar.innerHTML=role==='agent'
        ?'<i class="fa-solid fa-seedling"></i>'
        :'<i class="fa-solid fa-user"></i>';

    const bubble=document.createElement('div');
    bubble.className='msg-bubble';

    if(imageDataUrl) {
        const img=document.createElement('img');
        img.src=imageDataUrl; img.className='msg-image'; img.alt='Attached crop photo';
        bubble.appendChild(img);
    }
    const txt=document.createElement('div');
    txt.innerHTML=role==='agent' ? formatMarkdown(text) : escapeHtml(text);
    bubble.appendChild(txt);

    div.appendChild(avatar);
    div.appendChild(bubble);
    area.appendChild(div);
    area.scrollTop=area.scrollHeight;
    APP.messages.push({role, text, imageDataUrl});
    return div;
}

function addTypingIndicator() {
    const area=document.getElementById('chat-messages');
    const div=document.createElement('div');
    div.className='chat-msg agent'; div.id='typing-indicator';
    div.innerHTML=`<div class="msg-avatar agent"><i class="fa-solid fa-seedling"></i></div>
        <div class="msg-bubble"><div class="typing-indicator">
            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
        </div></div>`;
    area.appendChild(div);
    area.scrollTop=area.scrollHeight;
    return div;
}

function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

async function sendMessage() {
    const input=document.getElementById('chat-input');
    const sendBtn=document.getElementById('chat-send-btn');
    const text=input.value.trim();
    if(!text&&!APP.pendingImage) return;

    const imgDataUrl=APP.pendingImage?.dataUrl||null;
    addMessage('user', text||'[Photo attached]', imgDataUrl);
    input.value=''; sendBtn.disabled=true;
    clearImageAttachment();

    const typing=addTypingIndicator();

    // Build context string
    let contextParts=[text];
    if(APP.selectedParcel) {
        const cr=cropOf(APP.selectedParcel.crop);
        contextParts.push(`[Context: parcel ${APP.selectedParcel.id}, crop: ${cr?.label||APP.selectedParcel.crop}]`);
    }
    const fullMessage=contextParts.join(' ');

    try {
        const response=await agentRun(fullMessage);
        removeTypingIndicator();
        const msgEl=addMessage('agent', response);

        // Extract [INDICATORS] and silently update dashboard
        const indMatch=response.match(/\[INDICATORS\]\s*(\{[\s\S]+?\})/);
        if(indMatch) {
            try {
                const inds=JSON.parse(indMatch[1]);
                if(inds.parcels) {
                    inds.parcels.forEach(p=>{
                        const existing=APP.indicators.findIndex(i=>i.parcel===p.parcel);
                        if(existing>=0) APP.indicators[existing]={...APP.indicators[existing],...p};
                        else APP.indicators.push(p);
                    });
                    renderIndicators_farm();
                }
                if(inds.weather) { APP.weather=inds.weather; updateWeatherIndicator(); }
                if(inds.price&&inds.crop) { APP.prices[inds.crop]=inds; updatePriceIndicator(inds.crop); }
            } catch {}
        }

        // Follow-up pills
        const pills=generateFollowUps(response, fullMessage);
        if(pills.length) {
            const pillRow=document.createElement('div');
            pillRow.className='chat-msg agent';
            pillRow.style.paddingLeft='42px';
            const pw=document.createElement('div');
            pw.className='followup-pills';
            pills.forEach(p=>{
                const btn=document.createElement('button');
                btn.className='followup-pill'; btn.textContent=p;
                btn.addEventListener('click',()=>{
                    const inp=document.getElementById('chat-input');
                    inp.value=p; inp.focus();
                    document.getElementById('chat-send-btn').disabled=false;
                });
                pw.appendChild(btn);
            });
            pillRow.appendChild(pw);
            document.getElementById('chat-messages').appendChild(pillRow);
            document.getElementById('chat-messages').scrollTop=999999;
        }
    } catch(err) {
        removeTypingIndicator();
        addMessage('agent', `Sorry, I had trouble connecting. Please try again.\n\n*${err.message}*`);
    }
}

function generateFollowUps(response, question) {
    const pills=[];
    const lower=response.toLowerCase();
    if(lower.includes('fertiliz')) pills.push('What fertiliser should I use?');
    if(lower.includes('disease')||lower.includes('fungus')||lower.includes('pest'))
        pills.push('How do I treat this organically?');
    if(lower.includes('harvest')||lower.includes('maturity'))
        pills.push('What is the best time to harvest?');
    if(lower.includes('price')||lower.includes('market')||lower.includes('sell'))
        pills.push('Who are the best buyers near me?');
    if(lower.includes('weather')||lower.includes('rain'))
        pills.push('Show me the 7-day forecast');
    if(!pills.length) {
        pills.push('Tell me more');
        pills.push('What should I do first?');
    }
    return pills.slice(0,3);
}

// ─────────────────────────────────────────────────────────────
// IMAGE ATTACHMENT
// -------------------------------------------------------------
function clearImageAttachment() {
    APP.pendingImage=null;
    document.getElementById('chat-img-preview-bar').style.display='none';
    document.getElementById('chat-img-thumb').src='';
    document.getElementById('chat-image-input').value='';
}

function attachImage(file) {
    if(!file||!file.type.startsWith('image/')) return;
    const reader=new FileReader();
    reader.onload=e=>{
        APP.pendingImage={ dataUrl:e.target.result, mimeType:file.type };
        document.getElementById('chat-img-thumb').src=e.target.result;
        document.getElementById('chat-img-preview-bar').style.display='flex';
        document.getElementById('chat-send-btn').disabled=false;
    };
    reader.readAsDataURL(file);
}

// ─────────────────────────────────────────────────────────────
// WEATHER (direct Open-Meteo, no key required)
// -------------------------------------------------------------
async function fetchWeatherDirect(lat, lng) {
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
    const res=await fetch(url);
    if(!res.ok) throw new Error('Weather fetch failed');
    const d=await res.json();
    const cur=d.current;
    return {
        temp:     Math.round(cur.temperature_2m),
        humidity: cur.relative_humidity_2m,
        condition:WMO[cur.weather_code]||'Unknown',
    };
}

// ─────────────────────────────────────────────────────────────
// ADK AGENT CALL  (POST /run)
// -------------------------------------------------------------
async function agentRun(text) {
    const res=await fetch('/run',{
        method:'POST', headers:{'Content-Type':'application/json'},
        signal:AbortSignal.timeout(30000),
        body:JSON.stringify({
            user_id:APP.userId, session_id:APP.sessionId,
            new_message:{ parts:[{text}] },
        }),
    });
    if(!res.ok) throw new Error(`Agent HTTP ${res.status}`);
    return extractFinalOutput(await res.json());
}

function extractFinalOutput(events) {
    if(!Array.isArray(events)||!events.length) return 'No response from agent.';
    for(let i=events.length-1;i>=0;i--) {
        const ev=events[i];
        if(ev?.content?.parts) {
            const t=ev.content.parts.filter(p=>p.text).map(p=>p.text).join('\n');
            if(t) return t;
        }
        if(ev?.output) return typeof ev.output==='object'?JSON.stringify(ev.output,null,2):String(ev.output);
    }
    return 'No response found.';
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// -------------------------------------------------------------
function formatMarkdown(text) {
    if(!text) return '';
    return text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/^### (.+)$/gm,'<strong style="display:block;margin:.7rem 0 .3rem;color:#10b981">$1</strong>')
        .replace(/^## (.+)$/gm,'<strong style="display:block;margin:1rem 0 .4rem;font-size:1.05rem">$1</strong>')
        .replace(/^# (.+)$/gm,'<strong style="display:block;margin:1.2rem 0 .5rem;font-size:1.1rem">$1</strong>')
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,'<em>$1</em>')
        .replace(/`(.+?)`/g,'<code style="background:rgba(255,255,255,.07);padding:.1em .3em;border-radius:3px;font-size:.9em">$1</code>')
        .replace(/^\s*[-*]\s+(.+)$/gm,'<li style="margin-left:1.1rem;margin-bottom:.25rem;color:#8aa0b8">$1</li>')
        .replace(/\n/g,'<br>');
}

function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────
// DOM READY — BOOT
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

    // ── Version Check to Reset Onboarding ────────────────────
    fetch('/version')
        .then(res => res.json())
        .then(data => {
            const currentSha = data.commit_sha || 'dev';
            const savedSha = localStorage.getItem('croppulse_commit_sha');
            if (savedSha && savedSha !== currentSha) {
                console.log("New build detected (" + currentSha + "), resetting onboarding...");
                localStorage.removeItem('croppulse_farm_profile');
                localStorage.setItem('croppulse_commit_sha', currentSha);
                window.location.reload();
                return;
            }
            localStorage.setItem('croppulse_commit_sha', currentSha);
            bootApp();
        })
        .catch(err => {
            console.warn("Version check failed, booting anyway:", err);
            bootApp();
        });

    function bootApp() {
        const existing=loadProfile();
        if(existing?.canton) {
            APP.profile=existing;
            launchApp();
        } else {
            document.getElementById('onboarding-overlay').style.display='flex';
            initOnboarding();
        }
    }

    // ── Tab switching ────────────────────────────────────────
    document.querySelectorAll('.main-tab-btn').forEach(btn=>{
        btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
    });

    // ── Calendar nav ─────────────────────────────────────────
    document.getElementById('cal-prev')?.addEventListener('click',()=>{
        APP.calDate.setMonth(APP.calDate.getMonth()-1);
        APP.selectedCalDay=null;
        renderCalendar(); renderEventsList();
    });
    document.getElementById('cal-next')?.addEventListener('click',()=>{
        APP.calDate.setMonth(APP.calDate.getMonth()+1);
        APP.selectedCalDay=null;
        renderCalendar(); renderEventsList();
    });

    // ── Chat: input + send ───────────────────────────────────
    const chatInput=document.getElementById('chat-input');
    const sendBtn=document.getElementById('chat-send-btn');
    chatInput?.addEventListener('input',()=>{
        sendBtn.disabled=!chatInput.value.trim()&&!APP.pendingImage;
    });
    chatInput?.addEventListener('keydown',e=>{
        if(e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn?.addEventListener('click',sendMessage);

    // ── Chat: camera button ──────────────────────────────────
    document.getElementById('chat-camera-btn')?.addEventListener('click',()=>{
        document.getElementById('chat-image-input')?.click();
    });
    document.getElementById('chat-image-input')?.addEventListener('change',e=>{
        if(e.target.files[0]) attachImage(e.target.files[0]);
    });
    document.getElementById('chat-img-remove')?.addEventListener('click',()=>{
        clearImageAttachment();
        const inp=document.getElementById('chat-input');
        sendBtn.disabled=!inp.value.trim();
    });

    // ── Database Config Modal ───────────────────────────────
    const dbStatusBtn = document.getElementById('topbar-db-status');
    const dbModal = document.getElementById('db-config-modal');
    const dbCloseBtn = document.getElementById('db-config-close');
    const dbOkBtn = document.getElementById('db-config-btn-ok');

    dbStatusBtn?.addEventListener('click', () => {
        dbModal.style.display = 'flex';
    });

    const closeDbModal = () => {
        dbModal.style.display = 'none';
    };

    dbCloseBtn?.addEventListener('click', closeDbModal);
    dbOkBtn?.addEventListener('click', closeDbModal);
    dbModal?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeDbModal();
    });
});
