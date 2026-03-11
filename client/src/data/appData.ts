type SelectField = {
  id: string;
  label: string;
  type: "select";
  options: string[];
  defaultValue: string;
};

type CheckboxField = {
  id: string;
  label: string;
  type: "checkbox";
  defaultValue: boolean;
};

type NumberField = {
  id: string;
  label: string;
  type: "number";
  min: number;
  max: number;
  defaultValue: number;
};

type RangeField = {
  id: string;
  label: string;
  type: "range";
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

type TextField = {
  id: string;
  label: string;
  type: "text";
  defaultValue: string;
};

export type SettingsField = SelectField | CheckboxField | NumberField | RangeField | TextField;

export type SettingsGroup = {
  title: string;
  description: string;
  fields: SettingsField[];
};

export const primaryNavigation = [
  { to: "/", label: "Overview" },
  { to: "/rooms", label: "Rooms" },
  { to: "/builder", label: "Environment Builder" },
  { to: "/ops", label: "Operations" },
  { to: "/settings", label: "Settings" },
];

export const roomFilters = {
  searchPlaceholder: "Search rooms, templates, or hosts",
  modes: ["Broadcast + mingle", "Hybrid collaboration", "1:1 and small groups"],
  capacities: ["0-16", "17-24", "25-40"],
};

export const overviewHighlights = [
  {
    eyebrow: "Client-Dominant Core",
    title: "A workspace shell for real-time spatial sessions",
    body: "Frontend routes, reusable panels, room previews, and product framing are scaffolded so each team can build inside clear boundaries.",
  },
  {
    eyebrow: "Architecture",
    title: "Rendering, RTC, sync, and data systems are visually separated",
    body: "The interface mirrors your ownership model so frontend, backend, RTC, and environment contributors do not design conflicting surfaces.",
  },
];

export const statCards = [
  { label: "Target Room Scale", value: "20-40", note: "concurrent users" },
  { label: "Peer Cap", value: "4", note: "nearest peers active" },
  { label: "Sync Budget", value: "10-20/s", note: "position updates" },
  { label: "Proximity Tick", value: "200ms", note: "client evaluation" },
];

export const roomTemplates = [
  {
    id: "town-hall",
    name: "Town Hall",
    type: "Broadcast + mingle",
    capacity: "40 users",
    summary: "Large open floor for a demo or faculty review, with spotlight stage zones and overflow conversation clusters.",
    environment: "default_room.json",
    zoneCount: 6,
    defaults: {
      talkRadius: 180,
      maxPeers: 4,
      stageMode: true,
      recordingReady: false,
    },
  },
  {
    id: "research-studio",
    name: "Research Studio",
    type: "Hybrid collaboration",
    capacity: "24 users",
    summary: "Persistent worktables, whiteboards, and notebook anchors for structured capstone collaboration.",
    environment: "research_studio.json",
    zoneCount: 4,
    defaults: {
      talkRadius: 160,
      maxPeers: 4,
      stageMode: false,
      recordingReady: true,
    },
  },
  {
    id: "portfolio-lounge",
    name: "Portfolio Lounge",
    type: "1:1 and small groups",
    capacity: "16 users",
    summary: "Quiet seating islands and private tables tuned for short interviews, critiques, and networking.",
    environment: "portfolio_lounge.json",
    zoneCount: 5,
    defaults: {
      talkRadius: 140,
      maxPeers: 3,
      stageMode: false,
      recordingReady: false,
    },
  },
];

export const systemTracks = [
  {
    title: "Rendering Surface",
    items: ["Landing and app shell", "Room viewport", "State panels", "Mobile-aware navigation"],
  },
  {
    title: "Environment Pipeline",
    items: ["JSON templates", "Schema validation", "Object presets", "Versioned room configs"],
  },
  {
    title: "Realtime Backbone",
    items: ["Room sync", "Signaling relay", "Peer lifecycle", "Telemetry and health states"],
  },
];

export const operationsChecklist = [
  "Route all room state through a lightweight sync server.",
  "Keep peer selection on the client only.",
  "Validate environment files before publishing to rooms.",
  "Track connection quality and join failures as visible operational states.",
];

export const settingsGroups: SettingsGroup[] = [
  {
    title: "Media Defaults",
    description: "Control camera, microphone, push-to-talk, and output routing defaults.",
    fields: [
      {
        id: "cameraDefault",
        label: "Default camera",
        type: "select",
        options: ["Integrated camera", "External USB camera", "Virtual camera"],
        defaultValue: "Integrated camera",
      },
      {
        id: "micDefault",
        label: "Default microphone",
        type: "select",
        options: ["MacBook microphone", "USB microphone", "Headset microphone"],
        defaultValue: "USB microphone",
      },
      {
        id: "pushToTalk",
        label: "Enable push-to-talk by default",
        type: "checkbox",
        defaultValue: true,
      },
      {
        id: "speakerLevel",
        label: "Default speaker output",
        type: "range",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 72,
      },
    ],
  },
  {
    title: "Workspace Policies",
    description: "Configure room limits, moderation, and participant onboarding rules.",
    fields: [
      {
        id: "defaultRoomLimit",
        label: "Default room limit",
        type: "number",
        min: 4,
        max: 40,
        defaultValue: 24,
      },
      {
        id: "moderationMode",
        label: "Moderation mode",
        type: "select",
        options: ["Open floor", "Host approval", "Invite only"],
        defaultValue: "Host approval",
      },
      {
        id: "waitingRoom",
        label: "Use waiting room before join",
        type: "checkbox",
        defaultValue: true,
      },
      {
        id: "presenceTimeout",
        label: "Presence timeout (seconds)",
        type: "number",
        min: 15,
        max: 120,
        defaultValue: 45,
      },
    ],
  },
  {
    title: "Brand and Presentation",
    description: "Manage copy, logos, and demo presentation settings for reviews and showcases.",
    fields: [
      {
        id: "workspaceName",
        label: "Workspace name",
        type: "text",
        defaultValue: "FeatherSpace Capstone Demo",
      },
      {
        id: "tagline",
        label: "Presentation tagline",
        type: "text",
        defaultValue: "Lightweight spatial communication for structured collaboration",
      },
      {
        id: "heroVariant",
        label: "Landing hero style",
        type: "select",
        options: ["Editorial", "Operations", "Research lab"],
        defaultValue: "Editorial",
      },
      {
        id: "showReviewerHints",
        label: "Show reviewer hints on presentation pages",
        type: "checkbox",
        defaultValue: true,
      },
    ],
  },
];

export const roomLaunchDefaults = {
  roomName: "Capstone Studio Session",
  hostName: "Akash",
  mode: "Hybrid collaboration",
  capacity: 24,
  talkRadius: 180,
  maxPeers: 4,
  environmentFile: "default_room.json",
  allowGuests: true,
};

export const roomExperience = {
  roomName: "Research Studio",
  hostLabel: "Hosted by Akash",
  sceneBadges: ["Live room", "Environment v1.0.0", "Client-side proximity"],
  overlays: [
    {
      title: "Focus zone",
      value: "Whiteboard cluster",
      detail: "4 peers nearby · annotations unlocked",
    },
    {
      title: "Audio radius",
      value: "180 px",
      detail: "Dynamic social proximity enabled",
    },
    {
      title: "Session mode",
      value: "Hybrid review",
      detail: "Stage handoff ready",
    },
  ],
  participants: [
    { name: "Akash", role: "Host", status: "Speaking", accent: "accent" },
    { name: "Mira", role: "RTC Agent", status: "Connected", accent: "secondary" },
    { name: "Jon", role: "Frontend", status: "Whiteboard", accent: "default" },
    { name: "Sara", role: "Backend", status: "Muted", accent: "default" },
    { name: "Dean Review", role: "Guest", status: "Listening", accent: "secondary" },
  ],
  mediaControls: [
    { label: "Mic", state: "Live" },
    { label: "Camera", state: "Preview" },
    { label: "Share", state: "Ready" },
    { label: "PTT", state: "Bound" },
  ],
  livePanels: [
    {
      title: "Connection Health",
      rows: [
        { label: "WebSocket", value: "Stable" },
        { label: "RTC peers", value: "3 active" },
        { label: "Packet trend", value: "Low jitter" },
      ],
    },
    {
      title: "Environment Objects",
      rows: [
        { label: "Whiteboards", value: "2 mounted" },
        { label: "Private tables", value: "4 ready" },
        { label: "Notebook nodes", value: "8 synced" },
      ],
    },
    {
      title: "Activity Feed",
      rows: [
        { label: "11:02", value: "Mira joined review stage" },
        { label: "11:05", value: "Whiteboard session opened" },
        { label: "11:08", value: "Peer limit held at 4" },
      ],
    },
  ],
};
