// Generated by CoffeeScript 1.8.0
var Color, DS4Gamepad, DS4Report, DS4TouchEvent, crc32, events, hid, isBluetoothHID, isDS4HID, isUSBHID,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

hid = require('../node_modules/ds4/node_modules/node-hid');

Color = require('color');

events = require('events');

crc32 = require("crc").crc32;

isDS4HID = function(descriptor) {
  return descriptor.vendorId === 1356 && descriptor.productId === 1476;
};

isBluetoothHID = function(descriptor) {
  return descriptor.path.match(/^Bluetooth/);
};

isUSBHID = function(descriptor) {
  return descriptor.path.match(/^USB/);
};

DS4Gamepad = (function(_super) {
  __extends(DS4Gamepad, _super);

  function DS4Gamepad(device_descriptor) {
    var a, _i;
    this.hid = new hid.HID(device_descriptor.path);
    this.wireless = !!isBluetoothHID(device_descriptor);
    if (this.wireless) {
      this.hid.getFeatureReport(0x04, 66);
    }
    this.report = {};
    this.updated = Date.now;
    this.trackpad = {
      touches: []
    };
    this._touch_obj_cache = [];
    this.deadzone = 0.075;
    for (a = _i = 0; _i <= 256; a = ++_i) {
      this.zero_padding = 0;
    }
    this.ratelimit = false;
    this._config = {
      led: '#000005',
      blink: false,
      rumble: 0
    };
    this.set({});
    this.hid.on('data', (function(_this) {
      return function(buf) {
        var data;
        if (_this.ratelimit && (Date.now() - _this.updated) < (1000 / _this.ratelimit)) {
          return;
        }
        _this.updated = Date.now();
        data = new DS4Report((_this.wireless ? buf.slice(2) : buf), _this);
        return _this._receive_report(data);
      };
    })(this));
  }

  DS4Gamepad.prototype.set = function(changes) {
    var blinkmode, color, key, packet, packet_data, prep, result, rumble, setting, value, _ref, _ref1;
    for (setting in changes) {
      value = changes[setting];
      if (this._config[setting] == null) {
        throw new Error("Unknown setting " + setting);
      }
    }
    for (key in changes) {
      value = changes[key];
      this._config[key] = value;
    }
    if (changes.rumble != null) {
      this._config.rumble_coarse = this._config.rumble_fine = changes.rumble;
    }
    prep = function(val) {
      return Math.max(0, Math.min(Math.round(val * 255), 255));
    };
    color = Color(this._config.led);
    blinkmode = (function() {
      if (typeof this._config.blink === 'object') {
        return this._config.blink;
      } else if (this._config.blink === true) {
        return {
          on: 0.25,
          off: 0.5
        };
      } else if (this._config.blink === false) {
        return {
          on: 0,
          off: 0
        };
      } else {
        throw new Error("Blink value invalid");
      }
    }).call(this);
    rumble = typeof this._config.rumble === 'object' ? this._config.rumble : {
      fine: this._config.rumble,
      coarse: this._config.rumble
    };
    if (blinkmode.on > 2.55 || blinkmode.off > 2.55) {
      throw new Error("Blink durations cannot exceed 2.55 seconds");
    }
    if (!(typeof rumble.coarse === 'number' && (0 <= (_ref = rumble.coarse) && _ref <= 1))) {
      throw new Error("Rumble values must be numbers between 0.0 and 1.0");
    }
    if (!(typeof rumble.fine === 'number' && (0 <= (_ref1 = rumble.fine) && _ref1 <= 1))) {
      throw new Error("Rumble values must be numbers between 0.0 and 1.0");
    }
    packet_data = new Buffer([prep(rumble.fine), prep(rumble.coarse), color.red(), color.green(), color.blue(), prep(blinkmode.on / 2.55), prep(blinkmode.off / 2.55)]);
    if (this.wireless) {
      packet = new Buffer(0);
      packet.fill(0);
      packet.copy([0x11, 128, 0, 0xff], 0);
      packet.copy(packet_data, 6);
      packet.writeInt32LE(crc32.unsigned(packet.slice(0)));
      packet = [0x11, 128, 0, 0xff, 0, 0].concat(packet_data, this.zero_padding).slice(0);
      result = crc32.unsigned(packet);
      return packet.writeInt32LE(crc32.unsigned(packet), this.hid.sendFeatureReport(packet));
    } else {
      return this.hid.write([0x5, 0xff, 0, 0].concat(packet_data.toJSON()));
    }
  };

  DS4Gamepad.prototype._receive_report = function(data) {
    var changes, idx, key, old_touch, queue, touch, touch_update, touches, value, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3;
    this.report = data;
    queue = [];
    this._previous_report || (this._previous_report = data);
    touches = {
      active: [],
      started: [],
      moved: [],
      ended: []
    };
    _ref = data.trackpad;
    for (idx = _i = 0, _len = _ref.length; _i < _len; idx = ++_i) {
      touch_update = _ref[idx];
      touch = this._touch_obj_cache[touch_update.id];
      if (!touch) {
        this._touch_obj_cache[touch_update.id] = touch = new DS4TouchEvent;
      }
      old_touch = this._previous_report.trackpad[idx];
      for (key in touch_update) {
        value = touch_update[key];
        touch[key] = value;
      }
      if (old_touch.id === touch.id) {
        touch.delta.x = touch.x - old_touch.x;
        touch.delta.y = touch.y - old_touch.y;
      }
      if (touch.active) {
        touches.active.push(touch);
      }
      if (old_touch.id !== touch.id && touch.active) {
        touches.started.push(touch);
      }
      if (old_touch.active && !touch.active) {
        touches.ended.push(touch);
        this._touch_obj_cache[touch.id] = null;
      }
      if ((old_touch.x !== touch.x || old_touch.y !== touch.y) && old_touch.active && touch.active) {
        touches.moved.push(touch);
      }
    }
    changes = {};
    _ref1 = this.report;
    for (key in _ref1) {
      value = _ref1[key];
      if (value === true && this._previous_report[key] === false) {
        changes[key] = value;
      }
      if (value === false && this._previous_report[key] === true) {
        changes[key] = value;
      }
      if (key !== 'timestamp' && key !== 'trackpad' && typeof value !== 'boolean' && JSON.stringify(value) !== JSON.stringify(this._previous_report[key])) {
        changes[key] = value;
      }
    }
    this.emit('report', data);
    if (((function() {
      var _results;
      _results = [];
      for (key in changes) {
        _results.push(key);
      }
      return _results;
    })()).length !== 0) {
      this.emit('change', changes);
    }
    for (key in changes) {
      value = changes[key];
      if (value === true) {
        this.emit('keydown', key);
        this.emit(key);
      } else if (value === false) {
        this.emit('keyup', key);
        this.emit("" + key + "Release");
      } else {
        this.emit(key, value);
      }
    }
    if (touches.started.length + touches.ended.length + touches.moved.length > 0) {
      this.emit('touch', touches);
    }
    if (touches.started.length > 0) {
      this.emit('touchstart', touches.started);
    }
    _ref2 = touches.moved;
    for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
      touch = _ref2[_j];
      touch.emit('move');
    }
    _ref3 = touches.ended;
    for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
      touch = _ref3[_k];
      touch.emit('end');
    }
    this.trackpad.touches = touches.active;
    return this._previous_report = data;
  };

  return DS4Gamepad;

})(events.EventEmitter);

DS4TouchEvent = (function(_super) {
  __extends(DS4TouchEvent, _super);

  function DS4TouchEvent() {
    this.created = new Date;
    this.delta = {
      x: 0,
      y: 0
    };
  }

  DS4TouchEvent.prototype.x = 0;

  DS4TouchEvent.prototype.y = 0;

  DS4TouchEvent.prototype.id = -1;

  DS4TouchEvent.prototype.active = false;

  return DS4TouchEvent;

})(events.EventEmitter);

DS4Report = (function() {
  DS4Report.prototype._deadzone_filter = function(value) {
    if ((-this.deadzone < value && value < this.deadzone)) {
      return 0;
    } else {
      return value;
    }
  };

  function DS4Report(buf, configuration) {
    var dPad;
    this.deadzone = configuration.deadzone;
    this.sensorsActive = configuration.wireless === false || (buf[0] === 0);
    this.leftAnalog = {
      x: this._deadzone_filter(buf[1] / 127.5 - 1),
      y: this._deadzone_filter(buf[2] / 127.5 - 1)
    };
    this.rightAnalog = {
      x: this._deadzone_filter(buf[3] / 127.5 - 1),
      y: this._deadzone_filter(buf[4] / 127.5 - 1)
    };
    this.l2Analog = buf[8] / 255;
    this.r2Analog = buf[9] / 255;
    dPad = buf[5] & 0xf;
    this.up = dPad === 0 || dPad === 1 || dPad === 7;
    this.down = dPad === 3 || dPad === 4 || dPad === 5;
    this.left = dPad === 5 || dPad === 6 || dPad === 7;
    this.right = dPad === 1 || dPad === 2 || dPad === 3;
    this.cross = (buf[5] & 32) !== 0;
    this.circle = (buf[5] & 64) !== 0;
    this.square = (buf[5] & 16) !== 0;
    this.triangle = (buf[5] & 128) !== 0;
    this.l1 = (buf[6] & 0x01) !== 0;
    this.l2 = (buf[6] & 0x04) !== 0;
    this.r1 = (buf[6] & 0x02) !== 0;
    this.r2 = (buf[6] & 0x08) !== 0;
    this.l3 = (buf[6] & 0x40) !== 0;
    this.r3 = (buf[6] & 0x80) !== 0;
    this.share = (buf[6] & 0x10) !== 0;
    this.options = (buf[6] & 0x20) !== 0;
    this.trackpadButton = (buf[7] & 2) !== 0;
    this.psButton = (buf[7] & 1) !== 0;
    if (this.sensorsActive) {
      this.motion = {
        y: buf.readInt16LE(13),
        x: -buf.readInt16LE(15),
        z: -buf.readInt16LE(17)
      };
      this.orientation = {
        roll: -buf.readInt16LE(19),
        yaw: buf.readInt16LE(21),
        pitch: buf.readInt16LE(23)
      };
      this.trackpad = [
        {
          id: buf[35] & 0x7f,
          active: (buf[35] >> 7) === 0,
          x: ((buf[37] & 0x0f) << 8) | buf[36],
          y: buf[38] << 4 | ((buf[37] & 0xf0) >> 4)
        }, {
          id: buf[39] & 0x7f,
          active: (buf[39] >> 7) === 0,
          x: ((buf[41] & 0x0f) << 8) | buf[40],
          y: buf[42] << 4 | ((buf[41] & 0xf0) >> 4)
        }
      ];
      this.batteryLevel = buf[12] / 255;
    } else {
      this.motion = {
        x: 0,
        y: 0,
        z: 0
      };
      this.orientation = {
        roll: 0,
        yaw: 0,
        pitch: 0
      };
      this.trackpad = [
        {
          id: 0,
          active: false,
          x: 0,
          y: 0
        }, {
          id: 0,
          active: false,
          x: 0,
          y: 0
        }
      ];
      this.batteryLevel = -1.0;
    }
  }

  return DS4Report;

})();

DS4Gamepad.devices = function() {
  return hid.devices().filter(isDS4HID);
};

exports.Gamepad = DS4Gamepad;

//# sourceMappingURL=sony_controller.js.map
