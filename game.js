let board, ctx;
const boardWidth = 360,
  boardHeight = 640;
const birdWidth = 34,
  birdHeight = 24;
let birdX = boardWidth / 8,
  birdY = boardHeight / 2;
let birdImg,
  bird = { x: birdX, y: birdY, width: birdWidth, height: birdHeight };

let pipes = [],
  pipeWidth = 64,
  pipeHeight = 512,
  pipeX = boardWidth;
let topPipeImg, bottomPipeImg;

// Pipe configuration constants
const pipeGap = boardHeight / 4; // Gap between top and bottom pipes
const basePipeSpawnInterval = 2000; // Base time between pipe spawns in milliseconds
const minGapFromEdges = 80; // Minimum distance from screen edges for gap center

// Speed progression constants
const baseVelocityX = -2; // Base horizontal speed
const maxVelocityX = -5; // Maximum horizontal speed
const minPipeSpawnInterval = 800; // Minimum time between pipe spawns
const speedIncreaseInterval = 5; // Score interval for speed increases

let gravity = 0.4,
  velocityY = 0,
  velocityX = baseVelocityX,
  isGameStarted = false,
  gameOver = false,
  score = 0,
  currentPipeSpawnInterval = basePipeSpawnInterval;

let flapSound = new Audio("./assets/sound/flap.mp3");
let passPipeSound = new Audio("./assets/sound/pass_pipe.mp3");
let deathSound = new Audio("./assets/sound/gameover.mp3");
let swooshSound = new Audio("./assets/sound/swoosh.mp3");

let pipeInterval, animationId;
let messageImg;
let lastPipeSpawnTime = 0;

// Head tracking variables
let webcam, faceModel;
let isWebcamEnabled = false;
let headTrackingEnabled = false;
let baseHeadY = null;
let currentHeadY = null;
let headSensitivity = 2.0;
let smoothingFactor = 0.3;
let smoothedHeadY = null;

// Loading state variables
let isModelLoaded = false;
let isCameraReady = false;

window.onload = function () {
  board = document.getElementById("board");
  board.width = boardWidth;
  board.height = boardHeight;
  ctx = board.getContext("2d");

  birdImg = new Image();
  birdImg.src = "./assets/images/flappybird.png";

  topPipeImg = new Image();
  topPipeImg.src = "./assets/images/toppipe.png";

  bottomPipeImg = new Image();
  bottomPipeImg.src = "./assets/images/bottompipe.png";

  messageImg = document.getElementById("message-image");
  webcam = document.getElementById("webcam");

  document.getElementById("start-button").addEventListener("click", loadGame);
  document
    .getElementById("restart-button")
    .addEventListener("click", restartGame);

  // Handle window resize for mobile orientation changes
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  // Start initialization sequence
  initializeGame();
};

// Handle mobile orientation changes and responsive updates
function handleResize() {
  // No longer need to update camera resolution on resize
  // Camera uses fixed dimensions for consistent performance
}

function loadGame() {
  // Check if everything is properly initialized
  if (!isModelLoaded || !isCameraReady) {
    alert("Game is not ready yet. Please wait for initialization to complete.");
    return;
  }

  swooshSound.play();
  document.getElementById("main-menu").style.display = "none";
  isGameStarted = false;
  velocityY = 0;
  score = 0;
  bird.y = birdY;

  // Ensure head tracking detection is running
  if (isWebcamEnabled && headTrackingEnabled) {
    detectHeadPosition();
    console.log("Head tracking detection started for game");
  } else {
    console.error("Camera not properly initialized");
    alert("Camera is not ready. Please refresh the page and try again.");
    return;
  }

  messageImg.style.display = "block"; // Show the message when the game is loaded

  ctx.clearRect(0, 0, board.width, board.height);
  ctx.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
  requestAnimationFrame(update);
}

function startGame() {
  if (!isGameStarted && headTrackingEnabled) {
    isGameStarted = true;

    // Reset baseline head position when starting the game
    baseHeadY = smoothedHeadY;

    // Reset speed settings
    velocityX = baseVelocityX;
    currentPipeSpawnInterval = basePipeSpawnInterval;
    lastPipeSpawnTime = Date.now();

    messageImg.style.display = "none"; // Hide the message after the game starts
  }
}

function update() {
  if (gameOver) return;
  ctx.clearRect(0, 0, board.width, board.height);

  if (isGameStarted) {
    // Handle time-based pipe spawning with variable intervals
    const currentTime = Date.now();
    if (currentTime - lastPipeSpawnTime >= currentPipeSpawnInterval) {
      addPipes();
      lastPipeSpawnTime = currentTime;
    }

    // Handle head tracking control - camera control is required
    if (headTrackingEnabled && smoothedHeadY !== null) {
      // Use the display dimensions for coordinate mapping since face detection
      // works on the video element as displayed, not the native resolution
      const displayHeight = webcam.height || webcam.clientHeight;
      const headProgress = smoothedHeadY / displayHeight;

      // Map to game board height, keeping bird within bounds
      // Direct mapping: head at top (0) -> bird at top (0), head at bottom (1) -> bird at bottom
      const targetY = headProgress * (boardHeight - birdHeight);
      bird.y = Math.max(0, Math.min(boardHeight - birdHeight, targetY));
      velocityY = 0; // Disable gravity when using head tracking

      // Debug logging
      if (score === 0) {
        // Only log at start to avoid spam
        console.log(
          `Head Y: ${smoothedHeadY.toFixed(
            1
          )}, Display Height: ${displayHeight}, Progress: ${headProgress.toFixed(
            2
          )}, Bird Y: ${bird.y.toFixed(1)}`
        );
      }
    } else {
      // If head tracking is not enabled or no head is detected, pause the game
      if (!headTrackingEnabled) {
        // Game requires head tracking - don't move the bird
        velocityY = 0;
      } else {
        // Head tracking enabled but no head detected - apply minimal gravity
        velocityY += gravity * 0.5; // Reduced gravity when head not detected
        bird.y = Math.max(bird.y + velocityY, 0);
      }
    }
  }

  ctx.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);

  if (bird.y > board.height) endGame();

  pipes.forEach((pipe) => {
    pipe.x += velocityX;
    ctx.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);

    if (!pipe.passed && bird.x > pipe.x + pipe.width) {
      score += 0.5;
      pipe.passed = true;
      passPipeSound.play();
      updateGameSpeed(); // Update game speed when score increases
    }

    if (isCollision(bird, pipe)) endGame();
  });

  // Remove pipes that have moved completely off screen (with some buffer)
  pipes = pipes.filter((pipe) => pipe.x >= -pipeWidth - 50);

  ctx.fillStyle = "white";
  ctx.font = "45px sans-serif";
  ctx.fillText(Math.floor(score), 5, 45);

  requestAnimationFrame(update);
}

function addPipes() {
  if (gameOver || !isGameStarted) return;

  // Use the configured gap size
  let gap = pipeGap;

  // Calculate the total available space for pipe positioning
  // Ensure gap center is within safe bounds
  let minGapCenter = minGapFromEdges + gap / 2;
  let maxGapCenter = boardHeight - minGapFromEdges - gap / 2;

  // Random position for the gap opening (center of the gap)
  let gapCenter = minGapCenter + Math.random() * (maxGapCenter - minGapCenter);

  // Calculate pipe positions based on gap center
  let topPipeY = gapCenter - gap / 2 - pipeHeight; // Top pipe ends at gap start
  let bottomPipeY = gapCenter + gap / 2; // Bottom pipe starts at gap end

  // Add top pipe
  pipes.push({
    img: topPipeImg,
    x: pipeX,
    y: topPipeY,
    width: pipeWidth,
    height: pipeHeight,
    passed: false,
  });

  // Add bottom pipe
  pipes.push({
    img: bottomPipeImg,
    x: pipeX,
    y: bottomPipeY,
    width: pipeWidth,
    height: pipeHeight,
    passed: false,
  });
}

function jump() {
  // Only allow starting game or restarting when using head tracking
  if (!isGameStarted && headTrackingEnabled) {
    startGame();
  } else if (gameOver && headTrackingEnabled) {
    restartGame();
  }
}

function isCollision(bird, pipe) {
  return (
    bird.x < pipe.x + pipe.width &&
    bird.x + bird.width > pipe.x &&
    bird.y < pipe.y + pipe.height &&
    bird.y + bird.height > pipe.y
  );
}

function endGame() {
  gameOver = true;
  // Note: No need to clear interval since we're using time-based spawning
  deathSound.play();
  document.getElementById("gameover-menu").style.display = "flex";
  document.getElementById("final-score").textContent = Math.floor(score);
}

function restartGame() {
  gameOver = false;
  pipes = [];
  velocityY = 0;
  score = 0;
  bird.y = birdY;

  // Reset speed settings
  velocityX = baseVelocityX;
  currentPipeSpawnInterval = basePipeSpawnInterval;

  document.getElementById("gameover-menu").style.display = "none";

  // Reset head tracking baseline
  if (headTrackingEnabled) {
    baseHeadY = smoothedHeadY;
  }

  messageImg.style.display = "block"; // Show the message when restarting the game

  loadGame();
}

// Game initialization and loading functions
async function initializeGame() {
  updateLoadingText("Initializing game...");

  // Initialize both model and camera in parallel
  const modelPromise = initializeFaceDetection();
  const cameraPromise = initializeCamera();

  await Promise.all([modelPromise, cameraPromise]);

  // Check if both are ready
  if (isModelLoaded && isCameraReady) {
    showStartButton();
  } else {
    showError();
  }
}

async function initializeCamera() {
  try {
    updateCameraStatus("🔄 Requesting camera access...");

    // Request webcam without forcing specific dimensions to respect native capabilities
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        // Let the browser choose optimal resolution based on device capabilities
      },
    });
    webcam.srcObject = stream;

    // Wait for video metadata to load to get actual dimensions
    await new Promise((resolve) => {
      webcam.addEventListener("loadedmetadata", resolve, { once: true });
    });

    // Get the actual video dimensions
    const videoWidth = webcam.videoWidth;
    const videoHeight = webcam.videoHeight;

    // Scale down the display size while maintaining aspect ratio for performance
    // Keep face detection efficient but respect original proportions
    const maxDisplaySize = 200;
    const aspectRatio = videoWidth / videoHeight;

    let displayWidth, displayHeight;
    if (aspectRatio > 1) {
      // Landscape
      displayWidth = Math.min(maxDisplaySize, videoWidth);
      displayHeight = displayWidth / aspectRatio;
    } else {
      // Portrait or square
      displayHeight = Math.min(maxDisplaySize, videoHeight);
      displayWidth = displayHeight * aspectRatio;
    }

    // Set webcam element display dimensions (this doesn't affect the actual video resolution)
    webcam.width = displayWidth;
    webcam.height = displayHeight;

    webcam.style.display = "block";
    isWebcamEnabled = true;
    headTrackingEnabled = true;
    isCameraReady = true;

    updateCameraStatus("✅ Camera ready!");
    console.log(
      `Camera initialized: Native ${videoWidth}x${videoHeight}, Display ${displayWidth}x${displayHeight}`
    );

    // Start face detection immediately
    detectHeadPosition();
  } catch (error) {
    console.error("Error accessing camera:", error);
    updateCameraStatus("❌ Camera access denied");
    isCameraReady = false;
  }
}

function updateLoadingText(text) {
  document.getElementById("loading-text").textContent = text;
}

function updateModelStatus(text, isComplete = false, isError = false) {
  const element = document.getElementById("model-status");
  element.textContent = text;
  element.className = isComplete
    ? "status-complete"
    : isError
    ? "status-error"
    : "";
}

function updateCameraStatus(text, isComplete = false, isError = false) {
  const element = document.getElementById("camera-status");
  element.textContent = text;
  element.className = isComplete
    ? "status-complete"
    : isError
    ? "status-error"
    : "";
}

function showStartButton() {
  document.getElementById("loading-screen").style.display = "none";
  document.getElementById("start-button").style.display = "block";
  updateLoadingText("Ready to play!");
}

function showError() {
  updateLoadingText("Setup failed - please refresh and try again");
  document.getElementById("loading-screen").style.display = "block";
}

// Head tracking and webcam functions
async function initializeFaceDetection() {
  try {
    updateModelStatus("🔄 Loading TensorFlow.js...");
    console.log("Loading face detection model...");
    console.log("TensorFlow.js version:", tf.version.tfjs);
    console.log(
      "faceLandmarksDetection available:",
      typeof faceLandmarksDetection !== "undefined"
    );

    await tf.ready();
    console.log("TensorFlow.js is ready");
    updateModelStatus("🔄 Loading face detection model...");

    if (typeof faceLandmarksDetection === "undefined") {
      throw new Error("faceLandmarksDetection is not loaded");
    }

    console.log("Available models:", faceLandmarksDetection.SupportedModels);

    // Use the new API to create a detector
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig = {
      runtime: "tfjs", // Use TensorFlow.js runtime instead of MediaPipe
      refineLandmarks: false,
      maxFaces: 1,
    };

    faceModel = await faceLandmarksDetection.createDetector(
      model,
      detectorConfig
    );

    isModelLoaded = true;
    updateModelStatus("✅ AI model ready!", true);
    console.log("Face detection model loaded successfully");
  } catch (error) {
    console.error("Error loading face detection model:", error);
    updateModelStatus("❌ Model loading failed", false, true);
    isModelLoaded = false;
  }
}

async function enableWebcam() {
  // Camera should already be enabled from initialization
  if (isWebcamEnabled && headTrackingEnabled) {
    // Start head tracking detection loop
    detectHeadPosition();
    console.log("Head tracking detection started");
  } else {
    console.error("Camera not properly initialized");
    alert("Camera is not ready. Please refresh the page and try again.");
  }
}

async function detectHeadPosition() {
  if (!headTrackingEnabled || !faceModel || webcam.readyState !== 4) {
    if (headTrackingEnabled) {
      requestAnimationFrame(detectHeadPosition);
    }
    return;
  }

  try {
    const predictions = await faceModel.estimateFaces(webcam);

    if (predictions.length > 0) {
      const face = predictions[0];

      // Get nose tip (keypoint 1) for head position
      const noseTip = face.keypoints[1];
      currentHeadY = noseTip.y;

      // Apply smoothing
      if (smoothedHeadY === null) {
        smoothedHeadY = currentHeadY;
        console.log("Initial head position set:", smoothedHeadY);
        console.log(
          "Video dimensions - Native:",
          webcam.videoWidth,
          "x",
          webcam.videoHeight
        );
        console.log(
          "Video dimensions - Display:",
          webcam.width,
          "x",
          webcam.height
        );
        console.log(
          "Video dimensions - Client:",
          webcam.clientWidth,
          "x",
          webcam.clientHeight
        );
      } else {
        smoothedHeadY =
          smoothedHeadY * (1 - smoothingFactor) +
          currentHeadY * smoothingFactor;
      }

      // Auto-start game when head movement is detected and game is loaded but not started
      if (!isGameStarted && !gameOver && headTrackingEnabled) {
        // Use display height for consistency with game controls
        const displayHeight = webcam.height || webcam.clientHeight;
        const headProgress = smoothedHeadY / displayHeight;

        console.log(
          `Head progress: ${headProgress.toFixed(
            2
          )}, game started: ${isGameStarted}`
        );

        // Start game if head is moved from center (more sensitive threshold)
        if (headProgress < 0.45 || headProgress > 0.55) {
          console.log("Starting game due to head movement");
          startGame();
        }
      }

      // Update UI based on position in video (for debugging)
      const displayHeight = webcam.height || webcam.clientHeight;
      const headProgress = smoothedHeadY / displayHeight;

      let positionText = "Center";
      if (headProgress < 0.3) {
        positionText = "Top";
      } else if (headProgress > 0.7) {
        positionText = "Bottom";
      }

      // Optional: Log head position for debugging
      // console.log(`Head position: ${positionText}`);
    } else {
      // Optional: Log when head is not detected
      // console.log("Head position: Not detected");
    }
  } catch (error) {
    console.error("Error in head detection:", error);
  }

  if (headTrackingEnabled) {
    requestAnimationFrame(detectHeadPosition);
  }
}

function updateGameSpeed() {
  // Calculate speed multiplier based on score
  const speedLevel = Math.floor(score / speedIncreaseInterval);
  const speedMultiplier = 1 + speedLevel * 0.15; // Increase by 15% per level

  // Update horizontal velocity (capped at maximum)
  velocityX = Math.max(maxVelocityX, baseVelocityX * speedMultiplier);

  // Update pipe spawn interval (capped at minimum)
  const newSpawnInterval = basePipeSpawnInterval / speedMultiplier;
  currentPipeSpawnInterval = Math.max(minPipeSpawnInterval, newSpawnInterval);

  // Debug logging (can be removed in production)
  if (speedLevel > 0 && score % speedIncreaseInterval === 0) {
    console.log(
      `Speed Level ${speedLevel}: velocityX=${velocityX.toFixed(
        2
      )}, spawnInterval=${currentPipeSpawnInterval}ms`
    );
  }
}
