var tileSize = 5;
var gridSize = 120;
var Mode;
(function (Mode) {
    Mode[Mode["Walking"] = 0] = "Walking";
    Mode[Mode["Driving"] = 1] = "Driving";
})(Mode || (Mode = {}));
var getGridTile = function (coord) {
    return Math.floor(coord / tileSize);
};
var Car = (function () {
    function Car(x, y, r, s, a, mint, maxt) {
        // car dimensions
        this.width = 4 * tileSize;
        this.height = 2 * tileSize;
        this.maxSpeed = 10; // ??
        this.minSpeed = -1; // ??
        this.maxTurn = 360; // ??
        this.x = x;
        this.y = y;
        this.rotation = r;
        this.speed = s;
        this.accelRate = a;
        this.minturn = mint;
        this.maxturn = maxt;
    }
    Car.prototype.turnRate = function () {
        return (this.maxSpeed - Math.abs(this.speed)) * (this.maxturn - this.minturn) / (this.maxSpeed) + this.minturn;
    };
    ;
    // accelerate and/or turn (driver's decisions)
    Car.prototype.Decide = function (grid) {
        var start = Date.now();
        var options = [
            {
                dist: grid.lookAhead(this.x, this.y, this.rotation, Math.abs(this.speed * 60) + 10, 0, this.speed, Mode.Driving),
                action: { turn: 0, speed: "" }
            },
            {
                dist: (grid.lookAhead(this.x, this.y, this.rotation + 180, 50, 0, this.speed, Mode.Driving) + 5),
                action: { turn: 0, speed: "back" }
            }
        ];
        for (var i = 0; i < this.turnRate(); i += .2) {
            options.push({
                dist: grid.lookAhead(this.x, this.y, this.rotation, Math.abs(this.speed * 60) + 10, i, this.speed, Mode.Driving),
                action: { turn: i, speed: "" }
            });
            options.push({
                dist: grid.lookAhead(this.x, this.y, this.rotation, Math.abs(this.speed * 60) + 10, -1 * i, this.speed, Mode.Driving),
                action: { turn: -1 * i, speed: "" }
            });
        }
        // find the max direction
        //console.log("decide");
        var max = { dist: 0, action: { turn: 0, speed: "" } };
        for (var i = 0; i < options.length; i++) {
            //console.log(options[i].dist);
            if (options[i].dist > max.dist) {
                max = options[i];
            }
        }
        // take action based on that action
        this.rotation += max.action.turn;
        if (max.dist > (this.speed * 50) && max.action.speed != "back") {
            this.speed += this.accelRate;
            if (this.speed < 0) {
                this.speed = 1;
            }
        }
        else if (this.speed >= 0 && max.dist <= (Math.abs(this.speed) * 30)) {
            this.speed -= this.accelRate * 2;
        }
        if (this.speed == 0 && max.action.speed == "back") {
            this.speed = -1;
        }
        //console.debug("speed", this.speed);
        // keep the speed below a certain amount
        if (this.speed > this.maxSpeed) {
            this.speed = this.maxSpeed;
        }
        if (this.speed < this.minSpeed) {
            this.speed = this.minSpeed;
        }
        // keep rotation between 0 and 360
        if (this.rotation > this.maxTurn) {
            this.rotation -= this.maxTurn;
        }
        if (this.rotation < 0) {
            this.rotation += this.maxTurn;
        }
        //console.log("dist:" + max.dist + " speed: " + this.speed + " turn: " + max.action.turn + "/" + this.turnRate());
        //console.log("took:" + (Date.now() - start) + "ms");
    };
    // move the car based on current speed and direction
    Car.prototype.Move = function () {
        var x = Math.cos(this.rotation * (Math.PI / 180));
        var y = Math.sin(this.rotation * (Math.PI / 180));
        this.x += this.speed * x;
        this.y += this.speed * y;
    };
    // draw the car on the canvas
    Car.prototype.Draw = function (ctx) {
        // context should be centered around the x,y of this object
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * (Math.PI / 180));
        ctx.fillStyle = "red";
        ctx.fillRect(-.5 * this.width, -.5 * this.height, this.width, this.height);
        ctx.fillStyle = "";
        ctx.restore();
    };
    return Car;
})();
var Game = (function () {
    function Game($scope) {
        var _this = this;
        this.$scope = $scope;
        this.username = "Alex";
        this.cities = [];
        this.cities.push(new City(500, gridSize));
        $scope.TileType = TileType;
        $scope.currentType = "Grass";
        $scope.buildSize = 1;
        $scope.setBuild = function (t) {
            _this.$scope.currentType = t;
        };
    }
    Game.$inject = ["$scope"];
    return Game;
})();
var City = (function () {
    function City(money, size) {
        this.money = money;
        this.grid = new Grid(size, size);
    }
    City.prototype.buildTile = function (type, x, y, size) {
        for (var i = 0; i < size; i++) {
            for (var j = 0; j < size; j++) {
                this.grid.buildTileIfPossible(type, i + x, j + y); // TODO: factor in cost!
            }
        }
    };
    City.prototype.updateGraphs = function () {
        console.log("updating graphs");
    };
    return City;
})();
var Grid = (function () {
    function Grid(width, height) {
        this.width = width;
        this.height = height;
        this.terrain = [];
        for (var i = 0; i < width; i++) {
            this.terrain[i] = [];
            for (var j = 0; j < height; j++) {
                this.terrain[i][j] = new Terrain(TileType.Grass);
            }
        }
    }
    Grid.prototype.buildTileIfPossible = function (type, x, y) {
        if (this.isBuildable(x, y)) {
            this.terrain[x][y] = new Terrain(type);
            return true;
        }
        return false;
    };
    Grid.prototype.isBuildable = function (x, y) {
        var t = this.getTerrain(x, y);
        if (t != null) {
            return t.isBuildable();
        }
        return false;
    };
    Grid.prototype.isPassable = function (transport, x, y) {
        var t = this.getTerrain(x, y);
        if (t != null) {
            switch (transport) {
                case Mode.Walking:
                    return t.isWalkwable();
                case Mode.Driving:
                    return t.isDriveable();
                default:
                    return false;
            }
        }
        return false;
    };
    Grid.prototype.getTerrain = function (x, y) {
        if (x >= 0 && x < this.width) {
            if (y >= 0 && y < this.height) {
                return this.terrain[x][y];
            }
        }
        return null;
    };
    Grid.prototype.getNeighbors = function (x, y) {
        // return terrain bordering the selected one, starting at north and returning clockwise
        var result = [];
        result.push(this.getTerrain(x, y - 1));
        result.push(this.getTerrain(x + 1, y));
        result.push(this.getTerrain(x, y + 1));
        result.push(this.getTerrain(x - 1, y));
        return result;
    };
    // return the distance until non-passable terrain. distance is the max distance to look.
    Grid.prototype.lookAhead = function (startX, startY, direction, distance, turn, speed, transport) {
        if (speed <= 0) {
            speed = 1;
        }
        var stepCount = 5;
        var stepSize = speed / stepCount;
        var currentDistance = 0;
        var currentDirection = direction;
        var currentX = startX;
        var currentY = startY;
        while (currentDistance <= distance) {
            currentDirection += turn;
            for (var i = 0; i < stepCount; i++) {
                currentDistance += stepSize;
                currentX += stepSize * Math.cos(currentDirection * Math.PI / 180);
                currentY += stepSize * Math.sin(currentDirection * Math.PI / 180);
                if (!this.isPassable(transport, getGridTile(currentX), getGridTile(currentY))) {
                    return currentDistance;
                }
            }
        }
        return currentDistance;
    };
    return Grid;
})();
var TileType;
(function (TileType) {
    TileType[TileType["Grass"] = 0] = "Grass";
    TileType[TileType["Water"] = 1] = "Water";
    TileType[TileType["Mountain"] = 2] = "Mountain";
    TileType[TileType["Pavement"] = 3] = "Pavement";
    TileType[TileType["Building"] = 4] = "Building";
    TileType[TileType["Sidewalk"] = 5] = "Sidewalk";
    TileType[TileType["Parking"] = 6] = "Parking";
    TileType[TileType["Dirt"] = 7] = "Dirt";
})(TileType || (TileType = {}));
var Terrain = (function () {
    // if this spot is already taken,  ?? first they should make the other object update its claimed tiles ??
    // otherwise they tell the other object they have crashed.
    // like people and people = set speeds to 0.
    // people and car = check speed and if high kill/injure person...
    // car and anything not grass = break car.
    function Terrain(type) {
        this.type = type;
    }
    Terrain.prototype.isBuildable = function () {
        return true || this.type == TileType.Grass;
    };
    Terrain.prototype.isDriveable = function () {
        return this.type == TileType.Pavement
            || this.type == TileType.Parking;
    };
    Terrain.prototype.isWalkwable = function () {
        return this.type == TileType.Pavement
            || this.type == TileType.Sidewalk
            || this.type == TileType.Parking;
    };
    return Terrain;
})();
var app = angular.module('CitySim', []);
app.controller("GameController", Game);
app.component('game', {
    template: '<div class="game">' +
        'User: {{$ctrl.username}} <br/>' +
        'clickType: {{currentType}} <br/>' +
        '<button ng-repeat="type in TileType" ng-click="setBuild(type)">{{type}}</button>' +
        '<button ng-click="setBuild(\'Car\')">Car</button>' +
        '<br/>' +
        'Build Size: {{buildSize}} <input type="range" min="1" max="15" ng-model="buildSize"></input><br/>' +
        '<city ng-repeat="c in $ctrl.cities" c="c"></city>' +
        '</div>',
    controller: "GameController"
});
app.component('city', {
    template: '<div style="border: 1px solid grey;">' +
        'CITY <br>' +
        '<button ng-click="redrawTerrain()">redraw</button>' +
        '<button ng-click="startGame()" ng-show="!runningGame">Start</button>' +
        '<button ng-click="stopGame()" ng-show="runningGame">Stop</button>' +
        '<grid g="city.grid"></grid>' +
        '</div>',
    controller: function ($scope, $element) {
        var city = $scope.$ctrl.c;
        console.log("city", city);
        var gameScope = $scope.$parent.$parent;
        var game = $scope.$parent.$parent.$ctrl;
        var terrain = null;
        var terrainCtx = null;
        var objects = null;
        var objectsCtx = null;
        var overlay = null;
        var overlayCtx = null;
        city.gameObjects = [];
        //city.gameObjects.push(new Car(100,100,0,0,.5,2, 10));
        //city.gameObjects.push(new Car(120, 120, 0, 0, .75, 2.5, 12));
        //city.gameObjects.push(new Car(150, 150, 0, 0, 1, 3, 15));
        $scope.runningGame = null;
        $scope.startGame = function () {
            if ($scope.runningGame == null) {
                $scope.runningGame = setInterval(function () {
                    objectsCtx.clearRect(0, 0, 600, 600);
                    //var start = Date.now();
                    for (var i = 0; i < city.gameObjects.length; i++) {
                        var o = city.gameObjects[i];
                        o.Decide(city.grid);
                        o.Move();
                        o.Draw(objectsCtx);
                    }
                    //console.log("took: " + (Date.now() - start) + "ms");
                }, 25);
            }
        };
        $scope.stopGame = function () {
            if ($scope.runningGame != null) {
                clearInterval($scope.runningGame);
                $scope.runningGame = null;
            }
        };
        $scope.redrawTerrain = function () {
            var start = Date.now();
            if (overlay == null) {
                var cTerrain = $element.children("div").children("grid").children("div").children("div").children("canvas");
                overlay = cTerrain[0];
                objects = cTerrain[1];
                terrain = cTerrain[2];
                overlayCtx = overlay.getContext("2d");
                objectsCtx = objects.getContext("2d");
                terrainCtx = terrain.getContext("2d");
                overlay.onclick = function (event) {
                    var x = Math.floor(event.layerX / tileSize);
                    var y = Math.floor(event.layerY / tileSize);
                    if (gameScope.currentType == "Car") {
                        city.gameObjects.push(new Car(event.layerX, event.layerY, 0, 0, .5, 2, 10));
                    }
                    else if (TileType[gameScope.currentType]) {
                        city.buildTile(TileType[gameScope.currentType], x, y, gameScope.buildSize);
                        $scope.redrawTerrain();
                    }
                };
                overlay.onmousedown = function (event) {
                    $scope.mousedown = true;
                    console.log("down");
                };
                overlay.onmouseup = function (event) {
                    console.log("up");
                    $scope.mousedown = false;
                };
                overlay.onmousemove = function (event) {
                    if ($scope.mousedown && gameScope.currentType != "Car") {
                        //console.log("drag");
                        var x = Math.floor(event.layerX / tileSize);
                        var y = Math.floor(event.layerY / tileSize);
                        city.buildTile(TileType[gameScope.currentType], x, y, gameScope.buildSize);
                        $scope.redrawTerrain();
                    }
                };
            }
            // TODO: only clear what is updated
            terrainCtx.clearRect(0, 0, 300, 300);
            // Redraw terrain TODO: only redraw what is updated
            // TODO: move this drawing logic into the terrain
            for (var i = 0; i < city.grid.width; i++) {
                for (var j = 0; j < city.grid.height; j++) {
                    switch (city.grid.getTerrain(i, j).type) {
                        case TileType.Grass:
                            terrainCtx.fillStyle = "green";
                            break;
                        case TileType.Pavement:
                            terrainCtx.fillStyle = "darkGrey";
                            break;
                        case TileType.Mountain:
                            terrainCtx.fillStyle = "tan";
                            break;
                        case TileType.Water:
                            terrainCtx.fillStyle = "blue";
                            break;
                        case TileType.Building:
                            terrainCtx.fillStyle = "yellow";
                            break;
                        case TileType.Dirt:
                            terrainCtx.fillStyle = "brown";
                            break;
                        case TileType.Parking:
                            terrainCtx.fillStyle = "gray";
                            break;
                        default:
                            terrainCtx.fillStyle = "lightGrey";
                    }
                    terrainCtx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
                }
            }
            console.debug("draw took:", Date.now() - start + "ms");
        };
    },
    bindings: {
        c: '='
    }
});
app.component('grid', {
    template: '<div ng-init="grid=$ctrl.g">' +
        '<div style="cursor: pointer; position: relative;">' +
        // UI overlay
        '<canvas class="overlay" style="position: absolute; z-index: 300;" width="600" height="600"/>' +
        // People & vehicles (stuff that updates a lot)
        '<canvas class="objects" style="position: absolute; z-index: 200; cursor: initial;" width="600" height="600"/>' +
        // Terrain (stuff that doesn't update a lot)
        '<canvas class="terrain" style="position: absolute; z-index: 100; cursor: initial;" width="600" height="600"/>' +
        '</div>' +
        '</div>',
    controller: function ($scope) { },
    bindings: {
        g: '='
    }
});
//# sourceMappingURL=app.js.map