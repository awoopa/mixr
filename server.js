/*************************************
//
// mixr app
//
**************************************/

// express magic
var express = require('express');
var app = express();
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);
var device  = require('express-device');
var request = require('request');
var runningPortNumber = process.env.PORT || 1337;
var _ = require('lodash');
var url = require('url');
var moment = require('moment');

var syncInterval = 50;
var nextId = 1;
var SC = require('node-soundcloud');


app.configure(function() {
	// I need to access everything in '/public' directly
	app.use(express.static(__dirname + '/public'));

	//set the view engine
	app.set('view engine', 'ejs');
	app.set('views', __dirname +'/views');

	app.use(device.capture());
});


// logs every request
app.use(function(req, res, next){
	// output every request in the array
	console.log({ method:req.method, url: req.url, device: req.device });

	// goes onto the next function in line
	next();
});

const CLIENT_ID = "4c85f5a7670cebd708284488e725bb6b";

SC.init({
	id: CLIENT_ID,
	secret: "127adaec7e8ef2779afa76d2c6b5da8c"
});

/*SC.get('/tracks/164497989', function(err, track) {
  if ( err ) {
    throw err;
  } else {
    //console.log('track retrieved:', track);
  }
});*/




app.get("/", function(req, res){
	res.render('index', {roomName: 'root'});
});

app.get("/:roomName", function(req, res) {
	res.render('index', {roomName: req.params.roomName});
})


function User(socketId, name) {
	this.socketId = socketId;
	this.name = name;
}

function Track(id) {
	this.remove = false;
	this.id = id;
	this.bpm = 100;
	this.sampleRate = 44100;
	this.length;
	this.startTime = 10000;
	this.waveformURL;
	this.name;
	this.artist;
}

function Room() {
	this.roomName;
	this.tracks = {};
	this.users = [];
	this.currentTime = 0;
	this.intervalObject;
}

var rooms = {};

function getTrackFromURL(url) {
	return new Promise(function(resolve, reject) {
	  var r = request("http://api.soundcloud.com/resolve?url=" + url + "&client_id=" + CLIENT_ID, function (e, res) {
		SC.get(r.uri.href, function (e, track_info) {
			if (!track_info) {
				var track = new Track(null);
				resolve(track);
			}
			else {
				console.log("URL: " +  url);
				console.log("TYPEOF TRACK_INFO " + typeof track_info);
				console.log("TRACK_INFO: " + track_info);
				var track = new Track(track_info.id);
				track.waveformURL = track_info.waveform_url;
				track.length = track_info.duration;
				track.name = track_info.title;
				track.artist = track_info.user.username;

				resolve(track);
			}
		});
	  });
	});
}

io.on('connection', function (socket) {
	var user = null;
	var room = null;

	/*
	A client enters the room.
	{
		room_name: ''  ;; the room name that a client intends to join/create
		user_name: ''  ;; the client user's name
	}
	specify a call back:
	function callback(roomExists: boolean) { ... }
	*/
	socket.on('join room', function (data) {
		var roomName = data.roomName;
		var userName = data.userName;

		console.log("user " + userName + " is joining " + roomName);

		if (!roomName || !userName) {
			return;
		}

		user = new User(socket.id, userName);

		if (rooms[roomName] != null) {
			room = rooms[roomName];
			room.users.push(user);
			socket.join(room.roomName);
		} else {
			room = new Room();

			room.roomName = data.roomName;
			room.users.push(user);
			rooms[roomName] = room;

			socket.join(room.roomName);
			room.intervalObject	= setInterval(updateRoom, syncInterval, room);
		}

		socket.emit('track list', room.tracks);
	});

	socket.on('submit track', function(data) {
		if (!room || !user) {
			return;
		}

		console.log("adding track " + data.url);

		getTrackFromURL(data.url).then(function (track) {
			if (track.id === undefined || track.id === null) return;

			track.speed = 1;
			track.hipass = false;
			track.lopass = false;
			track.fade = "none";
			track.vol = 1;

			track.number = nextId++;
			track.startTime = clock() + 1000; // start 3 seconds later
			room.tracks[track.number] = track;
			io.to(room.roomName).emit('add track', track);
		})
	});

	socket.on('edit tracks', function(data) {
		editTracks(room, data);
	});

	socket.on('send msg', function(data) {
		if (data.msg != "") {
			var chatMessage = {
				username: user.name,
				msg: data.msg
			}

			io.to(room.roomName).emit('receive msg', chatMessage);
		}
	});
});

function editTracks(room, datas) {
	for (var i = 0; i < datas.length; i++) {
		var data = datas[i];

		if (data.remove) {
			delete room.tracks[data.number];
		}
		else {
			var obj = room.tracks[data.number];
			if (data.startTime !== undefined) obj.startTime = data.startTime;
			if (data.speed !== undefined) obj.speed = data.speed;
			if (data.hipass !== undefined) obj.hipass = data.hipass;
			if (data.lopass !== undefined) obj.lopass = data.lopass;
			if (data.fade !== undefined) obj.fade = data.fade;
			if (data.vol !== undefined) obj.vol = data.vol;
		}
	}

	console.log("edit tracks " + JSON.stringify(datas));
	io.to(room.roomName).emit('edit tracks', datas);
}

function updateRoom(room) {
	var t = clock();
	for (var key in room.tracks) {
		if (!room.tracks.hasOwnProperty(key)) continue;

		var value = room.tracks[key];
		if (value.length + value.startTime <= t) {
			var delData = { remove: true, number: key }
			editTracks(room, [delData]);
		}
	}

	io.to(room.roomName).emit('sync', { ts: t });
}

function clock() {
    var end = process.hrtime();
    return Math.round((end[0] * 1000) + (end[1] / 1000000));
}

server.listen(runningPortNumber);
console.log("server listening on port " + runningPortNumber);
