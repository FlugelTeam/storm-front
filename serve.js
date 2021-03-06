var express = require('express'),
 	app = express(),
  server = require('http').createServer(app),
  io = require('socket.io')(server),
 	port = 3000;


app.use('/app', express.static(__dirname + '/app'));
app.use('/', express.static(__dirname + '/landing'));
app.use('/img', express.static(__dirname + '/img'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

io.on('connection', function(socket){
  console.log('a user connected');
});

server.listen(port, function(){
	console.log('Listen on Port ' + port);
});
