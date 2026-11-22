const SANDBOX = "98 - GoEase Plugin Sandbox";
const SCREEN = "POC - GoEase T01 Home v2";
const SCREEN_KEY = "goease-screen";
const T01 = "t01-home-v2";
const WIDTH = 390;
const HEIGHT = 844;

const colors = {
  canvas: "#FAFBF9",
  white: "#FFFFFF",
  ink: "#182723",
  muted: "#4C615A",
  border: "#DCE5DF",
  wash: "#F0F4F1",
  hero: "#E7EFE9",
  water: "#D5E4DF",
  art: "#78988B",
  accent: "#285B49",
};

const fonts = {
  regular: { family: "Inter", style: "Regular" },
  medium: { family: "Inter", style: "Medium" },
  bold: { family: "Inter", style: "Bold" },
};

const icons = {
  pin: "M 17 8 C 17 13 10 18 10 18 C 10 18 3 13 3 8 C 3 4 6 1 10 1 C 14 1 17 4 17 8 Z M 12 8 C 12 5.3 8 5.3 8 8 C 8 10.7 12 10.7 12 8 Z",
  down: "M 5 8 L 10 13 L 15 8",
  right: "M 7 5 L 12 10 L 7 15",
  search: "M 14 8.5 C 14 5.5 11.5 3 8.5 3 C 5.5 3 3 5.5 3 8.5 C 3 11.5 5.5 14 8.5 14 C 11.5 14 14 11.5 14 8.5 Z M 12.5 12.5 L 17 17",
  food: "M 4 3 L 4 8 Q 4 10 7 10 Q 10 10 10 8 L 10 3 M 7 3 L 7 17 M 15 3 Q 12 5 12 10 L 16 10 M 16 3 L 16 17",
  coffee: "M 3 6 L 14 6 L 14 11 Q 14 15 10 15 L 7 15 Q 3 15 3 11 Z M 14 7 L 16 7 C 19 7 19 11 16 11 L 14 11 M 2 17 L 16 17",
  play: "M 10 2 L 12 7.5 L 18 10 L 12 12.5 L 10 18 L 8 12.5 L 2 10 L 8 7.5 Z",
  culture: "M 2 8 L 10 3 L 18 8 Z M 5 8 L 5 15 M 10 8 L 10 15 M 15 8 L 15 15 M 2 16 L 18 16",
  nature: "M 4 15 C 2 6 9 3 17 3 C 17 11 14 18 6 16 M 3 18 L 12 9",
  shop: "M 4 7 L 16 7 L 17 17 L 3 17 Z M 7 8 L 7 5 C 7 1 13 1 13 5 L 13 8",
  compass: "M 18 10 C 18 5.6 14.4 2 10 2 C 5.6 2 2 5.6 2 10 C 2 14.4 5.6 18 10 18 C 14.4 18 18 14.4 18 10 Z M 13.5 6.5 L 11.5 11.5 L 6.5 13.5 L 8.5 8.5 Z",
  trip: "M 4 6 L 16 6 Q 18 6 18 8 L 18 15 Q 18 17 16 17 L 4 17 Q 2 17 2 15 L 2 8 Q 2 6 4 6 Z M 7 6 L 7 4 Q 7 3 8 3 L 12 3 Q 13 3 13 4 L 13 6 M 7 10 L 7 13 M 13 10 L 13 13",
  bookmark: "M 5 3 L 15 3 L 15 17 L 10 14 L 5 17 Z",
  profile: "M 13.5 6.5 C 13.5 1.8 6.5 1.8 6.5 6.5 C 6.5 11.2 13.5 11.2 13.5 6.5 Z M 3 17 C 3 11.5 17 11.5 17 17",
};

type Icon = keyof typeof icons;
type Layout = FrameNode | ComponentNode;
type Direction = "HORIZONTAL" | "VERTICAL";
type StackOptions = {
  width?: number;
  height?: number;
  gap?: number;
  inset?: number;
  fill?: string;
};

function solid(hex: string): SolidPaint[] {
  const rgb = Number.parseInt(hex.slice(1), 16);
  return [{
    type: "SOLID",
    color: { r: (rgb >> 16) / 255, g: ((rgb >> 8) & 255) / 255, b: (rgb & 255) / 255 },
  }];
}

function configureLayout(
  frame: Layout,
  name: string,
  direction: Direction,
  { gap = 0, inset = 0, fill }: StackOptions = {},
) {
  frame.name = name;
  frame.fills = fill ? solid(fill) : [];
  frame.layoutMode = direction;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  frame.itemSpacing = gap;
  frame.paddingTop = frame.paddingRight = frame.paddingBottom = frame.paddingLeft = inset;
  if (direction === "HORIZONTAL") frame.counterAxisAlignItems = "CENTER";
  frame.clipsContent = false;
}

function append<T extends SceneNode>(parent: Layout | SectionNode, node: T): T {
  try {
    parent.appendChild(node);
    return node;
  } catch (error) {
    node.remove();
    throw error;
  }
}

function stack(parent: Layout, name: string, direction: Direction, options: StackOptions = {}) {
  const frame = append(parent, figma.createFrame());
  configureLayout(frame, name, direction, options);
  frame.resize(options.width ?? WIDTH, options.height ?? 40);
  if (options.width === undefined) frame.layoutSizingHorizontal = "FILL";
  if (options.height === undefined) frame.layoutSizingVertical = "HUG";
  return frame;
}

function outline(frame: Layout, radius: number) {
  frame.cornerRadius = radius;
  frame.strokes = solid(colors.border);
  frame.strokeWeight = 1;
  frame.strokeAlign = "INSIDE";
}

function label(
  parent: Layout,
  name: string,
  characters: string,
  size: number,
  weight: keyof typeof fonts = "regular",
  color = colors.ink,
  lineHeight = size + 4,
) {
  const text = append(parent, figma.createText());
  text.name = name;
  text.fontName = fonts[weight];
  text.fontSize = size;
  text.lineHeight = { unit: "PIXELS", value: lineHeight };
  text.fills = solid(color);
  text.textAutoResize = "WIDTH_AND_HEIGHT";
  text.characters = characters;
  return text;
}

function path(parent: FrameNode, name: string, data: string, color: string, weight: number) {
  const vector = append(parent, figma.createVector());
  vector.name = name;
  vector.vectorPaths = [{ windingRule: "NONE", data }];
  vector.fills = [];
  vector.strokes = solid(color);
  vector.strokeWeight = weight;
  vector.strokeCap = "ROUND";
  vector.strokeJoin = "ROUND";
  return vector;
}

function icon(parent: Layout, name: Icon, size = 20, color = colors.accent) {
  const tile = append(parent, figma.createFrame());
  tile.name = `Icon / ${name}`;
  tile.resize(size, size);
  tile.fills = [];
  tile.clipsContent = false;
  const vector = path(tile, name, icons[name], color, 1.45);
  const scale = size / 20;
  vector.resize(vector.width * scale, vector.height * scale);
  vector.x = (size - vector.width) / 2;
  vector.y = (size - vector.height) / 2;
}

function riverArt(parent: Layout, width: number, height: number, featured: boolean) {
  const art = append(parent, figma.createFrame());
  art.name = featured ? "Minh họa chợ nổi" : "Minh họa sông nước";
  art.resize(width, height);
  art.fills = featured ? solid(colors.water) : [];
  art.clipsContent = true;
  if (featured) art.layoutSizingHorizontal = "FILL";

  const sun = append(art, figma.createEllipse());
  sun.name = "Mặt trời";
  sun.resize(featured ? 24 : 12, featured ? 24 : 12);
  sun.fills = solid(featured ? colors.hero : colors.water);
  sun.x = featured ? 248 : 77;
  sun.y = featured ? 12 : 8;

  const horizon = path(art, "Bờ sông", "M 0 18 C 22 18 41 5 61 5 C 79 5 88 13 105 11 C 123 8 138 0 162 0", colors.art, 1.4);
  const boat = path(art, "Ghe", "M 0 17 L 44 17 L 36 25 L 8 25 Z M 20 16 L 20 0 L 34 14 L 22 14", colors.accent, 1.35);
  const waves = path(art, "Gợn nước", "M 0 0 L 29 0 M 39 0 L 62 0 M 11 8 L 48 8", colors.art, 1.1);
  if (featured) {
    horizon.resize(350, 29);
    horizon.x = 0;
    horizon.y = 24;
    boat.x = 150;
    boat.y = 23;
    waves.x = 142;
    waves.y = 60;
  } else {
    horizon.resize(112, 18);
    horizon.x = 0;
    horizon.y = 19;
    boat.resize(36, 21);
    boat.x = 43;
    boat.y = 25;
    waves.x = 34;
    waves.y = 53;
  }
}

function header(parent: Layout) {
  const row = stack(parent, "GoEase Header", "HORIZONTAL", { height: 46 });
  row.primaryAxisAlignItems = "SPACE_BETWEEN";
  label(row, "Thương hiệu", "GoEase", 25, "bold", colors.accent);
  const location = stack(row, "Location selector", "HORIZONTAL", {
    width: 142, height: 38, inset: 10, gap: 6, fill: colors.white,
  });
  outline(location, 11);
  icon(location, "pin", 16);
  const city = label(location, "Điểm đến", "Cần Thơ", 13, "medium");
  city.layoutSizingHorizontal = "FILL";
  icon(location, "down", 14, colors.muted);
}

function contextSwitch(parent: Layout) {
  const switcher = stack(parent, "Local / Tourist context switch", "HORIZONTAL", {
    height: 40, inset: 3, gap: 4, fill: colors.wash,
  });
  outline(switcher, 12);
  for (const [title, selected] of [["Gần mình", true], ["Khám phá điểm đến", false]] as const) {
    const option = stack(switcher, title, "HORIZONTAL", {
      height: 34, fill: selected ? colors.accent : undefined,
    });
    option.cornerRadius = 9;
    option.primaryAxisAlignItems = "CENTER";
    label(option, "Nhãn", title, 12, "medium", selected ? colors.white : colors.muted);
  }
}

function hero(parent: Layout) {
  const panel = stack(parent, "Hero và Search", "VERTICAL", {
    height: 146, inset: 12, gap: 10, fill: colors.hero,
  });
  panel.cornerRadius = 15;
  panel.paddingLeft = panel.paddingRight = 14;
  const intro = stack(panel, "Hero", "HORIZONTAL", { height: 72 });
  intro.primaryAxisAlignItems = "SPACE_BETWEEN";
  label(intro, "Tiêu đề hero", "Cuối tuần này\nđi đâu vui?", 25, "bold", colors.ink, 29);
  riverArt(intro, 112, 62, false);
  const search = stack(panel, "Search", "HORIZONTAL", {
    height: 40, inset: 11, gap: 8, fill: colors.white,
  });
  outline(search, 10);
  icon(search, "search", 17);
  label(search, "Gợi ý tìm kiếm", "Tìm trải nghiệm, món ăn, địa điểm", 12, "regular", colors.muted);
}

function createFilterComponent(section: SectionNode) {
  const component = append(section, figma.createComponent());
  configureLayout(component, "POC / Quick filter", "HORIZONTAL", {
    inset: 10, fill: colors.white,
  });
  component.resize(92, 32);
  component.paddingTop = component.paddingBottom = 0;
  component.layoutSizingHorizontal = "HUG";
  outline(component, 16);
  component.x = 24;
  component.y = 28;
  const text = label(component, "Nhãn bộ lọc", "Cuối tuần", 11, "medium");
  const property = component.addComponentProperty("Nhãn", "TEXT", text.characters);
  text.componentPropertyReferences = { characters: property };
  return { component, property };
}

function quickFilters(parent: Layout, filter: ReturnType<typeof createFilterComponent>) {
  const row = stack(parent, "Quick filters", "HORIZONTAL", { height: 32, gap: 8 });
  for (const title of ["Cuối tuần", "Gần đây", "Ngoài trời", "Gia đình"]) {
    const chip = append(row, filter.component.createInstance());
    chip.name = title;
    chip.setProperties({ [filter.property]: title });
  }
}

function sectionTitle(parent: Layout, title: string, link?: string) {
  const row = stack(parent, "Tiêu đề mục", "HORIZONTAL", { height: 22 });
  row.primaryAxisAlignItems = "SPACE_BETWEEN";
  label(row, "Tiêu đề", title, 16, "bold");
  if (link) label(row, "Xem thêm", link, 11, "medium", colors.accent);
}

function categoryTile(parent: Layout, title: string, symbol: Icon) {
  const tile = stack(parent, title, "HORIZONTAL", {
    height: 40, inset: 8, gap: 6, fill: colors.white,
  });
  outline(tile, 10);
  icon(tile, symbol, 17);
  label(tile, "Danh mục", title, 11, "medium");
}

function categories(parent: Layout) {
  const section = stack(parent, "Discovery category grid", "VERTICAL", { gap: 8 });
  sectionTitle(section, "Khám phá theo sở thích");
  const rows = [
    [["Ăn uống", "food"], ["Cà phê", "coffee"], ["Đi chơi", "play"]],
    [["Văn hóa", "culture"], ["Ngoài trời", "nature"], ["Mua sắm", "shop"]],
  ] as const;
  for (const [index, tiles] of rows.entries()) {
    const row = stack(section, `Hàng ${index + 1}`, "HORIZONTAL", { height: 40, gap: 8 });
    for (const [title, symbol] of tiles) categoryTile(row, title, symbol);
  }
}

function featuredExperience(parent: Layout) {
  const section = stack(parent, "Featured experience", "VERTICAL", { gap: 8 });
  sectionTitle(section, "Nổi bật cuối tuần");
  const card = stack(section, "Featured experience card", "VERTICAL", {
    height: 150, fill: colors.white,
  });
  outline(card, 13);
  card.clipsContent = true;
  riverArt(card, 350, 86, true);
  const details = stack(card, "Nội dung trải nghiệm", "HORIZONTAL", { height: 64, inset: 12 });
  details.primaryAxisAlignItems = "SPACE_BETWEEN";
  const copy = stack(details, "Tên và mô tả", "VERTICAL", { width: 270, gap: 2 });
  label(copy, "Tên trải nghiệm", "Chợ nổi Cái Răng", 16, "bold");
  label(copy, "Mô tả", "Văn hóa sông nước · Cần Thơ", 11, "regular", colors.muted);
  icon(details, "right", 18);
}

function suggestionCard(parent: Layout, title: string, subtitle: string, symbol: Icon) {
  const card = stack(parent, title, "HORIZONTAL", {
    height: 72, inset: 9, gap: 8, fill: colors.white,
  });
  outline(card, 11);
  const thumbnail = stack(card, "Minh họa", "HORIZONTAL", { width: 35, height: 42, fill: colors.hero });
  thumbnail.cornerRadius = 7;
  thumbnail.primaryAxisAlignItems = "CENTER";
  icon(thumbnail, symbol, 19);
  const copy = stack(card, "Tên và danh mục", "VERTICAL", { gap: 2 });
  const titleNode = label(copy, "Tên trải nghiệm", title, 12, "bold");
  titleNode.textAutoResize = "HEIGHT";
  titleNode.layoutSizingHorizontal = "FILL";
  label(copy, "Danh mục", subtitle, 10, "regular", colors.muted);
}

function suggestions(parent: Layout) {
  const section = stack(parent, "Gợi ý trải nghiệm", "VERTICAL", { gap: 8 });
  sectionTitle(section, "Gợi ý trải nghiệm", "Xem thêm");
  const row = stack(section, "Danh sách gợi ý", "HORIZONTAL", { height: 72, gap: 8 });
  suggestionCard(row, "Dạo bến Ninh Kiều", "Đi dạo", "nature");
  suggestionCard(row, "Cà phê ven sông", "Cà phê", "coffee");
}

function bottomNavigation(parent: Layout) {
  const nav = stack(parent, "Bottom navigation", "HORIZONTAL", { height: 66, fill: colors.white });
  nav.paddingLeft = nav.paddingRight = 11;
  nav.strokes = solid(colors.border);
  nav.strokeAlign = "INSIDE";
  nav.strokeTopWeight = 1;
  nav.strokeRightWeight = nav.strokeBottomWeight = nav.strokeLeftWeight = 0;
  const tabs = [
    ["Khám phá", "compass"],
    ["Đi chơi", "trip"],
    ["Dấu ấn", "bookmark"],
    ["Tôi", "profile"],
  ] as const;
  for (const [index, [title, symbol]] of tabs.entries()) {
    const tab = stack(nav, title, "VERTICAL", { height: 52, gap: 3 });
    tab.primaryAxisAlignItems = tab.counterAxisAlignItems = "CENTER";
    const active = index === 0;
    const tile = stack(tab, "Nền biểu tượng", "HORIZONTAL", {
      width: 42, height: 24, fill: active ? colors.hero : undefined,
    });
    tile.cornerRadius = 12;
    tile.primaryAxisAlignItems = "CENTER";
    icon(tile, symbol, 18, active ? colors.accent : colors.muted);
    label(tab, "Nhãn điều hướng", title, 11, active ? "bold" : "medium", active ? colors.accent : colors.muted);
  }
}

function buildScreen(screen: FrameNode, x: number, filter: ReturnType<typeof createFilterComponent>) {
  configureLayout(screen, SCREEN, "VERTICAL", { fill: colors.canvas });
  screen.resize(WIDTH, HEIGHT);
  screen.x = x;
  screen.y = 0;
  screen.clipsContent = true;
  screen.setPluginData(SCREEN_KEY, T01);

  const content = stack(screen, "Home content", "VERTICAL", { gap: 13 });
  content.layoutSizingVertical = "FILL";
  content.paddingLeft = content.paddingRight = 20;
  content.paddingTop = 24;
  content.paddingBottom = 12;
  header(content);
  contextSwitch(content);
  hero(content);
  quickFilters(content, filter);
  categories(content);
  featuredExperience(content);
  suggestions(content);
  bottomNavigation(screen);
}

function findSandbox() {
  const pages = figma.root.children.filter(page => page.name === SANDBOX);
  if (pages.length > 1) throw new Error(`Có nhiều page mang tên “${SANDBOX}”. Giữ một sandbox có tên này rồi thử lại.`);
  return pages[0];
}

function findScreen(page: PageNode) {
  return page.findAllWithCriteria({ types: ["FRAME"] }).find(
    frame => frame.name === SCREEN || frame.getPluginData(SCREEN_KEY) === T01,
  );
}

function reveal(page: PageNode, screen: FrameNode) {
  page.selection = [screen];
  figma.viewport.scrollAndZoomIntoView([screen]);
}

async function generate(): Promise<FrameNode | null> {
  let sandbox = findSandbox();
  if (sandbox) {
    await sandbox.loadAsync();
    if (findScreen(sandbox)) {
      await figma.setCurrentPageAsync(sandbox);
      const existing = findScreen(sandbox);
      if (existing) {
        reveal(sandbox, existing);
        return null;
      }
    }
  }

  figma.ui.postMessage({ type: "progress", text: "Đang tải phông chữ Inter…" });
  await Promise.all(Object.values(fonts).map(font => figma.loadFontAsync(font)));

  sandbox = findSandbox();
  if (!sandbox) {
    sandbox = figma.createPage();
    sandbox.name = SANDBOX;
  }
  await sandbox.loadAsync();
  await figma.setCurrentPageAsync(sandbox);
  if (figma.currentPage.id !== sandbox.id) throw new Error("Không chuyển được đến page sandbox.");

  const existing = findScreen(sandbox);
  if (existing) {
    reveal(sandbox, existing);
    return null;
  }

  figma.ui.postMessage({ type: "progress", text: "Đang dựng các layer trong sandbox…" });
  const rightEdge = Math.max(0, ...sandbox.children.map(node => node.x + node.width));
  const x = sandbox.children.length ? Math.ceil(rightEdge) + 64 : 0;
  let screen: FrameNode | undefined;
  let components: SectionNode | undefined;
  try {
    components = figma.createSection();
    components.name = "POC - Components";
    components.x = x + WIDTH + 64;
    components.y = 0;
    components.resizeWithoutConstraints(204, 96);
    const filter = createFilterComponent(components);
    screen = figma.createFrame();
    buildScreen(screen, x, filter);
  } catch (error) {
    screen?.remove();
    components?.remove();
    throw error;
  }

  reveal(sandbox, screen);
  return screen;
}

figma.showUI(__html__, { width: 328, height: 202, themeColors: true });
let generating = false;

figma.ui.onmessage = async (message: unknown) => {
  if (
    typeof message !== "object" || message === null ||
    !("type" in message) || message.type !== "generate" || generating
  ) return;

  generating = true;
  try {
    const screen = await generate();
    const text = screen
      ? `Đã tạo T01 Home v2 · ${screen.width} × ${screen.height} trong sandbox.`
      : "T01 Home v2 đã có trong sandbox. Đã chọn frame hiện có.";
    figma.ui.postMessage({ type: "success", text });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({ type: "error", text: `Không dựng được T01 Home v2. ${detail}` });
  } finally {
    generating = false;
  }
};
