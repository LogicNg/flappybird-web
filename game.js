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

let gravity = 0.4,
  velocityY = 0,
  velocityX = -2,
  isGameStarted = false,
  gameOver = false,
  score = 0;

let flapSound = new Audio("./assets/sound/flap.mp3");
let passPipeSound = new Audio("./assets/sound/pass_pipe.mp3");
let deathSound = new Audio("./assets/sound/gameover.mp3");
let swooshSound = new Audio("./assets/sound/swoosh.mp3");

let pipeInterval, animationId;
let messageImg;

// Head tracking variables
let webcam, faceModel;
let isWebcamEnabled = false;
let headTrackingEnabled = false;
let baseHeadY = null;
let currentHeadY = null;
let headSensitivity = 2.0;
let smoothingFactor = 0.3;
let smoothedHeadY = null;

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

  // Head tracking toggle button
  document
    .getElementById("toggle-webcam")
    .addEventListener("click", toggleWebcam);

  // Added a mouse click event listener to the canvas for jumping
  board.addEventListener("click", jump);
  // Added a keydown event listener for the spacebar
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") jump();
  });

  // Initialize face detection model
  initializeFaceDetection();
};

function loadGame() {
  swooshSound.play();
  document.getElementById("main-menu").style.display = "none";
  isGameStarted = false;
  velocityY = 0;
  score = 0;
  bird.y = birdY;

  messageImg.style.display = "block"; // Show the message when the game is loaded

  ctx.clearRect(0, 0, board.width, board.height);
  ctx.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
  requestAnimationFrame(update);
}

function startGame() {
  if (!isGameStarted) {
    isGameStarted = true;

    // Reset baseline head position when starting the game
    if (headTrackingEnabled) {
      baseHeadY = currentHeadY;
      smoothedHeadY = currentHeadY;
    } else {
      velocityY = -6;
      flapSound.play();
    }

    pipeInterval = setInterval(addPipes, 1500);
    messageImg.style.display = "none"; // Hide the message after the game starts
  }
}

function update() {
  if (gameOver) return;
  ctx.clearRect(0, 0, board.width, board.height);

  if (isGameStarted) {
    // Handle head tracking control
    if (headTrackingEnabled && currentHeadY !== null) {
      // Map head position directly to bird Y coordinate using full video height
      const videoHeight = 240; // Height of the webcam video
      const headProgress = currentHeadY / videoHeight;

      // Map to game board height, keeping bird within bounds
      const targetY = headProgress * (boardHeight - birdHeight);
      bird.y = Math.max(0, Math.min(boardHeight - birdHeight, targetY));
      velocityY = 0; // Disable gravity when using head tracking
    } else {
      // Apply gravity only if head tracking is disabled or no head is detected
      if (!headTrackingEnabled || currentHeadY === null) {
        velocityY += gravity;
      }
      bird.y = Math.max(bird.y + velocityY, 0);
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
    }

    if (isCollision(bird, pipe)) endGame();
  });

  pipes = pipes.filter((pipe) => pipe.x >= -pipeWidth);

  ctx.fillStyle = "white";
  ctx.font = "45px sans-serif";
  ctx.fillText(Math.floor(score), 5, 45);

  requestAnimationFrame(update);
}

function addPipes() {
  if (gameOver || !isGameStarted) return;
  let gap = boardHeight / 4;
  let randomY = -pipeHeight / 4 - Math.random() * (pipeHeight / 2);

  pipes.push({
    img: topPipeImg,
    x: pipeX,
    y: randomY,
    width: pipeWidth,
    height: pipeHeight,
    passed: false,
  });
  pipes.push({
    img: bottomPipeImg,
    x: pipeX,
    y: randomY + pipeHeight + gap,
    width: pipeWidth,
    height: pipeHeight,
    passed: false,
  });
}

function jump() {
  // Only allow manual jumping if head tracking is disabled
  if (headTrackingEnabled) {
    if (!isGameStarted) {
      startGame();
    } else if (gameOver) {
      restartGame();
    }
    return;
  }

  if (!isGameStarted) {
    startGame();
  } else if (!gameOver) {
    velocityY = -6;
    flapSound.play();
  } else {
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
  clearInterval(pipeInterval);
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
  document.getElementById("gameover-menu").style.display = "none";

  // Reset head tracking baseline
  if (headTrackingEnabled) {
    baseHeadY = currentHeadY;
    smoothedHeadY = currentHeadY;
  }

  messageImg.style.display = "block"; // Show the message when restarting the game

  loadGame();
}

// Head tracking and webcam functions
async function initializeFaceDetection() {
  try {
    console.log("Loading face detection model...");
    console.log("TensorFlow.js version:", tf.version.tfjs);
    console.log(
      "faceLandmarksDetection available:",
      typeof faceLandmarksDetection !== "undefined"
    );

    await tf.ready();
    console.log("TensorFlow.js is ready");

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
    console.log("Face detection model loaded successfully");
  } catch (error) {
    console.error("Error loading face detection model:", error);
    document.getElementById("toggle-webcam").disabled = true;
    document.getElementById("tracking-status").textContent =
      "Head tracking: ERROR - Model failed to load";
  }
}

async function toggleWebcam() {
  const button = document.getElementById("toggle-webcam");

  if (!isWebcamEnabled) {
    try {
      button.disabled = true;
      button.textContent = "Starting...";

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 320,
          height: 240,
          facingMode: "user",
        },
      });

      webcam.srcObject = stream;
      webcam.style.display = "block";
      isWebcamEnabled = true;
      headTrackingEnabled = true;

      button.textContent = "Disable Head Tracking";
      document.getElementById("tracking-status").textContent =
        "Head tracking: ON";

      // Start head tracking
      detectHeadPosition();
    } catch (error) {
      console.error("Error accessing webcam:", error);
      button.textContent = "Webcam Access Denied";
      document.getElementById("tracking-status").textContent =
        "Head tracking: ERROR - Camera access denied";
    }
    button.disabled = false;
  } else {
    // Stop webcam
    const stream = webcam.srcObject;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
    }

    webcam.style.display = "none";
    isWebcamEnabled = false;
    headTrackingEnabled = false;
    baseHeadY = null;
    currentHeadY = null;
    smoothedHeadY = null;

    button.textContent = "Enable Head Tracking";
    document.getElementById("tracking-status").textContent =
      "Head tracking: OFF";
    document.getElementById("head-position").textContent =
      "Head position: Center";
  }
}

async function detectHeadPosition() {
  if (!headTrackingEnabled || !faceModel || !webcam.readyState === 4) {
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
      } else {
        smoothedHeadY =
          smoothedHeadY * (1 - smoothingFactor) +
          currentHeadY * smoothingFactor;
      }

      // Update UI based on position in video
      const videoHeight = 240;
      const headProgress = smoothedHeadY / videoHeight;

      let positionText = "Center";
      if (headProgress < 0.3) {
        positionText = "Top";
      } else if (headProgress > 0.7) {
        positionText = "Bottom";
      }

      document.getElementById(
        "head-position"
      ).textContent = `Head position: ${positionText}`;
    } else {
      document.getElementById("head-position").textContent =
        "Head position: Not detected";
    }
  } catch (error) {
    console.error("Error in head detection:", error);
  }

  if (headTrackingEnabled) {
    requestAnimationFrame(detectHeadPosition);
  }
}
