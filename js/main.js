import * as THREE from 'three';

// ===================================================================
// ===== AYARLAR (config.js) =====
// ===================================================================

const CELL = 0.25;         // xana ölçüsü (kiçildikcə təmizlik daha hamar görünür)
const SURFACE_SIZE = 402;   // 6-ya bölünməlidir (parça ölçüsü) və CELL-ə uyğun olmalıdır
const CHUNK_SIZE = 6;

const CONFIG = {
  VERSION: 'v0.9.10',

  CELL,
  SURFACE_SIZE,

  GRID: Math.round(SURFACE_SIZE / CELL),
  CHUNK_SIZE,

  CHUNK_CELLS: Math.round(CHUNK_SIZE / CELL),
  CHUNKS_PER_SIDE: Math.round(SURFACE_SIZE / CHUNK_SIZE),

  CHUNK_REWARD: 40,
  CHUNK_DONE_RATIO: 0.97,

  FAR_SIZE: 2000,
  LAYER_WINDOW: 60,

  DUST_HEIGHT: 0.12,
  DUST_COLOR: 0xa8a8a8,

  WALL_COLORS: [
    0x666666,
    0x585858,
    0x4a4a4a
  ],

  PLAYER_SPEED: 6,
  JOYSTICK_RADIUS: 50,
  BAG_CAPACITY: 1.0,

  CAMERA_HEIGHT: 1.8,
  PITCH_LIMIT: 1.5,

  TOUCH_SENSITIVITY: 0.005,
  MOUSE_SENSITIVITY: 0.0025,

  REACH: 5,

  KG_PER_SQUARE_UNIT: 0.02,
  SELL_PRICE_PER_KG: 10,

  // Baza
  BASE_X: SURFACE_SIZE / 2,
  BASE_Z: SURFACE_SIZE / 2,

  BASE_WIDTH: 18,
  BASE_DEPTH: 12,

  PAD_HALF: 2.2,
  BASE_CLEAR_MARGIN: 1.5,

  // Bazanın tikilisi: divar hündürlüyü, qalınlığı və qapının eni (cənub tərəfdə)
  WALL_HEIGHT: 4,
  WALL_THICKNESS: 0.5,
  DOOR_WIDTH: 5,

  // Süpürgələr
  BRUSH_TOOLS: [
    { name: 'Diş fırçası', size: 0.4, price: 0 },
    { name: 'Kiçik fırça', size: 0.6, price: 30 },
    { name: 'Süpürgə', size: 0.9, price: 120 },
    { name: 'Geniş süpürgə', size: 1.3, price: 400 },
    { name: 'Təmizləyici', size: 1.8, price: 1200 },
  ],

  // Çanta
  BAG_LEVELS: [
    { capacity: 1, price: 0 },
    { capacity: 2, price: 25 },
    { capacity: 4, price: 90 },
    { capacity: 8, price: 300 },
    { capacity: 16, price: 900 },
  ],

  // Robot modelləri (1-ci səviyyə hamıda var, pulsuzdur)
  // size: təmizlədiyi zolağın eni (metr), speed: sürəti (metr/saniyə)
  ROBOT_LEVELS: [
    { name: 'Robot süpürgə', size: 1.0, speed: 2.5, price: 0 },
    { name: 'Sürətli robot', size: 1.4, speed: 3.5, price: 900 },
    { name: 'Super robot', size: 2.0, speed: 5, price: 3000 },
  ],

  // Robot sayı: siyahının uzunluğu = ən çox robot sayı, hər ədəd növbəti robotun qiymətidir
  ROBOT_COUNT_PRICES: [400, 1000, 2500, 6000, 12000],
};

// Bütün hissələrin ortaq istifadə etdiyi ölçülər
const GRID = CONFIG.GRID;
const SIZE = CONFIG.SURFACE_SIZE;
const HEIGHT = CONFIG.DUST_HEIGHT;
const CHUNK_CELLS = CONFIG.CHUNK_CELLS;
const CHUNKS = CONFIG.CHUNKS_PER_SIDE;
const CHUNK_AREA = CHUNK_CELLS * CHUNK_CELLS;
const NEEDED_CELLS = CHUNK_AREA * CONFIG.CHUNK_DONE_RATIO; // parçanın "bitdi" sayılması üçün lazım olan xana sayı
const KG_PER_CELL = CONFIG.KG_PER_SQUARE_UNIT * CELL * CELL;
const MONEY_PER_CELL = KG_PER_CELL * CONFIG.SELL_PRICE_PER_KG;
// Toz teksturasının ölçüsünü azaldırıq.
// Oyun məntiqinin dəqiqliyi dəyişmir.
const DUST_TEXTURE_SCALE = 0.5;
const DUST_TEXTURE_SIZE = Math.max(1, Math.round(GRID * DUST_TEXTURE_SCALE));
// ===================================================================
// ===== OYUN VƏZİYYƏTİ (state.js) =====
// ===================================================================

const GameState = {
  playerId: 'local',   // hələlik tək oyunçu; multiplayer-də hər oyunçunun öz ID-si olacaq
  money: 0,
  bag: 0,
  bagCapacity: CONFIG.BAG_LEVELS[0].capacity,
  totalDustCollected: 0,
  upgrades: {
    brushLevel: 1,
    bagLevel: 1,
    robotLevel: 1,   // robot modeli (1 = ən sadə)
    robotCount: 0,   // neçə robot alınıb (0 = heç biri)
  },
};

// Pulu 0.1 dəqiqliyə yuvarlaqlaşdırır
function roundMoney(value) {
  return Math.round(value * 10) / 10;
}

// Ədəd deyilsə ehtiyat dəyəri qaytarır (xarab yaddaşdan qorunmaq üçün)
function toNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// Saxlamaq üçün oyun vəziyyətinin surəti
function exportState() {
  return {
    playerId: GameState.playerId,
    money: GameState.money,
    bag: GameState.bag,
    totalDustCollected: GameState.totalDustCollected,
    upgrades: {
      brushLevel: GameState.upgrades.brushLevel,
      bagLevel: GameState.upgrades.bagLevel,
      robotLevel: GameState.upgrades.robotLevel,
      robotCount: GameState.upgrades.robotCount,
    },
  };
}

// Yaddaşdan oxunan məlumatı yoxlayıb oyun vəziyyətinə yazır
function importState(data) {
  GameState.money = Math.max(0, toNumber(data.money, 0));
  GameState.bag = Math.max(0, toNumber(data.bag, 0));
  GameState.totalDustCollected = Math.max(0, toNumber(data.totalDustCollected, 0));
  if (data.upgrades) {
    const saved = data.upgrades;
    GameState.upgrades.brushLevel = toNumber(saved.brushLevel, 1);
    GameState.upgrades.bagLevel = toNumber(saved.bagLevel, 1);

    // Köhnə yaddaşda robot sayı yox idi: robot səviyyəsi 1 və ya çox idisə, 1 robot sayırıq
    const savedRobotLevel = toNumber(saved.robotLevel, 0);
    if (saved.robotCount === undefined) {
      GameState.upgrades.robotCount = savedRobotLevel > 0 ? 1 : 0;
    } else {
      GameState.upgrades.robotCount = toNumber(saved.robotCount, 0);
    }
    GameState.upgrades.robotLevel = Math.max(1, savedRobotLevel);
  }
}

// Çantanın tutumunu dəyişir (çanta tutumdan çox doludursa, artığı kəsir)
function setBagCapacity(capacity) {
  GameState.bagCapacity = capacity;
  if (GameState.bag > capacity) {
    GameState.bag = capacity;
  }
}

// Çanta doludurmu
function isBagFull() {
  return GameState.bagCapacity - GameState.bag < 0.0001;
}

// Tozu çantaya əlavə edir, həqiqətən əlavə olunan miqdarı qaytarır
function collectDust(amount) {
  if (amount <= 0) { return 0; }
  const freeSpace = GameState.bagCapacity - GameState.bag;
  const added = Math.min(freeSpace, amount);
  GameState.bag += added;
  GameState.totalDustCollected += added;
  return added;
}

// Çantadakı bütün tozu satır
function sellDust(pricePerKg) {
  const sold = GameState.bag;
  const earned = roundMoney(sold * pricePerKg);
  GameState.bag = 0;
  earnMoney(earned);
  return { earned, sold };
}

// Pul qazandırır
function earnMoney(amount) {
  if (amount <= 0) { return; }
  GameState.money = roundMoney(GameState.money + amount);
}

// Pul xərcləyir; kifayət etmirsə false qaytarır
function spendMoney(amount) {
  if (amount > GameState.money) { return false; }
  GameState.money = roundMoney(GameState.money - amount);
  return true;
}

// ===================================================================
// ===== YENİLƏMƏLƏR (upgrades.js) =====
// ===================================================================

// Ədədi min və max arasında saxlayır
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Səviyyələr dəyişəndən və ya yüklənəndən sonra çağırılır
function applyUpgrades() {
  const upgrades = GameState.upgrades;
  upgrades.brushLevel = clamp(Math.round(upgrades.brushLevel), 1, CONFIG.BRUSH_TOOLS.length);
  upgrades.bagLevel = clamp(Math.round(upgrades.bagLevel), 1, CONFIG.BAG_LEVELS.length);
  upgrades.robotLevel = clamp(Math.round(upgrades.robotLevel), 1, CONFIG.ROBOT_LEVELS.length);
  upgrades.robotCount = clamp(Math.round(upgrades.robotCount), 0, CONFIG.ROBOT_COUNT_PRICES.length);
  setBagCapacity(CONFIG.BAG_LEVELS[upgrades.bagLevel - 1].capacity);
}

// Hazırkı alət
function getBrushTool() {
  return CONFIG.BRUSH_TOOLS[GameState.upgrades.brushLevel - 1];
}

// Hazırkı fırçanın ağzının ölçüsü
function getBrushSize() {
  return getBrushTool().size;
}

// Növbəti alət (yoxdursa null)
function getNextBrushTool() {
  return CONFIG.BRUSH_TOOLS[GameState.upgrades.brushLevel] || null;
}

// Növbəti çanta səviyyəsi (yoxdursa null)
function getNextBagLevel() {
  return CONFIG.BAG_LEVELS[GameState.upgrades.bagLevel] || null;
}

// Hazırkı robot modeli (bütün robotlar eyni modeldə işləyir)
function getRobotTool() {
  return CONFIG.ROBOT_LEVELS[GameState.upgrades.robotLevel - 1];
}

// Növbəti robot modeli (yoxdursa null)
function getNextRobotTool() {
  return CONFIG.ROBOT_LEVELS[GameState.upgrades.robotLevel] || null;
}

// Növbəti robotun qiyməti (daha robot almaq olmursa null)
function getNextRobotCountPrice() {
  const price = CONFIG.ROBOT_COUNT_PRICES[GameState.upgrades.robotCount];
  if (price === undefined) { return null; }
  return price;
}

// Növbəti aləti alır
function buyBrushUpgrade() {
  const next = getNextBrushTool();
  if (next === null) { return { ok: false, message: 'Ən güclü alətdir' }; }
  if (!spendMoney(next.price)) { return { ok: false, message: 'Pul çatmır' }; }
  GameState.upgrades.brushLevel += 1;
  applyUpgrades();
  return { ok: true, message: next.name + ' alındı!' };
}

// Növbəti çantanı alır
function buyBagUpgrade() {
  const next = getNextBagLevel();
  if (next === null) { return { ok: false, message: 'Ən böyük çantadır' }; }
  if (!spendMoney(next.price)) { return { ok: false, message: 'Pul çatmır' }; }
  GameState.upgrades.bagLevel += 1;
  applyUpgrades();
  return { ok: true, message: 'Çanta ' + next.capacity + ' kq oldu!' };
}

// Növbəti robot modelini alır (bütün robotlar yeni modelə keçir)
function buyRobotModelUpgrade() {
  const next = getNextRobotTool();
  if (next === null) { return { ok: false, message: 'Ən güclü robot modelidir' }; }
  if (!spendMoney(next.price)) { return { ok: false, message: 'Pul çatmır' }; }
  GameState.upgrades.robotLevel += 1;
  applyUpgrades();
  return { ok: true, message: next.name + ' alındı! 🤖' };
}

// Yeni robot alır
function buyRobotCountUpgrade() {
  const price = getNextRobotCountPrice();
  if (price === null) { return { ok: false, message: 'Ən çox robot sayına çatdın' }; }
  if (!spendMoney(price)) { return { ok: false, message: 'Pul çatmır' }; }
  GameState.upgrades.robotCount += 1;
  applyUpgrades();
  return { ok: true, message: 'Yeni robot alındı! 🤖 (' + GameState.upgrades.robotCount + ')' };
}

// ===================================================================
// ===== EKRAN YAZILARI (ui.js) =====
// ===================================================================

let toastTimer = null;
const elements = {};   // tapılmış HTML elementləri
const lastTexts = {};  // son yazılmış mətnlər (boş yerə yeniləməmək üçün)

// HTML elementini tapır və yadda saxlayır
function getElement(id) {
  if (!elements[id]) {
    elements[id] = document.getElementById(id);
  }
  return elements[id];
}

// Mətn dəyişibsə yazır
function setTextIfChanged(id, text) {
  if (lastTexts[id] === text) { return; }
  const element = getElement(id);
  if (element) {
    element.textContent = text;
    lastTexts[id] = text;
  }
}

// Ekranın yuxarısında qısa mesaj göstərir
function showToast(text) {
  const toast = getElement('toast');
  toast.textContent = text;
  toast.classList.add('show');
  if (toastTimer !== null) { clearTimeout(toastTimer); }
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, 1800);
}

// Pul və çanta yazısı (çantanın real tutumu göstərilir)
function updateHUD() {
  setTextIfChanged('hud-money', '💰 ' + Math.floor(GameState.money));
  setTextIfChanged(
    'hud-bag',
    '🎒 ' + GameState.bag.toFixed(2) + '/' + GameState.bagCapacity.toFixed(2) + ' kq'
  );
}

// Parça faizi və bazaya məsafə yazıları
function updateInfoLabels(chunkPercent, baseMeters) {
  setTextIfChanged('chunk-info', 'Parça: ' + chunkPercent + '%');
  setTextIfChanged('base-info', 'Baza: ' + baseMeters + ' m');
}

// ===================================================================
// ===== YADDAŞ (save.js) =====
// ===================================================================

const OLD_SAVE_KEY = 'ay_temizleme_save_v1';

// Hər oyunçunun yaddaşı öz ID-sinə bağlıdır
function getSaveKey(playerId) {
  return 'ay_temizleme_save_v1:' + playerId;
}

// Oyunu yaddaşa yazır
function saveGame() {
  try {
    const data = exportState();
    data.savedAt = Date.now();
    localStorage.setItem(getSaveKey(GameState.playerId), JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Saxlama xətası:', e);
    return false;
  }
}

// Oyunu yaddaşdan yükləyir
function loadGame() {
  try {
    let raw = localStorage.getItem(getSaveKey(GameState.playerId));
    if (!raw) {
      // Köhnə versiyadakı yaddaşı tapıb köçürürük
      raw = localStorage.getItem(OLD_SAVE_KEY);
    }
    if (!raw) { return false; }
    importState(JSON.parse(raw));
    return true;
  } catch (e) {
    console.warn('Yükləmə xətası:', e);
    return false;
  }
}

// Avtomatik saxlama: hər 10 saniyədən bir, həmçinin səhifə gizlənəndə və ya bağlananda
function startAutoSave() {
  setInterval(saveGame, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { saveGame(); }
  });
  window.addEventListener('pagehide', saveGame);
}

// ===================================================================
// ===== PARÇALAR (chunks.js) =====
// ===================================================================

// Dünya təkrarlandığı üçün xana nömrəsini 0..GRID-1 aralığına gətirir
function wrapIndex(value) {
  return ((value % GRID) + GRID) % GRID;
}

// İki nöqtə arasındakı fərqi dünyanın təkrarlanmasını nəzərə alaraq ən qısa yolla verir
// (nəticə həmişə -SURFACE_SIZE/2 ilə +SURFACE_SIZE/2 arasında olur)
function wrapDelta(value) {
  return value - Math.round(value / SIZE) * SIZE;
}

// (i, j) xanasının hansı parçaya aid olduğunu verir
function chunkIndexOf(i, j) {
  return Math.floor(j / CHUNK_CELLS) * CHUNKS + Math.floor(i / CHUNK_CELLS);
}

// Bazanın altında və ətrafında toz olmasın: həmin yeri əvvəlcədən təmiz sayır (pul vermir).
// Təmiz sahə parça sərhədlərinə qədər genişləndirilir ki, bazanın kənarında yarımçıq parça qalmasın.
function clearBaseFootprint(dustSystem) {
  const halfWidth = CONFIG.BASE_WIDTH / 2 + CONFIG.BASE_CLEAR_MARGIN;
  const halfDepth = CONFIG.BASE_DEPTH / 2 + CONFIG.BASE_CLEAR_MARGIN;
  let minI = Math.max(0, Math.floor((CONFIG.BASE_X - halfWidth) / CELL));
  let maxI = Math.min(GRID - 1, Math.floor((CONFIG.BASE_X + halfWidth) / CELL));
  let minJ = Math.max(0, Math.floor((CONFIG.BASE_Z - halfDepth) / CELL));
  let maxJ = Math.min(GRID - 1, Math.floor((CONFIG.BASE_Z + halfDepth) / CELL));

  // Parça sərhədlərinə qədər genişləndiririk
  minI = Math.floor(minI / CHUNK_CELLS) * CHUNK_CELLS;
  minJ = Math.floor(minJ / CHUNK_CELLS) * CHUNK_CELLS;
  maxI = Math.min(GRID - 1, Math.ceil((maxI + 1) / CHUNK_CELLS) * CHUNK_CELLS - 1);
  maxJ = Math.min(GRID - 1, Math.ceil((maxJ + 1) / CHUNK_CELLS) * CHUNK_CELLS - 1);

  for (let j = minJ; j <= maxJ; j++) {
    for (let i = minI; i <= maxI; i++) {
      const index = j * GRID + i;
      if (dustSystem.cleaned[index] === 0) {
        dustSystem.cleaned[index] = 1;
        dustSystem.cleanedCount += 1;
        dustSystem.chunkCleaned[chunkIndexOf(i, j)] += 1;
      }
    }
  }
  dustSystem.ctx.clearRect(
  Math.floor(minI * DUST_TEXTURE_SCALE),
  Math.floor(minJ * DUST_TEXTURE_SCALE),
  Math.ceil((maxI - minI + 1) * DUST_TEXTURE_SCALE),
  Math.ceil((maxJ - minJ + 1) * DUST_TEXTURE_SCALE)
);

  // Tam bazanın altında qalan parçalar mükafatsız "bitmiş" sayılır
  for (let chunkIndex = 0; chunkIndex < dustSystem.chunkCleaned.length; chunkIndex++) {
    if (dustSystem.chunkCleaned[chunkIndex] >= NEEDED_CELLS) {
      dustSystem.chunkDone[chunkIndex] = 1;
    }
  }
  dustSystem.dirty = true;
  dustSystem.version += 1;
}

// Parçanı tamamlayır: qalan tozu silir və pul verir
function completeChunk(dustSystem, chunkX, chunkY) {
  const chunkIndex = chunkY * CHUNKS + chunkX;
  dustSystem.chunkDone[chunkIndex] = 1;

  const startI = chunkX * CHUNK_CELLS;
  const startJ = chunkY * CHUNK_CELLS;
  for (let j = startJ; j < startJ + CHUNK_CELLS; j++) {
    for (let i = startI; i < startI + CHUNK_CELLS; i++) {
      const index = j * GRID + i;
      if (dustSystem.cleaned[index] === 0) {
        dustSystem.cleaned[index] = 1;
        dustSystem.cleanedCount += 1;
      }
    }
  }
  dustSystem.chunkCleaned[chunkIndex] = CHUNK_AREA;

  dustSystem.ctx.clearRect(
  Math.floor(startI * DUST_TEXTURE_SCALE),
  Math.floor(startJ * DUST_TEXTURE_SCALE),
  Math.ceil(CHUNK_CELLS * DUST_TEXTURE_SCALE),
  Math.ceil(CHUNK_CELLS * DUST_TEXTURE_SCALE)
);
  dustSystem.dirty = true;
  dustSystem.version += 1;

  earnMoney(CONFIG.CHUNK_REWARD);
  dustSystem.rewardPending += CONFIG.CHUNK_REWARD;
}

// Təmizlənmiş xananı parçaya yazır, parça bitibsə mükafat verir
function addCleanedCell(dustSystem, i, j) {
  const chunkIndex = chunkIndexOf(i, j);
  dustSystem.chunkCleaned[chunkIndex] += 1;
  if (dustSystem.chunkDone[chunkIndex] === 0 && dustSystem.chunkCleaned[chunkIndex] >= NEEDED_CELLS) {
    completeChunk(dustSystem, Math.floor(i / CHUNK_CELLS), Math.floor(j / CHUNK_CELLS));
  }
}

// Hazırkı parçanın tamamlanma faizi (0-100)
function getChunkProgress(dustSystem, x, z) {
  const i = wrapIndex(Math.floor(x / CELL));
  const j = wrapIndex(Math.floor(z / CELL));
  const share = dustSystem.chunkCleaned[chunkIndexOf(i, j)] / CHUNK_AREA;
  return Math.min(100, Math.floor((share / CONFIG.CHUNK_DONE_RATIO) * 100));
}

// ===================================================================
// ===== SÜPÜRMƏ ZOLAĞI (sweep.js) =====
// ===================================================================

// Ədədi 0..1 aralığına gətirir (dünya təkrarlandığı üçün lazımdır)
function mod1(value) {
  return ((value % 1) + 1) % 1;
}

// ===================================================================
// ===== TOZUN TƏMİZLƏNMƏSİ (cleaning.js) =====
// ===================================================================

// Görüntüdən tozu fırçanın tam yerinə görə silir: xananın yarısını da silmək olur
// (kənar xananın içində istənilən yerdə dayana bilir, hamar kənarla).
// Dünya təkrarlandığı üçün kənara yaxın olanda qarşı tərəfdə də çəkilir.
function eraseShape(dustSystem, x, z, size, round) {
  const ctx = dustSystem.ctx;
  const textureScale = DUST_TEXTURE_SCALE;
  const textureGrid = DUST_TEXTURE_SIZE;

  const px = ((((x / CELL) % GRID) + GRID) % GRID) * textureScale;
  const py = ((((z / CELL) % GRID) + GRID) % GRID) * textureScale;
  const r = (size / 2 / CELL) * textureScale;

  // Bütün silmə formalarını bir path daxilində birləşdiririk.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();

  for (let oy = -1; oy <= 1; oy++) {
    const cy = py + oy * textureGrid;

    if (cy < -r || cy > textureGrid + r) {
      continue;
    }

    for (let ox = -1; ox <= 1; ox++) {
      const cx = px + ox * textureGrid;

      if (cx < -r || cx > textureGrid + r) {
        continue;
      }

      if (round) {
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      } else {
        ctx.rect(cx - r, cy - r, r * 2, r * 2);
      }
    }
  }

  ctx.fill();
  ctx.restore();

  dustSystem.dirty = true;
}

// Bir xananı təmizlənmiş sayır və parçanı yoxlayır.
// Xana yeni təmizlənibsə true, əvvəldən təmiz idisə false qaytarır.
// Tozu çantaya yazmaq bu funksiyanın işi deyil (çünki robot çantadan istifadə etmir).
function cleanCell(dustSystem, worldI, worldJ) {
  const i = wrapIndex(worldI);
  const j = wrapIndex(worldJ);
  const index = j * GRID + i;
  if (dustSystem.cleaned[index] === 1) { return false; }

  dustSystem.cleaned[index] = 1;
  dustSystem.cleanedCount += 1;
  dustSystem.version += 1;

  // Görünən tozu burada silmirik: onu hamar fırça izi (dairə / düzbucaq) silir
  dustSystem.dirty = true;

  addCleanedCell(dustSystem, i, j);
  return true;
}

// (x, z) nöqtəsi ətrafında size ölçülü kvadratı təmizləyir.
// Neçə yeni xana təmizləndiyini qaytarır (oyunçu və robot bunu istifadə edir).
function cleanSquare(dustSystem, x, z, size) {
  const half = size / 2;
  const minI = Math.floor((x - half) / CELL);
  const maxI = Math.floor((x + half) / CELL);
  const minJ = Math.floor((z - half) / CELL);
  const maxJ = Math.floor((z + half) / CELL);
  let newCells = 0;
  for (let j = minJ; j <= maxJ; j++) {
    for (let i = minI; i <= maxI; i++) {
      const centerX = (i + 0.5) * CELL;
      const centerZ = (j + 0.5) * CELL;
      if (Math.abs(centerX - x) <= half && Math.abs(centerZ - z) <= half) {
        if (cleanCell(dustSystem, i, j)) {
          newCells += 1;
        }
      }
    }
  }
  eraseShape(dustSystem, x, z, size, false);
  return newCells;
}

// Hər kadrda: marker göstərilir, düymə basılıbsa fırça əvvəlki yerdən indiki yerə süpürür
function updateDustSystem(dustSystem, hitPoint, isBrushing) {
  dustSystem.marker.visible = hitPoint !== null;
  if (hitPoint === null) {
    dustSystem.lastHit = null;
    return;
  }

  const size = getBrushSize();
  dustSystem.marker.scale.set(size, size, 1);
  dustSystem.marker.position.set(hitPoint.x, HEIGHT + 0.01, hitPoint.z);

  if (!isBrushing) {
    dustSystem.lastHit = null;
    return;
  }

  const from = dustSystem.lastHit;
  dustSystem.lastHit = { x: hitPoint.x, z: hitPoint.z };
  if (isBagFull()) { return; }

  // Başlanğıc nöqtə: əvvəlki kadrdakı yer (yaxındırsa), yoxsa elə indiki yer
  // Aralıq böyükdürsə (kamera sürətlə fırlananda və ya kadr atlananda) düz xətt çəkmirik:
  // fırça orada olmayıb, ona görə yalnız indiki yerə basırıq
  let startX = hitPoint.x;
  let startZ = hitPoint.z;
  let steps = 1;
  if (from !== null) {
    const distance = Math.hypot(hitPoint.x - from.x, hitPoint.z - from.z);
    const maxGap = Math.min(3, Math.max(1, size * 2));
    if (distance < maxGap) {
      startX = from.x;
      startZ = from.z;
      steps = Math.max(1, Math.ceil(distance / (size / 5)));
    }
  }

  // Zolağı addım-addım təmizləyirik; çanta dolan kimi dayanırıq
  for (let step = 1; step <= steps; step++) {
    if (isBagFull()) { break; }
    const t = step / steps;
    const stepX = startX + (hitPoint.x - startX) * t;
    const stepZ = startZ + (hitPoint.z - startZ) * t;
    const newCells = cleanSquare(dustSystem, stepX, stepZ, size);
    if (newCells > 0) {
      collectDust(newCells * KG_PER_CELL);
    }
  }
}

// ===================================================================
// ===== TOZ SİSTEMİ (dust.js) =====
// ===================================================================

// Teksturanın yerini oyunçunun ətrafına görə təyin edir
function placeTexture(texture, planeSize, centerX, centerZ) {
  texture.repeat.set(
    planeSize / SIZE,
    planeSize / SIZE
  );

  texture.offset.set(
    mod1((centerX - planeSize / 2) / SIZE),
    mod1(1 - (centerZ + planeSize / 2) / SIZE)
  );
}

// Teksturanın ayarlarını optimallaşdırır
function optimizeTexture(texture) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  texture.generateMipmaps = false;

  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  texture.colorSpace = THREE.SRGBColorSpace;
}

// Toz sistemini yaradır: canvas, toz müstəvisi, yan qatlar və təmizləmə göstəricisi
function createDustSystem(scene) {

  // Canvas yaradılır
  const canvas = document.createElement('canvas');

canvas.width = DUST_TEXTURE_SIZE;
canvas.height = DUST_TEXTURE_SIZE;

  const ctx = canvas.getContext('2d', {
    alpha: true
  });

  // Başlanğıc toz
  ctx.fillStyle = '#ffffff';

  ctx.fillRect(0, 0, DUST_TEXTURE_SIZE, DUST_TEXTURE_SIZE);

  // Parça sərhədləri
  ctx.fillStyle = '#d4d4d4';

for (let k = 0; k < CHUNKS; k++) {

  const edge = Math.round(k * CHUNK_CELLS * DUST_TEXTURE_SCALE);
  const lineWidth = Math.max(1, Math.round(2 * DUST_TEXTURE_SCALE));

  ctx.fillRect(edge - lineWidth / 2, 0, lineWidth, DUST_TEXTURE_SIZE);

  ctx.fillRect(0, edge - lineWidth / 2, DUST_TEXTURE_SIZE, lineWidth);
}

ctx.fillRect(DUST_TEXTURE_SIZE - 1, 0, 1, DUST_TEXTURE_SIZE);

ctx.fillRect(0, DUST_TEXTURE_SIZE - 1, DUST_TEXTURE_SIZE, 1);

  // Əsas tekstura
  const texTop = new THREE.CanvasTexture(canvas);

  optimizeTexture(texTop);

  // İkinci tekstura
  const texWin = texTop.clone();

  optimizeTexture(texWin);

  // Əsas toz müstəvisi
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(
      CONFIG.FAR_SIZE,
      CONFIG.FAR_SIZE
    ),

    new THREE.MeshStandardMaterial({
      color: CONFIG.DUST_COLOR,
      map: texTop,
      alphaTest: 0.5,
      roughness: 1.0
    })
  );

  top.rotation.x = -Math.PI / 2;
  top.frustumCulled = false;
  top.renderOrder = 0;

  scene.add(top);

  // Yan qatlar
  const walls = [];

  const wallCount = CONFIG.WALL_COLORS.length;

  for (let index = 0; index < wallCount; index++) {

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(
        CONFIG.LAYER_WINDOW,
        CONFIG.LAYER_WINDOW
      ),

      new THREE.MeshBasicMaterial({
        color: CONFIG.WALL_COLORS[index],
        map: texWin,
        alphaTest: 0.5
      })
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.frustumCulled = false;
    mesh.renderOrder = index + 1;

    scene.add(mesh);

    walls.push({
      mesh,
      height:
        (HEIGHT * (wallCount - index)) /
        (wallCount + 1)
    });
  }

  // Təmizləmə göstəricisi
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),

    new THREE.MeshBasicMaterial({
      color: 0x66ffcc,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    })
  );

  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;

  scene.add(marker);

  // Toz sistemi
  const dustSystem = {

    cleaned: new Uint8Array(GRID * GRID),

    cleanedCount: 0,

    version: 0,

    chunkCleaned: new Uint16Array(
      CHUNKS * CHUNKS
    ),

    chunkDone: new Uint8Array(
      CHUNKS * CHUNKS
    ),

    rewardPending: 0,

    ctx,
    canvas,

    texTop,
    texWin,

    top,
    walls,
    marker,

    lastHit: null,

    dirty: false,

    lastUpload: 0,

    uploadInterval: 200
  };

  // Bazanın altını təmizlə
  clearBaseFootprint(dustSystem);

  return dustSystem;
}

// Toz pəncərəsinin yenilənməsi
function updateDustWindow(dustSystem, playerPos, nowMs) {

  // Əsas müstəvi
  dustSystem.top.position.set(
    playerPos.x,
    HEIGHT,
    playerPos.z
  );

  placeTexture(
    dustSystem.texTop,
    CONFIG.FAR_SIZE,
    playerPos.x,
    playerPos.z
  );

  // Yan müstəvilər
  for (const wall of dustSystem.walls) {

    wall.mesh.position.set(
      playerPos.x,
      wall.height,
      playerPos.z
    );
  }

  placeTexture(
    dustSystem.texWin,
    CONFIG.LAYER_WINDOW,
    playerPos.x,
    playerPos.z
  );

  // GPU yenilənməsi: hər iki tekstura eyni anda yenilənir ki, silinən yer dərhal və fırçanın ölçüsündə görünsün
  if (dustSystem.dirty && nowMs - dustSystem.lastUpload >= dustSystem.uploadInterval) {
    dustSystem.texWin.needsUpdate = true;
    dustSystem.texTop.needsUpdate = true;
    dustSystem.dirty = false;
    dustSystem.lastUpload = nowMs;
  }
}

// ===================================================================
// ===== DÜNYA (world.js) =====
// ===================================================================

// Sahnəni, ulduzları, Yeri, Ay səthini və işığı yaradır
function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000008);

  // Oyunçu ilə birlikdə hərəkət edən qrup: ulduzlar və Yer
  const sky = new THREE.Group();
  scene.add(sky);

  const starCount = 200;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sky.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(25, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x3388ff, emissive: 0x114488, flatShading: true })
  );
  earth.position.set(45, 33, -75);
  sky.add(earth);

  // Ay səthi (təmiz yer): oyunçunu izləyir, ona görə dünya sonsuzdur
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0xc4c8d2, roughness: 1.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.material.depthWrite = false; // uzaqda titrəməsin deyə yer ilk çəkilir
  ground.renderOrder = -1;
  scene.add(ground);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(100, 300, 100);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x445566, 0.9));

  return { scene, sky, ground };
}

// Hər kadrda çağırılır: göy və yer oyunçunun ardınca gedir
function updateWorld(world, playerPos) {
  world.sky.position.set(playerPos.x, 0, playerPos.z);
  world.ground.position.set(playerPos.x, 0, playerPos.z);
}

// ===================================================================
// ===== OYUNÇU VƏ FIRÇA MODELLƏRİ (player.js) =====
// ===================================================================

// Qutu şəklində bir hissə düzəldir (en, hündürlük, dərinlik, rəng, yer)
function makeBox(width, height, depth, color, x, y, z, glowColor) {
  const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
  if (glowColor !== undefined) {
    material.emissive = new THREE.Color(glowColor);
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Konus şəklində hissə düzəldir (süpürgənin saman hissəsi üçün)
function makeCone(topRadius, bottomRadius, height, color, x, y, z) {
  const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, height, 6), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// 1. Diş fırçası: nazik çəhrayı sap, ağ tüklər
function buildToothbrush() {
  const model = new THREE.Group();
  model.add(makeBox(0.05, 0.55, 0.05, 0xff3388, 0, 0.2, 0));
  model.add(makeBox(0.08, 0.03, 0.2, 0xff3388, 0, -0.1, 0.04));
  model.add(makeBox(0.07, 0.04, 0.19, 0xffffff, 0, -0.13, 0.04));
  return model;
}

// 2. Kiçik fırça: taxta sap və taxta blok, sarı tüklər
function buildScrubBrush() {
  const model = new THREE.Group();
  model.add(makeBox(0.05, 0.5, 0.05, 0xb5793a, 0, 0.18, 0));
  model.add(makeBox(0.12, 0.05, 0.28, 0x8a5a2b, 0, -0.08, 0));
  model.add(makeBox(0.11, 0.06, 0.27, 0xffd34d, 0, -0.135, 0));
  return model;
}

// 3. Süpürgə: uzun sap, qırmızı bağ, konus şəkilli saman
function buildBroom() {
  const model = new THREE.Group();
  model.add(makeBox(0.045, 0.75, 0.045, 0x9c6b3a, 0, 0.3, 0));
  model.add(makeBox(0.1, 0.04, 0.1, 0xcc2222, 0, -0.04, 0));
  model.add(makeCone(0.07, 0.17, 0.26, 0xe0b84a, 0, -0.19, 0));
  return model;
}

// 4. Geniş süpürgə: uzun boz sap, enli narıncı blok, qara tüklər
function buildWideBroom() {
  const model = new THREE.Group();
  model.add(makeBox(0.045, 0.8, 0.045, 0x667788, 0, 0.32, 0));
  model.add(makeBox(0.06, 0.1, 0.06, 0x445566, 0, -0.05, 0));
  model.add(makeBox(0.5, 0.06, 0.1, 0xee7722, 0, -0.12, 0));
  model.add(makeBox(0.48, 0.07, 0.09, 0x222222, 0, -0.18, 0));
  return model;
}

// 5. Təmizləyici: tünd sap, firuzəyi gövdə, enli baş, parlayan zolaq
function buildCleaner() {
  const model = new THREE.Group();
  model.add(makeBox(0.045, 0.6, 0.045, 0x333a44, 0, 0.25, 0));
  model.add(makeBox(0.16, 0.14, 0.2, 0x22ccdd, 0, -0.04, 0));
  model.add(makeBox(0.6, 0.07, 0.16, 0x2b3038, 0, -0.14, 0));
  model.add(makeBox(0.58, 0.02, 0.04, 0x66ffcc, 0, -0.18, 0.06, 0x66ffcc));
  model.add(makeBox(0.56, 0.05, 0.12, 0xdddddd, 0, -0.19, 0));
  return model;
}

// Alətin səviyyəsinə görə modellər (BRUSH_TOOLS ardıcıllığı ilə eynidir)
const BRUSH_BUILDERS = [buildToothbrush, buildScrubBrush, buildBroom, buildWideBroom, buildCleaner];

// Köhnə modelin yaddaşını azad edir
function disposeModel(model) {
  model.traverse((part) => {
    if (part.geometry) {
      part.geometry.dispose();
    }
    if (part.material) {
      part.material.dispose();
    }
  });
}

// Fırçanın modelini cari alətə uyğun dəyişir
function setBrushModel(brushGroup, level) {
  const oldModel = brushGroup.userData.model;
  if (oldModel) {
    brushGroup.remove(oldModel);
    disposeModel(oldModel);
  }
  const index = Math.min(Math.max(level, 1), BRUSH_BUILDERS.length) - 1;
  const newModel = BRUSH_BUILDERS[index]();
  brushGroup.add(newModel);
  brushGroup.userData.model = newModel;
  brushGroup.userData.level = level;
}

// Oyunçunun əlindəki fırçanı kameraya bağlayır
function createPlayer(camera) {
  const brushGroup = new THREE.Group();
  setBrushModel(brushGroup, GameState.upgrades.brushLevel);

  brushGroup.position.set(0.2, -0.25, -0.45);
  brushGroup.rotation.x = 0.3;
  brushGroup.rotation.z = -0.1;

  camera.add(brushGroup);

  return { brushGroup };
}

// Təmizləyəndə fırça yumşaq şəkildə aşağı əyilir və yana-yana süpürür
function updateBrush(brushGroup, isCleaning, dt, time) {
  const data = brushGroup.userData;

  // Yeni alət alınıbsa, görünüşü dəyişirik
  if (data.level !== GameState.upgrades.brushLevel) {
    setBrushModel(brushGroup, GameState.upgrades.brushLevel);
  }

  if (data.cleanAmount === undefined) {
    data.cleanAmount = 0;
  }
  const target = isCleaning ? 1 : 0;
  data.cleanAmount += (target - data.cleanAmount) * Math.min(1, dt * 10);

  const amount = data.cleanAmount;
  const sweep = Math.sin(time * 12) * amount;

  brushGroup.position.set(0.2 + sweep * 0.12, -0.25 - 0.2 * amount, -0.45 - 0.1 * amount);
  brushGroup.rotation.x = 0.3 + 0.9 * amount;
  brushGroup.rotation.z = -0.1 + sweep * 0.3;
}

// ===================================================================
// ===== YENİLƏMƏ PANELİ (shop.js) =====
// ===================================================================

// Paneldəki sətirlər: alət, çanta, robot modeli, robot sayı (key = kompüterdə basılan düymə)
const ITEMS = [
  { id: 'tool', key: '1', title: '🪥 Alət', buy: buyBrushUpgrade },
  { id: 'bag', key: '2', title: '🎒 Çanta', buy: buyBagUpgrade },
  { id: 'robotModel', key: '3', title: '🤖 Robot modeli', buy: buyRobotModelUpgrade },
  { id: 'robotCount', key: '4', title: '🤖 Robot sayı', buy: buyRobotCountUpgrade },
];

// Mağaza panelini hazırlayır: hər yenilənmə üçün bir sətir və "Al" düyməsi düzəldir
function createShopPanel() {
  const shop = {
    lastKey: '',
    panel: document.getElementById('shop-panel'),
    list: document.getElementById('shop-items'),
    rows: [],
  };

  for (const item of ITEMS) {
    const row = document.createElement('div');
    row.className = 'shop-row';

    const text = document.createElement('div');
    text.className = 'shop-text';

    const title = document.createElement('div');
    title.className = 'shop-row-title';
    const keySpan = document.createElement('span');
    keySpan.className = 'shop-key';
    keySpan.textContent = '[' + item.key + '] ';
    const label = document.createElement('span');
    label.textContent = item.title;
    title.appendChild(keySpan);
    title.appendChild(label);

    const info = document.createElement('div');
    info.className = 'shop-row-info';

    text.appendChild(title);
    text.appendChild(info);

    const button = document.createElement('button');
    button.className = 'shop-buy';
    button.id = 'shop-buy-' + item.id;

    row.appendChild(text);
    row.appendChild(button);
    shop.list.appendChild(row);

    button.addEventListener('click', () => {
      const result = item.buy();
      showToast(result.message);
      if (result.ok) { saveGame(); }
      shop.lastKey = '';
    });

    shop.rows.push({ id: item.id, info: info, button: button });
  }

  return shop;
}

// Bir sətirin yazısını və qiymətini hazırlayır (qiymət null = daha yüksək səviyyə yoxdur)
function describeRow(id) {
  let info = '';
  let price = null;

  if (id === 'tool') {
    const current = getBrushTool();
    const next = getNextBrushTool();
    if (next === null) {
      info = current.name + ' (' + current.size + ' m): ən güclü alətdir';
    } else {
      info = current.name + ' (' + current.size + ' m) → ' + next.name + ' (' + next.size + ' m)';
      price = next.price;
    }
  } else if (id === 'bag') {
    const next = getNextBagLevel();
    if (next === null) {
      info = 'Çanta: ' + GameState.bagCapacity + ' kq (maksimum)';
    } else {
      info = 'Çanta: ' + GameState.bagCapacity + ' kq → ' + next.capacity + ' kq';
      price = next.price;
    }
  } else if (id === 'robotModel') {
    const current = getRobotTool();
    const next = getNextRobotTool();
    if (next === null) {
      info = current.name + ' (' + current.size + ' m): ən güclü model';
    } else {
      info = current.name + ' → ' + next.name + ' (' + next.size + ' m)';
      price = next.price;
    }
  } else {
    const count = GameState.upgrades.robotCount;
    const nextPrice = getNextRobotCountPrice();
    if (nextPrice === null) {
      info = 'Robot sayı: ' + count + ' (maksimum)';
    } else if (count === 0) {
      info = 'Robot sayı: 0 → 1 (özü təmizləyir)';
      price = nextPrice;
    } else {
      info = 'Robot sayı: ' + count + ' → ' + (count + 1);
      price = nextPrice;
    }
  }

  return { info: info, price: price };
}

// Panelin mətnini və düymələrini yeniləyir (yalnız nəsə dəyişibsə)
function renderPanel(shop) {
  const descriptions = [];
  let key = '' + Math.floor(GameState.money);

  for (const row of shop.rows) {
    const description = describeRow(row.id);
    descriptions.push(description);
    key += '|' + description.info + '|' + description.price;
  }

  if (key === shop.lastKey) { return; }
  shop.lastKey = key;

  for (let index = 0; index < shop.rows.length; index++) {
    const row = shop.rows[index];
    const description = descriptions[index];
    row.info.textContent = description.info;
    if (description.price === null) {
      row.button.textContent = 'Maksimum';
      row.button.disabled = true;
    } else {
      row.button.textContent = 'Al: ' + description.price + ' 💰';
      row.button.disabled = GameState.money < description.price;
    }
  }
}

// Hər kadrda: oyunçu YENİLƏMƏ sahəsindədirsə panel açılır
function updateShopPanel(shop, activeId) {
  if (activeId === 'upgrade') {
    renderPanel(shop);
    shop.panel.classList.add('show');
  } else {
    shop.panel.classList.remove('show');
    shop.lastKey = '';
  }
}

// ===================================================================
// ===== BAZA (base.js) =====
// ===================================================================

const PLAYER_RADIUS = 0.5;   // oyunçunun divara nə qədər yaxınlaşa biləcəyi

// Tikilinin içindəki iki sahə (koordinatlar bazanın mərkəzinə görədir)
const PADS = [
  { id: 'sell', label: 'SATIŞ', color: 0x35c46a, offsetX: -4, offsetZ: -2 },
  { id: 'upgrade', label: 'YENİLƏMƏ', color: 0x3b82f6, offsetX: 4, offsetZ: -2 },
];

// Divarların siyahısı (mərkəzə görə): şimal, qərb, şərq və qapı üçün boşluq qoyulmuş cənub divarı
function getWallRects() {
  const halfWidth = CONFIG.BASE_WIDTH / 2;
  const halfDepth = CONFIG.BASE_DEPTH / 2;
  const thick = CONFIG.WALL_THICKNESS / 2;
  const doorHalf = CONFIG.DOOR_WIDTH / 2;
  const sideLength = halfWidth + thick - doorHalf;
  const sideCenter = doorHalf + sideLength / 2;

  return [
    { x: 0, z: -halfDepth, halfW: halfWidth + thick, halfD: thick },
    { x: -halfWidth, z: 0, halfW: thick, halfD: halfDepth },
    { x: halfWidth, z: 0, halfW: thick, halfD: halfDepth },
    { x: -sideCenter, z: halfDepth, halfW: sideLength / 2, halfD: thick },
    { x: sideCenter, z: halfDepth, halfW: sideLength / 2, halfD: thick },
  ];
}

const WALLS = getWallRects();

// Sahənin üstündə görünən yazı lövhəsi
function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(6, 1.5, 1);
  return sprite;
}

// Bazanın bir nüsxəsini düzəldir: döşəmə, divarlar, dam, işıqlar, sahələr və lövhələr.
// Bütün hissələr bazanın mərkəzinə görə yerləşir (özü isə sonradan lazımi yerə qoyulur).
function buildBaseModel() {
  const model = new THREE.Group();
  const wallHeight = CONFIG.WALL_HEIGHT;

  // Döşəmə
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.BASE_WIDTH + 0.5, 0.3, CONFIG.BASE_DEPTH + 0.5),
    new THREE.MeshStandardMaterial({ color: 0x4b5a73, roughness: 0.9 })
  );
  floor.position.set(0, 0.15, 0);
  model.add(floor);

  // Divarlar
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x6b7a94, roughness: 0.9 });
  for (const wall of WALLS) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(wall.halfW * 2, wallHeight, wall.halfD * 2),
      wallMaterial
    );
    mesh.position.set(wall.x, wallHeight / 2, wall.z);
    model.add(mesh);
  }

  // Dam
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.BASE_WIDTH + 1.2, 0.3, CONFIG.BASE_DEPTH + 1.2),
    new THREE.MeshStandardMaterial({ color: 0x38465c, roughness: 0.9 })
  );
  roof.position.set(0, wallHeight + 0.15, 0);
  model.add(roof);

  // Damın altındakı işıq zolaqları
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfffbe6, emissive: 0xfffbe6 });
  for (const lampX of [-4, 4]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.4), lampMaterial);
    lamp.position.set(lampX, wallHeight - 0.05, -2);
    model.add(lamp);
  }

  // Sahələr (SATIŞ, YENİLƏMƏ)
  for (const pad of PADS) {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(CONFIG.PAD_HALF * 2, 0.08, CONFIG.PAD_HALF * 2),
      new THREE.MeshStandardMaterial({ color: pad.color, emissive: pad.color, emissiveIntensity: 0.35 })
    );
    plate.position.set(pad.offsetX, 0.34, pad.offsetZ);
    model.add(plate);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 3.2, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: pad.color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    beam.position.set(pad.offsetX, 1.94, pad.offsetZ);
    model.add(beam);

    const label = makeLabel(pad.label);
    label.position.set(pad.offsetX, 3.0, pad.offsetZ);
    model.add(label);
  }

  // Uzaqdan görünən "BAZA" lövhəsi (damın üstündə)
  const sign = makeLabel('BAZA');
  sign.position.set(0, wallHeight + 1.4, CONFIG.BASE_DEPTH / 2);
  model.add(sign);

  return model;
}

// Bazanı yaradır. Dünya təkrarlandığı üçün bazanın 9 nüsxəsi (3x3) olur,
// onlar oyunçunun ətrafında dayanır və oyunçu getdikcə yerini dəyişir.
function createBase(scene) {
  const template = buildBaseModel();
  const copies = [];

  for (let index = 0; index < 9; index++) {
    let copy = template;
    if (index > 0) {
      copy = template.clone();
    }
    scene.add(copy);
    copies.push(copy);
  }

  return { copies: copies, tileX: null, tileZ: null, shop: createShopPanel() };
}

// Oyunçu bazanın (ən yaxın nüsxənin) daxilindədirmi (bazanın üstündə fırça işləmir)
function isInsideBase(x, z) {
  return Math.abs(wrapDelta(x - CONFIG.BASE_X)) <= CONFIG.BASE_WIDTH / 2 + 0.5
    && Math.abs(wrapDelta(z - CONFIG.BASE_Z)) <= CONFIG.BASE_DEPTH / 2 + 0.5;
}

// Oyunçu divarın içinə keçibsə, onu geri itələyir (yalnız qapıdan girmək olur)
function pushOutOfBase(playerPos) {
  let relX = wrapDelta(playerPos.x - CONFIG.BASE_X);
  let relZ = wrapDelta(playerPos.z - CONFIG.BASE_Z);
  const startX = relX;
  const startZ = relZ;

  for (let pass = 0; pass < 2; pass++) {
    for (const wall of WALLS) {
      const diffX = relX - wall.x;
      const diffZ = relZ - wall.z;
      const limitX = wall.halfW + PLAYER_RADIUS;
      const limitZ = wall.halfD + PLAYER_RADIUS;

      if (Math.abs(diffX) < limitX && Math.abs(diffZ) < limitZ) {
        const pushX = limitX - Math.abs(diffX);
        const pushZ = limitZ - Math.abs(diffZ);
        if (pushX < pushZ) {
          relX += diffX >= 0 ? pushX : -pushX;
        } else {
          relZ += diffZ >= 0 ? pushZ : -pushZ;
        }
      }
    }
  }

  playerPos.x += relX - startX;
  playerPos.z += relZ - startZ;
}

// Nüsxələri oyunçunun ətrafına düzür (yalnız oyunçu başqa "plitəyə" keçəndə)
function placeCopies(base, tileX, tileZ) {
  base.tileX = tileX;
  base.tileZ = tileZ;

  let index = 0;
  for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      base.copies[index].position.set(
        CONFIG.BASE_X + (tileX + offsetX) * SIZE,
        0,
        CONFIG.BASE_Z + (tileZ + offsetZ) * SIZE
      );
      index += 1;
    }
  }
}

// Hər kadrda: nüsxələr yerləşdirilir, oyunçu hansı sahədədir? Satış avtomatikdir, yeniləmələr üçün panel açılır
function updateBase(base, playerPos) {
  const tileX = Math.round((playerPos.x - CONFIG.BASE_X) / SIZE);
  const tileZ = Math.round((playerPos.z - CONFIG.BASE_Z) / SIZE);
  if (tileX !== base.tileX || tileZ !== base.tileZ) {
    placeCopies(base, tileX, tileZ);
  }

  const relX = wrapDelta(playerPos.x - CONFIG.BASE_X);
  const relZ = wrapDelta(playerPos.z - CONFIG.BASE_Z);

  let activeId = null;
  for (const pad of PADS) {
    if (Math.abs(relX - pad.offsetX) <= CONFIG.PAD_HALF && Math.abs(relZ - pad.offsetZ) <= CONFIG.PAD_HALF) {
      activeId = pad.id;
    }
  }

  if (activeId === 'sell' && GameState.bag > 0.0001) {
    const result = sellDust(CONFIG.SELL_PRICE_PER_KG);
    showToast('Satıldı: ' + result.sold.toFixed(2) + ' kq, +' + result.earned + ' 💰');
    saveGame();
  }

  updateShopPanel(base.shop, activeId);
}

// ===================================================================
// ===== ROBOTLAR (robot.js) =====
// ===================================================================

// Silindr şəklində hissə düzəldir
function makeCylinder(radius, height, color, y) {
  const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material);
  mesh.position.set(0, y, 0);
  return mesh;
}

// Robotun görünüşünü düzəldir: dairəvi gövdə, tünd ətək, yaşıl işıq
function buildRobotModel() {
  const model = new THREE.Group();
  model.add(makeCylinder(0.46, 0.15, 0x1f2937, 0.125));
  model.add(makeCylinder(0.5, 0.2, 0xe5e7eb, 0.3));
  model.add(makeCylinder(0.3, 0.05, 0x374151, 0.425));

  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.06, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e })
  );
  led.position.set(0, 0.46, 0.2);
  model.add(led);
  return model;
}

// Robotlar sistemini yaradır (robotlar alınanda özləri əlavə olunur)
function createRobots(scene) {
  return { scene: scene, robots: [] };
}

// Ədədi 0..SIZE aralığına gətirir (dünya təkrarlandığı üçün)
function wrapPosition(value) {
  return ((value % SIZE) + SIZE) % SIZE;
}

// Yeni robot düzəldir və bazanın qapısının qarşısına qoyur
function createOneRobot(system, number) {
  const group = new THREE.Group();
  group.add(buildRobotModel());
  system.scene.add(group);

  return {
    group: group,
    x: CONFIG.BASE_X + (number - 2) * 1.6,
    z: CONFIG.BASE_Z + CONFIG.BASE_DEPTH / 2 + 3,
    chunkIndex: -1,        // hazırda təmizlədiyi parça (-1 = yoxdur)
    lastChunkIndex: -1,    // ən son bitirdiyi parça (eyni parçaya təkrar qayıtmasın)
    waypoints: [],         // parçanın içindəki yol nöqtələri
    waypointIndex: 0,
    waitTime: 0,
    pendingMoney: 0,       // hələ hesaba yazılmayan pul (1-ə çatanda yazılır)
    sizeLevel: -1,
  };
}

// Başqa robot bu parçanı artıq seçibmi
function isClaimed(system, robot, chunkIndex) {
  for (const other of system.robots) {
    if (other !== robot && other.chunkIndex === chunkIndex) {
      return true;
    }
  }
  return false;
}

// Robota ən yaxın, hələ bitməmiş və başqa robotun seçmədiyi parçanı tapır (yoxdursa -1)
function pickChunk(system, robot, dustSystem) {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let chunkY = 0; chunkY < CHUNKS; chunkY++) {
    for (let chunkX = 0; chunkX < CHUNKS; chunkX++) {
      const index = chunkY * CHUNKS + chunkX;
      if (dustSystem.chunkDone[index] === 1) { continue; }
      if (index === robot.lastChunkIndex) { continue; }
      if (isClaimed(system, robot, index)) { continue; }

      const centerX = (chunkX + 0.5) * CHUNK_SIZE;
      const centerZ = (chunkY + 0.5) * CHUNK_SIZE;
      const distance = Math.hypot(wrapDelta(centerX - robot.x), wrapDelta(centerZ - robot.z));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
  }
  return bestIndex;
}

// Parçanı sətir-sətir (biçin kimi) süpürmək üçün yol nöqtələrini hazırlayır
function buildWaypoints(chunkIndex, size) {
  const chunkX = chunkIndex % CHUNKS;
  const chunkY = Math.floor(chunkIndex / CHUNKS);
  const minX = chunkX * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE;
  const minZ = chunkY * CHUNK_SIZE;

  const lanes = Math.max(1, Math.ceil(CHUNK_SIZE / size));
  const spacing = CHUNK_SIZE / lanes;
  const points = [];

  for (let lane = 0; lane < lanes; lane++) {
    const z = minZ + (lane + 0.5) * spacing;
    if (lane % 2 === 0) {
      points.push({ x: minX, z: z });
      points.push({ x: maxX, z: z });
    } else {
      points.push({ x: maxX, z: z });
      points.push({ x: minX, z: z });
    }
  }
  return points;
}

// Robotun ölçüsünü cari modelə görə dəyişir
function syncRobotSize(robot, tool) {
  if (robot.sizeLevel === GameState.upgrades.robotLevel) { return; }
  robot.sizeLevel = GameState.upgrades.robotLevel;
  robot.group.scale.set(tool.size, 1, tool.size);
}

// Robotun qazandığı pulu yığır; 1-ə çatanda hesaba yazır
function payRobot(robot, cleanedCells) {
  robot.pendingMoney += cleanedCells * MONEY_PER_CELL;
  GameState.totalDustCollected += cleanedCells * KG_PER_CELL;
  if (robot.pendingMoney >= 1) {
    const whole = Math.floor(robot.pendingMoney);
    earnMoney(whole);
    robot.pendingMoney -= whole;
  }
}

// Robotu cari yol nöqtəsinə doğru sürür və yolundakı tozu təmizləyir
function driveRobot(robot, dustSystem, tool, dt) {
  const target = robot.waypoints[robot.waypointIndex];
  const dx = wrapDelta(target.x - robot.x);
  const dz = wrapDelta(target.z - robot.z);
  const distance = Math.hypot(dx, dz);

  if (distance < 0.001) {
    robot.waypointIndex += 1;
    return;
  }

  // Bu kadrda gedəcəyi məsafə
  const move = Math.min(distance, tool.speed * dt);
  const newX = robot.x + (dx / distance) * move;
  const newZ = robot.z + (dz / distance) * move;

  // Yolu addım-addım təmizləyirik ki, boşluq qalmasın
  const steps = Math.max(1, Math.ceil(move / (tool.size / 3)));
  let cleanedCells = 0;
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const stepX = robot.x + (newX - robot.x) * t;
    const stepZ = robot.z + (newZ - robot.z) * t;
    cleanedCells += cleanSquare(dustSystem, stepX, stepZ, tool.size);
  }

  // Yalnız yeni təmizlənən yer olubsa pul yazılır (toz cleanCell-də özü silinir)
  if (cleanedCells > 0) {
    payRobot(robot, cleanedCells);
  }

  robot.x = wrapPosition(newX);
  robot.z = wrapPosition(newZ);
  robot.group.rotation.y = Math.atan2(dx, dz);

  if (move >= distance) {
    robot.waypointIndex += 1;
  }
}

// Robotun şəklini oyunçuya ən yaxın dünya nüsxəsində göstərir (baza daxilində görünməz olur)
function placeRobot(robot, playerPos) {
  const shownX = robot.x + Math.round((playerPos.x - robot.x) / SIZE) * SIZE;
  const shownZ = robot.z + Math.round((playerPos.z - robot.z) / SIZE) * SIZE;
  robot.group.position.set(shownX, 0, shownZ);
  robot.group.visible = !isInsideBase(robot.x, robot.z);
}

// Bir robotun hər kadrdakı işi: parça seç, onu tam təmizlə, sonra başqasına keç
function updateOneRobot(system, robot, dustSystem, playerPos, dt) {
  const tool = getRobotTool();
  syncRobotSize(robot, tool);

  // Parça artıq bitibsə (robot, yaxud oyunçu bitirib) və ya yol qurtarıbsa, yenisinə keçirik
  if (robot.chunkIndex !== -1) {
    const chunkIsDone = dustSystem.chunkDone[robot.chunkIndex] === 1;
    const routeIsOver = robot.waypointIndex >= robot.waypoints.length;
    if (chunkIsDone || routeIsOver) {
      robot.lastChunkIndex = robot.chunkIndex;
      robot.chunkIndex = -1;
    }
  }

  // Yeni parça seçirik
  if (robot.chunkIndex === -1) {
    if (robot.waitTime > 0) {
      robot.waitTime -= dt;
    } else {
      const found = pickChunk(system, robot, dustSystem);
      if (found === -1) {
        robot.waitTime = 2;
      } else {
        robot.chunkIndex = found;
        robot.waypoints = buildWaypoints(found, tool.size);
        robot.waypointIndex = 0;
      }
    }
  }

  if (robot.chunkIndex !== -1) {
    driveRobot(robot, dustSystem, tool, dt);
  }

  placeRobot(robot, playerPos);
}

// Hər kadrda: alınmış robotların sayı qədər robot yaradılır və hamısı işləyir
function updateRobots(system, dustSystem, playerPos, dt) {
  while (system.robots.length < GameState.upgrades.robotCount) {
    system.robots.push(createOneRobot(system, system.robots.length));
  }

  for (const robot of system.robots) {
    updateOneRobot(system, robot, dustSystem, playerPos, dt);
  }
}

// ===================================================================
// ===== XƏRİTƏ (minimap.js) =====
// ===================================================================

const MAP_SIZE = 128;

// Xəritə canvas-ını və lazımi obyektləri hazırlayır
function createMinimap() {
  const canvas = document.getElementById('minimap');
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;

  // Bufer parça həllində olur (hər parça 1 piksel): hər xanaya baxmaq lazım deyil
  const buffer = document.createElement('canvas');
  buffer.width = CHUNKS;
  buffer.height = CHUNKS;
  const bufferCtx = buffer.getContext('2d');
  const mapCtx = canvas.getContext('2d');
  mapCtx.imageSmoothingEnabled = false;

  return {
    ctx: mapCtx,
    buffer,
    bufferCtx,
    image: bufferCtx.createImageData(CHUNKS, CHUNKS),
    label: document.getElementById('cleaned-percent'),
    drawnVersion: -1,
    lastRedraw: 0,
  };
}

// Xəritə bütün dünyanı göstərir (dünya təkrarlandığı üçün oyunçu kənardan çıxanda qarşı tərəfdən görünür)
function updateMinimap(map, dust, playerPos, heading, nowMs) {
  const grid = CONFIG.GRID;

  // Təmizlənmiş yerlər dəyişəndə (və ən çox 2 dəfə saniyədə) xəritəni yenidən çəkirik
  if (dust.version !== map.drawnVersion && nowMs - map.lastRedraw > 500) {
    map.drawnVersion = dust.version;
    map.lastRedraw = nowMs;

    const data = map.image.data;
    for (let k = 0; k < dust.chunkCleaned.length; k++) {
      const share = Math.min(1, dust.chunkCleaned[k] / CHUNK_AREA);
      const shade = 70 + share * 170;
      const p = k * 4;
      data[p] = shade;
      data[p + 1] = shade;
      data[p + 2] = shade;
      data[p + 3] = 255;
    }
    map.bufferCtx.putImageData(map.image, 0, 0);

    const percent = (dust.cleanedCount / (grid * grid)) * 100;
    map.label.textContent = 'Təmizlənib: ' + percent.toFixed(1) + '%';
  }

  map.ctx.drawImage(map.buffer, 0, 0, MAP_SIZE, MAP_SIZE);
  // Bazanın yeri (mavi kvadrat)
  const baseMapX = mod1(CONFIG.BASE_X / CONFIG.SURFACE_SIZE) * MAP_SIZE;
  const baseMapY = mod1(CONFIG.BASE_Z / CONFIG.SURFACE_SIZE) * MAP_SIZE;
  map.ctx.fillStyle = '#3b82f6';
  map.ctx.fillRect(baseMapX - 4, baseMapY - 4, 8, 8);
  // Oyunçunun yeri və baxdığı istiqamət
  const dotX = mod1(playerPos.x / CONFIG.SURFACE_SIZE) * MAP_SIZE;
  const dotY = mod1(playerPos.z / CONFIG.SURFACE_SIZE) * MAP_SIZE;
  map.ctx.strokeStyle = '#ff4040';
  map.ctx.lineWidth = 2;
  map.ctx.beginPath();
  map.ctx.moveTo(dotX, dotY);
  map.ctx.lineTo(dotX + heading.x * 10, dotY + heading.z * 10);
  map.ctx.stroke();
  map.ctx.fillStyle = '#ff4040';
  map.ctx.beginPath();
  map.ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
  map.ctx.fill();
}

// ===================================================================
// ===== İDARƏETMƏ: TELEFON (controls.js) =====
// ===================================================================

const inputState = {
  joystick: { x: 0, y: 0 },
  cameraYaw: 0,
  cameraPitch: 0,
  actionPressed: false,
};

// Seçilmiş cihaza görə idarəetməni qoşur: 'pc' = klaviatura və siçan, 'phone' = toxunuş
function setupControls(device) {
  if (device === 'pc') {
    setupKeyboardControls(inputState);
  } else {
    setupTouchControls();
  }
}

// Telefon idarəsi: virtual joystick, kamera sahəsi, təmizləmə düyməsi
function setupTouchControls() {
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');
  const camArea = document.getElementById('camera-area');
  const actionBtn = document.getElementById('action-btn');

  let joyPointerId = null;
  let camPointerId = null;
  let camLastX = 0;
  let camLastY = 0;

  // Joystick düyməsinin yerini və qiymətlərini yeniləyir
  function updateJoystick(e) {
    const rect = joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const maxR = CONFIG.JOYSTICK_RADIUS;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxR) {
      dx = (dx / d) * maxR;
      dy = (dy / d) * maxR;
    }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    inputState.joystick.x = dx / maxR;
    inputState.joystick.y = -dy / maxR;
  }

  // Joystick-i sıfırlayır
  function resetJoystick() {
    inputState.joystick.x = 0;
    inputState.joystick.y = 0;
    joyKnob.style.transform = 'translate(0, 0)';
  }

  joyBase.addEventListener('pointerdown', (e) => {
    if (joyPointerId !== null) { return; }
    joyPointerId = e.pointerId;
    joyBase.setPointerCapture(e.pointerId);
    updateJoystick(e);
  });

  joyBase.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) { return; }
    updateJoystick(e);
  });

  // Joystick-dən barmaq çəkiləndə
  function endJoy(e) {
    if (e.pointerId !== joyPointerId) { return; }
    joyPointerId = null;
    resetJoystick();
  }
  joyBase.addEventListener('pointerup', endJoy);
  joyBase.addEventListener('pointercancel', endJoy);

  camArea.addEventListener('pointerdown', (e) => {
    if (camPointerId !== null) { return; }
    camPointerId = e.pointerId;
    camLastX = e.clientX;
    camLastY = e.clientY;
    camArea.setPointerCapture(e.pointerId);
  });

  camArea.addEventListener('pointermove', (e) => {
    if (e.pointerId !== camPointerId) { return; }
    const dx = e.clientX - camLastX;
    const dy = e.clientY - camLastY;
    camLastX = e.clientX;
    camLastY = e.clientY;

    inputState.cameraYaw += dx * CONFIG.TOUCH_SENSITIVITY;
    // Barmaq aşağı çəkəndə kamera aşağı baxsın
    inputState.cameraPitch -= dy * CONFIG.TOUCH_SENSITIVITY;

    if (inputState.cameraPitch > CONFIG.PITCH_LIMIT) { inputState.cameraPitch = CONFIG.PITCH_LIMIT; }
    if (inputState.cameraPitch < -CONFIG.PITCH_LIMIT) { inputState.cameraPitch = -CONFIG.PITCH_LIMIT; }
  });

  // Kamera sahəsindən barmaq çəkiləndə
  function endCam(e) {
    if (e.pointerId !== camPointerId) { return; }
    camPointerId = null;
  }
  camArea.addEventListener('pointerup', endCam);
  camArea.addEventListener('pointercancel', endCam);

  actionBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    actionBtn.setPointerCapture(e.pointerId);
    inputState.actionPressed = true;
  });

  actionBtn.addEventListener('pointerup', (e) => {
    e.preventDefault();
    inputState.actionPressed = false;
  });

  actionBtn.addEventListener('pointercancel', () => {
    inputState.actionPressed = false;
  });
}

// ===================================================================
// ===== İDARƏETMƏ: KOMPÜTER (keyboard.js) =====
// ===================================================================

// Kompüterdə 1, 2, 3, 4 düymələri yeniləmə panelindəki uyğun "Al" düyməsini basır
const BUY_BUTTONS = {
  Digit1: 'shop-buy-tool',
  Numpad1: 'shop-buy-tool',
  Digit2: 'shop-buy-bag',
  Numpad2: 'shop-buy-bag',
  Digit3: 'shop-buy-robotModel',
  Numpad3: 'shop-buy-robotModel',
  Digit4: 'shop-buy-robotCount',
  Numpad4: 'shop-buy-robotCount',
};

// Kompüter idarəsi: WASD/oxlar, siçan baxışı, sol klik və ya Boşluq, 1/2/3/4 (yeniləmə paneli)
function setupKeyboardControls(inputState) {
  const container = document.getElementById('game-container');
  const hint = document.getElementById('pc-hint');
  const shopPanel = document.getElementById('shop-panel');

  const keys = {};      // hazırda basılı düymələr
  let spaceDown = false;
  let mouseDown = false;

  // İki düymədən biri basılıdırmı
  function isDown(firstCode, secondCode) {
    return keys[firstCode] === true || keys[secondCode] === true;
  }

  // Basılı düymələrə görə joystick qiymətlərini təyin edir
  function updateMove() {
    inputState.joystick.y = (isDown('KeyW', 'ArrowUp') ? 1 : 0) - (isDown('KeyS', 'ArrowDown') ? 1 : 0);
    inputState.joystick.x = (isDown('KeyD', 'ArrowRight') ? 1 : 0) - (isDown('KeyA', 'ArrowLeft') ? 1 : 0);
  }

  // Təmizləmə düyməsinin vəziyyətini yeniləyir
  function updateAction() {
    inputState.actionPressed = spaceDown || mouseDown;
  }

  // Siçan oyuna kilidlənibmi
  function isLocked() {
    return document.pointerLockElement === container;
  }

  // Ekranın altındakı köməkçi yazı
  function updateHint() {
    if (isLocked()) {
      hint.textContent = 'WASD: yeriş · Siçan: baxış · Sol klik / Boşluq: təmizlə · 1/2/3/4: yenilə · Esc: siçanı burax';
    } else {
      hint.textContent = 'Başlamaq üçün oyuna klikləyin';
    }
  }

  // Siçanı oyuna "kilidləyir" (kursor gizlənir, baxış siçanla idarə olunur)
  function lockMouse() {
    try {
      const result = container.requestPointerLock();
      if (result && result.catch) { result.catch(() => {}); }
    } catch (error) {
      console.warn('Siçan kilidi xətası:', error);
    }
  }

  // Bütün düymələri buraxılmış sayır
  function releaseAll() {
    for (const code in keys) {
      keys[code] = false;
    }
    spaceDown = false;
    mouseDown = false;
    updateMove();
    updateAction();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      spaceDown = true;
      updateAction();
      return;
    }

    const buyId = BUY_BUTTONS[e.code];
    if (buyId !== undefined) {
      if (!e.repeat && shopPanel.classList.contains('show')) {
        document.getElementById(buyId).click();
      }
      return;
    }

    if (e.code.startsWith('Arrow')) { e.preventDefault(); }
    keys[e.code] = true;
    updateMove();
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      updateAction();
      return;
    }
    keys[e.code] = false;
    updateMove();
  });

  window.addEventListener('blur', releaseAll);

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) { return; }
    if (!isLocked()) {
      lockMouse();
      return;
    }
    mouseDown = true;
    updateAction();
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) { return; }
    mouseDown = false;
    updateAction();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isLocked()) { return; }
    inputState.cameraYaw += e.movementX * CONFIG.MOUSE_SENSITIVITY;
    inputState.cameraPitch -= e.movementY * CONFIG.MOUSE_SENSITIVITY;
  });

  container.addEventListener('contextmenu', (e) => { e.preventDefault(); });

  document.addEventListener('pointerlockchange', () => {
    if (!isLocked()) { releaseAll(); }
    updateHint();
  });

  updateHint();
}

// ===================================================================
// ===== CİHAZIN TƏYİNİ (device.js) =====
// ===================================================================

// Cihazı özü təyin edir: toxunuşlu ekran varsa 'phone', yoxdursa 'pc'.
// Test üçün linkin sonuna ?device=phone və ya ?device=pc yazmaq olar.
// Seçilən cihaza uyğun "device-phone" və ya "device-pc" sinfi səhifəyə əlavə olunur.
function detectDevice() {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('device');

  let device = 'pc';
  if (forced === 'phone' || forced === 'pc') {
    device = forced;
  } else if (window.matchMedia('(pointer: coarse)').matches) {
    device = 'phone';
  }

  document.body.classList.add('device-' + device);
  return device;
}

// ===================================================================
// ===== ƏSAS OYUN (main.js) =====
// ===================================================================

// Versiya nömrəsi ekranda görünsün
document.getElementById('version-tag').textContent = CONFIG.VERSION;

// Oyunu seçilmiş cihaza ('phone' və ya 'pc') görə işə salır
function startGame(device) {
  loadGame();
  applyUpgrades();

  const container = document.getElementById('game-container');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 100);
  const world = createWorld();
  world.scene.add(camera);

  const { brushGroup } = createPlayer(camera);
  const dustSystem = createDustSystem(world.scene);
  const minimap = createMinimap();
  const base = createBase(world.scene);
  const robots = createRobots(world.scene);

  setupControls(device);
  updateHUD();
  startAutoSave();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Oyun bazanın içində başlayır
  const playerPos = new THREE.Vector3(CONFIG.BASE_X, 0, CONFIG.BASE_Z + 4);
  const heading = new THREE.Vector3(0, 0, -1);
  let currentPitch = 0;

  const upVec = new THREE.Vector3(0, 1, 0);
  const rightVec = new THREE.Vector3();
  const moveVec = new THREE.Vector3();
  const lookDir = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  const clock = new THREE.Clock();

  // Baxış istiqaməti ilə toz qatının kəsişmə nöqtəsi (fırça çatmasa və ya baza üstündədirsə null)
  function findGroundHit() {
    if (lookDir.y > -0.05) { return null; }
    const distance = (CONFIG.DUST_HEIGHT - camera.position.y) / lookDir.y;
    if (distance > CONFIG.REACH) { return null; }
    hitPoint.copy(camera.position).addScaledVector(lookDir, distance);
    if (isInsideBase(hitPoint.x, hitPoint.z)) { return null; }
    return hitPoint;
  }

  // Hər kadrda işləyən əsas dövr
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const nowMs = performance.now();

    if (inputState.cameraYaw !== 0) {
      heading.applyAxisAngle(upVec, -inputState.cameraYaw);
      inputState.cameraYaw = 0;
    }

    if (inputState.cameraPitch !== 0) {
      currentPitch += inputState.cameraPitch;
      if (currentPitch > CONFIG.PITCH_LIMIT) { currentPitch = CONFIG.PITCH_LIMIT; }
      if (currentPitch < -CONFIG.PITCH_LIMIT) { currentPitch = -CONFIG.PITCH_LIMIT; }
      inputState.cameraPitch = 0;
    }

    heading.y = 0;
    heading.normalize();
    rightVec.crossVectors(heading, upVec).normalize();

    moveVec.set(0, 0, 0);
    moveVec.addScaledVector(heading, inputState.joystick.y);
    moveVec.addScaledVector(rightVec, inputState.joystick.x);

    if (moveVec.lengthSq() > 0.01) {
      moveVec.normalize();
      playerPos.addScaledVector(moveVec, CONFIG.PLAYER_SPEED * dt);
    }

    // Bazanın divarlarından keçməsin
    pushOutOfBase(playerPos);

    camera.position.set(playerPos.x, playerPos.y + CONFIG.CAMERA_HEIGHT, playerPos.z);
    camera.up.set(0, 1, 0);

    lookDir.copy(heading).multiplyScalar(Math.cos(currentPitch)).addScaledVector(upVec, Math.sin(currentPitch));
    camera.lookAt(camera.position.clone().add(lookDir));

    updateWorld(world, playerPos);
    updateDustWindow(dustSystem, playerPos, nowMs);
    updateBrush(brushGroup, inputState.actionPressed, dt, clock.elapsedTime);

    const hit = findGroundHit();
    updateDustSystem(dustSystem, hit, inputState.actionPressed);
    updateRobots(robots, dustSystem, playerPos, dt);
    updateBase(base, playerPos);
    updateMinimap(minimap, dustSystem, playerPos, heading, nowMs);

    // Parça tamamlananda mesaj (oyunçu da, robot da tamamlaya bilər)
    if (dustSystem.rewardPending > 0) {
      showToast('Parça təmizləndi! +' + dustSystem.rewardPending + ' 💰');
      dustSystem.rewardPending = 0;
      saveGame();
    }

    // Parça faizi və bazaya məsafə (dünya təkrarlandığı üçün ən yaxın baza sayılır)
    const target = hit !== null ? hit : playerPos;
    const baseMeters = Math.round(Math.hypot(
      wrapDelta(playerPos.x - CONFIG.BASE_X),
      wrapDelta(playerPos.z - CONFIG.BASE_Z)
    ));
    updateInfoLabels(getChunkProgress(dustSystem, target.x, target.z), baseMeters);

    updateHUD();
    renderer.render(world.scene, camera);
  }

  animate();
}

// Cihaz özü təyin olunur, seçim ekranı yoxdur
startGame(detectDevice());
