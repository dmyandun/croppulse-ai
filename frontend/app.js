/* ═══════════════════════════════════════════════════════════════
   CropPulse AI — app.js  v2
   Onboarding + Farm tab (indicators / grid / calendar)
                + AI Assistant tab (context / suggestions / chat)
═══════════════════════════════════════════════════════════════ */
'use strict';

// ─────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────
// Persist userId/sessionId in localStorage so returning users keep
// the same backend session and can retrieve previously generated data.
function _getOrCreateId(storageKey, prefix) {
    let val = localStorage.getItem(storageKey);
    if (!val) {
        val = prefix + Math.random().toString(36).slice(2, 9);
        localStorage.setItem(storageKey, val);
    }
    return val;
}

const APP = {
    userId:         _getOrCreateId('croppulse_user_id',    'farmer_'),
    sessionId:      _getOrCreateId('croppulse_session_id', 'session_'),
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
// ─────────────────────────────────────────────────────────────
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
const cropOf = id => {
    const cropId = (id && typeof id === 'object') ? id.crop : id;
    const found = CROPS.find(c => c.id === cropId) || null;
    if (found) return found;
    if (cropId && cropId !== 'empty') {
        return {
            id: cropId,
            label: cropId.charAt(0).toUpperCase() + cropId.slice(1),
            icon: '🌱',
            bg: '#E6F1FB',
            tx: '#1e40af',
            color: '#3b82f6'
        };
    }
    return null;
};

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
// ─────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────
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
function resetProfile()      {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('croppulse_indicators');
    localStorage.removeItem('croppulse_crop_plan');
    // Also clear session IDs so the next onboarding creates a fresh backend session
    localStorage.removeItem('croppulse_user_id');
    localStorage.removeItem('croppulse_session_id');
}

// Persist indicators & cropPlan so they survive page reloads
function saveIndicators(indicators) {
    try { localStorage.setItem('croppulse_indicators', JSON.stringify(indicators)); } catch {}
}
function loadIndicators() {
    try { const r=localStorage.getItem('croppulse_indicators'); return r?JSON.parse(r):null; } catch{return null;}
}
function saveCropPlan(plan) {
    try { localStorage.setItem('croppulse_crop_plan', JSON.stringify(plan)); } catch {}
}
function loadCropPlan() {
    try { const r=localStorage.getItem('croppulse_crop_plan'); return r?JSON.parse(r):null; } catch{return null;}
}

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

    // Database connection toggles
    const btnLocal = document.getElementById('ob-db-btn-local');
    const btnSheets = document.getElementById('ob-db-btn-sheets');
    const sheetsGroup = document.getElementById('ob-sheets-config-group');
    const inputSheetId = document.getElementById('ob-sheet-id');

    let dbMode = 'local';

    btnLocal?.addEventListener('click', () => {
        dbMode = 'local';
        btnLocal.classList.add('active');
        btnLocal.style.background = '#3b82f6';
        btnLocal.style.borderColor = '#2563eb';
        btnLocal.style.color = '#ffffff';
        
        btnSheets.classList.remove('active');
        btnSheets.style.background = '#1e293b';
        btnSheets.style.borderColor = '#334155';
        btnSheets.style.color = '#94a3b8';
        
        sheetsGroup.style.display = 'none';
        inputSheetId.value = '';
    });

    btnSheets?.addEventListener('click', () => {
        dbMode = 'sheets';
        btnSheets.classList.add('active');
        btnSheets.style.background = '#10b981';
        btnSheets.style.borderColor = '#059669';
        btnSheets.style.color = '#ffffff';

        btnLocal.classList.remove('active');
        btnLocal.style.background = '#1e293b';
        btnLocal.style.borderColor = '#334155';
        btnLocal.style.color = '#94a3b8';

        sheetsGroup.style.display = 'block';
    });

    // Copy service account email to clipboard
    document.getElementById('ob-sa-copy')?.addEventListener('click', async () => {
        const btn = document.getElementById('ob-sa-copy');
        const email = document.getElementById('ob-sa-email')?.textContent?.trim() || '';
        try {
            await navigator.clipboard.writeText(email);
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
            setTimeout(() => { btn.innerHTML = original; }, 1500);
        } catch (e) {
            /* clipboard blocked — user can still select the code element manually */
        }
    });

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
            sheet_id:      '',
        };
        goToStep2();
    });

    // Step 2 (Sheets sync) → Next button
    document.getElementById('ob-next-btn-sheets')?.addEventListener('click', () => {
        let sheetId = '';
        if (dbMode === 'sheets' && inputSheetId && inputSheetId.value.trim()) {
            const rawVal = inputSheetId.value.trim();
            const urlMatch = rawVal.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            sheetId = urlMatch ? urlMatch[1] : rawVal;
        }
        APP.profile.sheet_id = sheetId;
        goToStep3();
    });

    // Step 2 (Sheets sync) → Back button
    document.getElementById('ob-back-btn-sheets')?.addEventListener('click', () => {
        document.getElementById('ob-step-2').style.display='none';
        document.getElementById('ob-step-1').style.display='block';
        document.getElementById('dot-1').classList.add('active');
        document.getElementById('dot-2').classList.remove('active');
    });
}

function goToStep2() {
    document.getElementById('ob-step-1').style.display='none';
    document.getElementById('ob-step-2').style.display='block';
    document.getElementById('ob-step-3').style.display='none';
    document.getElementById('dot-1').classList.remove('active');
    document.getElementById('dot-2').classList.add('active');
    document.getElementById('dot-3').classList.remove('active');
}

function goToStep3() {
    document.getElementById('ob-step-2').style.display='none';
    document.getElementById('ob-step-3').style.display='block';
    document.getElementById('dot-2').classList.remove('active');
    document.getElementById('dot-3').classList.add('active');
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
    _selectedCell = id;
    document.getElementById('ob-crop-cell-label').textContent = id;

    const cur = _gridState[id];
    const opts = document.getElementById('ob-crop-options');
    opts.innerHTML = '';
    
    CROPS.forEach(cr => {
        const b = document.createElement('button');
        const isSelected = cur && (typeof cur === 'object' ? cur.crop === cr.id : cur === cr.id);
        b.className = 'ob-crop-option' + (isSelected ? ' selected' : '');
        b.innerHTML = `<span style="font-size:1.6rem">${cr.icon}</span>${cr.label}`;
        
        b.addEventListener('click', () => {
            if (cr.id === 'empty') {
                _gridState[id] = null;
                closeObModal();
                renderObGrid();
            } else {
                // Show Screen 2 Details Form
                document.getElementById('ob-crop-screen-selection').style.display = 'none';
                document.getElementById('ob-crop-screen-details').style.display = 'block';
                
                const nameInput = document.getElementById('ob-custom-crop-name');
                nameInput.value = cr.id === 'other' ? '' : cr.label;
                
                const cycleSelect = document.getElementById('ob-crop-cycle');
                cycleSelect.value = (cur && typeof cur === 'object') ? cur.cycle : 'vegetative';
                
                nameInput.dispatchEvent(new Event('input'));
                cycleSelect.dispatchEvent(new Event('change'));
            }
        });
        opts.appendChild(b);
    });
    
    document.getElementById('ob-crop-screen-selection').style.display = 'block';
    document.getElementById('ob-crop-screen-details').style.display = 'none';
    
    document.getElementById('ob-crop-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeObModal() {
    document.getElementById('ob-crop-modal').style.display = 'none';
    document.body.style.overflow = '';
    _selectedCell = null;
    _editingProfileParcel = false;
    const rmBtn = document.getElementById('ob-crop-details-remove');
    if (rmBtn) rmBtn.style.display = 'none';
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
        // Parcels step (3) → back to Sheets step (2).
        document.getElementById('ob-step-3').style.display='none';
        document.getElementById('ob-step-2').style.display='block';
        document.getElementById('dot-2').classList.add('active');
        document.getElementById('dot-3').classList.remove('active');
    });
    document.getElementById('ob-crop-modal-close').addEventListener('click',closeObModal);
    document.getElementById('ob-crop-details-close').addEventListener('click',closeObModal);
    document.getElementById('ob-crop-modal').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeObModal(); });
    
    document.getElementById('ob-crop-details-back').addEventListener('click',()=>{
        document.getElementById('ob-crop-screen-selection').style.display = 'block';
        document.getElementById('ob-crop-screen-details').style.display = 'none';
    });



    let validationTimeout = null;
    const nameInput = document.getElementById('ob-custom-crop-name');
    const msgEl = document.getElementById('ob-crop-validation-msg');
    const sugBox = document.getElementById('ob-crop-suggestions-box');
    
    let currentValidatedName = '';

    nameInput.addEventListener('input', () => {
        clearTimeout(validationTimeout);
        const name = nameInput.value.trim();
        if (!name) {
            msgEl.style.display = 'none';
            sugBox.style.display = 'none';
            return;
        }
        validationTimeout = setTimeout(() => {
            fetch(`/api/market/validate-crop?name=${encodeURIComponent(name)}`)
                .then(r => r.json())
                .then(data => {
                    sugBox.innerHTML = '';
                    sugBox.style.display = 'none';
                    if (data.status === 'exact') {
                        msgEl.textContent = `✓ Price list active for ${data.match}`;
                        msgEl.style.color = '#10b981';
                        msgEl.style.display = 'block';
                        currentValidatedName = data.match;
                    } else if (data.status === 'suggest') {
                        msgEl.textContent = `⚠️ No exact match. Did you mean:`;
                        msgEl.style.color = '#f59e0b';
                        msgEl.style.display = 'block';
                        sugBox.style.display = 'flex';
                        data.matches.forEach(m => {
                            const btn = document.createElement('button');
                            btn.className = 'ob-btn-ghost';
                            btn.style.padding = '0.2rem 0.5rem';
                            btn.style.fontSize = '0.75rem';
                            btn.style.background = '#334155';
                            btn.style.color = '#f8fafc';
                            btn.style.borderRadius = '0.25rem';
                            btn.style.border = 'none';
                            btn.style.cursor = 'pointer';
                            btn.textContent = m.charAt(0).toUpperCase() + m.slice(1);
                            btn.addEventListener('click', (evt) => {
                                evt.preventDefault();
                                nameInput.value = m;
                                nameInput.dispatchEvent(new Event('input'));
                            });
                            sugBox.appendChild(btn);
                        });
                        currentValidatedName = name;
                    } else {
                        msgEl.textContent = `ℹ️ No price list found for '${name}'. You can still keep it.`;
                        msgEl.style.color = '#94a3b8';
                        msgEl.style.display = 'block';
                        currentValidatedName = name;
                    }
                });
        }, 300);
    });

    document.getElementById('ob-crop-details-save').addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) return;

        const cycleEl = document.getElementById('ob-crop-cycle');
        const record = {
            crop: (currentValidatedName || name).toLowerCase(),
            cycle: cycleEl ? cycleEl.value : 'vegetative',
        };

        if (_editingProfileParcel) {
            // Post-onboarding edit — mutate APP.profile in place and persist.
            APP.profile.grid = APP.profile.grid || {};
            APP.profile.grid[_selectedCell] = record;
            APP.profile.parcels = APP.profile.parcels || [];
            const pIdx = APP.profile.parcels.findIndex(p => p.id === _selectedCell);
            const parcelRec = {
                id: _selectedCell,
                crop: record.crop,
                cycle: record.cycle,
                area_ha: pIdx >= 0 ? (APP.profile.parcels[pIdx].area_ha || 1.0) : 1.0,
                status: pIdx >= 0 ? (APP.profile.parcels[pIdx].status || 'Healthy') : 'Healthy',
            };
            if (pIdx >= 0) APP.profile.parcels[pIdx] = parcelRec;
            else APP.profile.parcels.push(parcelRec);
            saveProfile(APP.profile);
            closeObModal();
            renderFarmGrid();
            persistProfileUpdate();
        } else {
            // Onboarding flow — original behavior.
            _gridState[_selectedCell] = record;
            closeObModal();
            renderObGrid();
        }
    });

    // Remove-parcel action (visible only in edit mode).
    document.getElementById('ob-crop-details-remove')?.addEventListener('click', () => {
        if (!_editingProfileParcel || !_selectedCell) return;
        const id = _selectedCell;
        APP.profile.grid = APP.profile.grid || {};
        APP.profile.grid[id] = null;
        APP.profile.parcels = (APP.profile.parcels || []).filter(p => p.id !== id);
        saveProfile(APP.profile);
        closeObModal();
        renderFarmGrid();
        persistProfileUpdate();
    });

    document.getElementById('ob-start-btn').addEventListener('click', finishOnboarding);
}

async function finishOnboarding() {
    const rows = obRows(), cols = obCols();
    const parcels = Object.entries(_gridState)
        .filter(([, c]) => c !== null)
        .map(([id, c]) => {
            const cropVal = (typeof c === 'object') ? c.crop : c;
            const cycleVal = (typeof c === 'object') ? c.cycle : 'vegetative';
            return {
                id,
                crop: cropVal,
                cycle: cycleVal,
                area_ha: 1.0,
                status: 'Healthy'
            };
        });
    APP.profile = { ...APP.profile, rows, cols, grid: _gridState, parcels, setup_date: new Date().toISOString() };
    saveProfile(APP.profile);
    document.getElementById('ob-start-btn').disabled = true;
    document.getElementById('ob-saving-msg').style.display = 'flex';
    try { await persistFarm(APP.profile); } catch (e) { console.warn('Backend save skipped:', e.message); }
    document.getElementById('ob-saving-msg').style.display = 'none';
    launchApp();
}



// Phase 17: build a state envelope that seeds the workflow session with the
// user's real farm profile. Sent alongside every /run POST so the backend
// never falls back to the demo mock DB — which was the root cause of
// hallucinated parcels and mismatched market prices.
function buildStateDelta(profile) {
    if (!profile) return {};
    const coords = (typeof coordsFor === 'function') ? coordsFor(profile.canton) : { lat:-0.2687, lng:-79.4326 };
    const parcels = (profile.parcels || []).map(p => ({
        id: p.id,
        crop: (p.crop || '').toString(),
        cycle: p.cycle || 'vegetative',
        area_ha: p.area_ha != null ? p.area_ha : 1.0,
        status: p.status || 'Healthy',
    }));
    const crops = [...new Set(parcels.map(p => p.crop).filter(Boolean))];
    const country = profile.country_label || profile.country || 'Ecuador';
    return {
        sheet_id: profile.sheet_id || '',
        latitude: coords.lat,
        longitude: coords.lng,
        canton: (profile.canton || 'el_carmen').toString().toLowerCase().replace(/\s+/g,'_'),
        province: profile.province || 'Manabí',
        country,
        crops,
        farm_context: {
            profile: {
                country,
                province: profile.province || 'Manabí',
                canton: profile.canton || 'El Carmen',
                latitude: coords.lat,
                longitude: coords.lng,
                farmer_name: profile.farmer_name || 'Farmer',
                farm_name: profile.farm_name || 'Farm',
                total_hectares: parcels.reduce((s,p) => s + (p.area_ha || 1.0), 0),
            },
            farm_grid: {
                rows: profile.rows || 2,
                cols: profile.cols || 3,
                parcels,
            },
            crop_plan: profile.crop_plan || [],
            indicators: profile.indicators || [],
        },
    };
}

async function persistFarm(profile) {
    const body = JSON.stringify({
        user_id: APP.userId,
        session_id: APP.sessionId,
        state_delta: buildStateDelta(profile),
        new_message: {
            parts: [{
                text: `Save my farm profile: ${JSON.stringify({
                    sheet_id: profile.sheet_id,
                    rows: profile.rows,
                    cols: profile.cols,
                    parcels: profile.parcels,
                    location: { canton: profile.canton, province: profile.province, country: profile.country_label },
                })}`,
            }],
        },
    });
    await fetch('/run', { method:'POST', headers:{'Content-Type':'application/json'}, body, signal:AbortSignal.timeout(15000) });
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

    // Update DB status badge in topbar
    const dbBdg = document.getElementById('topbar-db-status');
    const dbTxt = document.getElementById('db-status-text');
    if (dbBdg && dbTxt) {
        if (APP.profile.sheet_id) {
            dbTxt.textContent = "Sheets Active";
            dbBdg.style.background = "rgba(16,185,129,0.15)";
            dbBdg.style.color = "#10b981";
        } else {
            dbTxt.textContent = "Local DB";
            dbBdg.style.background = "rgba(245,158,11,0.15)";
            dbBdg.style.color = "#f59e0b";
        }
    }

    // Restore persisted indicators & cropPlan from localStorage
    const savedIndicators = loadIndicators();
    const savedCropPlan = loadCropPlan();

    if (savedCropPlan && savedCropPlan.length) {
        APP.cropPlan = savedCropPlan;
    } else {
        // Calendar starts empty — activities are only added when the user
        // explicitly requests a crop plan via the AI assistant.
        APP.cropPlan = [];
    }

    if (savedIndicators && savedIndicators.length) {
        APP.indicators = savedIndicators;
    } else {
        // Build synthetic indicators from profile
        APP.indicators = (APP.profile.parcels||[]).map(p=>({
            parcel:        p.id,
            crop:          p.crop,
            status:        p.status || 'Healthy',
            pending_action:'None',
        }));
    }

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
    fetch(`/api/market/price?crop=${encodeURIComponent(mainCrop)}`).then(res=>res.json()).then(d=>{
        if(d && d.current_price_usd) {
            APP.prices[mainCrop]={ price:d.current_price_usd, unit:d.unit, change:d.daily_change_pct, trend:d.trend_direction };
            updatePriceIndicator(mainCrop);
        } else {
            document.getElementById('ind-price-sub').textContent='Data unavailable';
        }
    }).catch(()=>{ document.getElementById('ind-price-sub').textContent='Offline'; });

    // Async: for Sheets users, re-fetch farm data from Google Sheets
    // so that indicators, crop plan, and parcel statuses written by the
    // advisory agent on previous sessions are restored.
    if (APP.profile.sheet_id) {
        _refetchSheetsData();
    }

    // Deselect handler
    document.getElementById('btn-deselect')?.addEventListener('click', deselectParcel);

    // Phase 19: +Row/+Column controls removed. The single trailing "+"
    // cell rendered by renderFarmGrid is now the only affordance for adding
    // parcels — it respects the user's chosen column count and flows into a
    // new row automatically.

    // Reset button
    document.getElementById('btn-reset-ob')?.addEventListener('click',()=>{
        if(confirm('Reset your farm setup? This will clear all onboarding data.')) { resetProfile(); location.reload(); }
    });
}

/**
 * Re-fetch farm data from Google Sheets on boot so that returning users
 * see indicators, crop plan updates, and parcel status changes written
 * by the advisory agent during previous sessions.
 */
async function _refetchSheetsData() {
    try {
        // Send a lightweight /run call that triggers sheets_read_node
        // and returns the full farm context from the Google Sheet.
        const res = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify({
                user_id:    APP.userId,
                session_id: APP.sessionId,
                state_delta: buildStateDelta(APP.profile),
                new_message: { parts: [{ text: 'Reload my farm data from Sheets' }] },
            }),
        });
        if (!res.ok) return;
        const events = await res.json();
        if (!Array.isArray(events)) return;

        // Look for the farm_context in the events' state_delta
        for (const ev of events) {
            const sd = ev?.actions?.state_delta;
            if (!sd?.farm_context) continue;
            const fc = typeof sd.farm_context === 'string'
                ? JSON.parse(sd.farm_context)
                : sd.farm_context;

            // Update indicators from Sheet data
            const sheetIndicators = fc.indicators || [];
            if (sheetIndicators.length) {
                APP.indicators = sheetIndicators.map(ind => ({
                    parcel:        ind.parcel,
                    crop:          ind.crop || (APP.profile.parcels||[]).find(p=>p.id===ind.parcel)?.crop || '',
                    status:        ind.health_status || ind.status || 'Healthy',
                    pending_action: ind.pending_action || 'None',
                }));
                saveIndicators(APP.indicators);
                renderIndicators_farm();
            }

            // Update crop plan from Sheet data
            const sheetPlan = fc.crop_plan || [];
            if (sheetPlan.length) {
                APP.cropPlan = sheetPlan;
                saveCropPlan(APP.cropPlan);
                renderCalendar();
                renderEventsList();
            }

            // Update parcel statuses from grid
            const gridParcels = fc.farm_grid?.parcels || [];
            if (gridParcels.length && APP.profile.parcels) {
                for (const gp of gridParcels) {
                    const local = APP.profile.parcels.find(p => p.id === gp.id);
                    if (local && gp.status) {
                        local.status = gp.status;
                    }
                }
                saveProfile(APP.profile);
                renderFarmGrid();
            }
            break;
        }
    } catch (e) {
        console.warn('Sheets re-fetch on boot failed (non-fatal):', e.message);
    }
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
    // Phase 18: drain any pending photo-analysis results into the chat when
    // the user first opens the AI tab.
    if (tabId === 'ai' && APP.chatSeed && APP.chatSeed.length) {
        APP.chatSeed.forEach(m => { try { addMessage(m.role || 'agent', m.text || ''); } catch {} });
        APP.chatSeed = [];
    }
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
        fetch(`/api/market/price?crop=${encodeURIComponent(par.crop)}`).then(res=>res.json()).then(d=>{
            if(d && d.current_price_usd) {
                APP.prices[par.crop]={ price:d.current_price_usd, unit:d.unit, change:d.daily_change_pct, trend:d.trend_direction };
                if(APP.selectedParcel?.id===parcelId) updatePriceIndicator(par.crop);
            }
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
    const cols=profile.cols||2;
    const container=document.getElementById('farm-grid-view');
    container.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    container.innerHTML='';

    // Phase 19: render one cell per filled parcel in row-major order, then a
    // single "+" cell at position N. Rows grow past the initial `rows` as
    // needed. No +/-Row/Column controls — the "+" cell is the only affordance.
    const parcels = (profile.parcels || [])
        .filter(p => p && p.crop)
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id));

    parcels.forEach(p => {
        const id = p.id;
        const cropId = p.crop;
        const crop = cropOf(cropId);
        const el = document.createElement('div');
        el.className = 'farm-parcel assigned';
        el.dataset.parcel = id;
        el.style.position = 'relative';
        el.setAttribute('role', 'gridcell');
        el.setAttribute('aria-label', `Parcel ${id}${crop ? ': ' + crop.label : ''}`);
        if (crop && crop.bg) {
            el.style.background = crop.bg;
            el.style.border = `2px solid ${crop.bg}`;
            el.innerHTML = `<span class="fp-id" style="color:${crop.tx}">${id}</span>
                            <span class="fp-icon">${crop.icon}</span>
                            <span class="fp-crop" style="color:${crop.tx}">${crop.label}</span>`;
        } else {
            el.innerHTML = `<span class="fp-id">${id}</span>`;
        }

        // Corner minus (delete) affordance with confirmation prompt
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'parcel-delete-btn';
        delBtn.setAttribute('aria-label', `Delete parcel ${id}`);
        delBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(15,23,42,0.85);border:1px solid rgba(239,68,68,0.4);border-radius:4px;color:#ef4444;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.75rem;padding:0;z-index:5;pointer-events:auto;transition:all 0.2s;';
        delBtn.innerHTML = '<i class="fa-solid fa-minus" style="pointer-events:none"></i>';
        delBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`¿Estás seguro de que deseas eliminar la parcela ${id} y toda su información? / Are you sure you want to delete parcel ${id}?`)) {
                APP.profile.grid = APP.profile.grid || {};
                APP.profile.grid[id] = null;
                APP.profile.parcels = (APP.profile.parcels || []).filter(p => p.id !== id);
                if (APP.selectedParcel?.id === id) {
                    deselectParcel();
                }
                saveProfile(APP.profile);
                renderFarmGrid();
                persistProfileUpdate();
            }
        });
        el.appendChild(delBtn);

        el.addEventListener('click', () => selectParcel(id, cropId));
        container.appendChild(el);
    });

    // Compute the next available slot for the "+" cell
    const existingIds = new Set(parcels.map(p => p.id));
    let nextId = null;
    let nextRow = 0;
    for (let r = 0; r < 50; r++) {
        for (let c = 0; c < cols; c++) {
            const cid = cellId(r, c);
            if (!existingIds.has(cid)) {
                nextId = cid;
                nextRow = r;
                break;
            }
        }
        if (nextId) break;
    }
    if (!nextId) {
        const n = parcels.length;
        nextRow = Math.floor(n / cols);
        nextId = cellId(nextRow, n % cols);
    }
    const addEl = document.createElement('div');
    addEl.className = 'farm-parcel add-cell';
    addEl.dataset.parcel = nextId;
    addEl.style.position = 'relative';
    addEl.setAttribute('role', 'gridcell');
    addEl.setAttribute('aria-label', `Add parcel ${nextId}`);
    addEl.innerHTML = `<span class="fp-id">${nextId}</span><span class="fp-empty"><i class="fa-solid fa-plus"></i></span><span class="fp-crop" style="opacity:0.65;font-size:0.8rem">Add</span>`;
    addEl.style.cursor = 'pointer';
    addEl.style.borderStyle = 'dashed';
    addEl.addEventListener('click', () => {
        try { openEditParcelModal(nextId); }
        catch (err) { console.error('openEditParcelModal (add) failed:', err); }
    });
    container.appendChild(addEl);

    // Keep rows in sync so the persisted profile reflects the current layout.
    profile.rows = Math.max(profile.rows || 1, nextRow + 1);
}

// Phase 17 — edit-parcel entrypoint. Reuses the onboarding modal in edit mode.
function openEditParcelModal(id) {
    _editingProfileParcel = true;
    _selectedCell = id;
    APP.profile.grid = APP.profile.grid || {};
    const cell = APP.profile.grid[id] || null;
    const cur = (typeof cell === 'object' && cell) ? cell : (cell ? { crop:cell, cycle:'vegetative', photo:null } : null);

    document.getElementById('ob-crop-cell-label').textContent = id;


    // Populate crop options and open selection screen
    const opts = document.getElementById('ob-crop-options');
    opts.innerHTML = '';
    CROPS.forEach(cr => {
        const b = document.createElement('button');
        const isSelected = cur && cur.crop === cr.id;
        b.className = 'ob-crop-option' + (isSelected ? ' selected' : '');
        b.innerHTML = `<span style="font-size:1.6rem">${cr.icon}</span>${cr.label}`;
        b.addEventListener('click', () => {
            if (cr.id === 'empty') {
                APP.profile.grid[id] = null;
                APP.profile.parcels = (APP.profile.parcels||[]).filter(p => p.id !== id);
                closeObModal();
                saveProfile(APP.profile);
                renderFarmGrid();
                persistProfileUpdate();
            } else {
                document.getElementById('ob-crop-screen-selection').style.display = 'none';
                document.getElementById('ob-crop-screen-details').style.display = 'block';
                const nameInput = document.getElementById('ob-custom-crop-name');
                nameInput.value = cr.id === 'other' ? '' : cr.label;
                const cycleSelect = document.getElementById('ob-crop-cycle');
                cycleSelect.value = cur?.cycle || 'vegetative';
                nameInput.dispatchEvent(new Event('input'));
                cycleSelect.dispatchEvent(new Event('change'));
            }
        });
        opts.appendChild(b);
    });

    document.getElementById('ob-crop-screen-selection').style.display = 'block';
    document.getElementById('ob-crop-screen-details').style.display = 'none';
    // Show the "Remove" secondary action only in edit mode.
    const rmBtn = document.getElementById('ob-crop-details-remove');
    if (rmBtn) rmBtn.style.display = 'block';

    document.getElementById('ob-crop-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

let _editingProfileParcel = false;

// Persist an updated farm profile to the backend — used by all post-onboarding
// grid mutations (edit parcel, add/remove row/col, remove parcel).
async function persistProfileUpdate() {
    try {
        const body = JSON.stringify({
            user_id: APP.userId,
            session_id: APP.sessionId,
            state_delta: buildStateDelta(APP.profile),
            new_message: {
                parts: [{ text: `Save my farm profile: ${JSON.stringify({
                    sheet_id: APP.profile.sheet_id,
                    rows: APP.profile.rows,
                    cols: APP.profile.cols,
                    parcels: APP.profile.parcels,
                    location: {
                        canton: APP.profile.canton,
                        province: APP.profile.province,
                        country: APP.profile.country_label,
                    },
                })}` }],
            },
        });
        await fetch('/run', { method:'POST', headers:{'Content-Type':'application/json'}, body, signal: AbortSignal.timeout(15000) });
    } catch (e) {
        console.warn('Profile update persist failed:', e.message);
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

        // Activity labels (full text in calendar cells)
        if(inMonth&&eventsMap[dayNum]) {
            const evs=eventsMap[dayNum];
            // If parcel filter active, only show for that parcel
            const filtered=APP.selectedParcel
                ? evs.filter(e=>e.parcel===APP.selectedParcel.id)
                : evs;
            const labelsWrap=document.createElement('div');
            labelsWrap.className='cal-event-labels';
            filtered.slice(0,3).forEach(ev=>{
                const cr=cropOf(ev.crop);
                const label=document.createElement('div');
                label.className='cal-event-label';
                label.style.borderLeftColor=cr?cr.color:'#56708a';
                label.textContent=ev.activity;
                label.title=`${ev.parcel}: ${ev.activity}`;
                labelsWrap.appendChild(label);
            });
            if(filtered.length>3) {
                const more=document.createElement('div');
                more.className='cal-event-more';
                more.textContent=`+${filtered.length-3} more`;
                labelsWrap.appendChild(more);
            }
            if(labelsWrap.children.length) cell.appendChild(labelsWrap);
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
// renderContextBar removed in Phase 17 — the ai-context-bar UI was removed
// because the chat is no longer scoped by the selected parcel.
function renderContextBar() { /* noop */ }

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
            if (document.getElementById('typing-indicator')) return;
            const inp=document.getElementById('chat-input');
            inp.value=s.text;
            inp.focus();
            document.getElementById('chat-send-btn').disabled=false;
            sendMessage();
        });
        container.appendChild(card);
    });
}

function buildSuggestions() {
    const sugs=[];
    const parcels=APP.profile?.parcels||[];
    const alerted=APP.indicators.filter(i=>i.pending_action&&i.pending_action!=='None');
    const emptyParcels=parcels.filter(p=>!p.crop||p.crop==='empty');
    const crops=[...new Set(parcels.map(p=>p.crop).filter(c=>c&&c!=='empty'))];
    const mainCrop=crops[0]||'cacao';
    const mainLabel=cropOf(mainCrop)?.label||mainCrop;


    // 1. Alert-driven (if any pending actions)
    if(alerted.length) {
        const a=alerted[0];
        sugs.push({ icon:'<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i>',
            iconBg:'rgba(245,158,11,.12)', category:'alert',
            text:`Review ${a.pending_action} in parcel ${a.parcel}` });
    }

    // 2. Weather signal — drives weather_node
    sugs.push({ icon:'<i class="fa-solid fa-cloud-sun" style="color:#38bdf8"></i>',
        iconBg:'rgba(56,189,248,.12)', category:'weather',
        text:"How will this week's weather affect my crops?" });

    // 3. Market signal — drives market_node
    sugs.push({ icon:'<i class="fa-solid fa-chart-line" style="color:#a855f7"></i>',
        iconBg:'rgba(168,85,247,.12)', category:'market',
        text:`Is it a good time to sell my ${mainLabel}?` });

    // 4. Farm health audit — drives all signals + full advisory
    sugs.push({ icon:'<i class="fa-solid fa-heart-pulse" style="color:#10b981"></i>',
        iconBg:'rgba(16,185,129,.12)', category:'health',
        text:'Give me a full health assessment for my farm' });

    // 5. Harvest assessment
    if(crops.length) {
        sugs.push({ icon:'<i class="fa-solid fa-wheat-awn" style="color:#f59e0b"></i>',
            iconBg:'rgba(245,158,11,.12)', category:'harvest',
            text:`Is my ${mainLabel} ready to harvest?` });
    }

    // 6. Planting / planning
    if(emptyParcels.length) {
        const ids=emptyParcels.slice(0,2).map(p=>p.id).join(' and ');
        sugs.push({ icon:'<i class="fa-solid fa-seedling" style="color:#10b981"></i>',
            iconBg:'rgba(16,185,129,.12)', category:'plan',
            text:`What should I plant in parcel${emptyParcels.length>1?'s':''} ${ids}?` });
    } else {
        const firstParcel=parcels[0]?.id||'A1';
        sugs.push({ icon:'<i class="fa-solid fa-clipboard-list" style="color:#3b82f6"></i>',
            iconBg:'rgba(59,130,246,.12)', category:'plan',
            text:`What should I do on parcel ${firstParcel} this week?` });
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

// Parse AI response to detect crop plan activities. Looks for structured
// activity listings (dates, parcel references, activity names) and builds
// calendar-compatible objects. Only triggered when the user's question was
// about planning/scheduling.
function parsePlanActivities(response, question) {
    const qLower = question.toLowerCase();
    const isPlanRequest = qLower.includes('plan') || qLower.includes('schedule') ||
        qLower.includes('calendar') || qLower.includes('activit') ||
        qLower.includes('irrigation') || qLower.includes('fertiliz') ||
        qLower.includes('maintenance') || qLower.includes('harvest');
    if (!isPlanRequest) return [];

    const activities = [];
    const parcels = APP.profile?.parcels || [];
    const today = new Date();

    // Try to find date + activity patterns in the response
    // Pattern: dates like "July 10", "2026-07-10", "Week 1", etc.
    const lines = response.split('\n');
    const datePatterns = [
        /(\d{4}-\d{2}-\d{2})/,  // ISO dates
        /(\w+ \d{1,2}(?:,?\s*\d{4})?)/,  // "July 10" or "July 10, 2026"
    ];

    // Activity keywords
    const activityKeywords = ['prun', 'fertil', 'irrigat', 'harvest', 'spray', 'weed',
        'inspect', 'monitor', 'plant', 'sow', 'mulch', 'pest', 'disease', 'apply',
        'water', 'compost', 'soil', 'drain', 'de-leaf', 'thin'];

    let foundActivities = [];
    lines.forEach(line => {
        const lower = line.toLowerCase();
        const hasActivity = activityKeywords.some(k => lower.includes(k));
        if (!hasActivity) return;

        // Extract activity name — use the first meaningful phrase
        let activity = line.replace(/^[\s\-\*\d\.\)]+/, '').trim();
        // Trim markdown bold
        activity = activity.replace(/\*\*/g, '').trim();
        if (activity.length < 5 || activity.length > 100) return;

        // Try to extract a date
        let actDate = null;
        for (const pat of datePatterns) {
            const m = line.match(pat);
            if (m) {
                const parsed = new Date(m[1]);
                if (!isNaN(parsed.getTime())) {
                    actDate = parsed;
                    break;
                }
            }
        }

        // If no date found, spread activities over the next weeks
        if (!actDate) {
            actDate = new Date(today);
            actDate.setDate(actDate.getDate() + foundActivities.length * 5 + 2);
        }

        // Try to identify which parcel
        let parcelId = parcels[0]?.id || 'A1';
        parcels.forEach(p => {
            if (line.includes(p.id)) parcelId = p.id;
        });

        foundActivities.push({
            date: actDate.toISOString().split('T')[0],
            parcel: parcelId,
            crop: parcels.find(p => p.id === parcelId)?.crop || 'cacao',
            activity: activity.substring(0, 60),
            status: 'Scheduled',
        });
    });

    // If we detected plan-related content but no structured activities,
    // build some from the parcels and response keywords
    if (foundActivities.length === 0 && isPlanRequest && response.length > 200) {
        const commonActs = ['Soil preparation', 'Fertilization', 'Irrigation check',
            'Pest monitoring', 'Pruning', 'Harvest assessment'];
        parcels.forEach(p => {
            if (!p.crop || p.crop === 'empty') return;
            commonActs.slice(0, 3).forEach((act, i) => {
                const d = new Date(today);
                d.setDate(d.getDate() + i * 7 + 3);
                foundActivities.push({
                    date: d.toISOString().split('T')[0],
                    parcel: p.id,
                    crop: p.crop,
                    activity: act,
                    status: 'Scheduled',
                });
            });
        });
    }

    return foundActivities;
}

async function sendMessage() {
    const input=document.getElementById('chat-input');
    const sendBtn=document.getElementById('chat-send-btn');
    const text=input.value.trim();
    if(!text) return;

    addMessage('user', text);
    input.value=''; sendBtn.disabled=true;

    const typing=addTypingIndicator();

    // Phase 17: no message-level parcel filter — the agent answers whatever
    // the farmer typed. The dashboard grid still tracks APP.selectedParcel
    // for its own UI (indicators view), but the chat is unfiltered.
    const fullMessage=text;

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
                    saveIndicators(APP.indicators);
                    renderIndicators_farm();
                }
                if(inds.weather) { APP.weather=inds.weather; updateWeatherIndicator(); }
                if(inds.crop_updates) {
                    inds.crop_updates.forEach(upd => {
                        const pIdx = APP.profile.parcels.findIndex(p => p.id === upd.parcel);
                        if (pIdx >= 0) {
                            APP.profile.parcels[pIdx].crop = upd.crop;
                            if (upd.cycle) APP.profile.parcels[pIdx].cycle = upd.cycle;
                        }
                        if (APP.profile.grid && APP.profile.grid[upd.parcel]) {
                            if (typeof APP.profile.grid[upd.parcel] === 'object') {
                                APP.profile.grid[upd.parcel].crop = upd.crop;
                                if (upd.cycle) APP.profile.grid[upd.parcel].cycle = upd.cycle;
                            } else {
                                APP.profile.grid[upd.parcel] = {
                                    crop: upd.crop,
                                    cycle: upd.cycle || 'vegetative',
                                    photo: null
                                };
                            }
                        }
                    });
                    saveProfile(APP.profile);
                    renderFarmGrid();
                }
                if(inds.price&&inds.crop) { APP.prices[inds.crop]=inds; updatePriceIndicator(inds.crop); }
            } catch {}
        }

        // Detect crop plan activities in the response and offer to save
        const planActivities = parsePlanActivities(response, text);
        if (planActivities.length > 0) {
            const confirmRow = document.createElement('div');
            confirmRow.className = 'chat-msg agent';
            confirmRow.style.paddingLeft = '42px';
            const confirmBox = document.createElement('div');
            confirmBox.className = 'cal-save-confirm';
            confirmBox.innerHTML = `<span><i class="fa-solid fa-calendar-check" style="color:#10b981;margin-right:0.4rem"></i>Save ${planActivities.length} activities to your calendar?</span>`;
            const yesBtn = document.createElement('button');
            yesBtn.className = 'cal-save-btn';
            yesBtn.textContent = 'Yes, save';
            yesBtn.addEventListener('click', () => {
                planActivities.forEach(a => APP.cropPlan.push(a));
                APP.cropPlan.sort((a,b) => a.date.localeCompare(b.date));
                saveCropPlan(APP.cropPlan);
                renderCalendar();
                renderEventsList();
                confirmBox.innerHTML = '<span style="color:#10b981"><i class="fa-solid fa-circle-check" style="margin-right:0.4rem"></i>Activities saved to your calendar!</span>';
                // Switch to farm tab so user sees the calendar
                setTimeout(() => switchTab('farm'), 1500);
            });
            const noBtn = document.createElement('button');
            noBtn.className = 'cal-save-btn decline';
            noBtn.textContent = 'No thanks';
            noBtn.addEventListener('click', () => {
                confirmBox.innerHTML = '<span style="color:var(--tx2)"><i class="fa-solid fa-xmark" style="margin-right:0.4rem"></i>Activities not saved.</span>';
            });
            confirmBox.appendChild(yesBtn);
            confirmBox.appendChild(noBtn);
            confirmRow.appendChild(confirmBox);
            document.getElementById('chat-messages').appendChild(confirmRow);
            document.getElementById('chat-messages').scrollTop = 999999;
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
    const qLower=question.toLowerCase();
    const crops=APP.profile?.parcels?.map(p=>p.crop).filter(c=>c&&c!=='empty')||[];
    const mainCrop=cropOf(crops[0]||'cacao')?.label||'cacao';

    // Chain to the next signal the user hasn't asked about yet
    const mentionsWeather=lower.includes('weather')||lower.includes('rain')||lower.includes('forecast');
    const mentionsMarket=lower.includes('price')||lower.includes('market')||lower.includes('sell');
    const mentionsFarm=lower.includes('parcel')||lower.includes('farm')||lower.includes('grid');

    // Suggest the signal the response didn't focus on
    if(!qLower.includes('weather')&&!qLower.includes('rain'))
        pills.push("How will this week's weather affect my crops?");
    if(!qLower.includes('sell')&&!qLower.includes('price')&&!qLower.includes('market'))
        pills.push(`Is it a good time to sell my ${mainCrop}?`);
    if(!qLower.includes('health')&&!qLower.includes('assessment')&&!qLower.includes('audit'))
        pills.push('Give me a full health assessment for my farm');

    // Contextual follow-ups based on response content
    if(lower.includes('fertiliz')) pills.push('What fertiliser should I use?');
    if(lower.includes('disease')||lower.includes('fungus')||lower.includes('pest'))
        pills.push('How do I treat this organically?');
    if(lower.includes('harvest')||lower.includes('maturity'))
        pills.push('What is the best time to harvest?');

    return pills.slice(0,3);
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
    const parts = [{ text }];
    const res=await fetch('/run',{
        method:'POST', headers:{'Content-Type':'application/json'},
        signal:AbortSignal.timeout(45000),
        body:JSON.stringify({
            user_id:APP.userId, session_id:APP.sessionId,
            state_delta: buildStateDelta(APP.profile),
            new_message:{ parts },
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

    // ── Version Check (debug-only) ──────────────────────────
    // We record the current build's commit_sha in localStorage for debugging
    // (visible in DevTools → Application) but we no longer wipe the profile
    // on version mismatch. The profile schema is stable across builds and
    // there is no reason to force a smallholder farmer to re-onboard on every
    // backend redeploy — that was the root cause of "my Sheet ID disappeared
    // after a day". Users who genuinely want to reset can use the topbar
    // Reset button (see the `resetProfile()` call further down in this file).
    fetch('/version')
        .then(res => res.json())
        .then(data => {
            const currentSha = data.commit_sha || 'dev';
            const savedSha = localStorage.getItem('croppulse_commit_sha');
            if (savedSha && savedSha !== currentSha) {
                console.log("New build detected (" + currentSha + "), keeping profile intact.");
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
        sendBtn.disabled=!chatInput.value.trim();
    });
    chatInput?.addEventListener('keydown',e=>{
        if(e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn?.addEventListener('click',sendMessage);

    // ── Calendar Plan Buttons (in dashboard header) ──────────
    document.querySelectorAll('.cal-plan-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (document.getElementById('typing-indicator')) return;
            const prompt = btn.getAttribute('data-prompt');
            if (!prompt) return;
            // Switch to AI tab
            switchTab('ai');
            // Short delay to let the tab render, then populate and send
            setTimeout(() => {
                const inp = document.getElementById('chat-input');
                const sb = document.getElementById('chat-send-btn');
                if (!inp || !sb) return;
                inp.value = prompt;
                sb.disabled = false;
                sendMessage();
            }, 150);
        });
    });


    // ── Database Config Modal ───────────────────────────────
    const dbStatusBtn = document.getElementById('topbar-db-status');
    const dbModal = document.getElementById('db-config-modal');
    const dbCloseBtn = document.getElementById('db-config-close');
    const dbOkBtn = document.getElementById('db-config-btn-ok');

    dbStatusBtn?.addEventListener('click', () => {
        // Dynamically populate the modal body based on connection status
        const body = document.getElementById('db-config-body');
        const icon = dbModal.querySelector('.fa-database');
        if (APP.profile && APP.profile.sheet_id) {
            if (icon) icon.style.color = '#10b981';
            body.innerHTML = `
                <p style="font-size:0.9rem;color:#cbd5e1;line-height:1.5;margin-bottom:1rem;">
                    CropPulse AI is connected to your <strong>Google Sheet</strong> for live cloud sync.
                </p>
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);padding:0.75rem;border-radius:0.5rem;margin-bottom:1.25rem;">
                    <p style="font-size:0.8rem;color:#10b981;margin:0;line-height:1.4;display:flex;align-items:center;gap:0.4rem;">
                        <i class="fa-solid fa-circle-check"></i>
                        <strong>Google Sheets Active</strong> — your farm data is synced to the cloud.
                    </p>
                    <p style="font-size:0.75rem;color:#94a3b8;margin:0.5rem 0 0;line-height:1.3;word-break:break-all;">
                        Sheet ID: <code style="background:rgba(255,255,255,.07);padding:.1em .3em;border-radius:3px;">${APP.profile.sheet_id}</code>
                    </p>
                </div>`;
        } else {
            if (icon) icon.style.color = '#f59e0b';
            body.innerHTML = `
                <p style="font-size:0.9rem;color:#cbd5e1;line-height:1.5;margin-bottom:1rem;">
                    CropPulse AI is currently operating in <strong>Local mode</strong> — your farm data is stored in your browser.
                </p>
                <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);padding:0.75rem;border-radius:0.5rem;margin-bottom:1.25rem;">
                    <p style="font-size:0.8rem;color:#f59e0b;margin:0;line-height:1.4;">
                        To enable live cloud sync to your <strong>Google Sheets</strong>, reset your farm setup and select <strong>Google Sheets</strong> during onboarding step 2.
                    </p>
                    <p style="font-size:0.75rem;color:#94a3b8;margin:0.5rem 0 0;line-height:1.3;">
                        Had a Sheet configured before? Your browser storage may have been cleared — re-run onboarding to reconnect.
                    </p>
                </div>`;
        }
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
