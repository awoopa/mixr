var audioCtx = new AudioContext();

var createSource = function(trackNumber) {
	var audio = new Audio();
	var url = 'http://api.soundcloud.com/tracks/' + trackNumber + '/stream?client_id=4c85f5a7670cebd708284488e725bb6b';

	audio.src = url;
	audio.crossOrigin = "anonymous";

	var source = audioCtx.createMediaElementSource(audio);
	source.connect(audioCtx.destination);
	return source;
}

var vote = function(elemid) {
	var elem = document.getElementById(elemid);
	var vote;
	console.log(elem.id);
	var className = elem.classList[1];
	var id = elem.id.split(".");
	if (className.indexOf('up') != -1) {
		vote = 'upvote';
		if (document.getElementsByClassName('upvotecolor').length > 0) {
			elem.classList.remove('upvotecolor');
			socket.emit('unvote', {voteDir: vote, videoId: id[1]});

		} else if (document.getElementsByClassName('downvotecolor').length > 0) {
			/*elem.classList.add('upvotecolor');
			document.getElementById("thumbs-down." + id[1]).classList.remove('downvotecolor');
			socket.emit('vote', {voteDir: vote, videoId: id[1]});

			socket.emit('unvote', {voteDir: 'downvote', videoId: id[1]});*/
			/*vote2("thumbs-down." + id[1]);
			vote2("thumbs-up." + id[1]);*/
		} else {
			elem.classList.add('upvotecolor');
			socket.emit('vote', {voteDir: vote, videoId: id[1]});
		}
	} else {
		vote = 'downvote';
		if (document.getElementsByClassName('downvotecolor').length > 0) {
			elem.classList.remove('downvotecolor');
			socket.emit('unvote', {voteDir: vote, videoId: id[1]});
		} else if (document.getElementsByClassName('upvotecolor').length > 0) {
			elem.classList.add('downvotecolor');
			document.getElementById("thumbs-up." + id[1]).classList.remove('upvotecolor');
			socket.emit('vote', {voteDir: vote, videoId: id[1]});
			socket.emit('unvote', {voteDir: 'upvote', videoId: id[1]});
		}
		else {
			elem.classList.add('downvotecolor');
			socket.emit('vote', {voteDir: vote, videoId: id[1]});
		}
	}

	console.log(vote);

	socket.on('video voted', function(data) {
		var points = data.points;
		var id = data.videoId;
		document.getElementById("thumbs-up." + id).parentNode.children[1].innerHTML = points;
	});
};

var vote2 = function(elem2) {
	vote(elem2);
};

(function() {
	"use strict";

	var tracks = null;
	var clientOffset = null;

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
			//addMessage(username, message);
		}

/*		usernameInput.onkeypress = function(e) {
			if (e.keyCode == 13) {
				setUsername();
			}
		}*/

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

		function loop() {
			if (!tracks) return;
			var ts = clientTime();

			for (var key in tracks) {
				if (!tracks.hasOwnProperty(key)) continue;

				var value = tracks[key];
				if (!value.source) {
					value.source = createSource(value.id);

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
						if (Math.abs(ts - (value.startTime + value.source.mediaElement.currentTime * 1000)) > 50) {
							value.source.mediaElement.currentTime = (ts - value.startTime) / 1000;
						}
					}
					else {
						value.source.mediaElement.currentTime = (ts - value.startTime) / 1000;
						value.source.mediaElement.play();
					}
				}
				if (ts <= value.startTime && !value.source.mediaElement.paused) {
					value.source.mediaElement.pause();
					value.source.mediaElement.currentTime = 0;
				}
			}
		}

		var xscale = 200;
		function getTrackHoriz(track) {
			var time = clientTime();
			return { x: (track.startTime - time) / xscale, width: (track.length / xscale) };
		}

		var tracklistprevmouse = null;
		var tracklistclicking = null;

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
				}
			}

			return true;
		}

		function tracklistonmouseup(e) {
			if (tracklistclicking != null) {
				var track = tracks[tracklistclicking];
				var extents = getTrackHoriz(track);
				var toSend = [{ number: tracklistclicking, startTime: (track.x) * xscale + clientTime() }];
				editTracks(toSend);
				socket.emit('edit tracks', toSend);
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

			var grd = ctx.createLinearGradient(0, 0, 0, 200);
			grd.addColorStop(0, "black");
			grd.addColorStop(1, "white");
			ctx.fillStyle = grd;
			ctx.fillRect(0, 0, document.body.clientWidth, document.body.clientHeight);

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

				tracklistCtx.drawImage(track.waveform, track.x, track.y, track.w, track.h);
				tracklistCtx.fillStyle = "#AAAAAA";
				tracklistCtx.fillText(track.artist + " - " + track.name, Math.max(track.x + 10, 10), track.y + 30);

				yscan += 50;
			}
		}

		setInterval(loop, 30);
		setInterval(render, 50);

		function editTracks(datas) {
			for (var i = 0; i < datas.length; i++) {
				var data = datas[i];
				if (data.remove) {
					if (tracks[data.number]) {
						if (tracks[data.number].source) {
							tracks[data.number].source.mediaElement.pause();
						}
						delete tracks[data.number];
					}
				}
				else {
					var obj = tracks[data.number];
					obj.startTime = data.startTime;
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
