var socket = io('votetube.cloudapp.net');

socket.on('sync', function(data) {
	sync(data.ts);
});

socket.on('add track', function(track) {
	enqueueTrack(track);
});

// socket.on('message',function(data) {
//   console.log('Received a message from the server',data);
// });

socket.on('connect', function() {
	console.log('Client has connected!');
});

// socket.emit('join room', {roomName: 'main', userName: 'asdf'});
