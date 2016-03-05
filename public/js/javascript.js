(function() {
	"use strict";
	window.onload = function() {
		var topBar = document.getElementById("top-bar");
		var sideBar = document.getElementById("side-bar");
		var pin = document.getElementById("pin");
		var tabs = [document.querySelector(".top-tab img"), document.querySelector(".side-tab img")];
		var c = document.getElementById("canvas-page");
		var ctx = c.getContext("2d");

		var tracklistCanvas = document.getElementById("tracklist-canvas");
		var tracklistCtx = tracklistCanvas.getContext("2d");

		var editorCanvas = document.getElementById("editor-canvas");
		var editorCtx = editorCanvas.getContext("2d");

		tracklistCanvas.width = window.innerWidth;
		tracklistCanvas.height = 50;

		window.canvas = c;
		window.ctx = ctx;

		window.tracklistCanvas = tracklistCanvas;
		window.tracklistCtx = tracklistCtx;
		window.editorCanvas = editorCanvas;
		window.editorCtx = editorCtx;



		var SoundCloudAudioSource = function() {
			var self = this;
			var sampleAudioStream = function() {
				window.analyser.getByteFrequencyData(self.streamData);
				// calculate an overall volume value
				var total = 0;
				for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
					total += self.streamData[i];
				}
				self.volume = total;
			};
			setInterval(sampleAudioStream, 50);

			this.volume = 0;
			this.streamData = new Uint8Array(window.analyser.fftSize);
		};

		var visualizer = new Visualizer();
		visualizer.init({
			containerId: 'visualizer',
			audioSource: new SoundCloudAudioSource()
		});
		window.visualizer = visualizer;



		pin.onclick = pinSidebar;
		sideBar.style.right = "-" + sideBar.offsetWidth + "px";

		function pinSidebar() {
			if (pin.checked) {
				topBar.style.width = window.innerWidth - sideBar.offsetWidth + "px";
				console.log(sideBar.offsetWidth);
			} else {
				topBar.style.width = "";
			}
		}

		function getCursorPosition(e){
			// Mouse moves. Now show tabs
			clearTimeout(mouseTimer);
			if (document.getElementsByClassName("top-bar-hover").length == 0 &&
				document.getElementsByClassName("side-bar-hover").length == 0) {
				tabs.forEach(function(t) {
					t.style.opacity = 0.5;
				});
			}

			// Hover for top bar
			if (e.pageY < 30) {
				if (!pin.checked && document.getElementsByClassName("side-bar-hover").length == 0) {
					topBar.classList.add("top-bar-hover");
				} else if (pin.checked && e.pageX < window.innerWidth - sideBar.offsetWidth) {
					topBar.classList.add("top-bar-hover");
				}
			} else if (e.pageY > topBar.offsetHeight + 30) {
				topBar.classList.remove("top-bar-hover");
			}

			// Hover for side bar
			if (e.pageX > window.innerWidth - 30 && document.getElementsByClassName("top-bar-hover").length == 0) {
				sideBar.classList.add("side-bar-hover");
			} else if (e.pageX < window.innerWidth - sideBar.offsetWidth - 30 && !pin.checked) {
				sideBar.classList.remove("side-bar-hover");
			}
			var mouseTimer = setTimeout(hideTabs, 2500);
		}

		function hideTabs() {
			tabs.forEach(function(t) {
				t.style.opacity = 0;
			});
		}

		document.addEventListener('mousemove', getCursorPosition, false);

		document.getElementById('createbutton').addEventListener('click', function() {
			var newRoomUrl = window.location.origin + '/' + document.getElementById('nameinput').value;
			window.location.href = newRoomUrl;
		});

		document.getElementById('new-room-form').addEventListener('submit', function(e) {
			e.preventDefault();
			var newRoomUrl = window.location.origin + '/' + document.getElementById('nameinput').value;
			window.location.href = newRoomUrl;
			return false;
		});

		window.onresize = function()
		{
			canvas.height = canvas.clientHeight;
			canvas.width = canvas.clientWidth;
			editorCanvas.height = editorCanvas.clientHeight;
			editorCanvas.width = editorCanvas.clientWidth;
		}
		window.onresize();
	};
}) ();
