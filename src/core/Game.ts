import * as THREE from 'three';
import { Sound } from './Sound';
import { Gear } from '../character/Gear';
import { Guide } from '../world/Guide';
import { Townsfolk } from '../character/Townsfolk';
import { Fireworks } from '../world/Fireworks';
import { ShopView } from '../ui/ShopView';
import { SHOP_BY_ID, type ShopCategory } from '../content/shop';
import { payUpkeep, rideSpeed, sellPrice, walkSpeed, type ShopState } from './Shop';
import { themeFor } from '../content/music';
import { Coach } from '../ui/Coach';
import { loadAvatar } from '../character/AvatarNpc';
import { HERO_IDS, heroModel } from '../character/hero';
import { PlazaExtras } from '../character/Extras';
import { CameraController } from '../camera/CameraController';
import { CITY_BOUNDS, PlayerController } from '../character/PlayerController';
import { NpcActor, Npcs } from '../character/Npcs';
import type { OneShot } from '../character/CharacterAnimator';
import { Studio } from '../character/Studio';
import { DEFAULT_LOOK, randomLook, type CharacterLook } from '../content/characterOptions';
import { DISTRICT_IDS, type ZoneId } from '../content/cityPlan';
import { isConcept } from '../content/concepts';
import { CURIOSITIES } from '../content/curiosities';
import { DIALOGUES } from '../content/dialogue/scripts';
import { INTERIORS, type InteriorId } from '../content/interiors';
import { ADVISORS, CLUE_IDS, type ClueId } from '../content/missions/branch';
import type { Tone } from '../content/dialogue/types';
import { ERRANDS, VISIT_RANGE } from '../content/errands';
import { NPC_IDS, NPCS, repLevel, type NpcId } from '../content/npcs';
import { t } from '../i18n';
import { CharacterCreator } from '../ui/CharacterCreator';
import { DialogueView } from '../ui/DialogueView';
import { InfoCard, type CardContent } from '../ui/InfoCard';
import { Notebook } from '../ui/Notebook';
import { Hud, type NpcMarker } from '../ui/Hud';
import { Bag, CompleteScreen, QuestLog, questTracker, SettingsPanel } from '../ui/Progress';
import { TRAIL } from '../world/landmarks/decor';
import { QUESTS, XP } from '../content/quests';
import { advance, grant, levelInfo as levelOf, type ProgressEvent, type Reward } from './Progression';
import { Ambient, PLAZA_LOOPS } from '../world/Ambient';
import { Atmosphere } from '../world/Atmosphere';
import { buildCity, type City } from '../world/CityBuilder';
import { Curiosities } from '../world/Curiosities';
import { Interiors } from '../world/Interiors';
import { rectCenter, zoneAt } from '../world/cityLayout';
import { addSurfaceDetail, loadGraphics, PostFX, saveGraphics, type Graphics } from '../world/Style';
import type { Poi } from '../world/types';
import { EventBus } from './EventBus';
import { Input } from './Input';
import { newSave, SaveStore, type SaveData, type Settings } from './Save';
import { currentStep, findClue, type Evaluation } from './Mission';
import { apply, Conversation, hasFlag, metCount, type EffectResult } from './Social';
import { type DaySummary, type ShopLevel } from './PizzaShop';
import { PizzaShopView } from '../ui/PizzaShopView';
import { Collectibles, GOLD_TOTAL, type FoundEvent } from '../world/Collectibles';
import { PLAZA, TRAMPOLINE } from '../world/landmarks/plaza';
import { SKY_CHEST, SKY_TRAMPOLINE, SkyTreasure, type SkyEvent } from '../world/interiors/skyLand';
import { ISLAND_CHEST, IslandTreasure } from '../world/interiors/island';
import { FlightView, TravelView } from '../ui/TravelView';
import { buyTicket, COCONUT, type TripClass } from '../content/travel';
import { BusinessSite } from '../world/BusinessSite';
import { CityEventDecor } from '../world/CityEventDecor';
import { BusinessView, CITY_ICON } from '../ui/BusinessView';
import { MoneyView } from '../ui/MoneyView';
import { MissionView } from '../ui/MissionView';
import { LifeView, type LifeTab } from '../ui/LifeView';
import { SleepView } from '../ui/SleepView';
import { FriendView, gendered, type FriendAction } from '../ui/FriendView';
import { BEST_GIFT, FRIENDS } from '../content/friends';
import { TOWN_LINES } from '../content/townsfolk';
import { TreasureMarks } from '../world/TreasureMarks';
import { ServiceQueue } from '../world/ServiceQueue';
import { JobView } from '../ui/JobView';
import { JOB_BY_POI, SHIFT, type JobDef } from '../content/jobs';
import { makeShift, paidToday, payslip, recordShift, type Payslip } from './Jobs';
import { playServedShift, shiftDemand, type ShiftPlan, type ShopDay } from './PizzaShop';
/** Where the player cooks in Marco's pizzeria and where the line starts (room coordinates). */
const PIZZA_COUNTER = { cook: { x: 3.0, z: -2.4 }, queue: { x: 3.0, z: -0.6 } };
const PIZZA_SECONDS = 60;
import { ServiceView } from '../ui/ServiceView';
import { planService, RECIPES, ServiceRun, type RecipeStep, type ServiceEvent } from './Service';
import { ESCALATOR, ESCALATORS, escalatorHeight } from '../content/mall';
import { TREASURE_FRIEND_LEVEL } from '../content/treasure';
import { nextStep, piecesFound, take, treasureDone } from './Treasure';
import { chat, finishFavor, friendLevel, friendOf, giveGift, reachPlace, startFavor, takePresent, type FriendChange } from './Friends';
import { FURNITURE } from '../content/home';
import { billsFor, noteWorth, payBills, worth, type Worth } from './Life';
import { add as addNeeds, consume, drain, lowNeeds, needSpeed, sleep as sleepNeeds } from './Needs';
import { HOME_MEAL, SLEEP_BED, SLEEP_FLOOR, TAP_WATER, type NeedId } from '../content/needs';
import { grade as gradeTier, recordTier } from './BuildingMissions';
import { BUILDING_MISSIONS, TIER_RULES, type MissionBuilding } from '../content/missions/buildings';
import { accrue, dayIndex, portfolioValue } from './Money';
import { addMoments, newMoments } from './Album';
import { decisionSeed, decisionState, recordDecision, resolveDecision } from './Decisions';
import { DECISION_BY_BUILDING } from '../content/decisions';
import { bizDemand, playServedDay, type BizDay, type BizPlan } from './Business';
import { CITY_EVENTS, cityEventFor, cityWeatherFor, dayKey, recordBizDay, STAGE_RULES, takeHome, upgrade, type BizResult, type CityEventId, type WeatherId } from './Business';

export type GameEvents = {
  'zone:changed': ZoneId | null;
  'zone:discovered': ZoneId;
  'poi:selected': string | null;
  'poi:interact': string;
  'night:changed': boolean;
  'game:saved': boolean;
  'npc:talk': NpcId;
  'errand:changed': { npc: NpcId; state: string };
};

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITY_LEVELS: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

export interface QualitySettings {
  level: QualityLevel;
  pixelRatio: number;
  shadowMap: number;
  /** Multisampling of the post-processing target (0 = off). */
  samples: number;
  bloom: boolean;
  /** Ambient occlusion (an extra pass over the scene). */
  ao: boolean;
}

const QUALITY_KEY = 'investor-city.quality';

/**
 * Graphics presets. Medium is what phones and tablets got before the levels
 * existed and high is what computers got, so the automatic choice looks the
 * same as before; low is for weak devices and ultra adds ambient occlusion.
 */
export function qualityPreset(level: QualityLevel): QualitySettings {
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  switch (level) {
    case 'low':
      return { level, pixelRatio: Math.min(dpr, 1), shadowMap: 1024, samples: 2, bloom: false, ao: false };
    case 'medium':
      return { level, pixelRatio: Math.min(dpr, 1.5), shadowMap: 1024, samples: 4, bloom: false, ao: false };
    case 'high':
      return { level, pixelRatio: Math.min(dpr, 2), shadowMap: 2048, samples: 4, bloom: true, ao: false };
    case 'ultra':
      return { level, pixelRatio: Math.min(dpr, 2), shadowMap: 4096, samples: 4, bloom: true, ao: true };
  }
}

const isLevel = (v: string | null): v is QualityLevel => !!v && (QUALITY_LEVELS as string[]).includes(v);

/** The level the device gets when the player has not picked one. */
export function autoQuality(): QualityLevel {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  return coarse || small ? 'medium' : 'high';
}

export function detectQuality(): QualitySettings {
  const forced = new URLSearchParams(location.search).get('quality');
  if (isLevel(forced)) return qualityPreset(forced);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(QUALITY_KEY);
  } catch {
    /* private mode */
  }
  return qualityPreset(isLevel(saved) ? saved : autoQuality());
}

/** Remembers the player's choice ('auto' forgets it). */
export function saveQuality(level: QualityLevel | 'auto'): void {
  try {
    if (level === 'auto') localStorage.removeItem(QUALITY_KEY);
    else localStorage.setItem(QUALITY_KEY, level);
  } catch {
    /* the choice lasts for this visit only */
  }
}

type Mode = 'title' | 'creator' | 'playing';

/** Something usable next to the player besides characters and buildings. */
type Near = { kind: 'treasure'; id: string } | { kind: 'friend'; id: string } | { kind: 'door'; id: InteriorId } | { kind: 'spot'; room: InteriorId; spot: string } | { kind: 'curio'; id: string } | { kind: 'biz' } | { kind: 'robot' };

const nearKey = (n: Near | null): string | null =>
  !n ? null : n.kind === 'treasure' ? `treasure:${n.id}` : n.kind === 'friend' ? `friend:${n.id}` : n.kind === 'door' ? `door:${n.id}` : n.kind === 'spot' ? `spot:${n.spot}` : n.kind === 'biz' ? 'biz' : n.kind === 'robot' ? 'robot' : `curio:${n.id}`;

/** Where a new player appears: the plaza, facing the stock exchange. */
/** The close, low over-the-shoulder view of the reference art. */
const VIEW = { dist: 5.4, portrait: 7, pitch: 0.12 };
const SPAWN = { x: 0, z: 18, heading: Math.PI };
const INTERACT_RANGE = 2.6;
/** How close to the business counter the player must stand. */
const BIZ_RANGE = 2.4;
/** How many tips Bit the robot knows (robot.tip.0 ... in the locale). */
const ROBOT_TIPS = 9;
/** How close the player must be to meet Bit (he stands between benches). */
const ROBOT_RANGE = 3.6;
/** How close to someone walking in the street the player must be to talk. */
const FRIEND_RANGE = 2.4;
/** How close the player must be to start a conversation (tapping a name tag allows a bit more). */
const TALK_RANGE = 2.8;
const TAP_TALK_RANGE = 7;

/** How the player's character reacts to their own answer. */
const TONE_GESTURE: Record<Tone, OneShot> = { kind: 'nod', curious: 'think', smart: 'nod', rude: 'shake', joke: 'laugh', bye: 'wave' };
const AUTOSAVE_SECONDS = 10;
const DOOR_RANGE = 2.6;
const SPOT_RANGE = 2.2;
const CURIO_RANGE = 2.2;
const FADE_MS = 280;
/** Closer than this to a door or marker, it beats a character standing nearby. */
const THING_FIRST = 1.0;
const DOOR_FIRST = 1.9;

/**
 * Owns the renderer, scene and main loop, and wires the systems together.
 * Systems talk through the event bus so later phases (NPCs, quests, market)
 * can plug in without touching each other.
 */
export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly input = new Input();
  readonly cam: CameraController;
  readonly city: City;
  readonly atmosphere: Atmosphere;
  readonly ambient: Ambient;
  readonly player: PlayerController;
  readonly studio = new Studio();
  private extras!: PlazaExtras;
  readonly saves = new SaveStore();
  readonly hud: Hud;
  readonly npcs: Npcs;
  readonly dialog: DialogueView;
  private conv: Conversation | null = null;
  private talkingTo: NpcActor | null = null;
  private nearNpc: NpcActor | null = null;
  private dialogFocus = new THREE.Vector3();
  private errandCheck = 0;
  private data: SaveData | null;
  private mode: Mode = 'title';
  private creator: CharacterCreator | null = null;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private sinceSave = 0;
  private selection: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private nearPoi: Poi | null = null;
  private fpsFrames = 0;
  private frames = 0;
  private fpsTime = performance.now();
  fps = 0;
  readonly graphics: Graphics = loadGraphics();
  /** Characters whose realistic model has loaded. */
  private avatars: NpcId[] = [];
  /** Colour grading and bloom (vivid look only). */
  private postfx: PostFX | null = null;
  readonly interiors: Interiors;
  readonly curios: Curiosities;
  readonly card: InfoCard;
  readonly notebook: Notebook;
  private nearThing: Near | null = null;
  private fading = false;
  private fadeEl: HTMLDivElement;
  /** What the tracker line shows (and opens when tapped). */
  private trackerKind: 'quest' | 'mission' | 'errand' | 'treasure' | null = null;
  readonly questLog: QuestLog;
  readonly bag: Bag;
  readonly shop: PizzaShopView;
  private collect!: Collectibles;
  private sound!: Sound;
  private coach!: Coach;
  private coachLast = new THREE.Vector2();
  private sky!: SkyTreasure;
  private island!: IslandTreasure;
  /** How long the player has been walking into a door (walk-in entry). */
  private walkInTime = 0;
  private bizSite!: BusinessSite;
  private announcedDay = '';
  private robotTimer = 14;
  private robotHello = false;
  private heroLoaded = '';
  private eventDecor!: CityEventDecor;
  readonly biz: BusinessView;
  readonly money: MoneyView;
  readonly store: ShopView;
  /** Worn things and the pet, drawn on the hero (see world/Gear). */
  private gear: Gear;
  /** Places the tracked goal points to (live vectors for characters). */
  private goalTargets: { x: number; z: number }[] = [];
  private goalClock = 0;
  private guide: Guide;
  private goalV = new THREE.Vector3();
  private town: Townsfolk;
  private fw = new Fireworks();
  readonly missionsView: MissionView;
  readonly lifeView: LifeView;
  readonly sleepView = new SleepView();
  readonly flightView = new FlightView();
  readonly travelView: TravelView;
  readonly friendView: FriendView;
  readonly jobView: JobView;
  readonly serviceView: ServiceView;
  private serviceQueue = new ServiceQueue();
  private service: { run: ServiceRun; price: number; till: number; clock: number; empty: boolean; finish(run: ServiceRun): void } | null = null;
  private treasureMarks: TreasureMarks;
  /** The day bills were last checked (bills come once per day played). */
  private billDay = -1;
  private billClock = 0;
  private needClock = 0;
  /** Needs already hinted about while low (hinted once until they recover). */
  private needHinted = new Set<NeedId>();
  readonly settings: SettingsPanel;
  readonly complete: CompleteScreen;
  private questCheck = 0;
  /** What the player started last (leads the tracker until it ends). */
  private focus: 'quest' | 'mission' | 'errand' | 'treasure' | null = null;

  constructor(container: HTMLElement, readonly quality: QualitySettings) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // counted per frame (all post-processing passes included), not per render call
    this.renderer.info.autoReset = false;
    this.renderer.domElement.className = 'game-canvas';
    container.append(this.renderer.domElement);

    this.cam = new CameraController(this.renderer.domElement, window.innerWidth / window.innerHeight, this.input);
    const vivid = this.graphics === 'vivid';
    this.atmosphere = new Atmosphere(this.scene, this.renderer, quality.shadowMap, vivid);

    this.city = buildCity();
    if (vivid) {
      addSurfaceDetail(this.city.materials.byKey.paint as THREE.MeshStandardMaterial, 0.6, true);
      addSurfaceDetail(this.city.materials.facade, 0.4);
      this.postfx = new PostFX(this.renderer, this.scene, this.cam.camera, quality);
    }
    this.scene.add(this.city.root);
    void this.city.trees.load();
    void this.city.parked.load();
    this.cam.collision = this.city.collision;
    this.ambient = new Ambient(this.city.walkLoops, quality.level === 'high' || quality.level === 'ultra' ? 'high' : 'low');
    this.scene.add(this.ambient.group);

    this.npcs = new Npcs(this.city.pois, this.city.collision);
    this.scene.add(this.npcs.group);
    this.extras = new PlazaExtras(this.city.collision);
    this.town = new Townsfolk(PLAZA_LOOPS, this.city.walkLoops, (x, z, feet) => this.city.collision.groundHeight(x, z, feet));
    this.guide = new Guide((x, z) => this.city.collision.groundHeight(x, z, this.player.position.y + 0.3));
    this.scene.add(this.guide.group);
    this.scene.add(this.town.group);
    this.scene.add(this.extras.group);
    void this.npcs.loadAvatars(vivid).then((ids) => (this.avatars = ids));

    this.interiors = new Interiors(this.city.collision, this.city.materials, this.city.pois);
    this.curios = new Curiosities(this.city.pois, this.interiors);
    this.treasureMarks = new TreasureMarks(this.city.pois);
    this.scene.add(this.treasureMarks.group);
    this.collect = new Collectibles(this.city.layout, this.city.collision);
    this.bizSite = new BusinessSite(this.city.collision);
    this.bizSite.setStage(0, '');
    this.eventDecor = new CityEventDecor();
    this.eventDecor.show(this.cityEvent());
    this.city.root.add(this.eventDecor.group);
    this.scene.add(this.fw.group);
    this.scene.add(this.interiors.group, this.interiors.doorGroup, this.curios.group, this.collect.group, this.bizSite.group);
    const sky = this.interiors.rooms.get('skyLand')!;
    this.sky = new SkyTreasure(sky.ox, sky.oz);
    sky.group.add(this.sky.group);
    const isl = this.interiors.rooms.get('island')!;
    this.island = new IslandTreasure(isl.ox, isl.oz);
    isl.group.add(this.island.group);

    this.data = this.saves.load();
    this.player = new PlayerController(this.data?.character ?? DEFAULT_LOOK, this.input, this.city.collision);
    this.player.object.visible = false;
    const skyTramp = this.interiors.toWorld('skyLand', SKY_TRAMPOLINE.x, SKY_TRAMPOLINE.z);
    this.player.onJump = () => {
      this.sound.play('jump');
      this.coach?.did('jump');
    };
    this.player.bouncers = [
      { x: PLAZA.trampoline.x, z: PLAZA.trampoline.z, ...TRAMPOLINE },
      { ...SKY_TRAMPOLINE, ...skyTramp },
    ];
    this.player.object.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh));
    this.scene.add(this.player.object);
    this.gear = new Gear(this.player);
    this.scene.add(this.gear.group);
    // the illustrated hero replaces the built body once its model arrives
    this.loadHeroFor(this.player.look);
    this.studio.loadHero(this.player.look.hero);

    // pulsing ring under the selected building
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd96b', transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.selection.visible = false;
    this.selection.renderOrder = 2;
    this.scene.add(this.selection);

    this.sound = new Sound();
    this.hud = new Hud({
      onToggleSound: () => {
        this.sound.setMuted(!this.sound.muted);
        return this.sound.muted;
      },
      muted: () => this.sound.muted,
      camera: this.cam,
      layout: this.city.layout,
      pois: this.city.pois,
      isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
      start: {
        hasSave: !!this.data && !!this.data.character.nickname,
        nickname: this.data?.character.nickname ?? '',
        visited: this.data?.progress.visited.filter((z) => DISTRICT_IDS.includes(z)).length ?? 0,
      },
      onNewGame: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onToggleNight: () => this.setNight(!this.atmosphere.isNight),
      onSelectPoi: (id) => this.select(id),
      onTravel: (zone) => this.travelTo(zone),
      onVisitPoi: (id) => this.visitPoi(id),
      jobAt: (key) => {
        const job = JOB_BY_POI[key];
        if (!job) return null;
        const level = this.data ? levelOf(this.data.growth.xp).level : 1;
        return { locked: level < job.minLevel ? job.minLevel : null };
      },
      onWork: (key) => this.startJob(key),
      onInteract: () => this.interact(),
      onSave: () => this.save(true),
      onEditCharacter: () => this.openCreator(true),
      graphics: () => this.graphics,
      onGraphics: (g) => this.setGraphics(g),
      social: () => this.data?.social ?? null,
      friends: () => this.data?.friends ?? {},
      placeOf: (id) => t(`district.${this.npcPoi(id).zone}.name`),
      onGoToNpc: (id) => this.goToNpc(id),
      onTapNpc: (id) => this.tapNpc(id),
      onJoystick: (x, y) => this.input.setJoystick(x, y),
      onRunToggle: (on) => (this.input.runToggle = on),
      onJump: () => this.player.jump(),
      onScooter: () => this.toggleScooter(),
      onNotebook: () => this.openNotebook(),
      onTracker: () => (this.trackerKind === 'treasure' ? undefined : this.trackerKind === 'mission' ? this.openNotebook('mission') : this.trackerKind === 'quest' ? this.openPanel('quests') : this.hud.openPeople()),
      onQuests: () => this.openPanel('quests'),
      onBag: () => this.openPanel('bag'),
      onMoney: () => this.openPanel('money'),
      onSettings: () => this.openPanel('settings'),
    });
    this.coach = new Coach(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    this.hud.root.append(this.coach.el);

    this.dialog = new DialogueView({
      onChoose: (i) => this.choose(i),
      onNext: () => {
        this.conv?.next();
        this.showLine();
      },
      onClose: () => this.endTalk(),
    });
    this.hud.root.append(this.dialog.el);

    this.card = new InfoCard(() => this.hud.closeOverlays());
    this.hud.addOverlay(this.card.el, () => this.card.close());
    this.notebook = new Notebook({
      view: () => {
        const d = this.data;
        return d ? { branch: d.missions.branch, flags: d.social.flags, concepts: d.learning.concepts, curiosities: d.learning.curiosities, level: levelOf(d.growth.xp).level } : null;
      },
      onChange: () => {
        this.updateSocialUi();
        this.save(false);
      },
      onDecided: (ev) => this.onDecided(ev),
      onGoToNpc: (id) => {
        this.hud.closeOverlays();
        this.goToNpc(id);
      },
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.notebook.el, () => this.notebook.hide());
    this.questLog = new QuestLog({
      view: () => {
        const d = this.data;
        if (!d) return null;
        const errands = NPC_IDS.filter((id) => d.social.errands[id] !== 'none').map((npc) => ({ npc, state: d.social.errands[npc] as 'active' | 'ready' | 'done' }));
        const line = this.missionLine();
        return { growth: d.growth, errands, mission: line ? { line, done: d.missions.branch.status === 'done' } : null, album: d.album, today: this.today() };
      },
      onGoTo: (id) => {
        this.hud.closeOverlays();
        this.goToNpc(id);
      },
      onMission: () => this.openNotebook('mission'),
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.questLog.el, () => this.questLog.hide());
    this.shop = new PizzaShopView({
      onDayDone: (level, s) => this.onShopDay(level, s),
      onServe: (day, plan) => this.startPizzaService(day, plan),
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.shop.el, () => this.shop.close());
    this.biz = new BusinessView({
      onDay: (r, stars) => this.onBizDay(r, stars),
      onUpgrade: () => this.onBizUpgrade(),
      onTakeHome: () => this.onBizTakeHome(),
      cityEvent: () => this.cityEvent(),
      weather: () => this.cityWeather(),
      onServe: (day, plan) => this.startService(day, plan),
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.biz.el, () => this.biz.close());
    this.money = new MoneyView({
      cityEvent: () => this.cityEvent(),
      worth: () => {
        const d = this.data;
        const w = this.worthNow();
        if (!d || !w) return null;
        return { worth: w, level: levelOf(d.growth.xp).level, history: d.life.history, bills: billsFor(d.life).total };
      },
      view: () => (this.data ? { wallet: this.data.growth.coins, money: this.data.money } : null),
      commit: (wallet, money, learn) => {
        const d = this.data;
        if (!d) return;
        d.growth.coins = Math.max(0, Math.round(wallet));
        d.money = money;
        this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
        if (learn.length) this.learn(learn);
        if (learn.includes('interest')) this.coach.did('deposit');
        if (learn.includes('shares')) this.coach.did('buyShare');
        this.noteWorth();
        this.save(false);
      },
      onClose: () => this.hud.closeOverlays(),
      onTab: (tab) => tab === 'shares' && this.coach.did('sharesTab'),
    });
    this.hud.addOverlay(this.money.el, () => this.money.close());
    this.store = new ShopView({
      view: () => (this.data ? { wallet: this.data.growth.coins, level: levelOf(this.data.growth.xp).level, shop: this.data.shop } : null),
      commit: (wallet, shop, change) => this.onStore(wallet, shop, change),
      onClose: () => this.hud.closeOverlays(),
      onCarLot: () => this.openLife('car'),
    });
    this.hud.addOverlay(this.store.el, () => this.store.close());
    this.missionsView = new MissionView({
      level: () => levelOf(this.data?.growth.xp ?? 0).level,
      record: () => this.data?.missions.buildings ?? {},
      onFinish: (b, tier, answers) => this.onMissionTier(b, tier, answers),
      onClose: () => this.hud.closeOverlays(),
      decision: (b) => decisionState(this.data?.missions.decisions ?? {}, b, (this.data?.missions.buildings[b]?.[0] ?? 0) > 0, this.today()),
      onDecision: (b, k) => this.onDecision(b, k),
    });
    this.hud.addOverlay(this.missionsView.el, () => this.missionsView.close());
    this.lifeView = new LifeView({
      view: () => (this.data ? { wallet: this.data.growth.coins, level: levelOf(this.data.growth.xp).level, life: this.data.life, day: this.today() } : null),
      commit: (wallet, life, message, learn) => {
        const d = this.data;
        if (!d) return;
        d.growth.coins = Math.max(0, Math.round(wallet));
        d.life = life;
        this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
        if (learn.length) this.learn(learn);
        this.sound.play('coin');
        this.noteWorth();
        this.applyGear();
        this.save(false);
        void message;
      },
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.lifeView.el, () => this.lifeView.close());
    this.hud.addOverlay(this.sleepView.el, () => this.sleepView.finish());
    this.travelView = new TravelView({
      wallet: () => this.data?.growth.coins ?? null,
      buy: (cls) => this.buyTrip(cls),
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.travelView.el, () => this.travelView.close());
    this.hud.addOverlay(this.flightView.el, () => this.flightView.finish());
    this.friendView = new FriendView({
      view: (id) => {
        const d = this.data;
        const poi = FRIENDS[id] && this.city.pois.find((p) => p.key === FRIENDS[id].favor.poi);
        return d ? { friend: friendOf(d.friends, id), wallet: d.growth.coins, day: this.today(), place: poi ? t(`poi.${poi.key}.name`) : '' } : null;
      },
      act: (id, a) => this.friendAct(id, a),
      onClose: () => {
        this.cam.enabled = true;
      },
    });
    this.hud.addOverlay(this.friendView.el, () => this.friendView.close());
    this.jobView = new JobView({
      onShiftDone: (job, right) => this.onShiftDone(job, right),
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.jobView.el, () => this.jobView.close());
    this.serviceView = new ServiceView({
      step: (st) => this.serviceStep(st),
      serve: () => this.serviceServe(),
      end: () => this.endService(),
    });
    container.append(this.serviceView.el);
    this.scene.add(this.serviceQueue.group);
    this.bag = new Bag({ view: () => this.data?.growth ?? null, onClose: () => this.hud.closeOverlays() });
    this.hud.addOverlay(this.bag.el, () => this.bag.hide());
    this.settings = new SettingsPanel({
      view: () => this.data?.settings ?? null,
      quality: quality.level,
      onQuality: (q) => this.setQuality(q),
      onChange: (c) => this.changeSettings(c),
      onReset: () => {
        this.saves.clear();
        window.location.reload();
      },
      onClose: () => this.hud.closeOverlays(),
    });
    this.hud.addOverlay(this.settings.el, () => this.settings.hide());
    this.complete = new CompleteScreen(() => {
      if (this.playing()) this.cam.enabled = true;
    });
    this.hud.addOverlay(this.complete.el, () => this.complete.el.hidden || this.complete.close());
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'screen-fade';
    this.hud.root.append(this.fadeEl);
    this.hud.setNpcs(this.npcMarkers());

    this.cam.onTap = (x, y) => this.tap(x, y);
    this.bus.on('zone:changed', (id) => this.onZone(id));

    // title-screen view: high overview slowly orbiting
    this.cam.setState({ x: 0, z: 0, yaw: 0.6, pitch: 1.05, distance: 185 }, true);
    this.cam.attract = true;
    this.cam.enabled = false;

    window.addEventListener('resize', () => this.resize());
    // never lose progress when the tab closes or the phone switches apps
    window.addEventListener('pagehide', () => this.save(false));
    document.addEventListener('visibilitychange', () => {
      const hidden = document.visibilityState === 'hidden';
      this.sound.setHidden(hidden);
      if (hidden) this.save(false);
    });
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
    this.hud.ready();
  }

  /* ------------------------------ game flow ------------------------------ */

  private newGame(): void {
    this.saves.clear();
    this.data = null;
    this.openCreator(false, { ...randomLook(Math.random, ''), model: 'hero', hero: HERO_IDS[1 + Math.floor(Math.random() * (HERO_IDS.length - 1))] });
  }

  private continueGame(): void {
    if (!this.data) return this.newGame();
    this.player.setLook(this.data.character);
    this.player.teleport(this.data.player.x, this.data.player.z, this.data.player.heading, this.data.player.y);
    this.setNight(this.data.settings.night);
    this.atmosphere.setWeather(this.cityWeather(), true);
    this.enterCity(false);
  }

  private openCreator(editing: boolean, start?: CharacterLook): void {
    if (this.creator) return;
    this.mode = 'creator';
    this.hud.setPlaying(false);
    this.hud.closeOverlays();
    this.cam.enabled = false;
    this.input.enabled = false;
    const look = start ?? this.player.look;
    this.studio.setLook(look);
    this.creator = new CharacterCreator({
      look,
      editing,
      onChange: (l) => this.studio.setLook(l),
      onDrag: (dx) => this.studio.drag(dx),
      onDragEnd: () => this.studio.release(),
      onCancel: () => this.closeCreator(),
      onDone: (l) => {
        this.studio.wave();
        this.player.setLook(l);
        this.loadHeroFor(l);
        if (editing && this.data) {
          this.data.character = l;
          this.save(false);
          this.closeCreator();
        } else {
          this.data = newSave(l);
          this.player.teleport(SPAWN.x, SPAWN.z, SPAWN.heading);
          this.save(false);
          // a short wave on the stage, then into the city
          window.setTimeout(() => {
            this.closeCreator();
            this.enterCity(true);
          }, 700);
        }
      },
    });
    this.hud.root.append(this.creator.el);
    this.resize();
  }

  private closeCreator(): void {
    this.creator?.el.remove();
    this.creator = null;
    this.mode = 'playing';
    this.input.enabled = true;
    if (this.data) this.enterCity(false, true);
  }

  private enterCity(firstTime: boolean, quiet = false): void {
    this.mode = 'playing';
    this.input.enabled = true;
    this.cam.attract = false;
    this.cam.enabled = true;
    this.player.object.visible = true;
    this.cam.setFollow(this.player.position, this.player.height * 1.32);
    this.hud.setPlayer(this.player.position, this.player.height, this.player.look.nickname);
    this.hud.setPlaying(true);
    this.hud.setVisited(this.data?.progress.visited ?? []);
    this.syncLearning();
    this.applySettings();
    this.applyUnlocks();
    this.checkQuests();
    this.updateSocialUi();
    this.announceCityEvent();
    this.payPet();
    this.payLife();
    this.showNeeds();
    this.applyGear();
    const portrait = window.innerWidth / window.innerHeight < 0.8;
    const behind = this.player.heading + Math.PI;
    window.setTimeout(() => {
      if (this.mode !== 'playing') return;
      this.coach.start('basics');
      this.nextLesson();
    }, firstTime ? 3200 : 1500);
    if (quiet) return;
    this.cam.flyTo(this.player.position.x, this.player.position.z, portrait ? VIEW.portrait : VIEW.dist, firstTime ? 2.4 : 1.6, { yaw: behind, pitch: VIEW.pitch });
    if (firstTime) window.setTimeout(() => this.player.animator.play('wave'), 2300);
  }

  private setNight(night: boolean): boolean {
    this.atmosphere.setNight(night);
    this.hud.setNight(night);
    if (this.data) this.data.settings.night = night;
    this.bus.emit('night:changed', night);
    this.updateMusic();
    return night;
  }

  private onZone(id: ZoneId | null): void {
    if (this.mode !== 'playing' || !id || !this.data) {
      this.hud.setZone(id);
      return;
    }
    const visited = this.data.progress.visited;
    if (!visited.includes(id)) {
      visited.push(id);
      this.hud.setVisited(visited);
      if (DISTRICT_IDS.includes(id)) {
        const n = visited.filter((z) => DISTRICT_IDS.includes(z)).length;
        this.hud.setZone(id, t('hud.discovered'));
        this.hud.toast(n === DISTRICT_IDS.length ? t('hud.allDiscovered') : t('hud.discoveredCount', { n }));
        this.player.animator.play('cheer');
        this.bus.emit('zone:discovered', id);
        this.save(false);
        return;
      }
    }
    this.hud.setZone(id);
  }

  /** Writes the save. `announce` shows a confirmation toast. */
  /** New first times go into the album, with a gentle note. */
  private checkAlbum(): void {
    const d = this.data;
    if (!d) return;
    const fresh = newMoments(d.album, d);
    if (!fresh.length) return;
    d.album = addMoments(d.album, fresh, this.today());
    // after any toast of the moment itself
    window.setTimeout(() => this.hud.toast(t('album.toast', { what: t(`album.${fresh[0]}.title`) }), 3200), 2400);
  }

  save(announce: boolean): boolean {
    if (!this.data || this.mode === 'title') return false;
    const p = this.player;
    this.data.character = p.look;
    const inside = this.interiors.current;
    // indoors, remember the spot in front of the door (rooms are not a place to wake up in)
    if (inside) {
      const out = this.interiors.exit(inside);
      this.data.player = { x: out.x, y: out.y, z: out.z, heading: out.heading };
    } else this.data.player = { x: p.position.x, y: p.position.y, z: p.position.z, heading: p.heading };
    this.data.progress.metresWalked = Math.round(this.data.progress.metresWalked + p.distance);
    p.distance = 0;
    this.checkAlbum();
    const ok = this.saves.save(this.data);
    this.sinceSave = 0;
    if (announce) this.hud.toast(ok ? t('hud.saved') : t('hud.saveFailed'));
    this.bus.emit('game:saved', ok);
    return ok;
  }

  /* ---------------------------- moving around ---------------------------- */

  private travelTo(zone: ZoneId): void {
    if (this.interiors.current) this.leaveRoom(true);
    const z = this.city.layout.find((l) => l.id === zone);
    if (!z) return;
    const c = rectCenter(z.rect);
    // hubs: stand at the south edge of the plaza or park; districts: the central crossroads
    const merged = z.lots.length === 1;
    const x = c.x;
    const zz = merged ? z.rect.z1 - 6 : c.z;
    this.player.teleport(x, zz, Math.PI);
    this.cam.flyTo(this.player.position.x, this.player.position.z, VIEW.dist, 1.4, { yaw: 0, pitch: VIEW.pitch });
    this.select(null);
  }

  private visitPoi(id: string): void {
    const poi = this.city.pois.find((p) => p.id === id);
    if (!poi) return;
    if (this.interiors.current) this.leaveRoom(true);
    // stand on the sidewalk in front (south side) of the building
    this.player.teleport(poi.x, poi.z + poi.d / 2 + 1.6, Math.PI);
    this.cam.flyTo(this.player.position.x, this.player.position.z, VIEW.dist, 1.2, { yaw: 0, pitch: VIEW.pitch });
  }

  /** Distance from the player to a building's footprint. */
  private poiDistance(p: Poi): number {
    const pos = this.player.position;
    const dx = Math.max(Math.abs(pos.x - p.x) - p.w / 2, 0);
    const dz = Math.max(Math.abs(pos.z - p.z) - p.d / 2, 0);
    return Math.hypot(dx, dz);
  }

  private findNearPoi(): Poi | null {
    let best: Poi | null = null;
    let bestD = INTERACT_RANGE;
    for (const p of this.city.pois) {
      const d = this.poiDistance(p);
      // inside a footprint (open lots): prefer the smallest, most specific one
      const score = d === 0 ? -1 / (p.w * p.d) : d;
      if (score < bestD) {
        bestD = score;
        best = p;
      }
    }
    return best;
  }

  private interact(): void {
    if (this.mode !== 'playing' || this.conv || this.fading) return;
    if (this.nearNpc) return this.startTalk(this.nearNpc);
    if (this.nearThing) return this.useThing(this.nearThing);
    const poi = this.nearPoi;
    if (!poi) return;
    this.player.heading = Math.atan2(poi.x - this.player.position.x, poi.z - this.player.position.z);
    this.player.animator.play('wave');
    this.select(poi.id);
    this.bus.emit('poi:interact', poi.id);
    // the mall and the market stalls are shops
    if (poi.key === 'mall' || poi.key === 'market') this.openStore(poi.key === 'market' ? 'food' : undefined);
  }

  private openStore(tab?: ShopCategory): void {
    if (!this.data) return;
    this.hud.closeOverlays();
    this.store.show(tab);
    this.cam.enabled = false;
    this.coach.did('openStore');
  }

  /** A purchase, sale or outfit change from the shop. */
  private onStore(wallet: number, shop: ShopState, change: { bought?: string; sold?: string; equip?: string }): void {
    const d = this.data;
    if (!d) return;
    d.growth.coins = Math.max(0, Math.round(wallet));
    d.shop = shop;
    this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
    const name = (id: string) => t(`shop.item.${id}.name`);
    if (change.bought) {
      this.coach.did('buyItem');
      const item = SHOP_BY_ID[change.bought];
      this.sound.play(item.kind === 'treat' ? 'coin' : 'chest');
      if (item.kind === 'treat') {
        this.player.animator.play('cheer');
        this.hud.toast(`${item.icon} ${t('store.boughtTreat', { name: name(item.id) })}`, 2200);
        this.gear.holdTreat(item.id);
        d.needs = consume(d.needs, item.id);
        this.showNeeds();
        if (item.id === 'fireworks') {
          this.fw.show(this.player.position.x, this.player.position.z);
          this.sound.play('levelUp');
        }
        else window.setTimeout(() => this.showCard({ kind: 'curio', kicker: t('store.kicker'), title: `${item.icon} ${name(item.id)}`, body: t(`shop.item.${item.id}.fact`) }), 900);
      } else {
        this.hud.toast(`${item.icon} ${t('store.bought', { name: name(item.id) })}`, 2600);
      }
      const learn = ['expenses'];
      if (item.sameAs) learn.push('opportunityCost');
      if (item.upkeep) learn.push('fixedCost');
      this.learn(learn);
    }
    if (change.sold) this.hud.toast(t('store.sold', { n: sellPrice(SHOP_BY_ID[change.sold]) }), 3200);
    if (change.bought && SHOP_BY_ID[change.bought].furniture) {
      this.hud.toast(`${SHOP_BY_ID[change.bought].icon} ${t(d.life.home ? 'home.furnitureHome' : 'home.furnitureNoHome')}`, 3600);
    }
    this.interiors.setFurniture(d.shop.owned);
    this.applyGear();
    this.save(false);
  }

  /** Puts the bought gear on the hero (rides, and worn things as their models arrive). */
  private applyGear(): void {
    const d = this.data;
    if (!d) return;
    // the car, when owned and chosen, is the ride (the fastest one)
    const car = d.life.car?.drive;
    this.player.rideBoost = car ? 1.9 : rideSpeed(d.shop);
    this.player.walkBoost = walkSpeed(d.shop) * needSpeed(d.needs);
    this.gear.apply(car ? { ...d.shop.equipped, ride: 'car' } : d.shop.equipped);
  }

  /* ------------------------------- needs -------------------------------- */

  private showNeeds(): void {
    const d = this.data;
    if (!d) return;
    this.hud.playerCard.setNeeds(d.needs);
    this.player.walkBoost = walkSpeed(d.shop) * needSpeed(d.needs);
  }

  /** Needs go down slowly while playing; a low one gets one gentle hint until it is filled again. */
  private tickNeeds(seconds: number): void {
    const d = this.data;
    if (!d) return;
    d.needs = drain(d.needs, seconds, !!d.life.home);
    const low = lowNeeds(d.needs);
    for (const id of low) {
      if (this.needHinted.has(id)) continue;
      this.needHinted.add(id);
      const key = id === 'energy' ? (d.life.home ? 'needs.tired' : 'needs.tiredNoHome') : `needs.${id}Low`;
      this.hud.toast(t(key), 4200);
      this.player.animator.play(id === 'energy' ? 'think' : 'sad');
    }
    for (const id of [...this.needHinted]) if (!low.includes(id)) this.needHinted.delete(id);
    this.showNeeds();
  }

  /**
   * Sleep in the home: the hero lies down on the bed (or the mattress), the
   * night passes over a few seconds (or is skipped), and morning brings full
   * energy (part of it on the floor mattress).
   */
  private sleepAtHome(): void {
    const d = this.data;
    if (!d || this.sleepView.open || this.interiors.current !== 'home') return;
    const bed = d.shop.owned.includes('bed');
    const fit = FURNITURE.bed;
    const from = d.needs.energy;
    const to = Math.max(from, bed ? SLEEP_BED : SLEEP_FLOOR);
    this.hud.closeOverlays();
    // feet at the foot of the bed, head on the pillow (toward the wall)
    const foot = this.interiors.toWorld('home', fit.x, fit.z + 0.78);
    this.player.teleport(foot.x, foot.z, 0);
    this.player.lieDown(bed ? 0.55 : 0.22);
    this.cam.setState({ yaw: Math.PI * 0.62, pitch: 0.75, distance: 4.2 }, false);
    // the dog curls up on the rug beside the bed
    const nook = this.interiors.toWorld('home', fit.x + 1.0, fit.z + 1.2);
    this.gear.petJoin('sleep', new THREE.Vector3(nook.x, this.player.position.y, nook.z), Math.PI * 0.75);
    this.sleepView.show(from, to, () => {
      d.needs = sleepNeeds(d.needs, to);
      this.gear.petJoin(null);
      this.player.lieDown(null);
      const side = this.interiors.toWorld('home', fit.x + 1.1, fit.z + 0.6);
      this.player.teleport(side.x, side.z, Math.PI / 2);
      this.player.animator.play('happy');
      this.showNeeds();
      this.save(false);
      this.hud.closeOverlays();
      this.hud.toast(t(bed ? 'home.sleptBed' : 'home.sleptFloor'), 4200);
    });
  }

  /** The kitchen: tap water is free; with a fridge, a home-cooked meal costs a little. */
  private useKitchen(): void {
    const d = this.data;
    if (!d) return;
    const fridge = d.shop.owned.includes('fridge');
    // with a table, the hero takes the food to the table and eats there
    if (d.shop.owned.includes('table')) {
      const tb = FURNITURE.table;
      const at = this.interiors.toWorld('home', tb.x + 1.05, tb.z);
      const mid = this.interiors.toWorld('home', tb.x, tb.z);
      this.player.teleport(at.x, at.z, Math.atan2(mid.x - at.x, mid.z - at.z));
    }
    let text: string;
    // the dog has its own bowl beside the hero
    const side = this.player.object.localToWorld(new THREE.Vector3(0.75, 0, 0.35));
    const meal = fridge && d.growth.coins >= HOME_MEAL.price;
    this.gear.petJoin(meal ? 'eat' : 'drink', new THREE.Vector3(side.x, this.player.position.y, side.z), this.player.heading, meal ? 7 : 5);
    if (meal) {
      d.growth.coins -= HOME_MEAL.price;
      d.needs = addNeeds(d.needs, { food: HOME_MEAL.food, water: HOME_MEAL.water });
      this.gear.holdTreat('sandwich');
      text = t('home.meal', { n: HOME_MEAL.price });
      this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
    } else {
      d.needs = addNeeds(d.needs, { water: TAP_WATER });
      this.gear.holdTreat('water');
      text = t(fridge ? 'home.waterNoCoins' : 'home.waterNoFridge');
    }
    this.sound.play('coin');
    this.hud.toast(text, 4200);
    this.showNeeds();
    this.save(false);
  }

  /** Opens the home and car panel. */
  openLife(tab: LifeTab): void {
    if (!this.data) return;
    this.hud.closeOverlays();
    this.lifeView.show(tab);
    this.cam.enabled = false;
  }

  /** Where the player's money stands today (cash, savings, shares, home and car, debts). */
  worthNow(): Worth | null {
    const d = this.data;
    if (!d) return null;
    const key = dayKey(new Date());
    const savings = Math.floor(accrue(d.money.savings, key).savings.balance);
    return worth(d.life, d.growth.coins, savings, portfolioValue(d.money.portfolio, key).value, this.today());
  }

  private noteWorth(): void {
    const d = this.data;
    const w = this.worthNow();
    if (d && w) d.life = noteWorth(d.life, this.today(), w.net);
  }

  /** Home and car bills: once on each day the player plays (checked at start and when the date changes). */
  private payLife(): void {
    const d = this.data;
    if (!d) return;
    const day = this.today();
    if (day === this.billDay) return;
    this.billDay = day;
    const r = payBills(d.life, d.growth.coins, day);
    d.life = r.life;
    d.growth.coins = r.wallet;
    if (r.bills) {
      this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
      const text = r.life.unpaid > 0 ? t('life.bills.short', { n: r.bills.total, left: r.life.unpaid }) : t('life.bills.toast', { n: r.bills.total });
      window.setTimeout(() => this.hud.toast(`🏠 ${text}`, 4200), 8000);
    }
    this.noteWorth();
    this.save(false);
  }

  /** Pays pet food since the last visit (once per session start). */
  private payPet(): void {
    const d = this.data;
    if (!d) return;
    const r = payUpkeep(d.shop, d.growth.coins, dayKey(new Date()));
    if (!r.days) return;
    d.shop = r.shop;
    const pet = t(`shop.item.${d.shop.equipped.pet ?? r.shop.owned.find((o) => SHOP_BY_ID[o].slot === 'pet') ?? 'dog'}.name`);
    if (r.home) window.setTimeout(() => this.hud.toast(t('store.petHome', { name: pet }), 5200), 6000);
    else {
      d.growth.coins -= r.spent;
      window.setTimeout(() => this.hud.toast(t('store.petFed', { name: pet, n: r.spent, days: r.days }), 3600), 6000);
    }
    this.applyGear();
  }

  /* ---------------------------- characters ----------------------------- */

  private npcPoi(id: NpcId): Poi {
    return this.city.pois.find((p) => p.key === NPCS[id].home)!;
  }

  private goToNpc(id: NpcId): void {
    const room = this.interiors.current;
    if (room && INTERIORS[room].npc?.id !== id) this.leaveRoom(true);
    const a = this.npcs.get(id);
    // the first free spot around them, starting in front, close enough to talk
    let spot = { x: a.position.x, z: a.position.z + 2 };
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const x = a.position.x + Math.sin(ang) * 1.9;
      const z = a.position.z + Math.cos(ang) * 1.9;
      if (this.city.collision.isFree(x, z, 0.45, 0.4)) {
        spot = { x, z };
        break;
      }
    }
    this.player.teleport(spot.x, spot.z, Math.atan2(a.position.x - spot.x, a.position.z - spot.z));
    this.cam.flyTo(this.player.position.x, this.player.position.z, VIEW.dist, 1.2, { yaw: 0, pitch: VIEW.pitch });
    this.select(null);
  }

  private tapNpc(id: NpcId): void {
    if (this.mode !== 'playing' || this.conv) return;
    const a = this.npcs.get(id);
    if (a.distanceTo(this.player.position) <= TAP_TALK_RANGE) this.startTalk(a);
    else this.hud.toast(t('hud.tooFar'));
  }

  private startTalk(actor: NpcActor): void {
    if (!this.data || this.conv) return;
    this.select(null);
    this.hud.closeOverlays();
    this.talkingTo = actor;
    actor.talking = true;
    this.conv = new Conversation(DIALOGUES[actor.id], this.data.social, (r) => this.onSocialEffect(actor.id, r));
    this.bus.emit('npc:talk', actor.id);
    this.coach.did('talk');

    // face each other, then frame both from the side, a little behind the player
    const p = this.player.position;
    const dx = actor.position.x - p.x;
    const dz = actor.position.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    this.player.heading = Math.atan2(dx, dz);
    this.player.animator.play('wave');
    this.dialogFocus.set((p.x + actor.position.x) / 2, p.y, (p.z + actor.position.z) / 2);
    const s = this.cam.state;
    const side = Math.sin(s.yaw) * (dz / len) - Math.cos(s.yaw) * (dx / len) >= 0 ? 1 : -1;
    const cx = (dz / len) * side - (dx / len) * 0.7;
    const cz = (-dx / len) * side - (dz / len) * 0.7;
    const portrait = window.innerWidth / window.innerHeight < 0.8;
    // aim below the faces so both characters sit in the top half, above the conversation sheet
    this.cam.setFollow(this.dialogFocus, portrait ? 0.1 : 0.2);
    this.cam.enabled = false;
    this.cam.flyTo(this.dialogFocus.x, this.dialogFocus.z, portrait ? 7.5 : 6.2, 0.8, { yaw: Math.atan2(cx, cz), pitch: portrait ? 0.3 : 0.24 });
    this.hud.root.classList.add('talking');
    this.showLine();
  }

  private showLine(): void {
    const conv = this.conv;
    const actor = this.talkingTo;
    if (!conv || !actor || !this.data) return;
    if (conv.done) return this.endTalk();
    const line = conv.line;
    this.dialog.show(line, { name: this.player.look.nickname }, repLevel(this.data.social.npcs[actor.id].rep));
    actor.animator.play(line.mood);
    actor.speak(t(line.textKey).length / 55);
  }

  /** The quality level is picked at start-up too: save the game, remember the choice, reload. */
  private setQuality(q: QualityLevel | 'auto'): void {
    saveQuality(q);
    if (this.mode === 'playing') this.save(false);
    location.reload();
  }

  /** The graphics style is picked at start-up, so a change saves and reloads. */
  private setGraphics(g: Graphics): void {
    if (g === this.graphics) return;
    saveGraphics(g);
    if (this.mode === 'playing') this.save(false);
    location.reload();
  }

  private choose(index: number): void {
    const conv = this.conv;
    if (!conv) return;
    const tone = conv.line.choices.find((c) => c.index === index)?.tone;
    conv.choose(index);
    if (tone) this.player.animator.play(TONE_GESTURE[tone]);
    this.showLine();
  }

  private endTalk(): void {
    if (!this.conv) return;
    this.dialog.hide();
    // the key that closed the conversation must not reopen it on the next frame
    this.input.endFrame();
    this.hud.root.classList.remove('talking');
    if (this.talkingTo) this.talkingTo.talking = false;
    this.conv = null;
    this.talkingTo = null;
    this.cam.setFollow(this.player.position, this.player.height * 1.32);
    this.cam.enabled = true;
    this.cam.flyTo(this.player.position.x, this.player.position.z, VIEW.dist, 0.7, { yaw: this.player.heading + Math.PI, pitch: VIEW.pitch });
    this.checkErrands();
    this.updateSocialUi();
    this.save(false);
  }

  private onSocialEffect(id: NpcId, r: EffectResult): void {
    const s = this.data?.social;
    if (!s) return;
    if (r.repDelta) {
      const f = NPCS[id].gender === 'f' ? 'F' : '';
      const up = r.repDelta > 0;
      this.dialog.flashRep(t(up ? `rep.up${f}` : `rep.down${f}`, { name: t(`npc.${id}.short`) }), up);
      this.dialog.setRelation(repLevel(s.npcs[id].rep));
    }
    if (r.errand) {
      const title = t(`errand.${r.errand.npc}.title`);
      if (r.errand.state === 'active') {
        this.hud.toast(t('errand.started', { title }), 2600);
        this.focus = 'errand';
      }
      if (r.errand.state === 'done') {
        this.hud.toast(t('errand.doneToast', { title }), 2600);
        this.player.animator.play('cheer');
        this.reward(XP.errand);
      }
      this.bus.emit('errand:changed', r.errand);
    }
    if (r.flags) this.onFlags(r.flags);
    this.updateSocialUi();
  }

  /** Moves active errands to "ready" once their goal is met. */
  /** Opens the chat panel with someone walking in the street. */
  private openFriend(id: string): void {
    const d = this.data;
    if (!d || !FRIENDS[id]) return;
    this.select(null);
    this.hud.closeOverlays();
    const at = this.town.position(id);
    if (at) this.player.heading = Math.atan2(at.x - this.player.position.x, at.z - this.player.position.z);
    this.player.animator.play('wave');
    this.town.react(id, 'wave');
    if (!d.friends[id]) d.friends = { ...d.friends, [id]: friendOf(d.friends, id) };
    this.friendView.show(id);
    this.cam.enabled = false;
    if (friendLevel(friendOf(d.friends, id).points) >= TREASURE_FRIEND_LEVEL) window.setTimeout(() => this.friendPiece(id), 1400);
  }

  /* ------------------------------- jobs -------------------------------- */

  /** Starts a shift at the job in a building (the player must be there). */
  private startJob(key: string): void {
    const d = this.data;
    const job = JOB_BY_POI[key];
    const poi = this.city.pois.find((p) => p.key === key);
    if (!d || !job || !poi) return;
    const level = levelOf(d.growth.xp).level;
    if (level < job.minLevel) return;
    if (!this.interiors.current && this.poiDistance(poi) > 14) {
      this.hud.toast(t('job.goFirst'), 2600);
      return this.visitPoi(poi.id);
    }
    this.select(null);
    this.hud.closeOverlays();
    this.player.animator.play('wave');
    const practice = paidToday(d.jobs, job.id, this.today());
    this.jobView.show(job, makeShift(job, (Date.now() ^ 0x10b5) >>> 0, level >= 5), practice);
    this.cam.enabled = false;
  }

  private onShiftDone(job: JobDef, right: number): Payslip {
    const d = this.data!;
    const day = this.today();
    const slip = payslip(job, right, levelOf(d.growth.xp).level, paidToday(d.jobs, job.id, day));
    d.jobs = recordShift(d.jobs, job.id, day, right);
    d.needs = addNeeds(d.needs, { energy: -SHIFT.energy });
    this.showNeeds();
    this.reward({ coins: slip.net, xp: 10 + right * 5 });
    this.sound.play(slip.net ? 'chest' : 'success');
    this.player.animator.play('cheer');
    this.save(false);
    return slip;
  }

  /* --------------------------- working the counter --------------------------- */

  /** Opens the stand for a day the player works themselves. */
  private startService(day: BizDay, plan: BizPlan): void {
    this.biz.close();
    this.hud.closeOverlays();
    const c = this.bizSite.counter;
    const y = this.city.collision.groundHeight(c.x - 1, c.z, 1);
    this.player.setRiding(false);
    this.hud.setRiding(false);
    this.player.teleport(c.x, c.z, -Math.PI / 2);
    this.serviceQueue.setCounter(c.x, c.z, y, -1, 0);
    this.serviceCamera(c.x - 2.2, y, c.z, Math.PI / 2 + 0.55);
    this.bizSite.marker.sprite.visible = false;
    // the day's real weather shows over the stand while it is open
    this.atmosphere.setWeather(day.weather);
    const demand = bizDemand(day.stage, day.weather, day.city, plan.price);
    const run = new ServiceRun(planService(demand, (Date.now() ^ 0x5eed) >>> 0), plan.cups, RECIPES.lemonade);
    this.service = {
      run,
      price: plan.price,
      till: 0,
      clock: 0,
      empty: false,
      finish: (done) => {
        this.biz.showResult(playServedDay(day, plan, done.sold), { waited: done.leftWaiting, line: done.leftLine });
      },
    };
    this.serviceView.show(run, plan.price);
    document.body.classList.add('serving');
    this.player.animator.play('wave');
  }

  /** A shift in Marco's kitchen: the player bakes and serves at the counter. */
  private startPizzaService(day: ShopDay, plan: ShiftPlan): void {
    if (this.interiors.current !== 'pizzeria') return;
    this.shop.el.hidden = true;
    this.hud.closeOverlays();
    const me = this.interiors.toWorld('pizzeria', PIZZA_COUNTER.cook.x, PIZZA_COUNTER.cook.z);
    const q = this.interiors.toWorld('pizzeria', PIZZA_COUNTER.queue.x, PIZZA_COUNTER.queue.z);
    this.player.teleport(me.x, me.z, 0);
    this.serviceQueue.setCounter(q.x, q.z, 0.05, 0, 1);
    this.serviceCamera((me.x + q.x) / 2, 0.05, q.z + 1.2, Math.PI + 0.4);
    const run = new ServiceRun(planService(shiftDemand(day, plan.price), (Date.now() ^ 0x1771) >>> 0, PIZZA_SECONDS), plan.dough, RECIPES.pizza, PIZZA_SECONDS);
    this.service = {
      run,
      price: plan.price,
      till: 0,
      clock: 0,
      empty: false,
      finish: (done) => {
        const r = playServedShift(day, plan, done.sold);
        if (r) this.shop.showShift(r);
      },
    };
    this.serviceView.show(run, plan.price);
    document.body.classList.add('serving');
  }

  /** Frames the counter and the line above the panel (which covers the lower half on a phone). */
  private serviceCamera(x: number, y: number, z: number, yaw: number): void {
    const portrait = window.innerHeight > window.innerWidth;
    this.serviceFocus.set(x, y, z);
    this.cam.setFollow(this.serviceFocus, portrait ? -1.6 : 0.2);
    this.cam.setState({ yaw, pitch: 0.5, distance: portrait ? 10 : 8.5 }, false);
  }

  private serviceFocus = new THREE.Vector3();

  private updateService(dt: number): void {
    const sv = this.service;
    if (!sv) return;
    const run = sv.run;
    for (const e of run.update(dt)) this.onServiceEvent(e);
    this.serviceQueue.arrange(run.line.map((w) => w.order.id));
    if (run.stock <= 0 && !sv.empty) {
      sv.empty = true;
      this.serviceView.say(t('service.outOfStock'));
    }
    if ((sv.clock -= dt) <= 0) {
      sv.clock = 0.1;
      this.serviceView.render(run, sv.till);
    }
    if (run.over) this.endService();
  }

  private onServiceEvent(e: ServiceEvent): void {
    if (e.kind === 'arrive') return this.serviceQueue.arrive(e.order.id, e.order.look);
    if (e.kind === 'served') return this.serviceQueue.leave(e.order.id, true);
    this.serviceQueue.leave(e.order.id, false);
    this.serviceView.say(t(e.why === 'line' ? 'service.leftLine' : e.why === 'empty' ? 'service.leftEmpty' : 'service.leftWaited'));
  }

  private serviceStep(st: RecipeStep): boolean {
    const sv = this.service;
    if (!sv) return false;
    const ok = sv.run.step(st);
    if (ok) {
      this.sound.play('click');
      this.player.animator.play('nod');
    }
    this.serviceView.render(sv.run, sv.till);
    return ok;
  }

  private serviceServe(): void {
    const sv = this.service;
    if (!sv) return;
    const e = sv.run.serve();
    if (!e) return;
    this.onServiceEvent(e);
    if (e.kind === 'served') {
      const pay = e.cups * sv.price;
      sv.till += pay;
      this.sound.play('coin');
      this.player.animator.play('happy');
      this.serviceView.say(t('service.paid', { n: pay }));
    }
    this.serviceView.render(sv.run, sv.till);
  }

  /** Closes the stand: everyone still waiting goes home, and the day is counted. */
  private endService(): void {
    const sv = this.service;
    if (!sv) return;
    for (const e of sv.run.close()) this.onServiceEvent(e);
    this.service = null;
    this.serviceView.hide();
    this.bizSite.marker.sprite.visible = true;
    this.atmosphere.setWeather(this.cityWeather());
    this.cam.setFollow(this.player.position, this.player.height * 1.32);
    document.body.classList.remove('serving');
    sv.finish(sv.run);
    this.cam.enabled = false;
  }

  /** The mall's escalators carry whoever stands on them. */
  private rideEscalator(dt: number): void {
    const room = this.interiors.toWorld('mall', 0, 0);
    const p = this.player.position;
    const lx = p.x - room.x;
    const lz = p.z - room.z;
    for (const e of ESCALATORS) {
      if (Math.abs(lx - e.x) > ESCALATOR.width / 2 || lz < ESCALATOR.zTop - 0.1 || lz > ESCALATOR.zBottom + (e.dir === 'up' ? 0.9 : 0.1)) continue;
      // only when actually on the steps (not walking past underneath)
      if (Math.abs(p.y - escalatorHeight(lz)) > 0.7) continue;
      p.z += (e.dir === 'up' ? -1 : 1) * ESCALATOR.speed * dt;
      // keep to the middle of the steps
      p.x += (room.x + e.x - p.x) * Math.min(1, dt * 3);
    }
  }

  /** A friend hands over the map piece they found (when that piece is the next one). */
  private friendPiece(id: string): void {
    const d = this.data;
    if (!d || nextStep(d.treasure)?.kind !== 'friend') return;
    this.friendView.close();
    this.town.react(id, 'cheer');
    this.takeTreasure('friend', t(`friend.${id}.name`));
  }

  /** Walking into a glowing map piece picks it up. */
  private checkTreasure(): void {
    const d = this.data;
    const at = this.treasureMarks.position;
    if (!d || !at || this.interiors.current || this.hud.overlayOpen || nextStep(d.treasure)?.kind !== 'free') return;
    const p = this.player.position;
    if (Math.hypot(p.x - at.x, p.z - at.z) < 1.5) this.takeTreasure(this.treasureMarks.id!);
  }

  /** Takes the next treasure step: a piece, the chest or the vault. */
  private takeTreasure(id: string, from?: string): void {
    const d = this.data;
    if (!d) return;
    const step = nextStep(d.treasure);
    const r = take(d.treasure, id, d.growth.coins);
    if (!r) {
      if (step?.kind === 'chest' && step.id === id) {
        this.player.animator.play('think');
        this.showCard({ kind: 'info', kicker: t('treasure.kicker'), title: t('treasure.fountain.next'), body: t('treasure.chestShort', { n: (step.price ?? 0) - d.growth.coins }) });
      }
      return;
    }
    d.treasure = r.state;
    d.growth.coins -= r.cost;
    this.reward({ coins: r.coins, xp: r.xp });
    this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
    const done = treasureDone(d.treasure);
    const next = nextStep(d.treasure);
    this.sound.play(done ? 'levelUp' : 'chest');
    this.player.animator.play('cheer');
    if (done) {
      this.fw.show(this.player.position.x, this.player.position.z);
      this.learn(['interest', 'savings']);
    }
    this.focus = 'treasure';
    this.treasureMarks.show(next);
    const n = piecesFound(d.treasure);
    if (!done) this.hud.toast(t('treasure.pieceToast', { n }), 2200);
    const body = [from ? `${from}: ` : '', t(`treasure.${r.step.id}.body`), r.cost ? ` ${t('treasure.chestPaid', { n: r.coins })}` : ''].join('');
    this.showCard({
      kind: 'curio',
      kicker: t('treasure.kicker'),
      title: t(`treasure.${r.step.id}.title`),
      body,
      note: done ? t('treasure.done') : `${t('treasure.count', { n })} · ${t(`treasure.${next!.id}.next`)}`,
    });
    this.updateSocialUi();
    this.save(false);
  }

  private friendAct(id: string, a: FriendAction): string | null {
    const d = this.data;
    if (!d) return null;
    const name = t(`friend.${id}.name`);
    const day = this.today();
    let change: FriendChange | null = null;
    let say: string | null = null;
    switch (a) {
      case 'chat': {
        change = chat(d.friends, id, day);
        say = change.gained ? t(`town.${id}.${(friendOf(d.friends, id).points + day) % TOWN_LINES}`) : t('friend.chatted');
        if (change.gained) this.hud.toast(`💛 ${t('friend.chatGain', { n: change.gained })}`, 1600);
        break;
      }
      case 'gift': {
        const g = giveGift(d.friends, id, d.growth.coins, day);
        if (!g) return null;
        change = g;
        d.growth.coins -= g.cost;
        this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
        this.sound.play('coin');
        say = `${FRIENDS[id].gift.icon} ${gendered(id, 'friend.thanks')}`;
        this.town.react(id, 'happy');
        break;
      }
      case 'favorTake':
        d.friends = startFavor(d.friends, id);
        say = t('friend.favorThanks');
        this.player.animator.play('nod');
        break;
      case 'favorReport': {
        const f = finishFavor(d.friends, id);
        if (!f) return null;
        change = f;
        this.reward({ coins: f.coins, xp: f.xp });
        this.sound.play('chest');
        this.player.animator.play('cheer');
        this.town.react(id, 'cheer');
        say = t(`friend.${id}.favorDone`);
        this.hud.toast(`🤝 ${t('friend.favorPaid', { coins: f.coins, xp: f.xp })}`, 2600);
        break;
      }
      case 'present': {
        const s = takePresent(d.friends, id);
        if (!s) return null;
        d.friends = s;
        this.reward(BEST_GIFT);
        this.sound.play('chest');
        this.player.animator.play('cheer');
        this.town.react(id, 'cheer');
        say = t(`friend.${id}.present`);
        this.hud.toast(gendered(id, 'friend.presentGot', { name, coins: BEST_GIFT.coins }), 3200);
        break;
      }
    }
    if (change) {
      d.friends = change.state;
      if (friendLevel(friendOf(d.friends, id).points) >= TREASURE_FRIEND_LEVEL) window.setTimeout(() => this.friendPiece(id), 900);
      if (change.levelUp !== null) {
        this.sound.play('levelUp');
        this.town.react(id, 'cheer');
        this.hud.toast(t('friend.levelUp', { name, level: t(`friend.level.${change.levelUp}`) }), 3200);
      }
    }
    this.save(false);
    return say;
  }

  /** A favour asks the player to visit a place: arriving there makes it ready to report. */
  private checkFavors(): void {
    const d = this.data;
    if (!d || this.interiors.current) return;
    for (const [id, f] of Object.entries(d.friends)) {
      if (f.favor !== 'active') continue;
      const key = FRIENDS[id]?.favor.poi;
      const poi = key ? this.city.pois.find((p) => p.key === key) : null;
      if (!poi || this.poiDistance(poi) > INTERACT_RANGE + 2) continue;
      d.friends = reachPlace(d.friends, key!).state;
      this.sound.play('coin');
      this.hud.toast(t('friend.favorToast', { place: t(`poi.${key}.name`), name: t(`friend.${id}.name`) }), 3600);
      this.save(false);
    }
  }

  private checkErrands(): void {
    const s = this.data?.social;
    if (!s) return;
    let changed = false;
    for (const id of NPC_IDS) {
      if (s.errands[id] !== 'active') continue;
      const goal = ERRANDS[id].goal;
      let met = false;
      if (goal.kind === 'visit') {
        const poi = this.city.pois.find((p) => p.key === goal.poi);
        met = !!poi && this.poiDistance(poi) < VISIT_RANGE;
      } else if (goal.kind === 'flag') met = hasFlag(s, goal.flag);
      else met = metCount(s) >= goal.count;
      if (met) {
        s.errands[id] = 'ready';
        this.focus = 'errand';
        changed = true;
        this.hud.toast(t('errand.readyToast', { name: t(`npc.${id}.short`) }), 2600);
        this.bus.emit('errand:changed', { npc: id, state: 'ready' });
      }
    }
    if (changed) {
      this.updateSocialUi();
      this.save(false);
    }
  }

  private npcMarkers(): NpcMarker[] {
    const s = this.data?.social;
    return this.npcs.actors.map((a) => {
      const id = a.id;
      let mark: NpcMarker['mark'] = '';
      if (s) {
        const crossMaya = id === 'nina' && s.errands.maya === 'active' && !hasFlag(s, 'nina.toldMaya');
        const crossLeo = id === 'marco' && s.errands.leo === 'active' && !hasFlag(s, 'marco.rumorChecked');
        const b = this.data!.missions.branch;
        const advisor = ADVISORS.find((x) => x.id === id && x.key);
        const missionTalk =
          (id === 'marco' && ((b.status === 'done' && !hasFlag(s, 'branch.thanked')) || (b.status === 'locked' && s.npcs.marco.met))) ||
          (!!advisor && b.status === 'active' && !hasFlag(s, advisor.flag));
        const questTalk = this.questNpc() === id;
        if (s.errands[id] === 'ready') mark = '?';
        else if (questTalk || !s.npcs[id].met || crossMaya || crossLeo || s.errands[id] === 'none' || missionTalk) mark = '!';
      }
      return { id, pos: a.position, height: a.height, color: NPCS[id].color, met: !!s?.npcs[id].met, mark };
    });
  }

  /** Name-tag marks, the errand tracker and minimap targets. */
  private updateSocialUi(): void {
    this.hud.setNpcs(this.npcMarkers());
    const s = this.data?.social;
    if (!s) return this.hud.setTracker(null);
    const ready = NPC_IDS.find((id) => s.errands[id] === 'ready');
    const active = NPC_IDS.find((id) => s.errands[id] === 'active');
    const focus = ready ?? active;
    const mission = this.missionLine();
    const quest = questTracker(this.data!.growth);
    // Marco's mission outranks errands (as before); a quest leads when it was started last or nothing else runs
    const runningMission = mission && this.data!.missions.branch.status !== 'done' ? mission : null;
    if (ready && !(quest && this.focus === 'quest')) this.trackerKind = 'errand';
    else if (quest && (this.focus === 'quest' || (!runningMission && !(this.focus === 'errand' && active)))) this.trackerKind = 'quest';
    else if (mission) this.trackerKind = 'mission';
    else if (focus) this.trackerKind = 'errand';
    else this.trackerKind = quest ? 'quest' : null;
    // the treasure leads once a piece was found, while it was the last thing touched or nothing else runs
    const tr = this.data!.treasure;
    const trStep = tr.step > 0 ? nextStep(tr) : null;
    if (trStep && (this.focus === 'treasure' || this.trackerKind === null)) this.trackerKind = 'treasure';
    if (this.trackerKind === 'treasure') this.hud.setTracker(t('treasure.tracker'), `${t('treasure.count', { n: piecesFound(tr) })} · ${t(`treasure.${trStep!.id}.next`)}`, trStep!.kind === 'vault');
    else if (this.trackerKind === 'quest') this.hud.setTracker(quest!.title, quest!.goal);
    else if (this.trackerKind === 'mission') this.hud.setTracker(t('mission.tracker'), mission!, this.data!.missions.branch.status === 'done');
    else if (focus) {
      this.hud.setTracker(t(`errand.${focus}.title`), ready ? t('errand.ready', { name: t(`npc.${focus}.short`) }) : t(`errand.${focus}.goal`), !!ready);
    } else this.hud.setTracker(null);
    const targets: { x: number; z: number }[] = [];
    for (const id of NPC_IDS) {
      const state = s.errands[id];
      if (state === 'ready') targets.push(this.npcs.get(id).position);
      if (state !== 'active') continue;
      const goal = ERRANDS[id].goal;
      if (goal.kind === 'visit') {
        const poi = this.city.pois.find((p) => p.key === goal.poi);
        if (poi) targets.push({ x: poi.x, z: poi.z });
      } else if (id === 'maya' && !hasFlag(s, 'nina.toldMaya')) targets.push(this.npcs.get('nina').position);
      else if (id === 'leo' && !hasFlag(s, 'marco.rumorChecked')) targets.push(this.npcs.get('marco').position);
    }
    const missionTargets = this.missionTargets();
    const questTargets = this.questTargets();
    targets.push(...missionTargets, ...questTargets);
    const tpos = this.treasureMarks.position;
    if (tpos && tr.step > 0) targets.push(tpos);
    this.hud.setMapTargets(targets);
    // the one goal the tracker talks about (the guide and the distance follow it)
    if (this.trackerKind === 'treasure') this.goalTargets = tpos ? [tpos] : [];
    else if (this.trackerKind === 'quest') this.goalTargets = questTargets;
    else if (this.trackerKind === 'mission') this.goalTargets = missionTargets;
    else if (focus) this.goalTargets = this.errandTargets(focus);
    else this.goalTargets = [];
    this.updateProgressUi();
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.postfx?.setSize(w, h);
    this.cam.resize(w / h);
    const wide = w > 760;
    this.studio.layout(w, h, wide ? { side: 'right', size: Math.min(0.55, 460 / w) } : { side: 'bottom', size: 0.56 });
  }

  private tap(clientX: number, clientY: number): void {
    if (this.mode !== 'playing') return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.cam.camera);
    const hit = this.raycaster.intersectObjects(this.city.hitboxes, false)[0];
    this.select(hit ? (hit.object.userData.poiId as string) : null);
  }

  select(id: string | null): void {
    const poi = id ? (this.city.pois.find((p) => p.id === id) ?? null) : null;
    this.hud.showPoi(poi);
    this.selection.visible = !!poi;
    if (poi) {
      this.selection.userData.radius = Math.max(poi.w, poi.d) * 0.62;
      this.selection.position.set(poi.x, 0.45, poi.z);
    }
    this.bus.emit('poi:selected', poi?.id ?? null);
  }

  private lastZone: ZoneId | null | undefined = undefined;

  /** The music follows the area, the time of day and the room. */
  private updateMusic(): void {
    this.sound.setTheme(themeFor({ zone: this.lastZone ?? null, room: this.interiors.current, night: this.atmosphere.isNight }));
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += dt;

    if (this.mode === 'creator') {
      this.studio.update(dt, this.elapsed);
      this.renderer.info.reset();
      this.renderer.render(this.studio.scene, this.studio.camera);
      this.input.endFrame();
      return;
    }

    const playing = this.mode === 'playing';
    if (playing) {
      const blocked = this.hud.overlayOpen || this.dialog.open || this.fading || !!this.service;
      this.player.frozen = blocked;
      this.player.update(dt, this.cam.state.yaw);
      this.gear.update(dt);
      if (!blocked && !this.conv && (this.needClock += dt) >= 1) {
        this.tickNeeds(this.needClock);
        this.needClock = 0;
      }
      if ((this.billClock -= dt) <= 0) {
        // a new day can start while playing
        this.billClock = 30;
        this.payLife();
      }
      if ((this.goalClock -= dt) <= 0) {
        this.goalClock = 0.4;
        const g = this.goalTarget();
        this.hud.setTrackerDistance(g ? Math.hypot(g.x - this.player.position.x, g.z - this.player.position.z) : null);
        this.guide.setTarget(g);
      }
      const guideOn = this.data?.settings.guide !== false && !this.conv;
      this.guide.update(dt, this.player.position, guideOn);
      this.updateGoalArrow(guideOn);
      this.nearNpc = this.conv ? null : this.npcs.nearest(this.player.position, TALK_RANGE);
      this.nearThing = this.conv ? null : this.findNearThing();
      // characters come first, unless the player stands right at a door or marker
      if (this.nearNpc && this.nearThing) {
        const at = this.thingPos(this.nearThing);
        // a door wins whenever the player stands at it (hosts wait right outside their buildings)
        if (at && Math.hypot(at.x - this.player.position.x, at.z - this.player.position.z) < (this.nearThing.kind === 'door' ? DOOR_FIRST : THING_FIRST)) this.nearNpc = null;
        else this.nearThing = null;
      }
      this.nearPoi = this.nearNpc || this.nearThing || this.conv || this.interiors.current ? null : this.findNearPoi();
      // Space talks or enters when a character or door is near, and jumps otherwise
      // (places on the map are opened with E only, so Space still jumps in busy streets)
      const canUse = !!(this.nearNpc || this.nearThing);
      if (!blocked && (this.input.wasPressed('KeyE') || this.input.wasPressed('Enter') || (canUse && this.input.wasPressed('Space')))) this.interact();
      else if (!blocked && this.input.wasPressed('Space')) this.player.jump();
      if (!blocked && this.input.wasPressed('KeyF')) this.hud.setRiding(this.toggleScooter());
      if (!blocked) this.walkIn(dt);
      if (this.interiors.current === 'mall') this.rideEscalator(dt);
      this.updateService(dt);
      this.serviceQueue.update(dt);
      if (this.conv || this.sleepView.open || this.flightView.open) this.hud.setPrompt(null);
      else if (this.nearNpc) this.hud.setPrompt({ id: `npc:${this.nearNpc.id}`, text: t('hud.talk', { name: t(`npc.${this.nearNpc.id}.short`) }) });
      else if (this.nearThing) this.hud.setPrompt(this.thingPrompt(this.nearThing));
      else if (this.nearPoi) this.hud.setPrompt({ id: this.nearPoi.id, text: t('hud.interact', { name: t(`poi.${this.nearPoi.key}.name`) }) });
      else this.hud.setPrompt(null);
      this.errandCheck -= dt;
      if (this.errandCheck <= 0) {
        this.errandCheck = 0.3;
        this.checkErrands();
        this.checkFavors();
        this.checkTreasure();
      }
      this.questCheck -= dt;
      if (this.questCheck <= 0 && !this.conv) {
        this.questCheck = 0.25;
        this.checkQuests();
      }
      this.sinceSave += dt;
      if (this.data) this.data.progress.playSeconds += dt;
      if (this.sinceSave > AUTOSAVE_SECONDS) this.save(false);
    }
    this.npcs.update(dt, playing ? this.player.position : null);
    this.extras.update(dt, playing && !this.interiors.current ? this.player.position : null);
    this.town.update(dt, playing && !this.interiors.current ? this.player.position : null);
    const outdoors = playing && !this.interiors.current;
    const bot = this.extras.buddy;
    if (bot.object) bot.object.visible = !this.interiors.current;
    bot.update(dt, outdoors ? { position: this.player.position, heading: this.player.heading, speed: this.player.speed } : null);
    if (outdoors && bot.following) this.robotChat(dt);
    else if (outdoors && bot.object && !this.robotHello && Math.hypot(this.player.position.x - bot.position.x, this.player.position.z - bot.position.z) < 7) {
      // the first time the player walks by, Bit calls out so it is clear he can be met
      this.robotHello = true;
      bot.say(t('robot.hello'), 5);
    }
    this.cam.update(dt);
    const focus = playing ? this.player.position : this.cam.target;
    this.atmosphere.follow(focus, playing ? 60 : this.cam.state.distance);
    this.atmosphere.setIndoors(!!this.interiors.current);
    if (this.atmosphere.update(dt)) {
      this.city.setNight(this.atmosphere.nightAmount);
      this.ambient.setNight(this.atmosphere.nightAmount);
    }
    this.city.update(this.elapsed, dt);
    if (!this.interiors.current) this.city.models.update(focus);
    this.collect.group.visible = !this.interiors.current;
    this.bizSite.group.visible = !this.interiors.current;
    this.bizSite.update(this.elapsed, dt, this.nearThing?.kind === 'biz');
    this.fw.update(dt);
    if (this.coach.active) {
      const step = this.coach.step_;
      if (step === 'goBiz' && this.nearThing?.kind === 'biz') this.coach.did('goBiz');
      // Bit calls out while the player is looking for it
      if (step === 'findBit' && !this.extras.buddy.following && !this.extras.buddy.bubble) this.extras.buddy.say(t('robot.callOut'), 3);
    }
    if (this.coach.active && playing) {
      const p = this.player.position;
      const step = Math.hypot(p.x - this.coachLast.x, p.z - this.coachLast.y);
      // capped, so a teleport or a slow frame counts as a short walk
      this.coach.moved(Math.min(step, 2));
      this.coachLast.set(p.x, p.z);
    }
    const found = this.collect.update(this.elapsed, dt, playing && !this.interiors.current ? this.player.position : null);
    if (found.length) this.onFound(found);
    if (this.interiors.current === 'skyLand') {
      const got = this.sky.update(this.elapsed, dt, playing ? this.player.position : null);
      if (got.length) this.onSkyFound(got);
    }
    if (this.interiors.current === 'island') {
      const got = this.island.update(this.elapsed, dt, playing ? this.player.position : null);
      if (got.length) this.onIslandFound(got);
    }
    const near = nearKey(this.nearThing);
    this.interiors.update(this.elapsed, dt, this.cam.camera, near);
    this.curios.update(this.elapsed, this.interiors.current, this.nearThing?.kind === 'curio' ? this.nearThing.id : null);
    const tpos = this.treasureMarks.position;
    if (tpos) this.treasureMarks.update(this.elapsed, this.city.collision.groundHeight(tpos.x, tpos.z, 1));
    this.ambient.update(this.elapsed, dt, playing ? this.player.position : null);
    const said = playing && !this.conv && !this.interiors.current && this.data?.settings.bubbles !== false ? this.ambient.crowd.bubble() : null;
    const local = playing && !this.conv && !this.interiors.current && this.data?.settings.bubbles !== false ? this.town.bubble() : null;
    this.hud.setBubble(bot.bubble ?? (local && { x: local.x, y: local.y, z: local.z, text: t(local.key) }) ?? (said && { x: said.x, y: said.y, z: said.z, text: t(`crowd.line.${said.line}`) }));

    const zone = zoneAt(this.city.layout, focus.x, focus.z)?.id ?? null;
    if (!this.interiors.current && zone !== this.lastZone) {
      this.lastZone = zone;
      this.updateMusic();
      this.bus.emit('zone:changed', zone);
    }
    if (this.selection.visible) {
      const r = this.selection.userData.radius * (1 + Math.sin(this.elapsed * 4) * 0.04);
      this.selection.scale.set(r, 1, r);
    }

    this.renderer.info.reset();
    if (this.postfx) this.postfx.render(dt);
    else this.renderer.render(this.scene, this.cam.camera);
    this.hud.update(this.cam.camera, window.innerWidth, window.innerHeight);
    this.input.endFrame();

    this.frames++;
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsTime >= 1000) {
      this.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsTime));
      this.fpsFrames = 0;
      this.fpsTime = now;
    }
  }

  /* ------------------------- buildings and learning ------------------------ */

  private findNearThing(): Near | null {
    const p = this.player.position;
    const room = this.interiors.current;
    const it = this.interiors.nearest(p, room ? SPOT_RANGE : DOOR_RANGE);
    if (it) return it.kind === 'door' ? { kind: 'door', id: it.id } : { kind: 'spot', room: it.room, spot: it.spot };
    const c = this.curios.nearest(p, CURIO_RANGE, room);
    if (c) return { kind: 'curio', id: c };
    const bc = this.bizSite.counter;
    if (!room && Math.hypot(p.x - bc.x, p.z - bc.z) < BIZ_RANGE) return { kind: 'biz' };
    const bot = this.extras.buddy;
    if (!room && !bot.following && bot.object && Math.hypot(p.x - bot.position.x, p.z - bot.position.z) < ROBOT_RANGE) return { kind: 'robot' };
    const tp = room ? null : this.treasureMarks.position;
    const tid = this.treasureMarks.id;
    const tstep = nextStep(this.data?.treasure ?? { step: 0 });
    if (tp && tid && tstep && tstep.kind !== 'free' && Math.hypot(p.x - tp.x, p.z - tp.z) < (tstep.kind === 'vault' ? 3.6 : 2.2)) return { kind: 'treasure', id: tid };
    const f = room ? null : this.town.nearest(p, FRIEND_RANGE);
    if (f) return { kind: 'friend', id: f.id };
    return null;
  }

  /**
   * Walking into a door goes in (and into a room's doorway goes out), and
   * stepping into a portal goes through it, so E is not needed.
   */
  private walkIn(dt: number): void {
    const n = this.nearThing;
    const at = n && this.thingPos(n);
    if (!n || !at || this.fading || this.conv) {
      this.walkInTime = 0;
      return;
    }
    const p = this.player.position;
    const dist = Math.hypot(at.x - p.x, at.z - p.z);
    const v = this.player.moving;
    const portal = (n.kind === 'door' && INTERIORS[n.id].at) || (n.kind === 'spot' && (n.spot === 'portal' || (n.room === 'skyLand' && n.spot === 'exit')));
    let go = false;
    if (portal) go = dist < 1.3;
    // building doors face +z: walking toward -z goes in; a room's exit is at its +z wall
    else if (n.kind === 'door') go = dist < 1.4 && v.y < -1.2;
    else if (n.kind === 'spot' && n.spot === 'exit') go = dist < 1.6 && v.y > 1.2;
    this.walkInTime = go ? this.walkInTime + dt : 0;
    if (this.walkInTime > (portal ? 0.05 : 0.3)) {
      this.walkInTime = 0;
      this.useThing(n);
    }
  }

  /** Coins and the treasure chest in Cloud Land. */
  private onSkyFound(events: SkyEvent[]): void {
    const d = this.data;
    if (!d) return;
    for (const e of events) {
      if (!d.found.includes(e.id)) d.found.push(e.id);
      if (e.kind === 'coin') {
        const all = e.count === e.total;
        this.reward({ coins: 1, xp: all ? 40 : 3 });
        this.sound.play('coin');
        this.hud.toast(all ? t('sky.allCoins', { total: e.total }) : t('sky.coin', { n: e.count, total: e.total }), all ? 2800 : 900);
      } else {
        this.reward({ coins: SKY_CHEST.coins, xp: 60 });
        this.sound.play('chest');
        this.player.animator.play('cheer');
        this.showCard({ kind: 'curio', kicker: t('chest.kicker'), title: t('sky.chestTitle', { coins: SKY_CHEST.coins }), body: t('sky.chestBody') });
        this.learn(['interest', 'savings']);
      }
    }
    this.save(false);
  }

  /** Gold coins and the volcano chest on Adventure Island. */
  private onIslandFound(events: SkyEvent[]): void {
    const d = this.data;
    if (!d) return;
    for (const e of events) {
      if (!d.found.includes(e.id)) d.found.push(e.id);
      if (e.kind === 'coin') {
        const all = e.count === e.total;
        this.reward({ coins: 1, xp: all ? 40 : 3 });
        this.sound.play('coin');
        this.hud.toast(all ? t('island.allCoins', { total: e.total }) : t('island.coin', { n: e.count, total: e.total }), all ? 2800 : 900);
      } else {
        this.reward({ coins: ISLAND_CHEST.coins, xp: 60 });
        this.sound.play('chest');
        this.player.animator.play('cheer');
        this.showCard({ kind: 'curio', kicker: t('chest.kicker'), title: t('island.chestTitle', { coins: ISLAND_CHEST.coins }), body: t('island.chestBody') });
        this.learn(['opportunityCost']);
      }
    }
    this.save(false);
  }

  /** The travel agency in the mall. */
  private openTravel(): void {
    if (!this.data) return;
    this.hud.closeOverlays();
    this.travelView.show();
    this.cam.enabled = false;
  }

  /** Pays for a ticket and flies to Adventure Island. */
  private buyTrip(cls: TripClass): void {
    const d = this.data;
    if (!d || this.flightView.open) return;
    const r = buyTicket(d.growth.coins, cls);
    if (!r.ok) return;
    d.growth.coins = r.wallet;
    this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
    this.sound.play('coin');
    this.learn(['opportunityCost', 'savings']);
    this.noteWorth();
    this.save(false);
    this.hud.closeOverlays();
    this.cam.enabled = false;
    this.flightView.show(false, cls, () => {
      this.hud.closeOverlays();
      this.enterRoom('island');
    });
  }

  /** Boards the plane on the island and flies back to the mall's travel agency (the return ticket is included). */
  private flyHome(): void {
    if (!this.data || this.flightView.open || this.interiors.current !== 'island') return;
    this.hud.closeOverlays();
    this.cam.enabled = false;
    this.sound.play('door');
    this.flightView.show(true, null, () => {
      this.hud.closeOverlays();
      this.enterRoom('mall', { x: 7.4, z: -4.6, heading: Math.PI });
      window.setTimeout(() => this.hud.toast(t('island.welcomeHome'), 3600), 900);
    });
  }

  /** A coconut drink at the beach stand: a little spending on holiday. */
  private buyCoconut(): void {
    const d = this.data;
    if (!d) return;
    if (d.growth.coins < COCONUT.price) {
      this.hud.toast(t('island.coconutNoCoins', { n: COCONUT.price }), 3200);
      return;
    }
    d.growth.coins -= COCONUT.price;
    d.needs = addNeeds(d.needs, { water: COCONUT.water, food: COCONUT.food });
    this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
    this.sound.play('coin');
    this.player.animator.play('happy');
    this.hud.toast(t('island.coconutBought', { n: COCONUT.price }), 3600);
    this.showNeeds();
    this.save(false);
  }

  private thingPos(n: Near): { x: number; z: number } | null {
    if (n.kind === 'friend') return this.town.position(n.id);
    if (n.kind === 'treasure') return this.treasureMarks.position;
    if (n.kind === 'door') return this.interiors.doors.find((d) => d.id === n.id) ?? null;
    if (n.kind === 'curio') return this.curios.position(n.id);
    if (n.kind === 'biz') return this.bizSite.counter;
    if (n.kind === 'robot') return this.extras.buddy.position;
    return this.interiors.marker(n.room, n.spot)?.position ?? null;
  }

  private thingPrompt(n: Near): { id: string; text: string } {
    const id = nearKey(n)!;
    if (n.kind === 'door') return { id, text: INTERIORS[n.id].at ? t('portal.prompt') : t('door.enter', { name: this.interiors.roomName(n.id) }) };
    if (n.kind === 'biz') return { id, text: t('biz.prompt') };
    if (n.kind === 'robot') return { id, text: t('robot.prompt') };
    if (n.kind === 'friend') return { id, text: t('friend.prompt', { name: t(`friend.${n.id}.name`) }) };
    if (n.kind === 'treasure') return { id, text: t(nextStep(this.data!.treasure)?.kind === 'vault' ? 'treasure.vaultPrompt' : 'treasure.chestPrompt') };
    if (n.kind === 'curio') {
      const found = this.data?.learning.curiosities.includes(n.id);
      return { id, text: found ? t(`curio.${n.id}.title`) : t('curio.prompt') };
    }
    return { id, text: n.spot === 'exit' ? t(n.room === 'skyLand' ? 'sky.exit' : 'door.exit') : t(`spot.${n.room}.${n.spot}.prompt`, { n: COCONUT.price }) };
  }

  private useThing(n: Near): void {
    if (n.kind === 'door') return this.enterRoom(n.id);
    if (n.kind === 'curio') return this.onCurio(n.id);
    if (n.kind === 'biz') return this.openBusiness();
    if (n.kind === 'robot') return this.meetRobot();
    if (n.kind === 'friend') return this.openFriend(n.id);
    if (n.kind === 'treasure') return this.takeTreasure(n.id);
    const spot = INTERIORS[n.room].hotspots.find((h) => h.id === n.spot);
    if (!spot) return;
    const m = this.interiors.marker(n.room, n.spot);
    if (m) this.player.heading = Math.atan2(m.position.x - this.player.position.x, m.position.z - this.player.position.z);
    if (spot.kind === 'exit') return this.leaveRoom();
    if (spot.kind === 'clue') return this.onClue(n.room, n.spot as ClueId);
    if (spot.kind === 'game') return this.openShop();
    if (spot.kind === 'mission') return this.openMissions(n.room as MissionBuilding);
    if (spot.kind === 'portal') return this.enterRoom('skyLand');
    if (spot.kind === 'life') return this.openLife('home');
    if (spot.kind === 'rest') return this.sleepAtHome();
    if (spot.kind === 'kitchen') return this.useKitchen();
    if (spot.kind === 'shop') return this.openStore(spot.tab);
    if (spot.kind === 'travel') return this.openTravel();
    if (spot.kind === 'fly') return this.flyHome();
    if (spot.kind === 'coconut') return this.buyCoconut();
    if (n.room === 'mall' && n.spot === 'lift' && this.data && treasureDone(this.data.treasure)) {
      this.player.animator.play('think');
      return this.showCard({ kind: 'info', kicker: t('spot.kicker'), title: t('spot.mall.lift.title'), body: t('spot.mall.lift.bodyDone') });
    }
    this.player.animator.play('think');
    this.showCard({ kind: 'info', kicker: t('spot.kicker'), title: t(`spot.${n.room}.${n.spot}.title`), body: t(`spot.${n.room}.${n.spot}.body`) });
  }

  /** Golden coins and chests the player just picked up. */
  private onFound(events: FoundEvent[]): void {
    const d = this.data;
    if (!d) return;
    for (const e of events) {
      if (!d.found.includes(e.id)) d.found.push(e.id);
      if (e.kind === 'coin') {
        const milestone = e.count % 10 === 0;
        this.reward({ coins: 1, xp: milestone ? 25 : 2 });
        this.sound.play('coin');
        this.hud.toast(milestone ? t('gold.milestone', { n: e.count, total: GOLD_TOTAL }) : t('gold.coin', { n: e.count, total: GOLD_TOTAL }), milestone ? 2600 : 900);
      } else {
        this.reward({ coins: e.coins, xp: 40 });
        this.sound.play('chest');
        this.player.animator.play('cheer');
        this.showCard({ kind: 'curio', kicker: t('chest.kicker'), title: t('chest.title', { coins: e.coins }), body: t(`chest.${e.id}`), note: t('chest.count', { n: e.count, total: this.collect.chests.length }) });
      }
    }
    this.save(false);
  }

  /** Gets on or off the kick scooter (outdoors only). Returns whether the player now rides. */
  private toggleScooter(): boolean {
    const on = !this.player.isRiding && !this.interiors.current;
    this.player.setRiding(on);
    return on;
  }

  /* ------------------------------ my business ----------------------------- */

  /** Loads the chosen ready-made hero (once per hero; the built body shows until it arrives). */
  private loadHeroFor(look: CharacterLook): void {
    const h = heroModel(look.hero);
    if (this.heroLoaded === h.id) return;
    this.heroLoaded = h.id;
    void loadAvatar(h.model)
      .then(({ scene, clips }) => {
        if (this.heroLoaded !== h.id) return;
        this.player.useHero(scene, clips, h.scale, h.walkSpeed);
        if (this.mode === 'playing') this.hud.setPlayer(this.player.position, this.player.height, this.player.look.nickname);
      })
      .catch((err) => console.warn('hero model failed to load', err));
  }

  /* ------------------------------ Bit the robot ---------------------------- */

  private meetRobot(): void {
    const d = this.data;
    if (!d) return;
    const bot = this.extras.buddy;
    this.player.heading = Math.atan2(bot.position.x - this.player.position.x, bot.position.z - this.player.position.z);
    if (!hasFlag(d.social, 'robot.friend')) d.social.flags.push('robot.friend');
    bot.follow();
    this.coach.did('findBit');
    this.player.animator.play('wave');
    this.reward({ xp: 20 });
    this.showCard({ kind: 'info', kicker: t('robot.kicker'), title: t('robot.title'), body: t('robot.body'), note: t('robot.note') });
    this.robotTimer = 14;
    this.save(false);
  }

  /** Now and then Bit says something useful: a gold coin close by, or a tip. */
  private robotChat(dt: number): void {
    this.robotTimer -= dt;
    if (this.robotTimer > 0 || this.conv || this.hud.overlayOpen) return;
    this.robotTimer = 22 + Math.random() * 14;
    const p = this.player.position;
    const found = new Set(this.collect.foundIds);
    let best: { x: number; z: number; d: number } | null = null;
    for (const c of this.collect.coins) {
      if (found.has(c.id)) continue;
      const dd = Math.hypot(c.x - p.x, c.z - p.z);
      if (dd > 4 && dd < 28 && (!best || dd < best.d)) best = { x: c.x, z: c.z, d: dd };
    }
    if (best) {
      // which way, relative to where the player faces
      const ang = Math.atan2(best.x - p.x, best.z - p.z) - this.player.heading;
      const a = Math.atan2(Math.sin(ang), Math.cos(ang));
      const dir = Math.abs(a) < 0.6 ? 'ahead' : Math.abs(a) > 2.5 ? 'behind' : a > 0 ? 'left' : 'right';
      this.extras.buddy.say(t('robot.coin', { dir: t(`robot.dir.${dir}`), m: Math.round(best.d) }), 4.5);
    } else this.extras.buddy.say(t(`robot.tip.${Math.floor(Math.random() * ROBOT_TIPS)}`), 5);
  }

  /** Today's city event (by the calendar, the same for every player). */
  /** Today's weather over the city. */
  private cityWeather(): WeatherId {
    return cityWeatherFor(dayKey(new Date()));
  }

  private cityEvent(): CityEventId {
    return cityEventFor(dayKey(new Date()));
  }

  /** Once per calendar day, a toast with the city's event and how it changes the plaza crowd. */
  private announceCityEvent(): void {
    const key = dayKey(new Date());
    if (this.announcedDay === key) return;
    this.announcedDay = key;
    // the bank pays interest for the days since the last visit
    const d = this.data;
    if (d && d.money.savings.balance > 0) {
      const { savings, earned } = accrue(d.money.savings, key);
      d.money.savings = savings;
      if (earned >= 1) window.setTimeout(() => this.hud.toast(t('money.interestPaid', { n: Math.floor(earned) }), 4200), 9000);
    }
    const ev = this.cityEvent();
    this.eventDecor.show(ev);
    const k = CITY_EVENTS[ev];
    if (k === 1) return;
    const pct = `${k > 1 ? '+' : ''}${Math.round(k * 100 - 100)}%`;
    window.setTimeout(() => this.hud.toast(`${CITY_ICON[ev]} ${t('biz.cityToday', { event: t(`city.${ev}`) })} · ${t('biz.cityEffect', { pct })}`, 5200), 3000);
  }

  private ownerName(): string {
    const nick = this.data?.character.nickname || this.player.look.nickname;
    return nick ? t('biz.boardOf', { name: nick }) : t('biz.boardDefault');
  }

  private openBusiness(): void {
    const d = this.data;
    if (!d) return;
    const c = this.bizSite.counter;
    this.player.heading = Math.atan2(c.x + 2 - this.player.position.x, c.z - this.player.position.z);
    this.hud.closeOverlays();
    this.biz.show(d.missions.business);
    this.cam.enabled = false;
    this.coach.did('openBiz');
  }

  private onBizDay(r: BizResult, stars: number) {
    this.coach.did('bizDay');
    const d = this.data!;
    d.missions.business = recordBizDay(d.missions.business, r);
    this.reward({ xp: 10 + stars * 10 });
    const concepts = ['revenue', 'expenses', 'profit', 'demand', 'inventory'];
    if (STAGE_RULES[d.missions.business.stage].fixedCost) concepts.push('fixedCost', 'variableCost');
    if (d.missions.business.stage > 0) concepts.push('risk');
    this.learn(concepts);
    this.save(false);
    return d.missions.business;
  }

  private onBizUpgrade() {
    const d = this.data!;
    const before = d.missions.business.stage;
    d.missions.business = upgrade(d.missions.business);
    const now = d.missions.business.stage;
    if (now !== before) {
      this.bizSite.setStage(now, this.ownerName(), true);
      this.player.animator.play('cheer');
      this.hud.toast(t('biz.grew', { stage: t(`biz.stage.${now}`) }), 3200);
      this.reward({ xp: 60 + now * 30 });
      this.learn(['reinvest', 'payback', 'capacity']);
      this.save(false);
    }
    return d.missions.business;
  }

  private onBizTakeHome() {
    const d = this.data!;
    const out = takeHome(d.missions.business);
    d.missions.business = out.rec;
    if (out.coins > 0) {
      this.reward({ coins: out.coins });
      this.hud.toast(t('biz.tookHome', { n: out.coins }), 2400);
      this.learn(['savings', 'opportunityCost']);
      this.save(false);
    }
    return d.missions.business;
  }

  /** The missions of a walk-in building (three tiers that open with the player's level). */
  private openMissions(b: MissionBuilding): void {
    if (!this.data) return;
    this.hud.closeOverlays();
    this.missionsView.show(b, this.interiors.roomName(b as InteriorId));
    this.cam.enabled = false;
  }

  private onMissionTier(b: MissionBuilding, tier: number, answers: number[]) {
    const d = this.data!;
    const g = gradeTier(b, tier, answers);
    const r = recordTier(d.missions.buildings, b, tier, g);
    d.missions.buildings = r.rec;
    const rules = TIER_RULES[tier];
    if (g.passed) this.sound.play('success');
    if (r.firstPass) {
      this.reward({ xp: rules.xp, coins: rules.coins });
      this.learn([...BUILDING_MISSIONS[b].tiers[tier].learn]);
      this.player.animator.play('cheer');
    }
    this.save(false);
    return { grade: g, firstPass: r.firstPass, xp: rules.xp, coins: rules.coins };
  }

  /** Today as a whole day number (decisions can be made once a day). */
  private today(): number {
    return dayIndex(dayKey(new Date()));
  }

  /** A money decision in a mission building: resolve it, pay the story coins and record it. */
  private onDecision(b: MissionBuilding, k: number) {
    const d = this.data;
    const def = DECISION_BY_BUILDING[b];
    if (!d || !def) return null;
    const day = this.today();
    const st = decisionState(d.missions.decisions, b, (d.missions.buildings[b]?.[0] ?? 0) > 0, day);
    if (st.kind !== 'open') return null;
    const result = resolveDecision(def, k, decisionSeed(day, def.id, d.missions.decisions[b]?.count ?? 0));
    const r = recordDecision(d.missions.decisions, b, day);
    d.missions.decisions = r.rec;
    const xp = r.first ? def.xp : 0;
    this.reward({ xp, coins: result.later });
    if (r.first) this.learn([...def.learn]);
    this.sound.play('coin');
    this.save(false);
    return { result, xp };
  }

  /** Marco's "run the pizzeria for a day" minigame. */
  private openShop(): void {
    const d = this.data;
    if (!d) return;
    this.hud.closeOverlays();
    this.shop.show(d.missions.pizzaShop);
    this.cam.enabled = false;
  }

  private onShopDay(level: ShopLevel, s: DaySummary): void {
    const d = this.data;
    if (!d) return;
    const rec = d.missions.pizzaShop;
    rec.days++;
    rec.best[level] = Math.max(rec.best[level], s.stars);
    this.reward({ xp: s.xp, coins: s.coins });
    const concepts = ['revenue', 'expenses', 'profit', 'demand', 'inventory'];
    if (level !== 'explorer') concepts.push('fixedCost', 'variableCost');
    if (level === 'pro') concepts.push('risk');
    this.learn(concepts);
    this.save(false);
  }

  /** A short fade to black around a change of place. */
  private fade(mid: () => void): void {
    this.fading = true;
    this.fadeEl.classList.add('on');
    window.setTimeout(() => {
      mid();
      this.fadeEl.classList.remove('on');
      window.setTimeout(() => (this.fading = false), FADE_MS);
    }, FADE_MS);
  }

  /** Goes into a room (by its door, a portal or a flight); `at` puts the player at a spot in room coordinates instead of the entry. */
  private enterRoom(id: InteriorId, at?: { x: number; z: number; heading: number }): void {
    if (!this.data || this.interiors.current === id || this.fading) return;
    if (id === 'home' && !this.data.life.home) {
      // the house is waiting: rent or buy it at the agency first
      this.showCard({ kind: 'info', kicker: t('home.kicker'), title: t('home.lockedTitle'), body: t('home.lockedBody') });
      return;
    }
    if (id === 'home') this.interiors.setFurniture(this.data.shop.owned);
    this.select(null);
    this.walkInTime = 0;
    this.fade(() => {
      // a portal inside a room leads straight on (no stop in the street)
      if (this.interiors.current) this.leaveRoom(true);
      const def = INTERIORS[id];
      this.player.setRiding(false);
      this.hud.setRiding(false);
      this.interiors.setInside(id);
      this.curios.setInside(id);
      this.treasureMarks.setInside(true);
      this.city.root.visible = false;
      this.ambient.group.visible = false;
      for (const a of this.npcs.actors) a.object.visible = a.id === def.npc?.id;
      if (def.npc) {
        const at = this.interiors.toWorld(id, def.npc.x, def.npc.z);
        this.npcs.get(def.npc.id).moveTo(at.x, at.z, def.npc.heading);
      }
      const room = this.interiors.rooms.get(id)!;
      this.player.bounds = { x0: room.ox - def.size.w / 2, z0: room.oz - def.size.d / 2, x1: room.ox + def.size.w / 2, z1: room.oz + def.size.d / 2 };
      const e = at ? { ...this.interiors.toWorld(id, at.x, at.z), heading: at.heading } : this.interiors.entry(id);
      this.player.teleport(e.x, e.z, e.heading);
      // walls fade instead of pushing the camera in
      this.cam.collision = null;
      this.cam.flyTo(e.x, e.z, 10, 0.5, { yaw: e.heading + Math.PI, pitch: 0.72 });
      this.hud.setIndoors(this.interiors.roomName(id));
      this.sound.play(id === 'skyLand' ? 'portal' : id === 'island' ? 'success' : 'door');
      this.coach.did('enter');
      this.updateMusic();
      const arrive = id === 'skyLand' ? t('sky.arrive') : id === 'island' ? t('island.arrive') : null;
      this.hud.toast(arrive ?? this.interiors.roomName(id), arrive ? 3600 : undefined);
      if (arrive) this.player.animator.play('cheer');
      this.updateSocialUi();
    });
  }

  /** Back to the street in front of the door; `instant` skips the fade (map travel, "take me there"). */
  private leaveRoom(instant = false): void {
    const id = this.interiors.current;
    if (!id) return;
    const go = () => {
      this.sound.play('door');
      this.interiors.setInside(null);
      window.setTimeout(() => this.updateMusic(), 0);
      this.curios.setInside(null);
      this.treasureMarks.setInside(false);
      this.city.root.visible = true;
      this.ambient.group.visible = true;
      for (const a of this.npcs.actors) {
        a.object.visible = true;
        a.goBack();
      }
      this.player.bounds = CITY_BOUNDS;
      // leaving Adventure Island any other way than the plane lands at the mall (see Interiors.exit)
      const out = this.interiors.exit(id);
      this.player.teleport(out.x, out.z, out.heading, out.y);
      this.extras.buddy.snap(this.player.position, this.player.heading);
      this.cam.collision = this.city.collision;
      if (!instant) this.cam.flyTo(out.x, out.z, VIEW.dist, 0.5, { yaw: out.heading + Math.PI, pitch: VIEW.pitch });
      this.hud.setIndoors(null);
      this.updateSocialUi();
      this.save(false);
    };
    if (instant) go();
    else this.fade(go);
  }

  private showCard(c: CardContent): void {
    this.hud.closeOverlays();
    this.card.show(c);
    this.cam.enabled = false;
  }

  private openNotebook(tab?: 'mission' | 'concepts' | 'curios'): void {
    if (this.mode !== 'playing' || this.conv || !this.data) return;
    this.hud.closeOverlays();
    this.notebook.show(tab);
    this.cam.enabled = false;
  }

  private onClue(room: InteriorId, id: ClueId): void {
    const d = this.data;
    if (!d) return;
    const b = d.missions.branch;
    if (b.status === 'locked') {
      this.hud.toast(t('clue.needMission'), 3200);
      return;
    }
    const already = b.clues.includes(id);
    const concepts = findClue(b, id);
    this.interiors.marker(room, id)?.setDone(true);
    this.player.animator.play('think');
    this.showCard({
      kind: 'clue',
      kicker: t('clue.kicker'),
      title: t(`clue.${id}.title`),
      body: t(`clue.${id}.body`),
      example: { label: t('card.keyNumbers'), text: t(`clue.${id}.fact`) },
      note: already ? t('clue.already') : t('card.addedNotebook'),
      action: { label: t('card.openNotebook'), onClick: () => this.openNotebook('mission') },
    });
    if (!already) {
      this.learn(concepts);
      this.updateSocialUi();
      this.save(false);
    }
  }

  private onCurio(id: string): void {
    const d = this.data;
    if (!d) return;
    const list = d.learning.curiosities;
    const fresh = !list.includes(id);
    if (fresh) list.push(id);
    this.curios.setFound(list);
    this.player.animator.play(fresh ? 'cheer' : 'think');
    this.showCard({
      kind: 'curio',
      kicker: t('curio.kicker'),
      title: t(`curio.${id}.title`),
      body: t(`curio.${id}.body`),
      note: t('curio.count', { n: list.length, total: CURIOSITIES.length }),
      action: { label: t('card.openNotebook'), onClick: () => this.openNotebook('curios') },
    });
    if (fresh) {
      this.reward(XP.curio);
      this.save(false);
    }
  }

  /** Adds concepts to the notebook and says so. */
  private learn(ids: string[]): void {
    const d = this.data;
    if (!d) return;
    const fresh = [...new Set(ids)].filter((id) => isConcept(id) && !d.learning.concepts.includes(id));
    if (!fresh.length) return;
    d.learning.concepts.push(...fresh);
    this.reward({ xp: XP.concept.xp * fresh.length, coins: XP.concept.coins * fresh.length });
    this.hud.toast(fresh.length === 1 ? t('concept.new', { title: t(`concept.${fresh[0]}.title`) }) : t('concept.newMany', { n: fresh.length }), 2600);
  }

  /** Story flags set in conversations: concepts learned, the mission starting. */
  private onFlags(flags: string[]): void {
    const d = this.data;
    if (!d) return;
    this.learn(flags.filter((f) => f.startsWith('learn.')).map((f) => f.slice(6)));
    if (flags.includes('branch.started') && d.missions.branch.status === 'locked') {
      d.missions.branch.status = 'active';
      this.focus = 'mission';
      this.hud.toast(t('mission.started'), 3200);
    }
  }

  private onDecided(ev: Evaluation): void {
    const d = this.data;
    if (!d) return;
    apply(d.social, 'marco', [{ flag: 'branch.done' }, { flag: `branch.result.${ev.choice}` }, { rep: ev.stars * 5 }]);
    this.learn(ev.concepts);
    this.hud.toast(t('mission.done', { stars: '★'.repeat(ev.stars) }), 3200);
    this.sound.play('success');
    this.reward({ xp: XP.missionBase.xp + XP.missionStar.xp * ev.stars, coins: XP.missionBase.coins + XP.missionStar.coins * ev.stars });
    this.player.animator.play('cheer');
    this.updateSocialUi();
    this.save(false);
  }

  /* ----------------------------- progression ----------------------------- */

  private playing(): boolean {
    return this.mode === 'playing';
  }

  private openPanel(which: 'quests' | 'bag' | 'settings' | 'money'): void {
    if (this.mode !== 'playing' || this.conv || !this.data) return;
    this.hud.closeOverlays();
    if (which === 'quests') this.questLog.show();
    else if (which === 'bag') this.bag.show();
    else if (which === 'money') {
      this.money.show();
      this.coach.did('openMoney');
    }
    else this.settings.show();
    this.cam.enabled = false;
  }

  private changeSettings(c: Partial<Settings>): void {
    const d = this.data;
    if (!d) return;
    if (c.night !== undefined && c.night !== this.atmosphere.isNight) this.setNight(c.night);
    Object.assign(d.settings, c);
    this.applySettings();
    this.save(false);
  }

  private applySettings(): void {
    const s = this.data?.settings;
    if (!s) return;
    this.cam.turnSpeed = s.camSpeed;
    this.hud.root.classList.toggle('calm', s.calm);
  }

  /** Opens the areas the player has unlocked (gates, walkable trails). */
  private applyUnlocks(): void {
    const open = !!this.data?.growth.unlocked.includes('trail');
    this.city.trailGate.setOpen(open);
    this.player.extraAreas = open ? [{ x0: TRAIL.x0, z0: TRAIL.z0, x1: TRAIL.x1, z1: TRAIL.z1 }] : [];
  }

  /** Adds XP and coins earned outside quests. */
  private reward(r: Partial<Reward>): void {
    const d = this.data;
    if (!d || (!r.xp && !r.coins)) return;
    const { level, levelUp } = grant(d.growth, r);
    this.updateProgressUi();
    this.nextLesson();
    if (levelUp) {
      this.hud.playerCard.levelUp(t('toast.levelUp', { n: level }));
      this.sound.play('levelUp');
      this.player.animator.play('cheer');
    }
  }

  /** Once the basics are done: the money lesson when there are coins to save, then the shop. */
  private nextLesson(): void {
    const d = this.data;
    if (!d || this.coach.active || this.mode !== 'playing' || !Coach.isDone('basics')) return;
    if (!Coach.isDone('business')) window.setTimeout(() => this.coach.start('business'), 2500);
    else if (!Coach.isDone('money')) {
      if (d.growth.coins >= 15) window.setTimeout(() => this.coach.start('money'), 1800);
    } else if (!Coach.isDone('shop') && d.growth.coins >= 5) window.setTimeout(() => this.coach.start('shop'), 1800);
  }

  private updateProgressUi(): void {
    const d = this.data;
    if (!d) return;
    this.hud.playerCard.update(d.character.nickname, d.character.topColor, d.growth);
    if (!this.questLog.el.hidden) this.questLog.render();
  }

  /** The character the current quest step is about (for the "!" mark), if any. */
  private questNpc(): NpcId | null {
    const g = this.data?.growth;
    if (!g) return null;
    for (const def of QUESTS) {
      const q = g.quests[def.id];
      if (q?.status !== 'active') continue;
      const goal = def.steps[q.step].goal;
      if (goal.kind === 'near') return goal.npc as NpcId;
      if (goal.kind === 'flag' && def.giver) return def.giver;
    }
    return null;
  }

  private questTargets(): { x: number; z: number }[] {
    const g = this.data?.growth;
    if (!g) return [];
    const out: { x: number; z: number }[] = [];
    for (const def of QUESTS) {
      const q = g.quests[def.id];
      if (q?.status !== 'active') continue;
      const goal = def.steps[q.step].goal;
      if (goal.kind === 'visit') {
        for (const id of goal.pois) {
          const poi = this.city.pois.find((p) => p.id === id);
          if (poi && !q.seen.includes(id)) out.push({ x: poi.x, z: poi.z });
        }
      } else if (goal.kind === 'near') out.push(this.npcs.get(goal.npc as NpcId).position);
      else if (def.giver) out.push(this.npcs.get(def.giver).position);
      break;
    }
    return out;
  }

  /** Moves quests forward and shows what happened. */
  private checkQuests(): void {
    const d = this.data;
    if (!d) return;
    const indoors = !!this.interiors.current;
    const before = d.social.flags.length;
    const events = advance(d.growth, {
      hasFlag: (f) => hasFlag(d.social, f),
      nearPoi: (id) => {
        if (indoors) return false;
        const poi = this.city.pois.find((p) => p.id === id);
        return !!poi && this.poiDistance(poi) < VISIT_RANGE;
      },
      nearNpc: (id) => this.npcs.get(id as NpcId).distanceTo(this.player.position) < 5,
      setFlag: (f) => {
        if (!hasFlag(d.social, f)) d.social.flags.push(f);
      },
    });
    if (!events.length && d.social.flags.length === before) return;
    for (const e of events) this.onProgress(e);
    this.updateSocialUi();
    this.save(false);
  }

  private onProgress(e: ProgressEvent): void {
    if (e.type === 'started') {
      this.focus = 'quest';
      // the very first quest is introduced by the tracker itself
      if (e.quest !== QUESTS[0].id) this.hud.toast(`${t('quests.newQuest')}: ${t(`quest.${e.quest}.title`)}`, 3000);
    } else if (e.type === 'step') {
      this.hud.toast(`✓ ${t('quests.stepDone')}`, 1800);
      this.sound.play('success');
    } else {
      const def = QUESTS.find((q) => q.id === e.quest)!;
      const bonus = !!def.reward.bonus && e.reward.xp > def.reward.xp;
      this.applyUnlocks();
      this.player.animator.play('cheer');
      this.hud.closeOverlays();
      this.complete.show(e.quest, e.reward, e.level, e.levelUp, bonus);
      this.cam.enabled = false;
    }
  }

  /** Repairs the mission state against the story flags (old saves) and refreshes found markers. */
  private syncLearning(): void {
    const d = this.data;
    if (!d) return;
    const b = d.missions.branch;
    if (b.status === 'locked' && hasFlag(d.social, 'branch.started')) b.status = 'active';
    this.curios.setFound(d.learning.curiosities);
    this.treasureMarks.show(nextStep(d.treasure));
    this.collect.restore(d.found);
    this.sky.restore(d.found);
    this.island.restore(d.found);
    this.bizSite.setStage(d.missions.business.stage, this.ownerName());
    if (hasFlag(d.social, 'robot.friend') && !this.extras.buddy.following) {
      this.extras.buddy.follow();
      this.extras.buddy.snap(this.player.position, this.player.heading);
    }
    for (const c of CLUE_IDS) this.interiors.marker('pizzeria', c)?.setDone(b.clues.includes(c));
  }

  /** The tracker's mission line, or null when there is nothing to do. */
  private missionLine(): string | null {
    const d = this.data;
    if (!d) return null;
    const b = d.missions.branch;
    if (b.status === 'active') return t(`mission.step.${currentStep(b, d.social.flags)}`);
    if (b.status === 'done' && !hasFlag(d.social, 'branch.thanked')) return t('mission.thanks');
    return null;
  }

  /** Where one character's errand leads now (the character when it is ready to hand in). */
  private errandTargets(id: NpcId): { x: number; z: number }[] {
    const s = this.data?.social;
    if (!s) return [];
    const state = s.errands[id];
    if (state === 'ready') return [this.npcs.get(id).position];
    if (state !== 'active') return [];
    const goal = ERRANDS[id].goal;
    if (goal.kind === 'visit') {
      const poi = this.city.pois.find((p) => p.key === goal.poi);
      return poi ? [{ x: poi.x, z: poi.z }] : [];
    }
    if (id === 'maya' && !hasFlag(s, 'nina.toldMaya')) return [this.npcs.get('nina').position];
    if (id === 'leo' && !hasFlag(s, 'marco.rumorChecked')) return [this.npcs.get('marco').position];
    return [];
  }

  /** An arrow at the screen edge while the goal is off screen. */
  private updateGoalArrow(on: boolean): void {
    const g = on ? this.goalTarget() : null;
    if (!g || Math.hypot(g.x - this.player.position.x, g.z - this.player.position.z) < 6) return this.hud.setGoalArrow(null);
    const v = this.goalV.set(g.x, this.player.position.y + 1.5, g.z).project(this.cam.camera);
    const behind = v.z > 1;
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    if (!behind && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85) return this.hud.setGoalArrow(null);
    // direction from the screen centre; behind the camera the projection flips
    let dx = behind ? -v.x : v.x;
    let dy = behind ? v.y : -v.y;
    if (Math.hypot(dx, dy) < 1e-3) dy = 1;
    const m = 44;
    const k = Math.min((w / 2 - m) / Math.max(Math.abs(dx) * (w / 2), 1e-3), (hgt / 2 - m) / Math.max(Math.abs(dy) * (hgt / 2), 1e-3));
    dx *= (w / 2) * k;
    dy *= (hgt / 2) * k;
    this.hud.setGoalArrow({ x: w / 2 + dx, y: hgt / 2 + dy, angle: Math.atan2(dy, dx) });
  }

  /** The nearest place the tracked goal points to, or null. */
  goalTarget(): { x: number; z: number } | null {
    if (this.interiors.current) return null;
    const p = this.player.position;
    let best: { x: number; z: number } | null = null;
    let bd = Infinity;
    for (const g of this.goalTargets) {
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return best;
  }

  private missionTargets(): { x: number; z: number }[] {
    const d = this.data;
    if (!d) return [];
    const b = d.missions.branch;
    if (b.status === 'done') return hasFlag(d.social, 'branch.thanked') ? [] : [this.npcs.get('marco').position];
    if (b.status !== 'active') return [];
    const step = currentStep(b, d.social.flags);
    if (step === 'clues') {
      const door = this.interiors.doors.find((x) => x.id === 'pizzeria');
      return door && this.interiors.current !== 'pizzeria' ? [door] : [];
    }
    if (step === 'consult') return ADVISORS.filter((a) => a.key && !hasFlag(d.social, a.flag)).map((a) => this.npcs.get(a.id).position);
    return [];
  }

  /** Snapshot for automated tests and debugging. */
  debugState() {
    const info = this.renderer.info;
    const p = this.player;
    return {
      mode: this.mode,
      graphics: this.graphics,
      avatars: this.avatars,
      frames: this.frames,
      zone: this.lastZone ?? null,
      camera: { ...this.cam.state, mode: this.cam.mode },
      player: { x: p.position.x, y: p.position.y, z: p.position.z, heading: p.heading, speed: p.speed, nickname: p.look.nickname, look: { ...p.look } },
      nearPoi: this.nearPoi?.id ?? null,
      nearNpc: this.nearNpc?.id ?? null,
      near: nearKey(this.nearThing),
      inside: this.interiors.current,
      fading: this.fading,
      overlay: this.hud.overlayOpen,
      mission: this.data ? JSON.parse(JSON.stringify(this.data.missions.branch)) : null,
      learning: this.data ? JSON.parse(JSON.stringify(this.data.learning)) : null,
      doors: this.interiors.doors.map((d) => ({ id: d.id, x: d.x, z: d.z, y: d.y })),
      spots: [...this.interiors.rooms.values()].flatMap((r) => r.markers.map((m) => ({ room: r.def.id, id: m.id, kind: m.kind, x: m.position.x, z: m.position.z }))),
      curios: CURIOSITIES.map((c) => {
        const at = this.curios.position(c.id);
        return { id: c.id, room: 'interior' in c.at ? c.at.interior : null, x: at?.x ?? 0, z: at?.z ?? 0 };
      }),
      talking: this.talkingTo?.id ?? null,
      line: this.conv && !this.conv.done ? this.conv.line : null,
      social: this.data ? JSON.parse(JSON.stringify(this.data.social)) : null,
      npcs: this.npcs.actors.map((a) => ({ id: a.id, x: a.position.x, z: a.position.z })),
      visited: [...(this.data?.progress.visited ?? [])],
      pois: this.city.pois.map((q) => ({ id: q.id, key: q.key, zone: q.zone, landmark: q.landmark, x: q.x, z: q.z, w: q.w, d: q.d })),
      crowd: { ...this.ambient.crowd.census(), size: this.ambient.crowd.size, talking: this.ambient.crowd.bubble()?.line ?? null },
      growth: this.data
        ? {
            ...JSON.parse(JSON.stringify(this.data.growth)),
            level: levelOf(this.data.growth.xp).level,
            tracker: this.trackerKind,
            complete: !this.complete.el.hidden,
            trailOpen: this.player.extraAreas.length > 0,
          }
        : null,
      settings: this.data ? { ...this.data.settings } : null,
      fps: this.fps,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      night: this.atmosphere.isNight,
    };
  }
}
