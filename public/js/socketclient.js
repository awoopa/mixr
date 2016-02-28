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
	var clientTime = -1;

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

			if (clientTime < 0) {
				clientTime = ts;
			}
			else {
				if (Math.abs(clientTime - ts) > 5) {
					clientTime += (ts - clientTime) * 0.2;
				}
			}
		}

		function loop() {
			if (!tracks) return;
			var ts = clientTime;

			for (var key in tracks) {
				if (!tracks.hasOwnProperty(key)) continue;

				var value = tracks[key];
				if (!value.source && ts >= value.startTime) {
					value.source = createSource(value.id);
					value.source.mediaElement.currentTime = (ts - value.startTime) / 1000;
					value.source.mediaElement.play();
				}
				else if (value.source) {
					if (Math.abs(ts - (value.startTime + value.source.mediaElement.currentTime * 1000)) > 50) {
						value.source.mediaElement.currentTime = (ts - value.startTime) / 1000;
					}
				}
			}
		}

		setInterval(loop, 30);

		function editTracks(datas) {
			for (var i = 0; i < datas.length; i++) {
				var data = datas[i];
				if (data.remove) {
					if (tracks[data.number]) {
						if (tracks[data.number].source) {
							tracks[data.number].source.mediaElement.stop();
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
			console.log("receive track");
			data.source = null;
			tracks[data.number] = data;

			var count = 0;
			for (var k in tracks) {
			    if (tracks.hasOwnProperty(k)) {
			       ++count;
			    }
			}

			window.tracklistCanvas.height = count * 50;

			var waveform = new Image();
			waveform.src = data.waveformURL;
			waveform.onload = function() {
				var height = waveform.height;
				var width = waveform.width;
				var scale_ratio = 10 / height;
				var new_width = width * scale_ratio;
				window.tracklistCtx.fillStyle = "green";
				window.tracklistCtx.fillRect(0, 0, 50, 50*height/width);
			    //window.tracklistCtx.drawImage(waveform, 0, 0, new_width, 10);

			};
		});

		socket.on('edit track', function(data) {
			editTrack(data);
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
