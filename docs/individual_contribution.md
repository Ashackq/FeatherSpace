# Project Contributors and Module Responsibilities

| Sr. No. | PRN No. | Student Name | Individual Project Student Specific Objective |
|---|---|---|---|
| 1 | 1032221820 | Suryabhaas Karmakar | Design and implement a JSON-driven virtual environment architecture supporting configurable room layouts, communication parameters, and dynamic environment loading. |
| 2 | 1032221882 | Akash Patel | Develop JSON schema validation, parsing mechanisms, and client-side rendering logic for dynamic visualization and interaction handling. |
| 3 | 1032221797 | Tamanud Ghule | Implement real-time synchronization and peer-to-peer communication using WebSockets, WebRTC, and STUN/TURN integration. |
| 4 | 1032221559 | Chakshu Negi Singh | Design and implement client-side proximity interaction systems and collaborative social features including push-to-talk, whiteboards, and private communication zones. |

---

# 1. Suryabhaas Karmakar

## Name of the Student
Suryabhaas Karmakar

## PRN No.
1032221820

## Module Title
JSON-Based Virtual Environment and System Architecture

## Problem Statement
Develop a configurable virtual environment system that dynamically loads room layouts, communication parameters, and interactive object configurations through structured JSON templates, while minimizing hardcoded application logic.

## Project Module Objectives (Individual Perspective)

1. Define a scalable and modular architecture for environment management.
2. Build a JSON-driven room model for map, spawn, walkability, and object metadata.
3. Implement a runtime configuration loading pipeline for dynamic room initialization.
4. Standardize communication-related room parameters for consistent behavior.
5. Enable extensibility so new rooms can be added without code-level rewrites.

## Project Module Scope (Individual Perspective)

This module covers the architecture and environment configuration layer of FeatherSpace. The scope includes:

1. Defining room configuration structure and naming conventions.
2. Organizing room metadata, map references, spawn points, and walkable zones.
3. Supporting initialization-time loading of room configurations.
4. Passing validated room parameters to parser, renderer, and communication modules.
5. Maintaining separation between environment data and runtime logic.

## Project Module(s) - Individual Contribution

1. Designed the overall high-level architecture for JSON-driven environment orchestration.
2. Created room template structures to capture spatial and interaction metadata.
3. Implemented and documented the environment loading pipeline from configuration to runtime state.
4. Defined configuration contracts for walkable regions, spawn positions, and room identity metadata.
5. Standardized communication parameter fields consumed by sync and proximity systems.
6. Coordinated cross-module integration interfaces with parser/rendering and server sync layers.

## Hardware and Software Requirements

### Hardware Requirements

1. Intel i5 processor or equivalent
2. 8 GB RAM
3. Stable internet connection

### Software Requirements

1. Node.js
2. JavaScript/TypeScript toolchain
3. JSON schema validation utilities
4. VS Code
5. Git

## Module Interfaces

### 1. JSON Template Loader Interface
Accepts room identifier and environment key, returns room configuration payload.

### 2. Environment Initialization Interface
Transforms validated room configuration into runtime-ready room state.

### 3. Communication Parameter Configuration Interface
Exposes room-level communication constraints and settings to sync/audio modules.

## Module Dependencies

1. JSON Schema Parser
2. Client Rendering Engine
3. Synchronization and signaling server

## Module Design

The design follows a data-driven approach in which each virtual room is represented as structured configuration instead of hardcoded scene logic. The architecture enforces clear contracts between environment data and runtime systems. This reduces coupling, improves maintainability, and enables rapid room addition or modification.

## Module Implementation

During room selection/entry, the client loads the corresponding room configuration. The module performs configuration parsing and normalization for:

1. Room metadata and map references
2. Spawn and navigation constraints
3. Walkable/collision-related spatial descriptors
4. Communication parameters used by realtime subsystems

The normalized configuration is then handed off to rendering, synchronization, and interaction modules for scene bootstrap.

## Module Testing Strategies

1. Configuration structure validation against expected schema fields
2. Positive/negative tests for room loading with valid and invalid JSON
3. Spawn point and walkable zone consistency checks
4. Runtime initialization tests for multiple room templates
5. Regression checks when introducing new configuration keys

## Module Deployment

This module is deployed as part of the browser client build. Room configurations are bundled/served as static environment assets and are loaded dynamically at runtime based on room selection.

## Technical Workflow and Execution Plan

The execution plan for this module followed an iterative flow so that configuration architecture could evolve alongside feature implementation:

1. Identify required room capabilities from product use-cases (navigation, interaction, communication setup).
2. Model each capability as JSON fields and define naming, nesting, and type constraints.
3. Create baseline room templates for development and integration testing.
4. Integrate runtime loader to consume templates and hand over normalized data to dependent modules.
5. Validate compatibility whenever schema or configuration contracts changed.

This workflow minimized integration breaks and made room onboarding predictable for the rendering and synchronization teams.

## Key Deliverables

1. Baseline room configuration template format for all supported environments.
2. Field-level documentation for metadata, spawn, walkability, and communication settings.
3. Runtime-compatible configuration loading and normalization sequence.
4. Integration-ready contracts consumed by parser, renderer, and synchronization modules.
5. Versioning and extensibility guidance for adding future room fields without breaking existing templates.

## Risks, Constraints, and Mitigation

1. Risk: Schema drift across modules can lead to runtime failures.
Mitigation: Maintained explicit configuration contracts and coordinated change communication.

2. Risk: Invalid room data can block user entry and scene startup.
Mitigation: Introduced validation-first loading and defensive parsing paths.

3. Risk: Hardcoded fallbacks can reduce configurability.
Mitigation: Prioritized data-driven defaults and centralized configuration access patterns.

4. Constraint: New room requirements emerged during implementation.
Mitigation: Used extensible JSON structures to absorb iterative changes with minimal code churn.

## Measurable Outcomes (Module-Level)

1. New room onboarding effort reduced to configuration authoring plus asset mapping.
2. Consistent room bootstrap process achieved across available environment templates.
3. Lower coupling between scene setup logic and static code structures.
4. Improved maintainability for future feature additions such as advanced interaction zones and communication policies.

## Future Enhancements

1. Introduce formal schema versioning and migration utilities.
2. Add automated linting for room templates in CI pipelines.
3. Provide a visual room configuration editor for non-developer content updates.
4. Add semantic validation (for example, spawn inside walkable area checks) as a pre-deploy gate.

---

# 2. Akash Patel

## Name of the Student
Akash Patel

## PRN No.
1032221882

## Module Title
JSON Schema Parser and Rendering Engine

## Problem Statement
Develop a schema-aware rendering subsystem that validates room configuration files and converts them into runtime-renderable structures for maps, avatars, collision zones, and interactive objects in a browser-based virtual environment.

## Project Module Objectives (Individual Perspective)

1. Define and maintain robust JSON schema rules for room configuration integrity.
2. Implement parser logic to transform raw configuration into normalized runtime entities.
3. Build a client-side rendering pipeline for map layers, avatars, and objects.
4. Implement movement, collision constraints, and interaction binding.
5. Ensure visual consistency and stable performance across supported room templates.

## Project Module Scope (Individual Perspective)

This module addresses the complete data-to-visualization pipeline on the client side. The scope includes:

1. Schema definition and validation constraints for environment JSON.
2. Parser and runtime transformation of map, object, and physics-relevant data.
3. Rendering of scene assets and player entities using browser graphics frameworks.
4. Collision boundary mapping and movement limitation controls.
5. Interaction registration for clickable or trigger-based room objects.

## Project Module(s) - Individual Contribution

1. Designed schema structures and key validation rules for room configuration files.
2. Implemented parsing and normalization logic for room metadata, object lists, and spatial fields.
3. Built rendering integration for map backgrounds, entity placement, and visual updates.
4. Implemented avatar rendering behavior and frame-wise position update handling.
5. Defined collision boundaries and integrated movement checks against restricted regions.
6. Mapped configured object behaviors to interaction handlers for runtime user actions.

## Hardware and Software Requirements

### Hardware Requirements

1. Intel i5 processor or equivalent
2. 8 GB RAM
3. Browser-compatible graphics support

### Software Requirements

1. JavaScript/TypeScript
2. HTML5 Canvas and Phaser.js
3. JSON schema validation utilities
4. VS Code
5. Node.js-based development toolchain

## Module Interfaces

### 1. Parser Interface
Accepts validated room configuration and returns normalized runtime scene data.

### 2. Rendering Engine Interface
Consumes normalized scene data and draws map, avatars, and interactive objects.

### 3. Object Binding Interface
Associates configured object identifiers/types with runtime interaction handlers.

### 4. Collision Detection Interface
Provides boundary checks and collision resolution for avatar navigation.

## Module Dependencies

1. Environment Loader Module
2. Realtime Synchronization System
3. Interactive Object and Event Handling Layer

## Module Design

The module follows a staged architecture:

1. Input validation stage (schema-level correctness)
2. Parsing and normalization stage (runtime data shaping)
3. Rendering and interaction stage (continuous frame updates)

This layered model ensures invalid data is rejected early, rendering remains deterministic, and interaction logic stays decoupled from raw configuration format.

## Module Implementation

At runtime, validated configuration is parsed into strongly structured scene objects. The renderer then initializes map assets and spawns entities using configuration-defined coordinates and dimensions. During each update cycle, the module:

1. Applies latest avatar positions from synchronization events
2. Re-renders entity states and interaction markers
3. Checks movement against collision polygons/zones
4. Triggers configured object actions when interaction conditions are met

This implementation keeps the rendering loop client-resident for responsiveness while relying on synchronized state streams for multi-user consistency.

## Module Testing Strategies

1. Schema validation tests for required fields, type checks, and malformed payload rejection
2. Parser transformation tests for expected runtime object structure generation
3. Rendering consistency tests across multiple room templates and viewport sizes
4. Collision tests for boundary adherence and non-walkable zone enforcement
5. Avatar movement and update tests under concurrent multi-user state changes
6. Interaction mapping tests for object trigger reliability

## Module Deployment

The module is packaged within the client application bundle and executes in the browser runtime. It is initialized automatically during room load and receives room/state updates through integrated environment and synchronization modules.

## Technical Workflow and Execution Plan

The implementation sequence for this module was organized as a staged rendering pipeline:

1. Define schema constraints for mandatory and optional room fields.
2. Build parser transformations to normalize raw JSON into rendering-safe structures.
3. Integrate rendering primitives for map layers, object sprites, and avatar entities.
4. Add movement and collision checks against configured boundaries.
5. Bind object interaction metadata to user-triggered behaviors.
6. Validate multi-user update correctness through synchronized state ingestion.

This staged flow improved debugging by isolating failure domains into validation, transformation, or rendering layers.

## Key Deliverables

1. Schema ruleset covering room metadata, spatial fields, and interactive objects.
2. Runtime parser converting validated templates to scene-ready structures.
3. Rendering logic for map assets, entities, and object overlays.
4. Collision and movement control for constrained user navigation.
5. Interaction binding model connecting object definitions to behavior handlers.
6. Update-loop integration for synchronized avatar position and state rendering.

## Performance and Reliability Considerations

1. Client-side rendering reduces server-side load and supports responsive interaction.
2. Early schema validation prevents invalid payload propagation into the frame loop.
3. Normalized runtime structures reduce repetitive transform cost during continuous updates.
4. Collision checks are scoped to relevant boundaries to limit unnecessary computations.
5. Deterministic parsing and binding improve reproducibility during regression testing.

## Risks, Constraints, and Mitigation

1. Risk: Malformed configuration may create invisible or misplaced entities.
Mitigation: Added strict validation and parser assertions for key spatial fields.

2. Risk: High object density may reduce rendering performance.
Mitigation: Maintained simplified object update paths and optimized redraw logic.

3. Risk: Mismatch between interaction metadata and handlers.
Mitigation: Enforced explicit type-based object behavior mapping.

4. Constraint: Dynamic rooms require compatibility with evolving schemas.
Mitigation: Adopted modular parser design with clear extension points.

## Measurable Outcomes (Module-Level)

1. Stable rendering across multiple room templates using a shared data contract.
2. Predictable collision behavior for avatar movement boundaries.
3. Improved consistency between configured objects and runtime interaction behavior.
4. Faster onboarding of new maps due to reusable parser and renderer paths.

## Future Enhancements

1. Introduce render culling for large maps and dense object environments.
2. Add parser diagnostics output for easier author debugging.
3. Support animation metadata in configuration for richer object behavior.
4. Add snapshot-based visual regression tests for scene consistency.

---

# 3. Tamanud Ghule

## Name of the Student
Tamanud Ghule

## PRN No.
1032221797

## Problem Statement
Develop a real-time communication and synchronization system capable of maintaining multi-user interaction through WebSockets and peer-to-peer WebRTC communication.

## Module Title
Real-Time Communication and Synchronization System

## Project Module Objectives (Individual Perspective)

1. Implement WebSocket synchronization.
2. Develop WebRTC signaling workflow.
3. Manage peer connection lifecycle.
4. Configure STUN/TURN support.
5. Implement direct messaging functionality.

## Project Module Scope (Individual Perspective)

This module implements the communication backbone of FeatherSpace. The scope includes:

1. Realtime room-state synchronization via WebSocket channels.
2. WebRTC signaling exchange for peer connection setup and teardown.
3. Session and participant state management for join/leave and reconnection handling.
4. STUN/TURN-assisted connectivity support for NAT traversal.
5. Low-latency direct messaging and event propagation between participants.

## Project Module(s) - Individual Contribution

1. Built WebSocket synchronization server.
2. Implemented signaling architecture.
3. Managed WebRTC peer connections.
4. Configured STUN/TURN support.
5. Developed direct messaging system.
6. Implemented session synchronization.

## Hardware and Software Requirements

### Hardware Requirements

1. Stable broadband internet
2. Multi-client testing environment

### Software Requirements

1. Node.js
2. Socket.IO / WebSockets
3. WebRTC APIs
4. STUN/TURN Services
5. VS Code

## Module Interfaces

### 1. WebSocket Communication Interface
Manages bidirectional event flow for room state, presence, and synchronization payloads.

### 2. WebRTC Signaling Interface
Exchanges SDP offers/answers and ICE candidates through signaling channels.

### 3. Direct Messaging Interface
Supports user-to-user message delivery for lightweight private communication.

### 4. Session Synchronization Interface
Maintains participant lifecycle state including join, update, disconnect, and recovery.

## Module Dependencies

1. Proximity Engine
2. Rendering Engine
3. Browser Media APIs

## Module Design

The communication architecture follows a hybrid model:

1. WebSockets are used for authoritative room synchronization and signaling relay.
2. WebRTC handles peer-to-peer media and low-latency direct channels where applicable.
3. TURN fallback is used when direct peer paths are unavailable due to network restrictions.

This model balances reliability and latency while preserving real-time interaction quality.

## Module Implementation

The implementation includes room-based channel management and event routing for synchronization updates. On peer discovery, signaling messages are relayed through the server until a WebRTC session is established. The module handles:

1. Participant registration and room membership updates.
2. Offer/answer and ICE exchange sequencing.
3. Connection timeout and retry handling.
4. Session cleanup on disconnect to prevent stale peer state.
5. Direct event dispatch for messaging and interaction-linked communication.

This design ensures users maintain coherent room state even during intermittent network conditions.

## Module Testing Strategies

1. Peer connection testing
2. Synchronization testing
3. Audio/video communication testing
4. NAT traversal testing
5. Direct messaging testing

Additional validation areas:

1. Reconnection and state recovery testing after transient disconnects.
2. Multi-user room load testing for event ordering consistency.
3. Signaling race-condition tests during simultaneous joins/leaves.
4. Server-side message integrity checks for malformed payload rejection.

## Module Deployment

The module is deployed using a Node.js server with WebSocket communication support and optional STUN/TURN relay configuration.

## Technical Workflow and Execution Plan

1. Design event contracts for synchronization and signaling payloads.
2. Implement server-side room/channel lifecycle management.
3. Integrate WebRTC signaling flow with client media stack.
4. Add TURN-compatible fallback logic and connection monitoring.
5. Validate behavior under concurrency and unstable network conditions.

This workflow enabled incremental integration with rendering and proximity features while keeping communication logic resilient.

## Key Deliverables

1. Realtime synchronization server and room presence management.
2. Signaling pipeline for peer connection establishment.
3. STUN/TURN connectivity handling strategy.
4. Direct messaging support integrated with room context.
5. Connection lifecycle controls for stable multi-user sessions.

## Risks, Constraints, and Mitigation

1. Risk: NAT/firewall restrictions can block direct peer setup.
Mitigation: TURN fallback and robust ICE candidate handling.

2. Risk: Concurrent joins/leaves may introduce stale session state.
Mitigation: Explicit lifecycle cleanup and state reconciliation events.

3. Risk: Network jitter can cause temporary desynchronization.
Mitigation: Frequent state updates and reconnection-aware recovery logic.

4. Constraint: Browser media permission behavior varies by platform.
Mitigation: Added permission-aware connection initiation sequence.

## Measurable Outcomes (Module-Level)

1. Reliable room-state propagation during multi-user interactions.
2. Successful peer setup across mixed network conditions.
3. Reduced stale connection artifacts through lifecycle cleanup routines.
4. Improved user continuity through reconnection and session recovery support.

## Future Enhancements

1. Add adaptive bitrate and media quality controls.
2. Introduce observability dashboards for signaling and peer health metrics.
3. Implement region-aware relay selection for lower latency.
4. Add end-to-end encrypted messaging channels for private interactions.

---

# 4. Chakshu Negi Singh

## Name of the Student
Chakshu Negi Singh

## PRN No.
1032221559

## Problem Statement
Develop a client-side proximity interaction system capable of dynamically managing communication behavior and collaborative interaction based on user movement within the virtual environment.

## Module Title
Proximity-Based Interaction and Social Features

## Project Module Objectives (Individual Perspective)

1. Implement client-side proximity detection.
2. Dynamically establish and remove peer connections.
3. Develop push-to-talk functionality.
4. Implement private tables and room interaction.
5. Develop collaborative interactive systems.

## Project Module Scope (Individual Perspective)

The module is responsible for social interaction behavior that depends on avatar location and room context. The scope includes:

1. Distance-based peer discovery and prioritization.
2. Dynamic communication state updates as users move through the map.
3. Push-to-talk controls for controlled voice participation.
4. Zone-specific interaction support for private tables and collaborative areas.
5. Synchronization hooks for whiteboards/notebooks and context-aware social actions.

## Project Module(s) - Individual Contribution

1. Implemented proximity engine.
2. Developed automatic peer connect/disconnect logic.
3. Implemented push-to-talk functionality.
4. Developed private table interaction zones.
5. Implemented whiteboards and notebooks.
6. Managed room navigation logic.

## Hardware and Software Requirements

### Hardware Requirements

1. Intel i5 Processor or equivalent
2. Stable internet connectivity
3. Audio input device

### Software Requirements

1. JavaScript
2. WebRTC APIs
3. WebSocket APIs
4. HTML5 Canvas
5. VS Code

## Module Interfaces

### 1. Proximity Detection Interface
Computes user-to-user distance and emits interaction state transitions.

### 2. Interactive Object Interface
Binds social/collaborative object behavior to user presence and interaction events.

### 3. Push-to-Talk Interface
Controls microphone activation and communication participation state.

### 4. Room Navigation Interface
Coordinates movement-aware transitions between interaction contexts/zones.

## Module Dependencies

1. Synchronization Server
2. WebRTC Communication Module
3. Rendering Engine

## Module Design

The module uses client-side spatial computation to control social behavior in real time. Core design principles include:

1. Event-driven proximity transitions (enter range, leave range, zone switch).
2. Controlled communication activation through push-to-talk policy.
3. Contextual interaction enablement for private and collaborative zones.
4. Lightweight local computation to preserve responsiveness without excessive server dependency.

## Module Implementation

The proximity engine evaluates user positions continuously and updates communication and interaction states according to configurable radius thresholds and zone rules. Implementation responsibilities include:

1. Maintaining active-neighbor sets per user.
2. Triggering peer connect/disconnect decisions on threshold crossing.
3. Enforcing zone-level communication constraints for private spaces.
4. Integrating push-to-talk state with current social context.
5. Synchronizing collaborative object access when multiple users interact concurrently.

This approach keeps interaction behavior fluid while avoiding unnecessary persistent peer links.

## Module Testing Strategies

1. Proximity calculation testing
2. Push-to-talk testing
3. Peer connection lifecycle testing
4. Whiteboard synchronization testing
5. Room transition testing

Additional validation areas:

1. Threshold boundary tests to prevent oscillation near distance limits.
2. Simultaneous zone-entry tests for multi-user private table behavior.
3. Stress tests for frequent movement and rapid state changes.
4. Accessibility checks for interaction controls and communication toggles.

## Module Deployment

The module is deployed within the browser client and operates locally using synchronized room state received from the server.

## Technical Workflow and Execution Plan

1. Define proximity radius and zone policies from collaboration requirements.
2. Implement detection and event transition logic.
3. Integrate with communication stack for dynamic peer state updates.
4. Add push-to-talk controls with clear activation/deactivation flows.
5. Validate multi-user social interactions under realistic navigation scenarios.

This sequence ensured proximity logic remained predictable, testable, and compatible with communication and rendering modules.

## Key Deliverables

1. Configurable proximity engine with dynamic peer state management.
2. Push-to-talk feature integrated with movement-aware social context.
3. Private zone interaction behavior for controlled local collaboration.
4. Collaborative object workflows for whiteboard/notebook use-cases.
5. Navigation-aware interaction transitions for immersive room behavior.

## Risks, Constraints, and Mitigation

1. Risk: Rapid movement may cause frequent connect/disconnect thrashing.
Mitigation: Added threshold-based state stabilization and controlled transition handling.

2. Risk: Overlapping interaction zones may produce ambiguous behavior.
Mitigation: Defined explicit zone precedence and conflict-resolution rules.

3. Risk: Audio control misuse can degrade shared communication quality.
Mitigation: Integrated push-to-talk gating with context-aware participation controls.

4. Constraint: Collaborative object state must remain consistent for all participants.
Mitigation: Coupled interaction events with synchronized state updates.

## Measurable Outcomes (Module-Level)

1. Improved realism through distance-aware communication behavior.
2. Reduced unnecessary peer links using dynamic connection control.
3. Better collaboration experience in private and shared interaction zones.
4. More predictable social interaction flow during navigation-heavy sessions.

## Future Enhancements

1. Add configurable hysteresis windows for smoother proximity transitions.
2. Introduce role-based interaction permissions for collaborative objects.
3. Add analytics for zone utilization and social interaction heatmaps.
4. Extend push-to-talk with group channels and moderation controls.