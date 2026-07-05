/* ═══════════════════════════════════════════════════════════════
   CropPulse AI — app.js
   Onboarding flow + main app logic
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Session identifiers ───────────────────────────────────────
const userId    = 'farmer_' + Math.random().toString(36).substring(2, 9);
const sessionId = 'session_' + Math.random().toString(36).substring(2, 9);

// ── Storage keys ─────────────────────────────────────────────
const STORAGE_KEY = 'croppulse_farm_profile';

// ─────────────────────────────────────────────────────────────
// LOCATION DATA — mirroring the MCP server lookup table
// Format: { country: { province: [canton, ...], ... } }
// ------------------------------------------------------------- 
const LOCATION_DATA = {
    ecuador: {
        'Azuay':                    ['Cuenca', 'Girón', 'Santa Isabel', 'Sigsig', 'Pucará'],
        'Bolívar':                  ['Guaranda', 'Chillanes', 'Caluma', 'Echeandía'],
        'Cañar':                    ['Azogues', 'Biblián', 'Cañar', 'La Troncal'],
        'Carchi':                   ['Tulcán', 'Montúfar', 'Espejo', 'Mira'],
        'Chimborazo':               ['Riobamba', 'Alausí', 'Chunchi', 'Guano', 'Penipe'],
        'Cotopaxi':                 ['Latacunga', 'Pujilí', 'Salcedo', 'Sigchos', 'La Maná'],
        'El Oro':                   ['Machala', 'Santa Rosa', 'Pasaje', 'Huaquillas', 'Arenillas'],
        'Esmeraldas':               ['Esmeraldas', 'Quinindé', 'San Lorenzo', 'Muisne', 'Atacames'],
        'Galápagos':                ['Puerto Ayora', 'Puerto Baquerizo Moreno', 'Puerto Villamil'],
        'Guayas':                   ['Guayaquil', 'Durán', 'Milagro', 'Daule', 'Samborondón', 'Naranjal'],
        'Imbabura':                 ['Ibarra', 'Otavalo', 'Cotacachi', 'Antonio Ante', 'Urcuquí'],
        'Loja':                     ['Loja', 'Catamayo', 'Macará', 'Cariamanga', 'Zapotillo'],
        'Los Ríos':                 ['Babahoyo', 'Quevedo', 'Vinces', 'Buena Fe', 'Valencia'],
        'Manabí':                   ['Portoviejo', 'Manta', 'Chone', 'El Carmen', 'Pedernales', 'Jipijapa', 'Montecristi', 'Bahía de Caráquez'],
        'Morona Santiago':          ['Macas', 'Sucúa', 'Gualaquiza', 'Palora'],
        'Napo':                     ['Tena', 'Archidona', 'El Chaco'],
        'Orellana':                 ['Francisco de Orellana', 'Loreto', 'La Joya de los Sachas'],
        'Pastaza':                  ['Puyo', 'Mera', 'Santa Clara'],
        'Pichincha':                ['Quito', 'Cayambe', 'Mejía', 'Rumiñahui', 'Pedro Moncayo'],
        'Santa Elena':              ['Santa Elena', 'Salinas', 'La Libertad'],
        'Santo Domingo de los Tsáchilas': ['Santo Domingo'],
        'Sucumbíos':                ['Lago Agrio', 'Shushufindi', 'Cuyabeno'],
        'Tungurahua':               ['Ambato', 'Baños', 'Pelileo', 'Píllaro'],
        'Zamora Chinchipe':         ['Zamora', 'Yantzaza', 'Centinela del Cóndor'],
    },
    colombia: {
        'Antioquia':            ['Medellín', 'Bello', 'Envigado', 'Apartadó', 'Turbo'],
        'Atlántico':            ['Barranquilla', 'Soledad', 'Malambo'],
        'Bogotá D.C.':          ['Bogotá'],
        'Bolívar':              ['Cartagena', 'Magangué'],
        'Caldas':               ['Manizales', 'Chinchiná', 'Villamaría'],
        'Cauca':                ['Popayán', 'Santander de Quilichao'],
        'Cesar':                ['Valledupar', 'Aguachica'],
        'Córdoba':              ['Montería', 'Cereté'],
        'Cundinamarca':         ['Bogotá', 'Soacha', 'Fusagasugá'],
        'Huila':                ['Neiva', 'Pitalito', 'Garzón'],
        'La Guajira':           ['Riohacha', 'Maicao'],
        'Magdalena':            ['Santa Marta', 'Ciénaga'],
        'Meta':                 ['Villavicencio', 'Acacías'],
        'Nariño':               ['Pasto', 'Tumaco', 'Ipiales'],
        'Norte de Santander':   ['Cúcuta', 'Ocaña'],
        'Quindío':              ['Armenia', 'Calarcá'],
        'Risaralda':            ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'],
        'Santander':            ['Bucaramanga', 'Floridablanca', 'Barrancabermeja'],
        'Sucre':                ['Sincelejo', 'Corozal'],
        'Tolima':               ['Ibagué', 'Espinal', 'Melgar'],
        'Valle del Cauca':      ['Cali', 'Buenaventura', 'Palmira', 'Tuluá'],
    },
    peru: {
        'Amazonas':         ['Chachapoyas', 'Bagua'],
        'Áncash':           ['Huaraz', 'Chimbote', 'Carhuaz'],
        'Apurímac':         ['Abancay', 'Andahuaylalas'],
        'Arequipa':         ['Arequipa', 'Mollendo', 'Camana'],
        'Ayacucho':         ['Ayacucho', 'Huanta'],
        'Cajamarca':        ['Cajamarca', 'Jaén', 'Chota'],
        'Cusco':            ['Cusco', 'Espinar', 'Quillabamba'],
        'Huancavelica':     ['Huancavelica', 'Acobamba'],
        'Huánuco':          ['Huánuco', 'Tingo María'],
        'Ica':              ['Ica', 'Pisco', 'Nazca'],
        'Junín':            ['Huancayo', 'Tarma', 'La Merced'],
        'La Libertad':      ['Trujillo', 'Chepén', 'Otuzco'],
        'Lambayeque':       ['Chiclayo', 'Ferreñafe', 'Lambayeque'],
        'Lima':             ['Lima', 'Barranca', 'Cañete'],
        'Loreto':           ['Iquitos', 'Yurimaguas'],
        'Madre de Dios':    ['Puerto Maldonado'],
        'Moquegua':         ['Moquegua', 'Ilo'],
        'Pasco':            ['Cerro de Pasco', 'Oxapampa'],
        'Piura':            ['Piura', 'Sullana', 'Talara', 'Paita'],
        'Puno':             ['Puno', 'Juliaca', 'Azángaro'],
        'San Martín':       ['Tarapoto', 'Moyobamba', 'Bellavista'],
        'Tacna':            ['Tacna'],
        'Tumbes':           ['Tumbes', 'Zarumilla'],
        'Ucayali':          ['Pucallpa', 'Aguaytía'],
    },
    bolivia: {
        'Cochabamba': ['Cochabamba', 'Quillacollo', 'Sacaba'],
        'La Paz':     ['La Paz', 'El Alto', 'Caranavi'],
        'Santa Cruz': ['Santa Cruz de la Sierra', 'Montero', 'Warnes'],
        'Oruro':      ['Oruro'],
        'Potosí':     ['Potosí', 'Uyuni'],
        'Sucre':      ['Sucre'],
        'Beni':       ['Trinidad', 'Riberalta'],
        'Pando':      ['Cobija'],
        'Tarija':     ['Tarija', 'Yacuiba'],
    },
    brazil: {
        'Amazonas':         ['Manaus', 'Parintins'],
        'Bahia':            ['Salvador', 'Feira de Santana', 'Vitória da Conquista'],
        'Goiás':            ['Goiânia', 'Anápolis'],
        'Mato Grosso':      ['Cuiabá', 'Sinop'],
        'Minas Gerais':     ['Belo Horizonte', 'Uberlândia'],
        'Pará':             ['Belém', 'Santarém'],
        'Paraná':           ['Curitiba', 'Londrina', 'Maringá'],
        'Rio de Janeiro':   ['Rio de Janeiro', 'Campos'],
        'Rio Grande do Sul':['Porto Alegre', 'Caxias do Sul'],
        'São Paulo':        ['São Paulo', 'Campinas', 'Ribeirão Preto'],
    },
    panama: {
        'Chiriquí':  ['David', 'Boquete', 'Bugaba'],
        'Coclé':     ['Penonomé', 'La Pintada'],
        'Herrera':   ['Chitré', 'Los Santos'],
        'Panamá':    ['Ciudad de Panamá', 'Arraiján'],
        'Veraguas':  ['Santiago', 'La Mesa'],
    },
    costa_rica: {
        'Alajuela':     ['Alajuela', 'San Ramón', 'Grecia'],
        'Cartago':      ['Cartago', 'Turrialba'],
        'Guanacaste':   ['Liberia', 'Nicoya'],
        'Heredia':      ['Heredia', 'San Isidro'],
        'Limón':        ['Limón', 'Guápiles'],
        'Puntarenas':   ['Puntarenas', 'Quepos'],
        'San José':     ['San José', 'Desamparados'],
    },
    mexico: {
        'Chiapas':          ['Tuxtla Gutiérrez', 'San Cristóbal de las Casas', 'Comitán'],
        'Guerrero':         ['Acapulco', 'Chilpancingo', 'Iguala'],
        'Jalisco':          ['Guadalajara', 'Zapopan', 'Tlaquepaque'],
        'Michoacán':        ['Morelia', 'Uruapan', 'Lázaro Cárdenas'],
        'Oaxaca':           ['Oaxaca de Juárez', 'Juchitán', 'Salina Cruz'],
        'Tabasco':          ['Villahermosa', 'Cárdenas'],
        'Veracruz':         ['Veracruz', 'Xalapa', 'Coatzacoalcos', 'Córdoba'],
        'Yucatán':          ['Mérida', 'Progreso', 'Valladolid'],
    },
};

// ── Crop definitions ─────────────────────────────────────────
const CROPS = [
    { id: 'cacao',    label: 'Cacao',    icon: '🍫', bg: '#E1F5EE', text: '#065f46' },
    { id: 'banana',   label: 'Banana',   icon: '🍌', bg: '#FAEEDA', text: '#92400e' },
    { id: 'coffee',   label: 'Coffee',   icon: '☕', bg: '#FAECE7', text: '#9a3412' },
    { id: 'palm_oil', label: 'Palm Oil', icon: '🌴', bg: '#E6F1FB', text: '#1e40af' },
    { id: 'rice',     label: 'Rice',     icon: '🌾', bg: '#E6F1FB', text: '#1e40af' },
    { id: 'maize',    label: 'Maize',    icon: '🌽', bg: '#FAEEDA', text: '#92400e' },
    { id: 'plantain', label: 'Plantain', icon: '🍌', bg: '#E6F1FB', text: '#1e40af' },
    { id: 'cassava',  label: 'Cassava',  icon: '🥔', bg: '#E6F1FB', text: '#1e40af' },
    { id: 'other',    label: 'Other',    icon: '🌱', bg: '#E6F1FB', text: '#1e40af' },
    { id: 'empty',    label: 'Empty',    icon: '✕',  bg: null,      text: null       },
];

function cropById(id) { return CROPS.find(c => c.id === id) || null; }

// ── Grid state ────────────────────────────────────────────────
let gridState = {};      // { 'A1': 'cacao', 'A2': null, ... }
let selectedCell = null; // cell id being edited

// ── Farm profile ──────────────────────────────────────────────
let farmProfile = null;

// ─────────────────────────────────────────────────────────────
// HELPERS
// -------------------------------------------------------------
function cellId(row, col) {
    return String.fromCharCode(65 + row) + (col + 1);
}

function loadProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveProfile(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function resetProfile() {
    localStorage.removeItem(STORAGE_KEY);
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING — STEP 1: Location
// -------------------------------------------------------------
function initStep1() {
    const countryEl  = document.getElementById('ob-country');
    const provinceEl = document.getElementById('ob-province');
    const cantonEl   = document.getElementById('ob-canton');
    const nextBtn    = document.getElementById('ob-next-btn');
    const badge      = document.getElementById('ob-location-badge');
    const badgeText  = document.getElementById('ob-location-text');

    function updateNext() {
        const ok = countryEl.value && provinceEl.value && cantonEl.value;
        nextBtn.disabled = !ok;
        if (ok) {
            badge.style.display = 'flex';
            const cLabel = countryEl.options[countryEl.selectedIndex].text;
            badgeText.textContent = `${cantonEl.value}, ${provinceEl.value}, ${cLabel}`;
        } else {
            badge.style.display = 'none';
        }
    }

    countryEl.addEventListener('change', () => {
        const country = countryEl.value;
        const provinces = country ? Object.keys(LOCATION_DATA[country] || {}) : [];

        provinceEl.innerHTML = '<option value="">Select province...</option>';
        provinces.sort().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            provinceEl.appendChild(opt);
        });
        provinceEl.disabled = !provinces.length;

        cantonEl.innerHTML = '<option value="">Select province first...</option>';
        cantonEl.disabled = true;

        const provField = document.getElementById('ob-province-field');
        const canField  = document.getElementById('ob-canton-field');
        provField.classList.toggle('ob-field-disabled', !provinces.length);
        canField.classList.add('ob-field-disabled');
        updateNext();
    });

    provinceEl.addEventListener('change', () => {
        const country  = countryEl.value;
        const province = provinceEl.value;
        const cantons  = province ? (LOCATION_DATA[country]?.[province] || []) : [];

        cantonEl.innerHTML = '<option value="">Select canton...</option>';
        cantons.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            cantonEl.appendChild(opt);
        });
        cantonEl.disabled = !cantons.length;

        const canField = document.getElementById('ob-canton-field');
        canField.classList.toggle('ob-field-disabled', !cantons.length);
        updateNext();
    });

    cantonEl.addEventListener('change', updateNext);

    nextBtn.addEventListener('click', () => {
        if (nextBtn.disabled) return;
        // Store partial profile
        farmProfile = {
            country:  countryEl.value,
            country_label: countryEl.options[countryEl.selectedIndex].text,
            province: provinceEl.value,
            canton:   cantonEl.value,
        };
        goToStep2();
    });
}

function goToStep2() {
    document.getElementById('ob-step-1').style.display = 'none';
    document.getElementById('ob-step-2').style.display = 'block';
    document.getElementById('dot-1').classList.remove('active');
    document.getElementById('dot-2').classList.add('active');
    renderGrid();
    // Animate card in
    document.getElementById('ob-step-2').style.animation = 'none';
    requestAnimationFrame(() => {
        document.getElementById('ob-step-2').style.animation = 'ob-fade-up 0.35s ease both';
    });
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING — STEP 2: Farm Grid
// -------------------------------------------------------------
function getRows() { return parseInt(document.getElementById('ob-rows').value) || 2; }
function getCols() { return parseInt(document.getElementById('ob-cols').value) || 3; }

function clampInput(id, min, max) {
    const el = document.getElementById(id);
    const v = parseInt(el.value) || min;
    el.value = Math.min(max, Math.max(min, v));
}

function renderGrid() {
    const rows = getRows();
    const cols = getCols();
    const grid = document.getElementById('ob-farm-grid');
    grid.style.gridTemplateColumns = `repeat(${cols}, 72px)`;
    grid.innerHTML = '';

    // Rebuild gridState preserving existing assignments
    const newState = {};
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const id = cellId(r, c);
            newState[id] = gridState[id] || null;
        }
    }
    gridState = newState;

    Object.entries(gridState).forEach(([id, cropId]) => {
        const cell = document.createElement('div');
        cell.className = 'ob-parcel' + (cropId ? ' assigned' : '');
        cell.dataset.cell = id;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Parcel ${id}${cropId ? ': ' + cropById(cropId)?.label : ''}`);

        if (cropId && cropId !== 'empty') {
            const crop = cropById(cropId);
            cell.style.background = crop.bg;
            cell.style.border = `2px solid ${crop.bg}`;
            cell.innerHTML = `
                <span class="parcel-icon">${crop.icon}</span>
                <span class="parcel-id" style="color:${crop.text}">${id}</span>
                <span class="parcel-crop" style="color:${crop.text}">${crop.label}</span>
            `;
        } else {
            cell.innerHTML = `
                <span class="parcel-id">${id}</span>
                <i class="fa-solid fa-plus" style="color:rgba(255,255,255,0.2);font-size:0.85rem"></i>
            `;
        }

        cell.addEventListener('click', () => openCropModal(id));
        grid.appendChild(cell);
    });
}

function openCropModal(cellIdStr) {
    selectedCell = cellIdStr;
    document.getElementById('ob-crop-cell-label').textContent = cellIdStr;
    const modal = document.getElementById('ob-crop-modal');
    const opts  = document.getElementById('ob-crop-options');
    const current = gridState[cellIdStr];

    opts.innerHTML = '';
    CROPS.forEach(crop => {
        const btn = document.createElement('button');
        btn.className = 'ob-crop-option' + (crop.id === current ? ' selected' : '');
        btn.setAttribute('aria-label', crop.label);
        btn.innerHTML = `<span style="font-size:1.6rem">${crop.icon}</span>${crop.label}`;
        btn.addEventListener('click', () => {
            assignCrop(cellIdStr, crop.id === 'empty' ? null : crop.id);
            closeCropModal();
        });
        opts.appendChild(btn);
    });

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCropModal() {
    document.getElementById('ob-crop-modal').style.display = 'none';
    document.body.style.overflow = '';
    selectedCell = null;
}

function assignCrop(cellIdStr, cropId) {
    gridState[cellIdStr] = cropId;
    renderGrid();
}

function initStep2() {
    // Number inputs
    ['rows', 'cols'].forEach(dim => {
        document.getElementById(`${dim}-dec`).addEventListener('click', () => {
            const el = document.getElementById(`ob-${dim}`);
            el.value = Math.max(1, parseInt(el.value) - 1);
            renderGrid();
        });
        document.getElementById(`${dim}-inc`).addEventListener('click', () => {
            const el = document.getElementById(`ob-${dim}`);
            el.value = Math.min(10, parseInt(el.value) + 1);
            renderGrid();
        });
        document.getElementById(`ob-${dim}`).addEventListener('change', () => {
            clampInput(`ob-${dim}`, 1, 10);
            renderGrid();
        });
    });

    document.getElementById('ob-back-btn').addEventListener('click', () => {
        document.getElementById('ob-step-2').style.display = 'none';
        document.getElementById('ob-step-1').style.display = 'block';
        document.getElementById('dot-1').classList.add('active');
        document.getElementById('dot-2').classList.remove('active');
    });

    document.getElementById('ob-crop-modal-close').addEventListener('click', closeCropModal);
    document.getElementById('ob-crop-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeCropModal();
    });

    document.getElementById('ob-start-btn').addEventListener('click', finishOnboarding);
}

async function finishOnboarding() {
    const rows = getRows();
    const cols = getCols();

    // Build grid parcels
    const parcels = Object.entries(gridState)
        .filter(([, cropId]) => cropId !== null)
        .map(([id, cropId]) => ({
            id,
            crop:    cropId,
            area_ha: 1.0,
            status:  'Healthy',
        }));

    farmProfile = {
        ...farmProfile,
        rows,
        cols,
        grid: gridState,
        parcels,
        setup_date: new Date().toISOString(),
    };

    // Save locally
    saveProfile(farmProfile);

    // Show saving indicator
    const savingMsg = document.getElementById('ob-saving-msg');
    const startBtn  = document.getElementById('ob-start-btn');
    startBtn.disabled = true;
    savingMsg.style.display = 'flex';

    // Attempt to persist to backend via /run (fire-and-forget, non-blocking)
    try {
        await persistFarmToBackend(farmProfile);
    } catch (e) {
        console.warn('Backend persistence skipped (offline or not running):', e.message);
    }

    savingMsg.style.display = 'none';
    launchApp();
}

async function persistFarmToBackend(profile) {
    const gridJson = JSON.stringify({ rows: profile.rows, cols: profile.cols, parcels: profile.parcels });
    await fetch('/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  AbortSignal.timeout(6000),
        body: JSON.stringify({
            user_id:     userId,
            session_id:  sessionId,
            new_message: {
                parts: [{ text: `Save my farm grid: ${gridJson}. My location is ${profile.canton}, ${profile.province}, ${profile.country_label}.` }],
            },
        }),
    });
}

// ─────────────────────────────────────────────────────────────
// LAUNCH APP (hide onboarding, show main UI)
// -------------------------------------------------------------
function launchApp() {
    document.getElementById('onboarding-overlay').style.display = 'none';
    const app = document.getElementById('main-app');
    app.style.display = 'grid';
    app.style.animation = 'ob-fade-up 0.4s ease both';

    applyProfileToUI(farmProfile);
    loadLogs();
    renderDashboardGrid(farmProfile);
}

function applyProfileToUI(profile) {
    if (!profile) return;
    const loc = `${profile.canton}, ${profile.province}`;
    document.getElementById('sidebar-location-text').textContent = loc;
    document.getElementById('dash-farm-location').textContent = loc;

    // Pre-fill lat/lng from known coords (El Carmen defaults)
    // Could be extended with the full lookup table
    const knownCoords = { 'El Carmen': { lat: -0.2687, lng: -79.4326 } };
    const coords = knownCoords[profile.canton];
    if (coords) {
        document.getElementById('lat').value = coords.lat;
        document.getElementById('lng').value = coords.lng;
    }

    // Populate parcel selector in logs tab
    const parcelSel = document.getElementById('log-parcel');
    parcelSel.innerHTML = '<option value="">Select parcel...</option>';
    if (profile.parcels) {
        profile.parcels.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            const cropLabel = p.crop ? (cropById(p.crop)?.label || p.crop) : 'Empty';
            opt.textContent = `${p.id} — ${cropLabel}`;
            parcelSel.appendChild(opt);
        });
    }

    // Default log date to today
    document.getElementById('log-date').value = new Date().toISOString().split('T')[0];

    // Dashboard alert
    const unhealthy = (profile.parcels || []).filter(p => p.status && p.status !== 'Healthy');
    const alertEl = document.getElementById('dash-alert-desc');
    if (unhealthy.length) {
        alertEl.textContent = `${unhealthy.length} parcel(s) require attention: ${unhealthy.map(p => `${p.id} (${p.crop})`).join(', ')}.`;
    } else {
        alertEl.textContent = 'All parcels are healthy. Run an Advisory Fusion report for proactive recommendations.';
    }

    // Dashboard log count
    document.getElementById('dash-logs').textContent = `${(profile.parcels || []).length} Active`;
}

function renderDashboardGrid(profile) {
    const container = document.getElementById('dash-farm-grid');
    container.innerHTML = '';
    if (!profile?.parcels?.length) {
        container.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem">No parcels defined.</span>';
        return;
    }
    profile.parcels.forEach(p => {
        const crop = cropById(p.crop);
        const pill = document.createElement('div');
        pill.className = 'dash-parcel' + (crop ? '' : ' empty');
        if (crop && crop.bg) {
            pill.style.background = crop.bg;
            pill.style.color      = crop.text;
        }
        pill.textContent = `${p.id} ${crop ? crop.icon + ' ' + crop.label : '—'}`;
        container.appendChild(pill);
    });
}

// ─────────────────────────────────────────────────────────────
// INIT — check localStorage for existing profile
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const existing = loadProfile();
    if (existing && existing.canton) {
        farmProfile = existing;
        launchApp();
    } else {
        // Show onboarding
        initStep1();
        initStep2();
    }

    // Reset setup button
    document.getElementById('btn-reset-onboarding')?.addEventListener('click', () => {
        if (confirm('This will clear your farm setup and restart the onboarding. Continue?')) {
            resetProfile();
            location.reload();
        }
    });

    // Mobile sidebar toggle
    const menuBtn   = document.getElementById('mobile-menu-btn');
    const sidebar   = document.querySelector('.sidebar');
    const navOverlay = document.getElementById('mobile-nav-overlay');

    menuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        navOverlay.classList.toggle('show');
    });
    navOverlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        navOverlay.classList.remove('show');
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            switchTab(item.getAttribute('data-tab'));
            sidebar.classList.remove('open');
            navOverlay.classList.remove('show');
        });
    });

    // Image upload
    setupImageUpload();

    // Vision button
    document.getElementById('btn-analyze-vision')?.addEventListener('click', runVisionDiagnostic);

    // Weather & Market
    document.getElementById('btn-fetch-weather')?.addEventListener('click', fetchWeather);
    document.getElementById('btn-fetch-price')?.addEventListener('click', fetchPrice);

    // Logs
    document.getElementById('btn-write-log')?.addEventListener('click', writeLog);
    document.getElementById('btn-refresh-logs')?.addEventListener('click', loadLogs);

    // Advisory
    document.getElementById('btn-generate-advisory')?.addEventListener('click', generateAdvisory);
});

// ─────────────────────────────────────────────────────────────
// TAB SWITCHING
// -------------------------------------------------------------
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`)?.classList.add('active');

    const titles = {
        'dashboard':      { title: 'Workspace Dashboard',        sub: 'Real-time agricultural metrics & alerts' },
        'vision':         { title: 'Crop Vision Diagnostic',     sub: 'Multimodal analysis of leaves, soil, and crop conditions' },
        'weather-market': { title: 'Weather & Markets',          sub: 'Location weather modeling and commodity price feeds' },
        'logs':           { title: 'Crop Logs Tracker',          sub: 'Historical records and farm activity tracking' },
        'advisory':       { title: 'Advisory Fusion Studio',     sub: 'Generate 4-signal cross-intelligence reports' },
    };
    if (titles[tabId]) {
        document.getElementById('tab-title').textContent    = titles[tabId].title;
        document.getElementById('tab-subtitle').textContent = titles[tabId].sub;
    }
}

// ─────────────────────────────────────────────────────────────
// IMAGE UPLOAD
// -------------------------------------------------------------
let uploadedFileName = null;

function setupImageUpload() {
    const dropzone    = document.getElementById('dropzone');
    const imageUpload = document.getElementById('image-upload');
    if (!dropzone) return;

    dropzone.addEventListener('click', () => imageUpload.click());

    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = '#10b981'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    imageUpload.addEventListener('change', () => {
        if (imageUpload.files.length) handleFile(imageUpload.files[0]);
    });
}

async function handleFile(file) {
    if (!file.type.startsWith('image/')) { alert('Please upload an image file.'); return; }

    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById('image-preview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        dropzone?.querySelector('.upload-icon')?.style.setProperty('display','none');
        dropzone?.querySelector('p')?.style.setProperty('display','none');
    };
    reader.readAsDataURL(file);

    uploadedFileName = file.name;
    const btnAnalyze = document.getElementById('btn-analyze-vision');
    btnAnalyze.disabled = true;
    btnAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

    try {
        const b64Reader = new FileReader();
        b64Reader.onloadend = async () => {
            const base64Data = b64Reader.result.split(',')[1];
            const res = await fetch(`/apps/croppulse-ai/users/${userId}/sessions/${sessionId}/artifacts`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, artifact: { inline_data: { data: base64Data, mime_type: file.type } } }),
            });
            if (res.ok) {
                btnAnalyze.disabled = false;
                btnAnalyze.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run Diagnostic';
            } else { throw new Error('Upload failed.'); }
        };
        b64Reader.readAsDataURL(file);
    } catch (err) {
        console.error('Artifact upload:', err);
        btnAnalyze.disabled = false;
        btnAnalyze.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run Diagnostic';
    }
}

// ─────────────────────────────────────────────────────────────
// AGENT CALLS
// -------------------------------------------------------------
async function agentRun(messageText) {
    const res = await fetch('/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, session_id: sessionId, new_message: { parts: [{ text: messageText }] } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return extractFinalOutput(await res.json());
}

async function runVisionDiagnostic() {
    const mode      = document.getElementById('vision-mode').value;
    const resultDiv = document.getElementById('vision-result');
    const phDiv     = document.getElementById('vision-placeholder');
    phDiv.style.display    = 'none';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML     = spinner('Analyzing crop health...');
    try {
        const output = await agentRun(`Analyze my crop image using ${mode} mode.`);
        resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
    } catch (err) {
        resultDiv.innerHTML = errorHtml(err.message);
    }
}

async function fetchWeather() {
    const lat       = document.getElementById('lat').value;
    const lng       = document.getElementById('lng').value;
    const resultDiv = document.getElementById('wm-result');
    document.getElementById('wm-placeholder').style.display = 'none';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML     = spinner('Querying Open-Meteo...');
    try {
        const output = await agentRun(`Get weather forecast for latitude ${lat} and longitude ${lng}.`);
        resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
        // Update dashboard widget
        try {
            const parsed = JSON.parse(output);
            const temp = parsed?.current_weather?.temperature_celsius;
            if (temp != null) {
                document.getElementById('dash-weather').textContent = `${temp}°C`;
                document.getElementById('dash-weather-sub').textContent = parsed?.current_weather?.weather_condition || '';
            }
        } catch {}
    } catch (err) {
        resultDiv.innerHTML = errorHtml(err.message);
    }
}

async function fetchPrice() {
    const commodity = document.getElementById('crop-commodity').value;
    const resultDiv = document.getElementById('wm-result');
    document.getElementById('wm-placeholder').style.display = 'none';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML     = spinner('Fetching commodity ticker...');
    try {
        const output = await agentRun(`What is the crop market price for ${commodity}?`);
        resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
        try {
            const parsed = JSON.parse(output);
            if (parsed.current_price_usd) {
                document.getElementById('dash-price').textContent = `$${parsed.current_price_usd} / ${parsed.unit}`;
                document.getElementById('dash-price-sub').textContent =
                    `${parsed.trend_direction === 'up' ? '▲' : parsed.trend_direction === 'down' ? '▼' : '—'} ${parsed.daily_change_pct}% today`;
            }
        } catch {}
    } catch (err) {
        resultDiv.innerHTML = errorHtml(err.message);
    }
}

async function writeLog() {
    const parcel   = document.getElementById('log-parcel').value;
    const activity = document.getElementById('log-activity').value.trim();
    const status   = document.getElementById('log-status').value;
    const date     = document.getElementById('log-date').value;

    if (!parcel || !activity) { alert('Please fill in Parcel and Activity fields.'); return; }

    const btn = document.getElementById('btn-write-log');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
        await agentRun(`Log activity for parcel ${parcel}: ${activity}. Status: ${status}. Date: ${date}.`);
        document.getElementById('log-activity').value = '';
        loadLogs();
    } catch (err) {
        alert(`Failed to log: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-pen"></i> Submit Log Entry';
    }
}

async function generateAdvisory() {
    const resultDiv = document.getElementById('advisory-result');
    resultDiv.innerHTML = spinner('Fusing 4 signals: weather, market prices, vision inspection, and farm history...');
    try {
        const output = await agentRun('Generate a crop advisory recommendation fusion report.');
        resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
    } catch (err) {
        resultDiv.innerHTML = errorHtml(err.message);
    }
}

async function loadLogs() {
    const container = document.getElementById('logs-container');
    if (!container) return;
    container.innerHTML = spinner('Loading activity logs...');

    try {
        const output = await agentRun('Read the crop activity plan and indicators.');
        let logs = [];
        try { logs = JSON.parse(output); } catch {}
        if (!Array.isArray(logs) || !logs.length) {
            // Show profile-based plan if available
            if (farmProfile?.parcels?.length) {
                logs = farmProfile.parcels.map(p => ({
                    date:     new Date().toISOString().split('T')[0],
                    parcel:   p.id,
                    activity: `Initial parcel setup — ${cropById(p.crop)?.label || p.crop}`,
                    status:   'Pending',
                }));
            } else {
                container.innerHTML = '<div style="color:var(--text-secondary);text-align:center;padding:2rem">No activity logs found.</div>';
                return;
            }
        }
        container.innerHTML = '';
        [...logs].reverse().forEach(log => {
            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `
                <div class="log-meta">
                    <span class="log-tag">${log.parcel || 'Farm'}</span>
                    <span>${log.date || 'Today'}</span>
                </div>
                <div class="log-title">${log.activity || log.action || 'Activity'}</div>
                <div class="log-notes">${log.status || 'Pending'}</div>
            `;
            container.appendChild(item);
        });
        document.getElementById('dash-logs').textContent = `${logs.length} Active`;
    } catch (err) {
        container.innerHTML = `<div style="color:#ef4444;padding:1rem">Failed to load logs: ${err.message}</div>`;
    }
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// -------------------------------------------------------------
function extractFinalOutput(events) {
    if (!events?.length) return 'No response from agent.';
    for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.content?.parts) {
            const text = ev.content.parts.filter(p => p.text).map(p => p.text).join('\n');
            if (text) return text;
        }
        if (ev.output) return typeof ev.output === 'object' ? JSON.stringify(ev.output, null, 2) : String(ev.output);
    }
    return 'No text response found.';
}

function formatMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/^### (.*$)/gim, '<h4 style="margin:1rem 0 0.5rem;color:#10b981">$1</h4>')
        .replace(/^## (.*$)/gim,  '<h3 style="margin:1.4rem 0 0.6rem;color:#f0f4f8;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:0.25rem">$1</h3>')
        .replace(/^# (.*$)/gim,   '<h2 style="margin:1.75rem 0 0.9rem;color:#fff">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff;font-weight:600">$1</strong>')
        .replace(/^\s*[\*\-]\s+(.*$)/gim, '<li style="margin-left:1.25rem;margin-bottom:0.4rem;color:#8aa0b8">$1</li>')
        .replace(/\n/g, '<br>');
}

function spinner(msg = 'Loading...') {
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:1rem;padding:2.5rem;color:var(--text-secondary)">
        <i class="fa-solid fa-spinner fa-spin fa-2x" style="color:#10b981"></i>
        <p style="font-size:0.92rem">${msg}</p>
    </div>`;
}

function errorHtml(msg) {
    return `<div style="color:#ef4444;padding:1rem;display:flex;gap:0.6rem;align-items:center">
        <i class="fa-solid fa-circle-exclamation"></i> ${msg}
    </div>`;
}
