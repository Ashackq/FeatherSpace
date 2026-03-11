Here is a comprehensive technical specification for your project, designed to be used as a context and complete description (a "perfect prompt") for an AI or a development team. This document synthesizes all critical information from your synopsis into a structured, actionable plan.

-----

## PROJECT TECHNICAL SPECIFICATION: REDUCED SSR SPATIAL COMMUNICATION PLATFORM

### 1\. PROJECT OVERVIEW

| Field             | Detail                                                                                                                                                                                       |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project Title** | A Reduced Server-Side Rendering Spatial Communication Platform for Real-Time Virtual Interaction                                                                                             |
| **Goal**          | Design and implement a lightweight, reproducible, client-dominant system for real-time spatial interaction that minimizes server computational load and infrastructure investment.           |
| **Core Concept**  | A 2D avatar-based virtual environment where real-time audio/video communication is established based on **client-side proximity detection** and managed via WebRTC peer-to-peer connections. |

### 2\. PROBLEM STATEMENT & JUSTIFICATION

| Problem                          | Justification                                                                                                                                                                                             |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server-Centric Architectures** | Existing spatial platforms rely on server-heavy architectures, leading to high computational resources and infrastructure costs (SFUs/MCUs, autoscaling).                                                 |
| **Lack of Lightweight Systems**  | There is a gap in lightweight, open, and reproducible system designs for academic research, experimentation, and small-scale, cost-effective deployments.                                                 |
| **Solution Focus**               | Create a **Client-Dominant Architecture** that limits server responsibilities to only state synchronization and signaling, thus preserving real-time fidelity while reducing operational expenses (OPEX). |

### 3\. PRIMARY OBJECTIVES (DELIVERABLES)

1.  **JSON-Based Modifiable Virtual Environment:**
      * Design a fully configurable environment defined by structured JSON files.
      * Allow dynamic modification of map layout, walkable zones, interactive objects (whiteboards, tables, doors, notebooks), and communication parameters **without changing core application code**.
2.  **JSON Schema Parser for Logic and Rendering:**
      * Create a validated JSON Schema Definition to ensure structural consistency.
      * Develop a parser to dynamically convert validated JSON into: renderable map structure, collision boundary model, proximity parameters, and interactive behavior bindings.
3.  **Real-Time Communication System with WebRTC Relays (Hybrid Model):**
      * Use **WebSockets** for state synchronization (position, room state) and WebRTC signaling.
      * Use **WebRTC** for peer-to-peer (P2P) audio/video media transmission.
      * Support optional **STUN/TURN** mechanisms for NAT traversal and secure media encryption (DTLS-SRTP).
4.  **Proximity-Based Interaction with Dynamic Social Features:**
      * Implement a **client-side proximity engine** that connects users only to the closest peers within a defined `TALK_RADIUS`, subject to a `MAX_PEERS` limit.
      * Include social features: Push-to-Talk (independent of proximity), Global Direct Messaging (DM), Private Rooms (Tables), and Interactive Objects (Whiteboards, Notebooks).

### 4\. ARCHITECTURAL & IMPLEMENTATION METHODOLOGY

#### A. System Design: Hybrid Client-Server

| Component                    | Responsibility (Low-Level)                                                                                | Key Technology               |
| :--------------------------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------- |
| **Client (Client-Dominant)** | UI Rendering, Input Handling, **Proximity Detection**, Peer Selection, WebRTC P2P Connection Management.  | React, Phaser.js, WebRTC API |
| **Server (Minimal Relay)**   | User Authentication, Session Management, Position Synchronization, Room Assignment, **WebRTC Signaling**. | Node.js, Express, WebSockets |
| **Database**                 | Storing user data and JSON template files for room configurations.                                        | MongoDB                      |

#### B. Proximity Engine Logic (Client-Side)

  * **Mechanism:** Client calculates squared distance (`dx² + dy²`) to all other users in the room.
  * **Filtering:** Filters list to users within `TALK_RADIUS`.
  * **Selection:** Sorts by distance and selects the top `MAX_PEERS`.
  * **Connection:** Performs a diff against current connections to dynamically establish or terminate WebRTC peer connections.
  * **Performance:** Checks performed at interval-based checks (e.g., 200ms).

#### C. Data Structure & Validation

  * **Environment:** Data-driven architecture; all environmental components loaded dynamically via JSON parsing.
  * **Validation:** Use **JSON Schema standard** (with a tool like AJV) to validate required fields, data types, structural hierarchy, and version compatibility before runtime loading.

### 5\. SCOPE DEFINITION

| Feature                              | Status           | Detail                                                                                                  | Target Scale                                     |
| :----------------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------ | :----------------------------------------------- |
| **JSON Configurable Environment**    | **IN SCOPE**     | Full dynamic definition of map, walkable zones, objects, and comms params via JSON.                     | N/A                                              |
| **Real-Time Multi-User Environment** | **IN SCOPE**     | Avatar movement, position synchronization via WebSockets.                                               | **20–40 concurrent users per room** (Demo Scale) |
| **Proximity-Based A/V Comms**        | **IN SCOPE**     | WebRTC for P2P **Audio and Video** streams, client-side proximity logic, Push-to-Talk.                  | N/A                                              |
| **Interactive Features**             | **IN SCOPE**     | Global DM, Private Rooms (Tables), Interactive Objects (Whiteboards, Notebooks).                        | N/A                                              |
| **Large-Scale Production**           | **OUT OF SCOPE** | No distributed server clusters, cloud auto-scaling, or enterprise-level high availability architecture. | N/A                                              |
| **Advanced Media Optimization**      | **OUT OF SCOPE** | No adaptive bitrate streaming (ABR), recording, or large-scale SFU/MCU media server deployment.         | N/A                                              |
| **Enterprise Security/MMO**          | **OUT OF SCOPE** | No MFA/SSO integration, advanced moderation, or support for hundreds of concurrent users per room.      | N/A                                              |

### 6\. KEY DELIVERABLES & EXPECTED OUTCOMES

  * **Configurable Environments:** Working system where room parameters are controlled by external, validated JSON files.
  * **Low-Latency Sync:** Real-time, low-latency position updates via WebSockets.
  * **Efficient P2P Communications:** Audio/video established via WebRTC P2P to minimize server bandwidth consumption.
  * **Simulated Spatial Interaction:** Functional proximity engine that dynamically manages connections to closest peers, simulating realistic spatial conversations.
  * **Client-Centric Model:** Verified reduced server load, with the server acting primarily as a signaling and relay node.
