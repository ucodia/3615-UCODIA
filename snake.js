import { startServer } from "./server.js";
import { Minitel, MinitelWS } from "./minitel.js";

// Game constants
const GAME_WIDTH = 21; // Nokia-style grid width
const GAME_HEIGHT = 21; // Nokia-style grid height
const INITIAL_SNAKE_LENGTH = 3;
const INITIAL_DELAY = 300; // milliseconds between moves
const MIN_DELAY = 100; // fastest speed

// Game elements
const EMPTY = " ";
const SNAKE_HEAD = "O";
const SNAKE_BODY = "o";
const FOOD = "*";
const WALL = String.fromCharCode(0x7f);

async function snakeGame(websocket) {
  const m = new Minitel(new MinitelWS(websocket));

  let running = true;
  let score = 0;
  let lastScore = 0;
  let delay = INITIAL_DELAY;
  let direction = "right";
  let nextDirection = "right";
  let snake = [];
  let lastTail = null;
  let food = { x: 0, y: 0 };
  let foodEaten = false;

  // Initialize the game
  function initGame() {
    // Create initial snake in the middle of the screen
    snake = [];
    const midY = Math.floor(GAME_HEIGHT / 2);
    const midX = Math.floor(GAME_WIDTH / 4);

    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
      snake.push({ x: midX - i, y: midY });
    }

    // Place initial food
    placeFood();

    // Reset game state
    score = 0;
    lastScore = 0;
    delay = INITIAL_DELAY;
    direction = "right";
    nextDirection = "right";
    running = true;
    lastTail = null;
    foodEaten = false;
  }

  // Place food at random position
  function placeFood() {
    let validPosition = false;

    while (!validPosition) {
      food.x = Math.floor(Math.random() * (GAME_WIDTH - 2)) + 1;
      food.y = Math.floor(Math.random() * (GAME_HEIGHT - 2)) + 1;

      // Check if food is not on snake
      validPosition = true;
      for (const segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
          validPosition = false;
          break;
        }
      }
    }
  }

  // Draw the initial game board (only once)
  async function drawInitialBoard() {
    await m.home();
    await m.cls();

    // Grid starts at position (1,2) - leaving 1 line at top
    const gridX = 1;
    const gridY = 2;

    // Draw walls with white color
    await m.color(m.blanc);

    // Top wall
    await m.pos(gridY, gridX);
    await m.plot(WALL, GAME_WIDTH);

    // Bottom wall
    await m.pos(gridY + GAME_HEIGHT - 1, gridX);
    await m.plot(WALL, GAME_WIDTH);

    // Left and right walls
    for (let y = 1; y < GAME_HEIGHT - 1; y++) {
      await m.pos(gridY + y, gridX);
      await m.print(WALL);
      await m.pos(gridY + y, gridX + GAME_WIDTH - 1);
      await m.print(WALL);
    }

    // Draw UI on the right
    const uiX = gridX + GAME_WIDTH + 2;

    // Title
    await m.pos(2, uiX);
    await m.color(m.blanc);
    await m.print("SNAKE");

    // Score (will be updated by updateScore)
    await m.pos(4, uiX);
    await m.print("Score: 0");

    // Controls
    await m.pos(6, uiX);
    await m.color(m.vert);
    await m.print("Controles");

    await m.pos(7, uiX);
    await m.print("Z - Haut");

    await m.pos(8, uiX);
    await m.print("Q - Gauche");

    await m.pos(9, uiX);
    await m.print("S - Bas");

    await m.pos(10, uiX);
    await m.print("D - Droite");

    await m.pos(11, uiX);
    await m.print("ENVOI - Rejouer");

    // Draw initial score
    await updateScore();

    // Draw initial food
    await drawFood();
  }

  // Update only the score display
  async function updateScore() {
    if (score !== lastScore) {
      const uiX = 1 + GAME_WIDTH + 2;
      await m.pos(4, uiX);
      await m.color(m.blanc);
      await m.print(`Score: ${score}    `);
      lastScore = score;
    }
  }

  // Draw only the food
  async function drawFood() {
    const gridX = 1;
    const gridY = 2;

    await m.pos(gridY + food.y, gridX + food.x);
    await m.color(m.rouge);
    await m.print(FOOD);
  }

  // Draw only the snake's head and erase the tail
  async function updateSnake() {
    const gridX = 1;
    const gridY = 2;

    // Draw new head
    const head = snake[0];
    await m.pos(gridY + head.y, gridX + head.x);
    await m.color(m.vert);
    await m.print(SNAKE_HEAD);

    // Update previous head to body segment
    if (snake.length > 1) {
      const neck = snake[1];
      await m.pos(gridY + neck.y, gridX + neck.x);
      await m.print(SNAKE_BODY);
    }

    // Erase the tail if we have one and didn't eat food
    if (lastTail) {
      await m.pos(gridY + lastTail.y, gridX + lastTail.x);
      await m.color(m.noir);
      await m.print(EMPTY);
    }
  }

  // Move the snake
  function moveSnake() {
    // Update direction
    direction = nextDirection;

    // Calculate new head position
    const head = { x: snake[0].x, y: snake[0].y };

    switch (direction) {
      case "up":
        head.y--;
        break;
      case "down":
        head.y++;
        break;
      case "left":
        head.x--;
        break;
      case "right":
        head.x++;
        break;
    }

    // Check for collisions with walls
    if (
      head.x <= 0 ||
      head.x >= GAME_WIDTH - 1 ||
      head.y <= 0 ||
      head.y >= GAME_HEIGHT - 1
    ) {
      running = false;
      return;
    }

    // Check for collision with self
    if (snake.some((segment) => segment.x === head.x && segment.y === head.y)) {
      running = false;
      return;
    }

    // Add new head
    snake.unshift(head);

    // Check if food eaten
    foodEaten = head.x === food.x && head.y === food.y;
    if (foodEaten) {
      score += 10;
      placeFood();
      lastTail = null; // Don't erase tail when growing

      // Increase speed
      if (delay > MIN_DELAY) {
        delay -= 10;
      }
    } else {
      // Remove tail if no food eaten
      lastTail = snake.pop();
    }
  }

  // Game over screen
  async function gameOver() {
    const gridX = 1;
    const gridY = 2;

    // Draw game over message in the center of the game area
    const centerY = Math.floor(GAME_HEIGHT / 2);
    const centerX = Math.floor(GAME_WIDTH / 2) - 4;

    await m.pos(gridY + centerY - 1, gridX + centerX);
    await m.color(m.rouge);
    await m.print("GAME OVER!");

    await m.pos(gridY + centerY + 1, gridX + centerX);
    await m.color(m.blanc);
    await m.print(`Score: ${score}`);
  }

  // Process a key press
  function processKey(key) {
    // Z(W)Q(A)SD controls - prevent 180-degree turns
    if ((key === "z" || key === "w") && direction !== "down") {
      nextDirection = "up";
    } else if ((key === "q" || key === "a") && direction !== "right") {
      nextDirection = "left";
    } else if (key === "s" && direction !== "up") {
      nextDirection = "down";
    } else if (key === "d" && direction !== "left") {
      nextDirection = "right";
    } else if (key === "\r") {
      // ENVOI key
      if (!running) {
        initGame();
        running = true;
      }
    } else if (key === "\x13\x46") {
      // SOMMAIRE key
      running = false;
    }
  }

  // Main game loop
  async function gameLoop() {
    initGame();
    await drawInitialBoard();

    const gridX = 1;
    const gridY = 2;

    // Draw initial snake
    for (let i = 0; i < snake.length; i++) {
      const segment = snake[i];
      await m.pos(gridY + segment.y, gridX + segment.x);

      if (i === 0) {
        await m.color(m.vert);
        await m.print(SNAKE_HEAD);
      } else {
        await m.color(m.vert);
        await m.print(SNAKE_BODY);
      }
    }

    // Set up WebSocket message handler for keyboard input
    websocket.onmessage = (event) => {
      const key = event.data.toString().toLowerCase();
      processKey(key);
    };

    let gameActive = true;

    while (gameActive) {
      if (running) {
        moveSnake();
        await updateSnake();
        await updateScore();

        // If food was eaten, draw the new food
        if (foodEaten) {
          await drawFood();
        }
      } else {
        await gameOver();

        // Wait for ENVOI to restart or SOMMAIRE to quit
        const [_, touche] = await m.input(0, 1, 0, "");
        if (touche === m.envoi) {
          initGame();
          await drawInitialBoard();

          // Draw initial snake
          for (let i = 0; i < snake.length; i++) {
            const segment = snake[i];
            await m.pos(gridY + segment.y, gridX + segment.x);

            if (i === 0) {
              await m.color(m.vert);
              await m.print(SNAKE_HEAD);
            } else {
              await m.color(m.vert);
              await m.print(SNAKE_BODY);
            }
          }

          running = true;
        } else if (touche === m.sommaire) {
          gameActive = false; // Exit the game
        }
      }

      // Pause between frames
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Start the game
  await m.cursor(false);
  await gameLoop();
}

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async function () {
    startServer((ws) => snakeGame(ws), 3612, "Snake Game");
  })().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

export { snakeGame };
