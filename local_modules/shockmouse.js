// Generated by CoffeeScript 1.8.0
var Gamepad, gamepads, gamey;

Gamepad = require('./sony_controller').Gamepad;

gamepads = Gamepad.devices();

console.log("gamepads:", gamepads);

console.log("connecting to first...");

gamey = new Gamepad(gamepads[0]);

console.log("connected!");

console.log("it is wireless?", gamey.wireless);

//# sourceMappingURL=shockmouse.js.map
