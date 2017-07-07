// all includes
var express = require('express');
var mysql = require('mysql');
var rand = require('csprng');
var bcrypt = require('bcrypt');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');
// global functions
function mysqlConnect() {
	  connection = mysql.createConnection({
	  host     : 'localhost',
	  user     : 'root',
	  password : '',
	  database : 'minesweeper'
	});
	connection.connect();
}
function updateUsernames(){
	io.sockets.emit('get users', Object.keys(users));
}
function getDateTimeNow(){
	currentdate = new Date(); 
	datetime =  + currentdate.getDate() + "/"
		 		+ (currentdate.getMonth()+1)  + "/" 
		        + currentdate.getFullYear() + " @ "  
		        + currentdate.getHours() + ":"  
		        + currentdate.getMinutes();
}
function onLoadFunctions(){
	chatLogTemp = [];
}
onLoadFunctions();
mysqlConnect();
//test connection
connection.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
  if (err){
  	getDateTimeNow();
	console.log(err);
	console.log(datetime+' Error occured while establishing mysql connection');
	console.log('============================================================');
  }
  getDateTimeNow();
  console.log(datetime+' MYSQL WORKS:  Query solution is: ', rows[0].solution);
  console.log('============================================================');
});
connection.end();
/// server setup
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
users =  {};
connections = [];
server.listen(process.env.PORT || 9000);
console.log('server up...');
app.get('/', function(req, res){
	res.sendFile(__dirname + '/public/index.html');
});

//Include css js
var path = require('path')
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));
app.use(cookieParser);
app.use(session({secret: 'string0any', saveUninitialized: true, resave: true}));

io.sockets.on('connection', function(socket){
	connections.push(socket);
	getDateTimeNow();
	console.log(datetime+' Server Up - connected: %s sockets', connections.length);
	//user disconenct
	socket.on('disconnect', function(data){
		delete users[socket.username];
		updateUsernames();
		connections.splice(connections.indexOf(socket), 1);
		getDateTimeNow();
		console.log(datetime+' Disconencted: %s sockets connected', connections.length);
		console.log('============================================================');
	})
	// check available username, hash password, create new user, send back cookie data
	const saltRounds = 10;
	socket.on('user register', function(data, callback){
		mysqlConnect();
			connection.query('SELECT users.username FROM users where username = "'+data.username+'"', function(err, result){
				if(err){
					getDateTimeNow();
					console.log(err);
					console.log(datetime+' Error occured while signing up new user code 1'+ data.username);
					console.log('============================================================');
				}
				else{
					getDateTimeNow();
					console.log(datetime+" Username registring fail return code: "+result.length);
					console.log('============================================================');
					var usernameExist = result.length
				}
				if(usernameExist > 0){
					callback(usernameExist);
				}
				else if(usernameExist == 0){
					var salt = bcrypt.genSaltSync(10);
					var hash = bcrypt.hashSync(data.password, salt);
					var newUser = {
								username: data.username,
								password: hash,
								salt: salt,
								rank: 1,
								points: 0
							}
					var cookieData = {
						username: data.username,
						userId: null,
						rank: 1,
						points: 0
					}
					mysqlConnect();
					connection.query('INSERT INTO users SET ?', newUser, function(err, result){
			   			if(err){
			   				getDateTimeNow();
							console.log(err);
							console.log(datetime+' Error occured while signing up new user code 2'+ data.username);
							console.log('============================================================');
			   			}
			   			console.log("Successfully registred user with ID: "+result.insertId);
			   			cookieData.userId= result.insertId;
			   			callback(cookieData);
			   		});
				}
			})
  		connection.end();
	});
	//check if user esxisting, check his password, send back login data
	socket.on('user login', function(data, callback){
		if(data.username in users){
			getDateTimeNow();
			console.log(datetime+'User '+data.username+'already logged in');
			console.log('============================================================');
			callback(3);
		}
		var username = data.username;
		var rawPassword = data.password;
		mysqlConnect();
		connection.query('SELECT * FROM users where username="'+username+'"', function(err, result, fields){
			if(err){
				getDateTimeNow();
				console.log(err);
				console.log(datetime+'Login server side error code 1');
				console.log('============================================================');
			}
			else if(result.length > 0){
				var user = {
					username: result[0].username,
					userId: result[0].id,
					rank: result[0].rank,
					points: result[0].points
				}
				bcrypt.compare(rawPassword, result[0].password, function(err, res) {
					if(res){
						getDateTimeNow();						
						console.log(datetime+' '+result[0].username+' Logged in');
						console.log('============================================================');
						socket.username = result[0].username;
						callback(user);
					}else{
						getDateTimeNow();
						console.log(datetime+' Failed login with username '+username);
						console.log('============================================================');
						callback(2);
					}
				});
			}
			else{
				getDateTimeNow();
				console.log(datetime+" username login fail return code: "+result.length);
				console.log('============================================================');
				callback(result.length);
			}
		});
		connection.end();
	});
	// send message
	socket.on('send message', function(data, callback){
		getDateTimeNow();
		if(data.pm == 1){
			var sender = socket.username;
			
			if(data.pmReciver in users){
				users[data.pmReciver].emit('new message', {msg: data.message, user: sender, isPm: 1});
				users[socket.username].emit('new message', {msg: data.message, user: sender, isPm: 1});
				console.log(datetime+' '+socket.username+'-> To '+data.pmReciver+': '+ data.message);
				console.log('============================================================');
				console.log(data.pmReciver);
				callback(true);
			}else{
				callback(false);
			}
		}
		else{
			console.log(datetime+' '+socket.username+'-> To Chat: '+ data.message);
			console.log('============================================================');
			io.sockets.emit('new message', {msg: data.message, user: socket.username, isPm: 0});
		}
		var message = [
			socket.username,
		    data.message
		]
		chatLogTemp.push(message);
		if(chatLogTemp.length > 10){
			mysqlConnect();
			connection.query('INSERT INTO chatlog (username, message) values ?', [chatLogTemp], function(err, res){
				if(err){
					getDateTimeNow();
					console.log(err);
					console.log(datetime+' Error occured while saving chat log');
					console.log('============================================================');
				}
				if(res){
					chatLogTemp = [];
					console.log(datetime+' Chat log saved');
					console.log('============================================================');
				}
			});	
		}	
	});
	// new user
	socket.on('new user', function(data, callback){
		if(data in users){
			callback(false);
		}else{
			callback(true);
			socket.username = data;
			users[socket.username] = socket;
			updateUsernames();
			io.sockets.emit('new message', {msg: 'User '+data+' has Joined ', user: 'System', isPm: 3});
			console.log(users);
		}
	})
});