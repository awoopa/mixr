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
var syncInterval = 33;

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

function Room() {
	this.roomName;
	this.users = [];
	this.currentTime = 0;
	this.time = 0;
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

			room.intervalObject	= setInterval(updateRoom, syncInterval, room);
		}
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
		track.startTime = room.time + 3000; // start 3 seconds later

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
	io.to(room.roomName).emit('sync', { ts: room.time++ });
}

server.listen(runningPortNumber);
