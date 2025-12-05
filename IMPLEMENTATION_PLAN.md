You are an expert TypeScript game engineer working in a React + Vite project (TypeScript template is already initialized).

Your task: implement a **local hot-seat 2-player web game** about two small “Titan-like” submersibles diving down to the Titanic and then trying to escape to the surface. The whole game must run **entirely on the client** (no backend for now), but the core game engine must be written in a **deterministic, replayable way** so that in the future it can be run authoritatively on a server using the same seed and recorded inputs.

## Tech stack and structure

-   Use **React + TypeScript + Vite**.
-   Use **HTML5 Canvas 2D** for rendering, driven by `requestAnimationFrame`.
-   Separate **core game engine** from **rendering/UI**:
    -   `src/engine/*` – pure TypeScript (no DOM/React):
        -   `types.ts` – shared types and enums.
        -   `config.ts` – constants.
        -   `rng.ts` – deterministic seeded RNG.
        -   `obstacleGenerator.ts` – spawning logic for obstacles.
        -   `gameState.ts` – initialization and update logic.
    -   `src/ui/*` – React components + canvas rendering:
        -   `GameCanvas.tsx` – canvas component that draws the game state.
        -   `GameView.tsx` – main game screen: holds state, main loop, HUD, etc.
        -   `MainMenu.tsx`, `GameOverScreen.tsx` – simple screens.
-   Add a basic test setup (Vitest or Jest) to test core engine determinism.

## Core game concept

-   Two players share a single screen at the start, both piloting small submersibles that dive vertically downward.
-   As they dive, they must **avoid obstacles**; deeper = faster movement + more wear on the sub.
-   Each sub has:
    -   **HP** (e.g. 3 hits).
    -   **Wear**: 0–100%. Wear increases over time and with depth, and additionally on collision.
-   If **wear reaches 100%** or HP drops to 0, the sub **implodes** and that player dies.
-   At any time _before_ implosion during the dive, a player can press a key to **dump ballast** and eject a **single-use escape capsule**:
    -   This switches that player into **ascent mode**.
    -   The capsule has **only 1 HP**: any collision during ascent = instant death.
    -   The capsule moves upward quickly, retracing the same obstacle field, but in a **much faster / more intense** way.
-   If a capsule reaches the surface without any collision, that player **survives** and the game records their run (depth, outcome).
-   Game ends when both players are either **dead** or **escaped**.

## Camera & split-screen behavior

-   Initially, when **both players are descending**, they share a **single canvas view**:
    -   Think of a vertical-scrolling side view.
    -   The camera follows their depth; the subs can move horizontally left/right within that view.
-   As the subs dive deeper, the **water gradually darkens** (color gradient based on depth).
-   **When any player ejects and starts ascending**:
    -   The view should switch to a **split-screen layout**:
        -   Top region: players in **ascent mode** (capsules going up).
        -   Bottom region: players still in **descent mode** (subs going down).
    -   If later both players are in the same mode (only ascent or both dead), you can collapse back to a single full-screen view for the remaining active player, for simplicity.
-   We don’t need sophisticated camera logic; just enough so that:
    -   While descending together → shared view.
    -   Once at least one is ascending and at least one still descending → split-screen vertically (top/bottom).
    -   If only one active player left → single view.

## Obstacles and environment

All obstacles must be generated **deterministically** based on a **seed** and the current depth.

### Obstacle types

1. **Corals**

    - Passive environment obstacles at **shallow and mid depths**.
    - Any collision:
        - Small HP damage.
        - Small wear increase.
    - Used heavily in the early part of the dive.

2. **Ice blocks / ice floes**

    - Start appearing at **greater depths** (after corals).
    - Mechanically similar to corals but:
        - Higher HP damage.
        - Higher wear increase.
    - Represent more dangerous, rigid obstacles.

3. **Sea turtles**
    - First living creatures encountered at **mid to deeper depths**.
    - Collision:
        - Small HP damage (comparable to corals or even slightly less).
        - Small or moderate wear increase.
    - They may move horizontally or vertically a bit (optional), but keep movement simple to stay deterministic and easy to simulate.

Later we might add more creature types, but for now implement only these three.

### Environment visual behavior

-   Background: vertical **gradient** representing ocean depth:
    -   Near surface: light blue.
    -   Mid-depth: darker blue.
    -   Deep: almost black.
-   You can implement this as a simple gradient fill or by darkening the entire scene as depth increases.
-   Include a symbolic **Titanic wreck** near the maximum depth (purely as a background landmark, not a collision object initially).

## Progression, speed, and wear

-   Define a `maxDepth` constant (e.g. some large value representing the theoretical bottom).
-   **Vertical speed** increases with depth, e.g.:

    ```ts
    speed = baseSpeed + depth * speedFactor;
    ```

*   **Wear** should increase:

    -   Over time (base wear rate).
    -   Proportionally to depth (the deeper, the faster the wear accumulates).
    -   Additionally on each collision with an obstacle, with multipliers depending on obstacle type.

Example (you can adjust values):

-   Base wear per second.
-   Plus extra wear = `extraWearFactor * normalizedDepth`.
-   On collision, add `collisionWear[obstacleType]`.

When wear reaches `100`, the sub implodes immediately.

## Ascent logic

-   When a player presses the **“dump ballast”** key while still alive and descending:

    -   That player’s submarine is effectively left behind.
    -   A **capsule** is spawned at the same position, with:

        -   HP = 1.
        -   Wear no longer matters (capsule fails instantly on any hit).
        -   High vertical speed upwards (reverse of descent).

    -   The capsule moves upward through the **same field of obstacles**, but much faster:

        -   You must design obstacle generation so that the positions are consistent and can be traversed in both directions.

-   Any collision during ascent = instant death for that player.
-   The capsule reaches the surface once its depth crosses back above 0 (or some small threshold), at which point that player wins/survives.

## Deterministic engine and RNG

The game engine must be **deterministic**:

-   Introduce a `SeededRNG` type / class in `rng.ts`:

    -   Implement a simple deterministic generator (e.g. LCG).
    -   Given the same seed and the same sequence of calls, it must produce the same sequence of numbers.

-   Obstacle generation, minor enemy movements, and any “random” behavior must _only_ use this RNG.
-   Use a **fixed time step** in the core simulation (`dt`, e.g. 1/60 s per tick) for updates.

### Input and replay

The engine must be designed so that a future server can reproduce runs:

-   Define a `PlayerInputFrame` type, something like:

    ```ts
    type PlayerAction = 'dumpBallast' | null;

    interface PlayerInputFrame {
        frame: number; // simulation frame index
        left: boolean;
        right: boolean;
        action: PlayerAction;
    }
    ```

-   The React/UI layer should:

    -   Capture keyboard input per frame.
    -   Maintain an array of `PlayerInputFrame` per player.

-   The core engine exposes functions like:

    ```ts
    interface GameState {
        /* ... */
    }

    interface EngineConfig {
        seed: number;
        /* other config constants if needed */
    }

    function createInitialState(config: EngineConfig): GameState;

    function updateGameState(
        state: GameState,
        inputs: { [playerId: string]: PlayerInputFrame },
        dt: number
    ): GameState;
    ```

-   For determinism:

    -   Use **immutable** or “copy-on-write” patterns for state, or very clearly control mutation.
    -   Always apply inputs and RNG calls in a consistent order.

Add tests to verify:

-   For the same `seed` and same sequence of inputs → final state is identical.
-   For two different seeds with identical inputs → obstacle layouts differ.

## Player controls (hot-seat)

Implement keyboard controls for two players on a single keyboard:

-   **Player 1**:

    -   Move left: `A`
    -   Move right: `D`
    -   Dump ballast (start ascent): `W`

-   **Player 2**:

    -   Move left: `Left Arrow`
    -   Move right: `Right Arrow`
    -   Dump ballast: `Up Arrow`

During ascent, the same keys control the capsule’s horizontal movement.

Implement a small React hook like `useKeyboardInput()` that maps keydown/keyup to a current input state for each player, which is then sampled each simulation frame to build the `PlayerInputFrame` objects.

## Collision and physics

-   Use simple **axis-aligned bounding box (AABB)** collision.
-   For each simulation tick:

    1. Update positions based on vertical speed and horizontal input.
    2. Check collisions against all active obstacles in the current visible depth range.
    3. Apply HP and wear changes depending on obstacle type and current mode (sub vs capsule).

-   Keep physics simple and tunable via constants in `config.ts`.

## React & rendering layer

-   `GameCanvas.tsx`:

    -   Renders a `<canvas>` element.
    -   Uses `useEffect` + `requestAnimationFrame` to:

        -   Step the engine with a fixed `dt`.
        -   Then draw the current `GameState` onto the canvas.

    -   Handle resizing so the game scales to the size of the window while preserving aspect ratio.

-   Drawing:

    -   For now, represent subs, capsules, and obstacles with simple shapes (rectangles, circles, icons).
    -   Draw the background gradient based on depth.
    -   Implement split-screen: in one canvas, use two “viewports” (top and bottom halves) rendered by adjusting the transform / clearing only the relevant region.

-   HUD overlay (can be regular React elements over the canvas):

    -   Display per-player:

        -   Depth
        -   HP
        -   Wear (%)
        -   State (Descending / Ascending / Dead / Escaped)

    -   Optionally show the seed used for this run.

## Game flow

Implement a very simple state machine:

-   `MainMenu`:

    -   “Start Game” button.
    -   Input field to set a custom seed (optional, otherwise generate random seed in the UI and pass to engine).
    -   “Controls” hint (keyboard mapping).

-   `GameView`:

    -   Creates the engine with a given seed.
    -   Starts the simulation and rendering.

-   `GameOverScreen`:

    -   Shows each player’s outcome:

        -   Survived / Imploded / Crashed During Ascent.
        -   Maximum depth reached.

    -   Show overall winner:

        -   If at least one survived: surviving players are winners.
        -   If both died: winner is the one who reached the greater depth before death.

    -   Button to return to `MainMenu` or restart with the same seed.

## Code quality

-   Use strict TypeScript (no `any` except where absolutely necessary).
-   Document the main types and functions with comments.
-   Keep the engine pure and independent from React.
-   Focus on:

    -   Correct game logic.
    -   Deterministic behavior.
    -   Clean separation of concerns.

-   It’s okay to keep art and visual style minimal for now; prioritize mechanics and architecture.

Your output should be:

1. A short **architecture overview** (file structure + responsibilities).
2. The actual **implementation**: TypeScript/React code for all engine and UI parts.
3. A few **example tests** for engine determinism and obstacle spawning.
4. Brief explanation of how to run the game (`npm install`, `npm run dev`) in a Vite project.
