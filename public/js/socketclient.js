var audioCtx = new AudioContext();

var createSource = function(dest, trackNumber) {
	var audio = new Audio();
	var url = 'http://api.soundcloud.com/tracks/' + trackNumber + '/stream?client_id=4c85f5a7670cebd708284488e725bb6b';

	audio.src = url;
	audio.crossOrigin = "anonymous";

	var source = audioCtx.createMediaElementSource(audio);
	var biquad = audioCtx.createBiquadFilter();
	var gain = audioCtx.createGain();
	source.connect(biquad);
	biquad.connect(gain);
	gain.connect(dest);

	return { source: source, biquad: biquad, gain: gain };
};

(function() {
	"use strict";

	var tracks = null;
	var clientOffset = null;
	var visualizer = new Visualizer();
	var analyser = audioCtx.createAnalyser();
	analyser.connect(audioCtx.destination);
	analyser.fftSize = 128;

	var SoundCloudAudioSource = function() {
		var self = this;
		var sampleAudioStream = function() {
			analyser.getByteFrequencyData(self.streamData);
			// calculate an overall volume value
			var total = 0;
			for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
				total += self.streamData[i];
			}
			self.volume = total;
		};
		setInterval(sampleAudioStream, 50);

		this.volume = 0;
		this.streamData = new Uint8Array(analyser.fftSize);
	}


	setTimeout(function() {
		visualizer.init({
			containerId: 'visualizer',
			audioSource: new SoundCloudAudioSource()
		});

		window.visualizer = visualizer;
	}, 10);

	var dataArray = new Uint8Array(analyser.fftSize);

	function clientTime() {
		return clientOffset + window.performance.now();
	}

	function addLoadEvent(func) {
		var oldonload = window.onload;
		if (typeof window.onload != 'function') {
			window.onload = func;
		} else {
			window.onload = function() {
				if (oldonload) {
					oldonload();
				}
				func();
			}
		}
	}

	addLoadEvent(function() {
		var messageInput = document.querySelector('.messageInput');
		/*var usernameInput = document.querySelector('.usernameInput');*/
		var chatArea = document.querySelector('.chatArea')
		var messages = document.querySelector('.messages');

		var username = random_username();
		var connected = false;
		/*var usernameSubmit = document.querySelector('.usernameSubmit');*/
		var messageSubmit = document.querySelector('.messageSubmit');
		/*usernameSubmit.onclick = setUsername;*/
		messageSubmit.onclick = messageSend;

		var trackUrlInput = document.querySelector('#track-url')
		var trackSubmit = document.querySelector('#submit-track');
		trackSubmit.onclick = submitTrack;

		window.tracklistCanvas.onmousedown = tracklistonmousedown;
		window.tracklistCanvas.onmouseup = tracklistonmouseup;
		window.tracklistCanvas.onmousemove = tracklistonmousemove;
		window.tracklistCanvas.onselectstart = function() { return false; }
		window.tracklistCanvas.oncontextmenu = tracklistoncontextmenu;
		window.tracklistCanvas.onmouseout = tracklistonmouseup;
		window.editorCanvas.onmousemove = editoronmousemove;
		window.editorCanvas.onclick = editoronclick;

		socket.emit('join room', { roomName: document.body.dataset.room, userName: username });

		messageInput.onkeypress = function(event) {
			//enter key is 13
			if (event.keyCode == 13) {
			event.cancelubble = true;
				event.returnValue = false;
				event.preventDefault();
				event.stopPropagation();

				messageSend();
			}
		}

		function messageSend() {
			var message = messageInput.value;
			if (message !== "") {
				socket.emit('send msg', {username: username, msg: message});
			}
			messageInput.value = "";
		}

		function addMessage(username, message) {
			var element = document.createElement('li');

			var usernameElement = document.createElement('span');
			usernameElement.className = 'username';
			usernameElement.innerHTML = username + ": ";
			var msgElement = document.createElement('span');
			msgElement.innerHTML = message;

			element.appendChild(usernameElement);
			element.appendChild(msgElement);

			messages.appendChild(element);

			if (messages.scrollHeight > messages.clientHeight) {
			  	messages.scrollTop = messages.scrollHeight - messages.clientHeight;
			}
		}

		function sync(ts) {
			if (tracks === null) return;

			if (clientOffset === null) {
				clientOffset = ts - window.performance.now();
			}
			else {
				var time = clientTime();
				if (Math.abs(time - ts) > 5) {
					clientOffset += (ts - time) * 0.2;
				}
			}
		}

		var editorRects = [
			{ x: 10, y: 10, w: 333, h: 50, text: 'Low Pass', active: function(track) { return track.lopass; }, click: function(track) {
				var toSend = [{ number: track.number, lopass: !track.lopass }];
				editTracks(toSend);
				socket.emit('edit tracks', toSend);
			}},
			{ x: 300, y: 10, w: 333, h: 50, text: 'High Pass', active: function(track) { return track.hipass; }, click: function(track) {
				var toSend = [{ number: track.number, hipass: !track.hipass }];
				editTracks(toSend);
				socket.emit('edit tracks', toSend);
			}},
			{ x: 600, y: 10, w: 333, h: 50, text: '2x Speed', active: function(track) { return track.speed > 1; }, click: function(track) {
				var toSend = [{ number: track.number, speed: track.speed == 1 ? 2 : 1 }];
				editTracks(toSend);
				socket.emit('edit tracks', toSend);
			}},
		];


		function loop() {
			if (!tracks) return;
			var ts = clientTime();

			for (var key in tracks) {
				if (!tracks.hasOwnProperty(key)) continue;

				var value = tracks[key];
				if (!value.source) {
					var sources = createSource(analyser, value.id);
					value.source = sources.source;
					value.gain = sources.gain;
					value.biquad = sources.biquad;

					var waveform = new Image();
					value.waveform = waveform;
					waveform.src = value.waveformURL;
					waveform.onload = function() {
						var height = waveform.height;
						var width = waveform.width;
						var scale_ratio = 10 / height;
						var new_width = width * scale_ratio;
					};
				}

				if (ts >= value.startTime) {
					if (!value.source.mediaElement.paused) {
						if (Math.abs(ts - (value.startTime + value.source.mediaElement.currentTime * 1000 / value.source.mediaElement.playbackRate)) > 50) {
							value.source.mediaElement.currentTime = (ts - value.startTime) / 1000 * value.source.mediaElement.playbackRate;
						}
					}
					else {
						value.source.mediaElement.currentTime = (ts - value.startTime) / 1000 * value.source.mediaElement.playbackRate;
						value.source.mediaElement.play();
					}

					if (value.gain.gain.value != value.vol) {
						value.gain.gain.value = value.vol;
					}

					if (value.speed != value.source.mediaElement.playbackRate) {
						value.source.mediaElement.playbackRate = value.speed;
					}

					if (value.hipass) {
						if (value.lopass) {
							if (value.biquad.type != "bandpass") {
								value.biquad.type = "bandpass";
								value.biquad.frequency.value = 1000;
							}
						}
						else {
							if (value.biquad.type != "highpass" || value.biquad.frequency.value < 10) {
								value.biquad.type = "highpass";
								value.biquad.frequency.value = 1000;
							}
						}
					}
					else if (value.lopass) {
						if (value.biquad.type != "lowpass") {
							value.biquad.type = "lowpass";
							value.biquad.frequency.value = 1000;
						}
					}
					else {
						if (value.biquad.type != "highpass" || value.biquad.frequency.value > 10) {
							value.biquad.type = "highpass";
							value.biquad.frequency.value = 1;
						}
					}
				}
				if (ts <= value.startTime && !value.source.mediaElement.paused) {
					value.source.mediaElement.pause();
					value.source.mediaElement.currentTime = 0;
				}
			}
		}

		var xscale = 300;
		function getTrackHoriz(track) {
			var time = clientTime();
			return { x: (track.startTime - time) / xscale, width: (track.length / xscale / track.speed) };
		}

		var tracklistprevmouse = null;
		var tracklistclicking = null;
		var tracklistselected = null;
		var editorMouse = { x: 0, y: 0};

		function editoronclick(e) {
			var r = window.editorCanvas.getBoundingClientRect();
			var mouse = { x: e.x - r.left, y: e.y - r.top };

			for (var i = 0; i < editorRects.length; i++) {
				var rect = editorRects[i];
				if (mouse.x > rect.x && mouse.x < rect.x + rect.w && mouse.y > rect.y && mouse.y < rect.y + rect.h) {
					rect.click(tracks[tracklistselected]);
				}
			}
		}

		function editoronmousemove(e) {
			var r = window.editorCanvas.getBoundingClientRect();
			editorMouse = { x: e.x - r.left, y: e.y - r.top };
		}

		function tracklistoncontextmenu(e) {
			var r = window.tracklistCanvas.getBoundingClientRect();
			var mouse = { x: e.x - r.left, y: e.y - r.top };

			for (var k in tracks) {
				if (!tracks.hasOwnProperty(k)) continue;

				var track = tracks[k];
				if (mouse.x > track.x && mouse.x < track.x + track.w && mouse.y > track.y && mouse.y < track.y + track.h) {
					var toSend = [{ number: k, remove: true }];
					editTracks(toSend);
					socket.emit('edit tracks', toSend);
				}
			}

			e.preventDefault();
			return false;
		}

		function tracklistonmousedown(e) {
			var r = window.tracklistCanvas.getBoundingClientRect();
			var mouse = { x: e.x - r.left, y: e.y - r.top };
			var tracklistprevmouse = mouse;

			for (var k in tracks) {
				if (!tracks.hasOwnProperty(k)) continue;

				var track = tracks[k];
				if (e.button == 0 && mouse.x > track.x && mouse.x < track.x + track.w && mouse.y > track.y && mouse.y < track.y + track.h) {
					tracklistclicking = k;
					tracklistselected = k;
				}
			}

			return true;
		}

		function tracklistonmouseup(e) {
			if (tracklistclicking != null) {
				var track = tracks[tracklistclicking];
				var extents = getTrackHoriz(track);
				if (Math.abs(track.x - extents.x) > 3) {
					var toSend = [{ number: tracklistclicking, startTime: (track.x) * xscale + clientTime() }];
					editTracks(toSend);
					socket.emit('edit tracks', toSend);
				}
			}

			tracklistprevmouse = null;
			tracklistclicking = null;
		}

		function tracklistonmousemove(e) {
			var r = window.tracklistCanvas.getBoundingClientRect();
			var nowmouse = { x: e.x - r.top, y: e.y - r.left };

			if (tracklistclicking) {
				var track = tracks[tracklistclicking];

				track.x += nowmouse.x - tracklistprevmouse.x;
			}
			tracklistprevmouse = nowmouse;
		}

		function render() {
			var ctx = window.ctx;
			ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
			var tracklistCtx = window.tracklistCtx;

			var count = 0;
			for (var k in tracks) {
				if (tracks.hasOwnProperty(k)) {
					count++;
				}
			}

			if (window.tracklistCanvas.height != count * 50) {
				window.tracklistCanvas.height = count * 50;
			}

			tracklistCtx.fillStyle = "#EEEEEE";
			tracklistCtx.fillRect(0, 0, window.tracklistCanvas.width, window.tracklistCanvas.height);

			tracklistCtx.font="20px Calibri";
			var yscan = 0;
			for (var k in tracks) {
				if (!tracks.hasOwnProperty(k)) continue;
				var track = tracks[k];

				var extents = getTrackHoriz(track);
				if (!tracklistclicking) {
					track.x = extents.x;
				}
				track.w = extents.width;
				track.y = yscan;
				track.h = 50;

				tracklistCtx.fillStyle = "#000000";
				tracklistCtx.fillRect(track.x + 1, track.y, track.w - 2, track.h);

				if (track.waveform) {
					tracklistCtx.drawImage(track.waveform, track.x, track.y, track.w, track.h);
				}
				tracklistCtx.fillStyle = "#AAAAAA";
				tracklistCtx.fillText(track.artist + " - " + track.name, Math.max(track.x + 10, 10), track.y + 30);

				yscan += 50;
			}

			var eCtx = window.editorCtx;
			window.editorCanvas.height = 300;
			var width = window.editorCanvas.width;
			var height = window.editorCanvas.height;

			eCtx.clearRect(0, 0, width, height);
			if (tracklistselected) {
				eCtx.fillStyle = "rgba(0, 0, 0, 0.1)";
				eCtx.fillRect(0, 0, width, height);

				for (var i = 0; i < editorRects.length; i++) {
					var rect = editorRects[i];
					if (editorMouse.x > rect.x && editorMouse.x < rect.x + rect.w && editorMouse.y > rect.y && editorMouse.y < rect.y + rect.h) {
						eCtx.fillStyle = "rgba(0, 0, 255, 0.1)";
					}
					else if (rect.active(tracks[tracklistselected])) {
						eCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
					}
					else {
						eCtx.fillStyle = "rgba(0, 0, 0, 0.1)";
					}
					eCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
					eCtx.fillStyle = "#000";
					eCtx.font = "30px Calibri";
					eCtx.fillText(rect.text, rect.x + 10, rect.y + (rect.h + 30) / 2);
				}
			}
		}

		setInterval(loop, 30);
		setInterval(render, 30);

		function editTracks(datas) {
			for (var i = 0; i < datas.length; i++) {
				var data = datas[i];
				if (data.remove) {
					if (tracks[data.number]) {
						if (tracks[data.number].source) {
							tracks[data.number].source.mediaElement.pause();
						}
						if (data.number == tracklistselected) {
							tracklistselected = null;
						}
						delete tracks[data.number];
					}
				}
				else {
					var obj = tracks[data.number];
					if (data.startTime !== undefined) obj.startTime = data.startTime;
					if (data.speed !== undefined) obj.speed = data.speed;
					if (data.hipass !== undefined) obj.hipass = data.hipass;
					if (data.lopass !== undefined) obj.lopass = data.lopass;
					if (data.fade !== undefined) obj.fade = data.fade;
					if (data.vol !== undefined) obj.vol = data.vol;
				}
			}
		}

		socket.on('receive msg', function(data) {
			var username = data.username;
			var msg = data.msg;
			addMessage(username, msg);
		});

		socket.on('track list', function(data) {
			if (tracks === null) {
				console.log('receive track list ' + JSON.stringify(data));
				tracks = data;
			}
		});

		socket.on('sync', function(data) {
			sync(data.ts);
		});

		socket.on('add track', function(data) {
			data.source = null;
			tracks[data.number] = data;
		});

		socket.on('edit tracks', function(data) {
			editTracks(data);
		});

		function submitTrack() {
			var toSend = {
				'url': trackUrlInput.value
			}

			socket.emit('submit track', toSend);
			trackUrlInput.value = "";
		}
	});
})();

function random_username() {
  var adjs = ["responsive", "hidden", "bitter", "misty", "silent", "empty", "dry",
  "dark", "summer", "icy", "delicate", "quiet", "white", "cool", "spring",
  "winter", "patient", "twilight", "dawn", "crimson", "wispy", "weathered",
  "blue", "billowing", "broken", "cold", "damp", "falling", "frosty", "green",
  "long", "late", "lingering", "bold", "little", "morning", "muddy", "old",
  "red", "rough", "still", "small", "sparkling", "memetic", "shy",
  "wandering", "withered", "wild", "black", "young", "holy", "solitary",
  "fragrant", "aged", "snowy", "proud", "floral", "restless", "divine",
  "polished", "ancient", "purple", "lively", "nameless"]

  , nouns = ["prayer", "river", "breeze", "moon", "rain", "wind", "sea",
  "morning", "snow", "lake", "sunset", "pine", "shadow", "leaf", "dawn",
  "glitter", "forest", "hill", "cloud", "meadow", "sun", "glade", "bird",
  "brook", "butterfly", "bush", "dew", "dust", "field", "fire", "flower",
  "firefly", "feather", "grass", "haze", "mountain", "night", "pond",
  "darkness", "snowflake", "silence", "sound", "sky", "shape", "surf",
  "thunder", "violet", "water", "wildflower", "wave", "water", "resonance",
  "sun", "wood", "dream", "cherry", "tree", "fog", "frost", "voice", "paper",
  "frog", "smoke", "star"];

  return adjs[Math.floor(Math.random() * (adjs.length-1))]+"_"+nouns[Math.floor(Math.random()*(nouns.length-1))];
}
