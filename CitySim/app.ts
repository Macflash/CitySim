var tileSize = 5;
var gridSize = 120;

var getGridTile = (coord: number) => {
    return Math.floor(coord / tileSize);
}

interface GameObject {
    x: number;
    y: number;
    rotation: number;
    Decide(grid: Grid): void; // TODO: will need stuff eventually.. like pass it nearby objects and terrain
    Move(): void; // TODO: will need to check for collisions etc.
    Draw(ctx: CanvasRenderingContext2D): void;
}

class Car implements GameObject {
    // car dimensions
    width = 4 * tileSize;
    height = 2 * tileSize;

    // coordinates of center point
    x: number;
    y: number;

    // speed and direction
    rotation: number;
    speed: number;

    // rate of acceleration and turning
    accelRate: number;
    maxSpeed = 10; // ??
    minSpeed = -1; // ??
    maxTurn = 360; // ??

    minturn: number;
    maxturn: number;
    turnRate() {
        return (this.maxSpeed - Math.abs(this.speed)) * (this.maxturn - this.minturn) / (this.maxSpeed) + this.minturn;
    };

    constructor(x, y, r, s, a, mint, maxt) {
        this.x = x;
        this.y = y;
        this.rotation = r;
        this.speed = s;
        this.accelRate = a;
        this.minturn = mint;
        this.maxturn = maxt;
    }

    // accelerate and/or turn (driver's decisions)
    Decide(grid: Grid) {
        var start = Date.now();
        var options = [
            { // straight
                dist: grid.lookAhead(this.x, this.y, this.rotation, 700, 0, this.speed),
                action: {turn: 0, speed: ""}
            },
            { // back up
                dist: (grid.lookAhead(this.x, this.y, this.rotation + 180, 50, 0, this.speed) + 5),
                action: { turn: 0, speed: "back" }
            }
        ];

        for (var i = 0; i < this.turnRate(); i += .2) {
            options.push({
                dist: grid.lookAhead(this.x, this.y, this.rotation, 650, i, this.speed),
                action: {turn: i, speed: ""}
            });
            options.push({
                dist: grid.lookAhead(this.x, this.y, this.rotation, 650, -1 * i, this.speed),
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

        if (max.dist > (this.speed * 75) && max.action.speed != "back") {
            this.speed += this.accelRate;

            if (this.speed < 0) {
                this.speed = 1;
            }
            //console.log("go faster");
        }
        else if (this.speed >= 0 && max.dist <= (Math.abs(this.speed) * 50)) {
            this.speed -= this.accelRate;
            //console.log("go slower");
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
    }

    // move the car based on current speed and direction
    Move() {
        var x = Math.cos(this.rotation * (Math.PI / 180));
        var y = Math.sin(this.rotation * (Math.PI / 180));
        this.x += this.speed * x;
        this.y += this.speed * y;
    }

    // draw the car on the canvas
    Draw(ctx: CanvasRenderingContext2D) {
        // context should be centered around the x,y of this object
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * (Math.PI / 180));
        ctx.fillStyle = "red";
        ctx.fillRect(-.5 * this.width, -.5 * this.height, this.width, this.height);
        ctx.fillStyle = "";
        ctx.restore();
    }
}

class Game {
    username: string;
    cities: City[];

    static $inject = ["$scope"];
    constructor(private $scope) {
        this.username = "Alex";
        this.cities = [];
        this.cities.push(new City(500, gridSize));
        $scope.TileType = TileType;
        $scope.currentType = "Grass";
        $scope.buildSize = 1;
        $scope.setBuild = (t: string) => {
            this.$scope.currentType = t;
        }
    }
}

class City {
    money: number;
    name: string;
    grid: Grid;
    roads: any[];
    intersections: any[];
    buildings: any[];
    gameObjects: GameObject[];

    constructor(money: number, size: number) {
        this.money = money;
        this.grid = new Grid(size, size);
    }

    buildTile(type: TileType, x: number, y: number, size: number) {
        for (var i = 0; i < size; i++) {
            for (var j = 0; j < size; j++) {
                this.grid.buildTileIfPossible(type, i + x, j + y); // TODO: factor in cost!
            }
        }
    }

    updateGraphs() {
        console.log("updating graphs");
    }
}

class Grid {
    private terrain: Terrain[][];
    width: number;
    height: number;

    constructor(width: number, height: number) {
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

    buildTileIfPossible(type: TileType, x: number, y: number): boolean {
        if (this.isBuildable(x, y)) {
            this.terrain[x][y] = new Terrain(type);
            return true;
        }

        return false;
    }

    isBuildable(x: number, y: number): boolean {
        var t = this.getTerrain(x, y);
        if (t != null) {
            return t.isBuildable();
        }

        return false;
    }

    isPassable(x: number, y: number): boolean {
        var t = this.getTerrain(x, y);
        if (t != null) {
            return t.isPassable();
        }

        return false;
    }

    getTerrain(x: number, y: number) {
        if (x >= 0 && x < this.width) {
            if (y >= 0 && y < this.height) {
                return this.terrain[x][y];
            }
        }
        return null;
    }

    getNeighbors(x: number, y: number) {
        // return terrain bordering the selected one, starting at north and returning clockwise
        var result = [];
        result.push(this.getTerrain(x, y - 1));
        result.push(this.getTerrain(x + 1, y));
        result.push(this.getTerrain(x, y + 1));
        result.push(this.getTerrain(x - 1, y));
        return result;
    }

    // return the distance until non-passable terrain. distance is the max distance to look.
    lookAhead(startX: number, startY: number, direction: number, distance: number, turn: number, speed: number) {
        if (speed <= 0) {
            speed = 1;
        }
        var stepSize = speed / 2;
        var currentDistance = 0;
        var currentDirection = direction;
        var currentX = startX;
        var currentY = startY;

        while (currentDistance <= distance) {
            currentDirection += turn;
            for (var i = 0; i < 2; i++) {
                currentDistance += stepSize;
                currentX += stepSize * Math.cos(currentDirection * Math.PI / 180);
                currentY += stepSize * Math.sin(currentDirection * Math.PI / 180);
                if (!this.isPassable(getGridTile(currentX), getGridTile(currentY))) {
                    return currentDistance;
                }
            }
        }

        return currentDistance;
    }
}

enum TileType {
    Grass,
    Water,
    Mountain,
    Pavement,
    Building
}

class Terrain {
    type: TileType;

    constructor(type: TileType) {
        this.type = type;
    }

    isBuildable(): boolean {
        return this.type == TileType.Grass;
    }

    isPassable(): boolean {
        return this.type == TileType.Pavement;
    }
}

var app = angular.module('CitySim', []);

app.controller("GameController", Game);

app.component('game', {
    template:
    '<div class="game">' +
    'User: {{$ctrl.username}} <br/>' +
    'clickType: {{currentType}} <br/>' +
    '<button ng-repeat="type in TileType" ng-click="setBuild(type)">{{type}}</button>' +
    '<br/>'+
    'Build Size: {{buildSize}} <input type="range" min="1" max="5" ng-model="buildSize"></input><br/>' +
    '<city ng-repeat="c in $ctrl.cities" c="c"></city>' +
    '</div>',
    controller: "GameController"
});

app.component('city', {
    template:
    '<div style="border: 1px solid grey;">' +
    'CITY <br>' +
    '<button ng-click="redrawTerrain()">redraw</button>' +
    '<button ng-click="startGame()" ng-show="!runningGame">Start</button>' +
    '<button ng-click="stopGame()" ng-show="runningGame">Stop</button>' +
    '<grid g="city.grid"></grid>' +
    '</div>',
    controller: ($scope, $element: JQuery) => {
        var city = <City>$scope.$ctrl.c;
        console.log("city", city);
        var gameScope = $scope.$parent.$parent;
        var game = <Game>$scope.$parent.$parent.$ctrl;
        var terrain: HTMLCanvasElement = null;
        var terrainCtx: CanvasRenderingContext2D = null;
        var objects: HTMLCanvasElement = null;
        var objectsCtx: CanvasRenderingContext2D = null;
        var overlay: HTMLCanvasElement = null;
        var overlayCtx: CanvasRenderingContext2D = null;

        city.gameObjects = [];
        city.gameObjects.push(new Car(100,100,0,0,.5,2, 10));
        city.gameObjects.push(new Car(120, 120, 0, 0, .75, 2.5, 12));
        city.gameObjects.push(new Car(150, 150, 0, 0, 1, 3, 15));

        $scope.runningGame = null;
        $scope.startGame = () => {
            if ($scope.runningGame == null) {
                $scope.runningGame = setInterval(() => {
                    objectsCtx.clearRect(0, 0, 600, 600);
                    //var start = Date.now();
                    for (var i = 0; i < city.gameObjects.length; i++){
                        var o = city.gameObjects[i];
                        o.Decide(city.grid);
                        o.Move();
                        o.Draw(objectsCtx);
                        //console.log(o.x + "," + o.y);
                    }
                    //console.log("took: " + (Date.now() - start) + "ms");
                }, 25);
            }
        }

        $scope.stopGame = () => {
            if ($scope.runningGame != null) {
                clearInterval($scope.runningGame);
                $scope.runningGame = null;
            }
        }

        $scope.redrawTerrain = () => {
            var start = Date.now();
            if (overlay == null) {
                var cTerrain = $element.children("div").children("grid").children("div").children("div").children("canvas");
                overlay = <HTMLCanvasElement>cTerrain[0];
                objects = <HTMLCanvasElement>cTerrain[1];
                terrain = <HTMLCanvasElement>cTerrain[2];
                overlayCtx = (<any>overlay).getContext("2d");
                objectsCtx = (<any>objects).getContext("2d");
                terrainCtx = (<any>terrain).getContext("2d");

                overlay.onclick = (event: MouseEvent) => {
                    var x = Math.floor(event.layerX / tileSize);
                    var y = Math.floor(event.layerY / tileSize);
                    city.buildTile(TileType[<string>gameScope.currentType], x, y, gameScope.buildSize);
                    $scope.redrawTerrain();
                }
                overlay.onmousedown = (event: MouseEvent) => {
                    $scope.mousedown = true;
                    console.log("down");
                }
                overlay.onmouseup = (event: MouseEvent) => {
                    console.log("up");
                    $scope.mousedown = false;
                }
                overlay.onmousemove = (event: MouseEvent) => {
                    if ($scope.mousedown) {
                    //console.log("drag");
                    var x = Math.floor(event.layerX / tileSize);
                        var y = Math.floor(event.layerY / tileSize);
                        city.buildTile(TileType[<string>gameScope.currentType], x, y, gameScope.buildSize);
                        $scope.redrawTerrain();
                    }
                }
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
                            terrainCtx.fillStyle = "brown";
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
    template:
    '<div ng-init="grid=$ctrl.g">' +
    '<div style="cursor: pointer; position: relative;">' +
    // UI overlay
    '<canvas class="overlay" style="position: absolute; z-index: 300;" width="600" height="600"/>' +
    // People & vehicles (stuff that updates a lot)
    '<canvas class="objects" style="position: absolute; z-index: 200; cursor: initial;" width="600" height="600"/>' +
    // Terrain (stuff that doesn't update a lot)
    '<canvas class="terrain" style="position: absolute; z-index: 100; cursor: initial;" width="600" height="600"/>' +
    '</div>' +
    '</div>',
    controller: ($scope) => { /* console.debug("gridscope:", $scope); */ },
    bindings: {
        g: '='
    }
});