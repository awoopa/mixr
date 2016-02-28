var socket = io('localhost:1337');

// socket.on('message',function(data) {
//   console.log('Received a message from the server',data);
// });

socket.on('connect', function() {
	console.log('Client has connected!');
});

// socket.emit('join room', {roomName: 'main', userName: 'asdf'});
