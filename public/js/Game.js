/*global $e, Car, InputState, ConfigPanel, Stats, TileMap */

"use strict";
/**
 *  Game class
 */
var Game = function(opts) {
  // canvas element that the game draws to
  this.canvas = opts.canvas;

  //  Acquire a drawing context from the canvas
  this.ctx = this.canvas.getContext("2d");
  this.canvasWidth = this.canvas.clientWidth;
  this.canvasHeight = this.canvas.clientHeight;
  this.map = map_4;
  this.mapW = this.map[0].length;
  this.mapH = this.map.length;
  this.tileW = Math.ceil(this.canvasWidth / this.mapW);
  this.tileH = Math.ceil(this.canvasHeight / this.mapH);

  this.possibleStartPositions = this.map
    .map((row, ridx) =>
      row.map((col, cidx) => (col == 1 ? [cidx, ridx] : null))
    )
    .flat()
    .filter(x => x !== null)
    .sort(() => Math.random() - 0.5);
  this.possibleEndPositions = [...this.possibleStartPositions];

  //  Scrolling background
  this.tileMap = new TileMap({
    map: this.map,
    tileImage: opts.tileImage,
    viewportWidth: this.canvasWidth,
    viewportHeight: this.canvasHeight,
    mapW: this.mapW,
    mapH: this.mapH,
    tileW: this.tileW,
    tileH: this.tileH,
    startPosition: [0, 0],
  });

  //  Holds keystates
  this.inputs = new InputState();

  //  Displays useful car physics data
  this.stats = new Stats();

  //  Instance of our car
  this.car = new Car({
    stats: this.stats,
  });
  this.reset();

  // Ghost cars
  this.ghostCars = [];
  this.counter = 0;

  //  Configuration panel for the car
  this.configPanel = new ConfigPanel(this.car);
};

Game.DRAW_SCALE = 25.0; // 1m = 25px

Game.prototype.getRandomStartPosition = function() {
  return this.possibleStartPositions.pop();
};

Game.prototype.getRandomEndPosition = function() {
  return this.possibleEndPositions[
    Math.floor(Math.random() * this.possibleEndPositions.length)
  ];
};

Game.prototype.reset = function() {
  if (this.possibleStartPositions.length > 0) {
    [this.startX, this.startY] = this.getRandomStartPosition();
    [this.endX, this.endY] = this.getRandomEndPosition();
    this.tileMap.startX = this.startX;
    this.tileMap.startY = this.startY;
    this.tileMap.endX = this.endX;
    this.tileMap.endY = this.endY;
    this.car.position.x =
      (-this.canvasWidth / 2 + this.startX * this.tileW + this.tileW / 2) /
      Game.DRAW_SCALE;
    this.car.position.y =
      (-this.canvasHeight / 2 +
        (this.mapH - this.startY - 1) * this.tileH +
        this.tileH / 2) /
      Game.DRAW_SCALE;
    this.car.heading = 0.0;
  } else {
    this.gameOver();
  }
  this.car.velocity.x = 0.0;
  this.car.velocity.y = 0.0;
  this.car.route = [];
  this.counter = 0;
};

Game.prototype.reachedEnd = function() {
  var c = new Car({});
  c.route = [...this.car.route];
  c.followingRoute = true;
  this.car.route = [];
  this.ghostCars.push(c);
  this.reset();
};

Game.prototype.gameOver = function() {
  this.ctx.save();
  this.ctx.fillStyle = "#000";
  this.ctx.textAlign = "center";
  this.ctx.scale(1, -1);
  this.ctx.strokeStyle = "#fff";
  this.ctx.strokeText("GAME OVER", 0, 0);
  this.ctx.fillText("GAME OVER", 0, 0);
  this.ctx.restore();
};

/**  Update game logic by delta T (millisecs) */
Game.prototype.update = function(dt) {
  this.car.setInputs(this.inputs);
  this.car.update(dt);
};

/**  Render the scene */
Game.prototype.render = function() {
  //  Clear the canvas
  //this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

  this.ctx.save();

  var s = Game.DRAW_SCALE;

  //  Render ground (covers screen so no need to clear)
  this.tileMap.render(this.ctx);

  //  Render the car.
  //  Set axis at centre of screen and y axis up.
  this.ctx.translate(this.canvasWidth / 2.0, this.canvasHeight / 2.0);
  this.ctx.scale(s, -s);
  this.car.render(this.ctx);

  // Render other cars
  for (var ghostCar of this.ghostCars) {
    var [x, y, heading] = ghostCar.route[
      Math.min(this.counter, ghostCar.route.length - 1)
    ];
    ghostCar.position.x = x;
    ghostCar.position.y = y;
    ghostCar.heading = heading;
    ghostCar.render(this.ctx);
  }

  // Compute the tile the car is currently on
  var carX = this.car.position.x * s;
  var carY = this.car.position.y * s;
  var tileX = Math.floor(this.mapW / 2 + carX / this.tileW);
  var tileY = this.mapH - Math.floor(this.mapH / 2 + carY / this.tileH) - 1;
  if (tileX >= this.mapW) tileX = this.mapW - 1;
  else if (tileX < 0) tileX = 0;
  if (tileY >= this.mapH) tileY = this.mapH - 1;
  else if (tileY < 0) tileY = 0;
  var tile = this.map[tileY][tileX];

  if (tile == 0) console.log("COLLISION");
  // End
  if (tileX == this.endX && tileY == this.endY) this.reachedEnd();

  this.ctx.restore();

  //  Stats rendered to DOM
  this.stats.render();

  // Increase the ghost car counter
  this.counter++;
};

Game.prototype.resize = function() {
  this.canvasWidth = this.canvas.clientWidth;
  this.canvasHeight = this.canvas.clientHeight;
  // Notify TileMap that resize happened
  this.tileMap.resize(this.canvasWidth, this.canvasHeight);
};

Game.prototype.setInputKeyState = function(k, s) {
  var i = this.inputs;
  if (k === 37)
    // arrow left
    i.left = s;
  else if (k === 39)
    // arrow right
    i.right = s;
  else if (k === 38)
    // arrow up
    i.throttle = s;
  else if (k === 40)
    // arrow down
    i.brake = s;
  else if (k === 32)
    // space
    i.ebrake = s;
};

Game.prototype.onKeyDown = function(k) {
  this.setInputKeyState(k.keyCode, 1.0);
};

Game.prototype.onKeyUp = function(k) {
  this.setInputKeyState(k.keyCode, 0.0);
};
