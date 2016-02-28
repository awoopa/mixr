/*************************************
//
// mixr	 app
//
**************************************/

// express magic
var express = require('express');
var app = express();
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);
var device  = require('express-device');

var runningPortNumber = process.env.PORT || 1337;
var _ = require('lodash');
var YouTube = require('youtube-node');
var yt = new YouTube();
var url = require('url');
var moment = require('moment');
var syncFreq = 30;

var time = 0;

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
	console.log({method:req.method, url: req.url, device: req.device});

	// goes onto the next function in line
	next();
});

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

function Video(videoURL) {
	this.points = 0;
	this.url = videoURL;
	this.name; // TODO: fetch video name somehow
	this.uploader;
	this.length;
	this.votedUsers = [];
	this.videoId = url.parse(videoURL, true).query.v;
}

function Room() {
	this.roomName;
	this.users = [];
	this.videos = {};
	this.currentVideo = null;
	this.currentTime = 0;
	this.intervalObject;
}

var rooms = {};

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
			// send sync event
			room.intervalObject	= setInterval(updateRoom, 1000 / syncFreq, room);
		}

		socket.emit('video list', room.videos);
		console.log(room.videos);
	});

	socket.on('submit track', function(data) {
		if (!room || !user) {
			return;
		}

		console.log("adding track " + data.url);
		var track = { }; // TODO

		// process track
		
		track.url = data.url;
		track.bpm = 100;
		track.sampleRate = 44100;
		track.length = 100;
		track.startTime = 10000;

		io.to(room.roomName).emit('add track', track);
	});

	socket.on('send msg', function (data) {
		if (data.msg != "") {
			var chatMessage = {
				username: user.name,
				msg: data.msg
			}

			io.to(room.roomName).emit('receive msg', chatMessage);
		}
	});
});

function updateRoom(room) {
	if (room.currentVideo !== null) {
		// already past end of video, update with next video
		if (room.currentTime + syncDuration > room.currentVideo.length) {
			io.to(room.roomName).emit('video ended', {videoId: room.currentVideo.videoId});
			delete room.videos[room.currentVideo.videoId];
			room.currentVideo = null;
		}
	}

	// get new video if no current video
	if (room.currentVideo === null) {
		if (_.size(room.videos) > 0) {
			// Number.MIN_SAFE_INTEGER = most negative number
			// need to account for negative voted videos too
			var max = {points: Number.MIN_SAFE_INTEGER};
			for (var k in room.videos) {
				room.videos[k].points > max.points ? max = room.videos[k] : max = max;
			}

			room.currentVideo = max;
			room.currentTime = 0;
			sync.videoId = url.parse(room.currentVideo.url, true).query.v;
			sync.timestamp = 0;
		} else {
			sync.videoId = null;
			sync.timestamp = -1;
		}
	} else {
		// currently playing video, update timestamp
		room.currentTime += syncDuration;
		sync.videoId = url.parse(room.currentVideo.url, true).query.v;
		sync.timestamp = room.currentTime;
	}

	io.to(room.roomName).emit('sync', time++);
}

server.listen(runningPortNumber);
